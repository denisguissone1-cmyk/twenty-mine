// Setup script: creates the "Operacional" custom object (delivery/ops
// tracking for automation projects) with a Kanban board grouped by stage.
//   TWENTY_API_KEY=<key> TWENTY_API_URL=<url> \
//     npx tsx packages/twenty-server/scripts/setup-operacional-object.ts
// Idempotent: skips the object/fields/view/columns that already exist.
//
// Design (confirmed with the user):
//   - stage (SELECT, kanban columns): Descoberto, Desenvolvimento, Teste, Entregue
//   - situacao (SELECT, cross-cutting flag usable at ANY stage): Em andamento,
//     Aguardando cliente — the specifics go in the description
//   - descricao (TEXT): what's missing / what it's waiting on
//   - prazo (DATE)
//   - oportunidade (RELATION -> opportunity): which client/deal this delivery is for

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

type FieldMetadata = {
  id: string;
  name: string;
  type?: string;
  options?: SelectOption[];
};

type View = {
  id: string;
  name: string;
  type: string;
  mainGroupByFieldMetadataId?: string | null;
};

type ViewGroup = { id: string; fieldValue: string; position: number };

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

const STAGE_OPTIONS: SelectOption[] = [
  { position: 0, label: 'Descoberto', value: 'DESCOBERTO', color: 'gray' },
  {
    position: 1,
    label: 'Desenvolvimento',
    value: 'DESENVOLVIMENTO',
    color: 'blue',
  },
  { position: 2, label: 'Teste', value: 'TESTE', color: 'purple' },
  { position: 3, label: 'Entregue', value: 'ENTREGUE', color: 'green' },
];

const SITUACAO_OPTIONS: SelectOption[] = [
  { position: 0, label: 'Em andamento', value: 'EM_ANDAMENTO', color: 'green' },
  {
    position: 1,
    label: 'Aguardando cliente',
    value: 'AGUARDANDO_CLIENTE',
    color: 'orange',
  },
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

  let operacionalObject = objects.find((o) => o.nameSingular === 'entrega');

  if (!operacionalObject) {
    console.log('Creating "Operacional" object...');

    const createdJson = await request('POST', '/rest/metadata/objects', {
      nameSingular: 'entrega',
      namePlural: 'entregas',
      labelSingular: 'Entrega',
      labelPlural: 'Operacional',
      icon: 'IconRocket',
      isLabelSyncedWithName: false,
    });

    operacionalObject = unwrapOne<ObjectMetadata>(createdJson, 'createOneObject');
    console.log(`  created object "Operacional" (id: ${operacionalObject.id})`);
  } else {
    console.log(`"Operacional" object already exists (id: ${operacionalObject.id})`);
  }

  const objectId = operacionalObject.id;
  const objectDetail = unwrapOne<ObjectMetadata>(
    await request('GET', `/rest/metadata/objects/${objectId}`),
    'object',
  );
  const existingFields = objectDetail.fields ?? [];

  console.log('Creating fields on "Operacional"...');

  const stageField = await createFieldIfMissing(objectId, existingFields, {
    type: 'SELECT',
    name: 'stage',
    label: 'Etapa',
    icon: 'IconProgressCheck',
    options: STAGE_OPTIONS,
    defaultValue: `'${STAGE_OPTIONS[0].value}'`,
  });

  await createFieldIfMissing(objectId, existingFields, {
    type: 'SELECT',
    name: 'situacao',
    label: 'Situação',
    icon: 'IconHourglass',
    options: SITUACAO_OPTIONS,
    defaultValue: `'${SITUACAO_OPTIONS[0].value}'`,
  });

  await createFieldIfMissing(objectId, existingFields, {
    type: 'TEXT',
    name: 'descricao',
    label: 'Descrição',
    icon: 'IconFileText',
  });

  await createFieldIfMissing(objectId, existingFields, {
    type: 'DATE',
    name: 'prazo',
    label: 'Prazo',
    icon: 'IconCalendarDue',
  });

  await createFieldIfMissing(objectId, existingFields, {
    type: 'RELATION',
    name: 'oportunidade',
    label: 'Oportunidade',
    isLabelSyncedWithName: false,
    relationCreationPayload: {
      type: 'MANY_TO_ONE',
      targetObjectMetadataId: opportunity.id,
      targetFieldLabel: 'Entregas',
      targetFieldIcon: 'IconRocket',
    },
  });

  // Create a Kanban view grouped by "stage" (+ its columns), otherwise the
  // board renders empty — same reason the Opportunity "By Stage" view needed
  // its view groups seeded.
  console.log('Setting up Kanban view "Por etapa"...');

  const views = unwrapList<View>(
    await request('GET', `/rest/metadata/views?objectMetadataId=${objectId}`),
    'views',
  );
  let kanbanView = views.find(
    (v) => v.type === 'KANBAN' && v.mainGroupByFieldMetadataId === stageField.id,
  );

  if (!kanbanView) {
    kanbanView = unwrapOne<View>(
      await request('POST', '/rest/metadata/views', {
        name: 'Por etapa',
        objectMetadataId: objectId,
        type: 'KANBAN',
        icon: 'IconLayoutKanban',
        mainGroupByFieldMetadataId: stageField.id,
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
    for (const option of STAGE_OPTIONS) {
      await request('POST', '/rest/metadata/viewGroups', {
        viewId: kanbanView.id,
        fieldValue: option.value,
        position: option.position,
        isVisible: true,
      });
    }
    console.log(`  created ${STAGE_OPTIONS.length} Kanban column(s)`);
  } else {
    console.log(`  Kanban columns already exist (${existingGroups.length})`);
  }

  console.log('\nDone. "Operacional" object ready.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
