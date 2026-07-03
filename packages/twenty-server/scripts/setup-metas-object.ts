// One-time setup script: creates the "Meta" (Goals) custom object and its
// fields in a running Twenty workspace via the metadata REST API.
// Not part of the product build — run manually, once per workspace:
//   TWENTY_API_KEY=<key> npx tsx packages/twenty-server/scripts/setup-metas-object.ts
// Idempotent: safe to re-run, skips anything that already exists.

export {};

type TagColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'gray';

type ObjectMetadata = {
  id: string;
  nameSingular: string;
  fields?: FieldMetadata[];
};

type FieldMetadata = {
  id: string;
  name: string;
  type: string;
  objectMetadataId?: string;
};

type SelectOption = {
  position: number;
  label: string;
  value: string;
  color: TagColor;
};

const API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:3000';
const API_KEY = process.env.TWENTY_API_KEY;

if (!API_KEY) {
  console.error('Missing TWENTY_API_KEY environment variable.');
  console.error(
    'Generate one in the Twenty UI: Settings -> APIs & Webhooks -> create a key.',
  );
  process.exit(1);
}

const request = async (
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<unknown> => {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();

    throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
  }

  return response.json();
};

// The navigation-menu-item metadata isn't exposed over REST — only GraphQL,
// at a dedicated metadata endpoint (separate from the main /graphql API).
const graphqlRequest = async <T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(`${API_URL}/metadata`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();

    throw new Error(`POST /metadata failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as {
    data?: T;
    errors?: unknown;
  };

  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  return json.data as T;
};

// Twenty's metadata REST responses can be wrapped in a "legacy" envelope
// (e.g. `{ data: { objects: [...] } }`, `{ data: { createOneObject: {...} } }`)
// or the flat modern shape (`{ data: [...] }`, `{ ...object }`), depending on
// a per-workspace feature flag. These helpers normalize both.
const unwrapList = (json: unknown, legacyKey: string): ObjectMetadata[] => {
  const data = (json as { data?: unknown })?.data;

  if (Array.isArray(data)) {
    return data as ObjectMetadata[];
  }

  const legacyList = (data as Record<string, unknown> | undefined)?.[legacyKey];

  return Array.isArray(legacyList) ? (legacyList as ObjectMetadata[]) : [];
};

const unwrapOne = <T>(json: unknown, legacyKey: string): T => {
  const data = (json as { data?: unknown })?.data;

  if (data && typeof data === 'object' && legacyKey in (data as object)) {
    return (data as Record<string, unknown>)[legacyKey] as T;
  }

  return (data ?? json) as T;
};

const STATUS_OPTIONS: SelectOption[] = [
  { position: 0, label: 'Não iniciada', value: 'NOT_STARTED', color: 'gray' },
  { position: 1, label: 'Em andamento', value: 'IN_PROGRESS', color: 'blue' },
  { position: 2, label: 'Em risco', value: 'AT_RISK', color: 'red' },
  { position: 3, label: 'Concluída', value: 'DONE', color: 'green' },
];

const findObjectByNameSingular = (
  objects: ObjectMetadata[],
  nameSingular: string,
): ObjectMetadata | undefined =>
  objects.find((object) => object.nameSingular === nameSingular);

const fetchAllFieldsForObject = async (
  objectMetadataId: string,
): Promise<FieldMetadata[]> => {
  const json = await request('GET', '/rest/metadata/fields?limit=1000');
  const allFields = unwrapList(json, 'fields') as unknown as FieldMetadata[];

  return allFields.filter(
    (field) => field.objectMetadataId === objectMetadataId,
  );
};

const createFieldIfMissing = async (
  objectMetadataId: string,
  existingFields: FieldMetadata[],
  input: Record<string, unknown>,
): Promise<FieldMetadata> => {
  const name = input.name as string;
  const existing = existingFields.find((field) => field.name === name);

  if (existing) {
    console.log(`  field "${name}" already exists, skipping`);

    return existing;
  }

  const json = await request('POST', '/rest/metadata/fields', {
    objectMetadataId,
    ...input,
  });
  const created = unwrapOne<FieldMetadata>(json, 'createOneField');

  console.log(`  created field "${created.name}" (${created.type})`);
  existingFields.push(created);

  return created;
};

// Twenty's metadata API has no in-place field-type migration (you cannot
// PATCH `type`) — the only way to change a field's type is to delete it and
// recreate it. Deleting a field metadata entry does a real `DROP COLUMN
// CASCADE` on the workspace table: this PERMANENTLY ERASES that field's
// value on every existing record, with no soft-delete/recovery. Only call
// this when you've accepted that data loss (e.g. re-modeling `cycle` from a
// fixed SELECT list to free-text).
const deleteFieldIfWrongType = async (
  existingFields: FieldMetadata[],
  name: string,
  expectedType: string,
): Promise<void> => {
  const index = existingFields.findIndex((field) => field.name === name);

  if (index === -1) {
    return;
  }

  const existing = existingFields[index];

  if (existing.type === expectedType) {
    return;
  }

  console.log(
    `  field "${name}" is ${existing.type}, migrating to ${expectedType} — ` +
      `this DROPS the "${name}" column, permanently erasing its value on every existing record`,
  );
  await request('DELETE', `/rest/metadata/fields/${existing.id}`);
  existingFields.splice(index, 1);
};

type NavigationMenuItem = {
  id: string;
  type: string;
  link: string | null;
  targetObjectMetadataId: string | null;
};

// Creating a custom object auto-adds a workspace-wide sidebar entry pointing
// at its generic /objects/:namePlural table view — for `meta` that entry is
// literally also labeled "Metas", colliding with our own /metas page link.
// This removes those auto-generated entries.
//
// NOTE: a NavigationMenuItem of type LINK can't hold an in-app route — Twenty
// treats LINK entries as external and force-prepends "https://" to any value
// that doesn't already start with "http(s)://" (see twenty-front's
// getLinkNavigationMenuItemComputedLink.ts), which turns "/metas" into the
// broken "https:///metas". The real "Metas" sidebar entry is instead a plain
// NavigationDrawerItem hardcoded into MainNavigationDrawerScrollableItems.tsx
// (proper in-app SPA navigation, no external-link icon/new tab). This
// function also deletes any broken LINK item a previous run of this script
// may have created before that was understood.
const fixNavigationMenu = async (
  metaObjectId: string,
  metaProgressUpdateObjectId: string,
): Promise<void> => {
  console.log('\nFixing sidebar navigation...');

  const { navigationMenuItems } = await graphqlRequest<{
    navigationMenuItems: NavigationMenuItem[];
  }>(`
    query {
      navigationMenuItems {
        id
        type
        link
        targetObjectMetadataId
      }
    }
  `);

  const idsToDelete = navigationMenuItems
    .filter(
      (item) =>
        (item.type === 'OBJECT' &&
          (item.targetObjectMetadataId === metaObjectId ||
            item.targetObjectMetadataId === metaProgressUpdateObjectId)) ||
        (item.type === 'LINK' && item.link === '/metas'),
    )
    .map((item) => item.id);

  if (idsToDelete.length > 0) {
    await graphqlRequest(
      `mutation($ids: [UUID!]!) {
        deleteManyNavigationMenuItems(ids: $ids) { id }
      }`,
      { ids: idsToDelete },
    );
    console.log(
      `  removed ${idsToDelete.length} nav entr${idsToDelete.length > 1 ? 'ies' : 'y'} ` +
        `(auto-generated meta/metaProgressUpdate table views, and/or a broken "/metas" link from a previous run)`,
    );
  } else {
    console.log('  no auto-generated or broken nav entries to remove');
  }
};

const main = async () => {
  console.log(`Using Twenty API at ${API_URL}`);

  const objectsJson = await request('GET', '/rest/metadata/objects?limit=1000');
  const objects = unwrapList(objectsJson, 'objects');

  const workspaceMember = findObjectByNameSingular(objects, 'workspaceMember');
  const company = findObjectByNameSingular(objects, 'company');
  const opportunity = findObjectByNameSingular(objects, 'opportunity');

  if (!workspaceMember || !company || !opportunity) {
    throw new Error(
      'Expected standard objects (workspaceMember, company, opportunity) not found. Is the workspace fully initialized?',
    );
  }

  let metaObject = findObjectByNameSingular(objects, 'meta');

  if (!metaObject) {
    console.log('Creating "meta" object...');

    const createdJson = await request('POST', '/rest/metadata/objects', {
      nameSingular: 'meta',
      namePlural: 'metas',
      labelSingular: 'Meta',
      labelPlural: 'Metas',
      icon: 'IconTarget',
    });

    metaObject = unwrapOne<ObjectMetadata>(createdJson, 'createOneObject');
    console.log(`  created object "meta" (id: ${metaObject.id})`);
  } else {
    console.log(`"meta" object already exists (id: ${metaObject.id})`);
  }

  const metaObjectId = metaObject.id;

  const existingFields =
    metaObject.fields ?? (await fetchAllFieldsForObject(metaObjectId));

  console.log('Creating fields on "meta"...');

  await createFieldIfMissing(metaObjectId, existingFields, {
    type: 'TEXT',
    name: 'name',
    label: 'Name',
  });

  // `cycle` moved from a fixed SELECT list to free-text (e.g. "BIMESTER_2026_3",
  // parsed/labeled client-side — see twenty-front's types/MetaPeriod.ts) so any
  // year works without ever touching this script again. Existing SELECT values
  // are lost on migration — see deleteFieldIfWrongType's doc comment.
  await deleteFieldIfWrongType(existingFields, 'cycle', 'TEXT');
  await createFieldIfMissing(metaObjectId, existingFields, {
    type: 'TEXT',
    name: 'cycle',
    label: 'Período',
  });

  await createFieldIfMissing(metaObjectId, existingFields, {
    type: 'NUMBER',
    name: 'progress',
    label: 'Progress',
    defaultValue: 0,
  });

  await createFieldIfMissing(metaObjectId, existingFields, {
    type: 'SELECT',
    name: 'status',
    label: 'Status',
    options: STATUS_OPTIONS,
    defaultValue: `'${STATUS_OPTIONS[0].value}'`,
  });

  const parentMetaField = await createFieldIfMissing(
    metaObjectId,
    existingFields,
    {
      type: 'RELATION',
      name: 'parentMeta',
      label: 'Meta Pai',
      isLabelSyncedWithName: false,
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: metaObjectId,
        targetFieldLabel: 'Sub-metas',
        targetFieldIcon: 'IconSubtask',
      },
    },
  );

  await createFieldIfMissing(metaObjectId, existingFields, {
    type: 'RELATION',
    name: 'owner',
    label: 'Responsável',
    isLabelSyncedWithName: false,
    relationCreationPayload: {
      type: 'MANY_TO_ONE',
      targetObjectMetadataId: workspaceMember.id,
      targetFieldLabel: 'Metas',
      targetFieldIcon: 'IconTarget',
    },
  });

  await createFieldIfMissing(metaObjectId, existingFields, {
    type: 'RELATION',
    name: 'company',
    label: 'Empresa',
    isLabelSyncedWithName: false,
    relationCreationPayload: {
      type: 'MANY_TO_ONE',
      targetObjectMetadataId: company.id,
      targetFieldLabel: 'Metas',
      targetFieldIcon: 'IconTarget',
    },
  });

  await createFieldIfMissing(metaObjectId, existingFields, {
    type: 'RELATION',
    name: 'opportunity',
    label: 'Oportunidade',
    isLabelSyncedWithName: false,
    relationCreationPayload: {
      type: 'MANY_TO_ONE',
      targetObjectMetadataId: opportunity.id,
      targetFieldLabel: 'Metas',
      targetFieldIcon: 'IconTarget',
    },
  });

  // Plain TEXT renders multi-line (there is no LONG_TEXT metadata type).
  await createFieldIfMissing(metaObjectId, existingFields, {
    type: 'TEXT',
    name: 'description',
    label: 'Descrição',
  });

  await createFieldIfMissing(metaObjectId, existingFields, {
    type: 'DATE',
    name: 'dueDate',
    label: 'Data de conclusão',
  });

  // Progress history: a separate object, one record per "Atualizar o progresso"
  // entry (value + date), linked back to the meta. Powers the drawer's chart.
  let metaProgressUpdateObject = findObjectByNameSingular(
    objects,
    'metaProgressUpdate',
  );

  if (!metaProgressUpdateObject) {
    console.log('Creating "metaProgressUpdate" object...');

    const createdJson = await request('POST', '/rest/metadata/objects', {
      nameSingular: 'metaProgressUpdate',
      namePlural: 'metaProgressUpdates',
      labelSingular: 'Atualização de progresso',
      labelPlural: 'Atualizações de progresso',
      icon: 'IconChartLine',
    });

    metaProgressUpdateObject = unwrapOne<ObjectMetadata>(
      createdJson,
      'createOneObject',
    );
    console.log(
      `  created object "metaProgressUpdate" (id: ${metaProgressUpdateObject.id})`,
    );
  } else {
    console.log(
      `"metaProgressUpdate" object already exists (id: ${metaProgressUpdateObject.id})`,
    );
  }

  const metaProgressUpdateObjectId = metaProgressUpdateObject.id;
  const progressUpdateFields =
    metaProgressUpdateObject.fields ??
    (await fetchAllFieldsForObject(metaProgressUpdateObjectId));

  console.log('Creating fields on "metaProgressUpdate"...');

  await createFieldIfMissing(metaProgressUpdateObjectId, progressUpdateFields, {
    type: 'NUMBER',
    name: 'value',
    label: 'Valor',
    defaultValue: 0,
  });

  await createFieldIfMissing(metaProgressUpdateObjectId, progressUpdateFields, {
    type: 'DATE',
    name: 'date',
    label: 'Data',
  });

  const progressUpdateMetaField = await createFieldIfMissing(
    metaProgressUpdateObjectId,
    progressUpdateFields,
    {
      type: 'RELATION',
      name: 'meta',
      label: 'Meta',
      isLabelSyncedWithName: false,
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: metaObjectId,
        targetFieldLabel: 'Atualizações de progresso',
        targetFieldIcon: 'IconChartLine',
      },
    },
  );

  const finalFields = await fetchAllFieldsForObject(metaObjectId);
  const finalProgressUpdateFields = await fetchAllFieldsForObject(
    metaProgressUpdateObjectId,
  );

  console.log('\nDone. "meta" object summary:');
  console.log(`  objectMetadataId: ${metaObjectId}`);
  console.log('  fields:');

  for (const field of finalFields) {
    console.log(`    ${field.name} (${field.type}) [id: ${field.id}]`);
  }

  console.log('\n"metaProgressUpdate" object summary:');
  console.log(`  objectMetadataId: ${metaProgressUpdateObjectId}`);
  console.log('  fields:');

  for (const field of finalProgressUpdateFields) {
    console.log(`    ${field.name} (${field.type}) [id: ${field.id}]`);
  }

  console.log(
    `\nSelf-relation created via field "${parentMetaField.name}" — check the reverse "Sub-metas" field name above before wiring the frontend.`,
  );
  console.log(
    `Progress-history relation created via field "${progressUpdateMetaField.name}" on metaProgressUpdate — the frontend history query filters on the "metaId" FK.`,
  );

  await fixNavigationMenu(metaObjectId, metaProgressUpdateObjectId);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
