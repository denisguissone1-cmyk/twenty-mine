// Setup script: creates the "Reuniões marcadas" custom object (scheduled
// meetings tracking) with a Kanban board grouped by status. Later meant to
// be fed by the Calendly integration.
//   TWENTY_API_KEY=<key> TWENTY_API_URL=<url> \
//     npx tsx packages/twenty-server/scripts/setup-reunioes-object.ts
// Idempotent: skips the object/fields/view/columns that already exist.

export {};

type TagColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'sky'
  | 'purple'
  | 'pink'
  | 'gray';

type SelectOption = {
  position: number;
  label: string;
  value: string;
  color: TagColor;
};

type ObjectMetadata = {
  id: string;
  nameSingular: string;
  fields?: FieldMetadata[];
};

type FieldMetadata = { id: string; name: string; type?: string };

type View = {
  id: string;
  type: string;
  mainGroupByFieldMetadataId?: string | null;
};

type ViewGroup = { id: string };

const API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:3000';
const API_KEY = process.env.TWENTY_API_KEY;

if (!API_KEY) {
  console.error('Missing TWENTY_API_KEY environment variable.');
  process.exit(1);
}

const request = async (
  method: 'GET' | 'POST',
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

const unwrapList = <T>(json: unknown, legacyKey: string): T[] => {
  if (Array.isArray(json)) {
    return json as T[];
  }

  const data = (json as { data?: unknown })?.data;

  if (Array.isArray(data)) {
    return data as T[];
  }

  const legacyList = (data as Record<string, unknown> | undefined)?.[legacyKey];

  return Array.isArray(legacyList) ? (legacyList as T[]) : [];
};

const unwrapOne = <T>(json: unknown, legacyKey: string): T => {
  const data = (json as { data?: unknown })?.data;

  if (data && typeof data === 'object' && legacyKey in (data as object)) {
    return (data as Record<string, unknown>)[legacyKey] as T;
  }

  return (data ?? json) as T;
};

const STATUS_OPTIONS: SelectOption[] = [
  { position: 0, label: 'Agendada', value: 'AGENDADA', color: 'blue' },
  { position: 1, label: 'Realizada', value: 'REALIZADA', color: 'green' },
  { position: 2, label: 'Cancelada', value: 'CANCELADA', color: 'red' },
  { position: 3, label: 'No-show', value: 'NO_SHOW', color: 'orange' },
];

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

const main = async () => {
  console.log(`Using Twenty API at ${API_URL}`);

  const objectsJson = await request('GET', '/rest/metadata/objects?limit=1000');
  const objects = unwrapList<ObjectMetadata>(objectsJson, 'objects');

  const opportunity = objects.find((o) => o.nameSingular === 'opportunity');

  if (!opportunity) {
    throw new Error('Standard object "opportunity" not found.');
  }

  let reuniaoObject = objects.find((o) => o.nameSingular === 'reuniao');

  if (!reuniaoObject) {
    console.log('Creating "Reuniões marcadas" object...');

    const createdJson = await request('POST', '/rest/metadata/objects', {
      nameSingular: 'reuniao',
      namePlural: 'reunioes',
      labelSingular: 'Reunião',
      labelPlural: 'Reuniões marcadas',
      icon: 'IconCalendarEvent',
      isLabelSyncedWithName: false,
    });

    reuniaoObject = unwrapOne<ObjectMetadata>(createdJson, 'createOneObject');
    console.log(`  created object "Reuniões marcadas" (id: ${reuniaoObject.id})`);
  } else {
    console.log(`"Reuniões marcadas" object already exists (id: ${reuniaoObject.id})`);
  }

  const objectId = reuniaoObject.id;
  const objectDetail = unwrapOne<ObjectMetadata>(
    await request('GET', `/rest/metadata/objects/${objectId}`),
    'object',
  );
  const existingFields = objectDetail.fields ?? [];

  console.log('Creating fields on "Reuniões marcadas"...');

  await createFieldIfMissing(objectId, existingFields, {
    type: 'DATE_TIME',
    name: 'dataHora',
    label: 'Data e hora',
    icon: 'IconClock',
  });

  const statusField = await createFieldIfMissing(objectId, existingFields, {
    type: 'SELECT',
    name: 'status',
    label: 'Status',
    icon: 'IconStatusChange',
    options: STATUS_OPTIONS,
    defaultValue: `'${STATUS_OPTIONS[0].value}'`,
  });

  // "link" is a reserved field name in Twenty, so use "linkReuniao"
  // internally while showing "Link" as the display label.
  await createFieldIfMissing(objectId, existingFields, {
    type: 'TEXT',
    name: 'linkReuniao',
    label: 'Link',
    icon: 'IconLink',
  });

  await createFieldIfMissing(objectId, existingFields, {
    type: 'RELATION',
    name: 'oportunidade',
    label: 'Oportunidade',
    isLabelSyncedWithName: false,
    relationCreationPayload: {
      type: 'MANY_TO_ONE',
      targetObjectMetadataId: opportunity.id,
      targetFieldLabel: 'Reuniões',
      targetFieldIcon: 'IconCalendarEvent',
    },
  });

  console.log('Setting up Kanban view "Por status"...');

  const views = unwrapList<View>(
    await request('GET', `/rest/metadata/views?objectMetadataId=${objectId}`),
    'views',
  );
  let kanbanView = views.find(
    (v) => v.type === 'KANBAN' && v.mainGroupByFieldMetadataId === statusField.id,
  );

  if (!kanbanView) {
    kanbanView = unwrapOne<View>(
      await request('POST', '/rest/metadata/views', {
        name: 'Por status',
        objectMetadataId: objectId,
        type: 'KANBAN',
        icon: 'IconLayoutKanban',
        mainGroupByFieldMetadataId: statusField.id,
      }),
      'view',
    );
    console.log(`  created Kanban view (id: ${kanbanView.id})`);
  } else {
    console.log(`  Kanban view already exists (id: ${kanbanView.id})`);
  }

  const existingGroups = unwrapList<ViewGroup>(
    await request('GET', `/rest/metadata/viewGroups?viewId=${kanbanView.id}`),
    'viewGroups',
  );

  if (existingGroups.length === 0) {
    for (const option of STATUS_OPTIONS) {
      await request('POST', '/rest/metadata/viewGroups', {
        viewId: kanbanView.id,
        fieldValue: option.value,
        position: option.position,
        isVisible: true,
      });
    }
    console.log(`  created ${STATUS_OPTIONS.length} Kanban column(s)`);
  } else {
    console.log(`  Kanban columns already exist (${existingGroups.length})`);
  }

  console.log('\nDone. "Reuniões marcadas" object ready.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
