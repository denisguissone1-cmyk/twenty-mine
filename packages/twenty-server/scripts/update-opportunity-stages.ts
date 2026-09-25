// One-time setup script: replaces the default Opportunity pipeline stages
// (New, Screening, Meeting, Proposal, Customer) with a funnel tailored for a
// long-cycle, high-ticket B2B/services sales motion.
//   TWENTY_API_KEY=<key> npx tsx packages/twenty-server/scripts/update-opportunity-stages.ts
// Idempotent: skips the update if the options already match.

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
  objectMetadataId?: string;
  options?: SelectOption[];
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
  method: 'GET' | 'POST' | 'PATCH',
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
  const data = (json as { data?: unknown })?.data;

  if (Array.isArray(data)) {
    return data as T[];
  }

  const legacyList = (data as Record<string, unknown> | undefined)?.[
    legacyKey
  ];

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
  { position: 0, label: 'Entrada', value: 'ENTRADA', color: 'gray' },
  {
    position: 1,
    label: 'Contato iniciado',
    value: 'CONTATO_INICIADO',
    color: 'blue',
  },
  {
    position: 2,
    label: 'Diagnóstico / Qualificação',
    value: 'QUALIFICACAO',
    color: 'sky',
  },
  {
    position: 3,
    label: 'Reunião marcada',
    value: 'REUNIAO_MARCADA',
    color: 'purple',
  },
  {
    position: 4,
    label: 'Proposta enviada',
    value: 'PROPOSTA_ENVIADA',
    color: 'orange',
  },
  {
    position: 5,
    label: 'Negociação / Aguardando resposta',
    value: 'NEGOCIACAO',
    color: 'yellow',
  },
  { position: 6, label: 'Fechado — Ganho', value: 'GANHO', color: 'green' },
  { position: 7, label: 'Fechado — Perdido', value: 'PERDIDO', color: 'red' },
];

const optionsMatch = (
  existing: SelectOption[] | undefined,
  target: SelectOption[],
): boolean => {
  if (!existing || existing.length !== target.length) {
    return false;
  }

  return target.every(
    (option, index) =>
      existing[index]?.value === option.value &&
      existing[index]?.label === option.label,
  );
};

const main = async () => {
  console.log(`Using Twenty API at ${API_URL}`);

  const objectsJson = await request('GET', '/rest/metadata/objects?limit=1000');
  const objects = unwrapList<ObjectMetadata>(objectsJson, 'objects');
  const opportunityObject = objects.find(
    (object) => object.nameSingular === 'opportunity',
  );

  if (!opportunityObject) {
    throw new Error('Could not find the "opportunity" standard object.');
  }

  // GET /rest/metadata/fields has no working `filter` query param (it's
  // silently ignored — it only paginates via a cursor over EVERY field in
  // the workspace, which can be in the thousands). GET on a single object
  // by id returns that object's fields already scoped server-side, so use
  // that instead of trying to filter the flat fields list.
  const objectDetailJson = await request(
    'GET',
    `/rest/metadata/objects/${opportunityObject.id}`,
  );
  const objectDetail = unwrapOne<ObjectMetadata>(objectDetailJson, 'object');
  const opportunityFields = objectDetail.fields ?? [];
  const stageField = opportunityFields.find((field) => field.name === 'stage');

  if (!stageField) {
    console.error(
      `Fields found on Opportunity: ${opportunityFields.map((f) => f.name).join(', ') || '(none returned)'}`,
    );
    throw new Error('Could not find the "stage" field on Opportunity.');
  }

  if (optionsMatch(stageField.options, STAGE_OPTIONS)) {
    console.log('Opportunity stages already match the target funnel, skipping.');

    return;
  }

  await request('PATCH', `/rest/metadata/fields/${stageField.id}`, {
    options: STAGE_OPTIONS,
    defaultValue: `'${STAGE_OPTIONS[0].value}'`,
  });

  console.log('Updated Opportunity "stage" options to:');
  STAGE_OPTIONS.forEach((option) =>
    console.log(`  ${option.position}. ${option.label} (${option.value})`),
  );
  console.log(
    '\nNote: any existing Opportunity records keeping an old stage value ' +
      '(NEW/SCREENING/MEETING/PROPOSAL/CUSTOMER) will need to be manually ' +
      "re-assigned to one of the new stages — Twenty doesn't auto-migrate " +
      'record values when SELECT options change.',
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
