// One-time script: renames the display labels of the main standard objects
// to Portuguese, keeping each object's internal name (nameSingular, used by
// the API/code) untouched by setting isLabelSyncedWithName=false.
//   TWENTY_API_KEY=<key> npx tsx packages/twenty-server/scripts/rename-objects-portuguese.ts
// Idempotent: skips any object whose labels already match the target.

export {};

type ObjectMetadata = {
  id: string;
  nameSingular: string;
  labelSingular: string;
  labelPlural: string;
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
  method: 'GET' | 'PATCH',
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

  const legacyList = (data as Record<string, unknown> | undefined)?.[legacyKey];

  return Array.isArray(legacyList) ? (legacyList as T[]) : [];
};

// nameSingular -> { labelSingular, labelPlural }
const RENAMES: Record<string, { singular: string; plural: string }> = {
  company: { singular: 'Empresa', plural: 'Empresas' },
  opportunity: { singular: 'Oportunidade', plural: 'Oportunidades' },
  task: { singular: 'Tarefa', plural: 'Tarefas' },
  note: { singular: 'Nota', plural: 'Notas' },
  person: { singular: 'Lead', plural: 'Leads' },
  workflow: { singular: 'Fluxo de trabalho', plural: 'Fluxos de trabalho' },
};

const main = async () => {
  console.log(`Using Twenty API at ${API_URL}`);

  const objectsJson = await request('GET', '/rest/metadata/objects?limit=1000');
  const objects = unwrapList<ObjectMetadata>(objectsJson, 'objects');

  for (const [nameSingular, target] of Object.entries(RENAMES)) {
    const object = objects.find((o) => o.nameSingular === nameSingular);

    if (!object) {
      console.log(`  "${nameSingular}" not found, skipping`);
      continue;
    }

    if (
      object.labelSingular === target.singular &&
      object.labelPlural === target.plural
    ) {
      console.log(`  "${nameSingular}" already labeled "${target.plural}", skipping`);
      continue;
    }

    // For standard objects, label and name are already decoupled by the
    // system (nameSingular is fixed English); sending isLabelSyncedWithName
    // is rejected ("Cannot edit standard object metadata properties"), so we
    // only send the display labels.
    await request('PATCH', `/rest/metadata/objects/${object.id}`, {
      labelSingular: target.singular,
      labelPlural: target.plural,
    });

    console.log(
      `  renamed "${nameSingular}": "${object.labelPlural}" -> "${target.plural}"`,
    );
  }

  console.log('\nDone.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
