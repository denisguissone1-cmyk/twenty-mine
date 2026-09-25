// Follow-up fix for update-opportunity-stages.ts: that script only updated
// the "stage" FIELD's SELECT options. Twenty's Kanban board columns are a
// SEPARATE metadata entity (ViewGroup, one per visible column) that isn't
// auto-migrated when a field's options change — so the board rendered
// empty even though records existed, because its columns still referenced
// the old stage values (NEW/SCREENING/MEETING/PROPOSAL/CUSTOMER).
//   TWENTY_API_KEY=<key> npx tsx packages/twenty-server/scripts/fix-opportunity-view-groups.ts
// Idempotent: skips any view whose groups already match the target stages.

export {};

type ViewGroup = { id: string; fieldValue: string; position: number; viewId: string };
type View = {
  id: string;
  name: string;
  mainGroupByFieldMetadataId?: string | null;
  viewGroups?: ViewGroup[];
};
type ObjectMetadata = { id: string; nameSingular: string; fields?: FieldMetadata[] };
type FieldMetadata = { id: string; name: string };

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

const unwrapList = <T>(json: unknown, legacyKey: string): T[] => {
  // The views/viewGroups REST endpoints return a bare JSON array (no `data`
  // envelope at all), unlike objects/fields which always wrap in `{data}`.
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

// Must match the STAGE_OPTIONS values/positions from update-opportunity-stages.ts
const STAGE_VALUES_IN_ORDER = [
  'ENTRADA',
  'CONTATO_INICIADO',
  'QUALIFICACAO',
  'REUNIAO_MARCADA',
  'PROPOSTA_ENVIADA',
  'NEGOCIACAO',
  'GANHO',
  'PERDIDO',
];

const main = async () => {
  console.log(`Using Twenty API at ${API_URL}`);

  const objectsJson = await request('GET', '/rest/metadata/objects?limit=1000');
  const objects = unwrapList<ObjectMetadata>(objectsJson, 'objects');
  const opportunityObject = objects.find((o) => o.nameSingular === 'opportunity');

  if (!opportunityObject) {
    throw new Error('Could not find the "opportunity" standard object.');
  }

  const objectDetailJson = await request(
    'GET',
    `/rest/metadata/objects/${opportunityObject.id}`,
  );
  const stageField = (
    unwrapOne<ObjectMetadata>(objectDetailJson, 'object').fields ?? []
  ).find((f) => f.name === 'stage');

  if (!stageField) {
    throw new Error('Could not find the "stage" field on Opportunity.');
  }

  const viewsJson = await request(
    'GET',
    `/rest/metadata/views?objectMetadataId=${opportunityObject.id}`,
  );
  const views = unwrapList<View>(viewsJson, 'views');
  const stageGroupedViews = views.filter(
    (v) => v.mainGroupByFieldMetadataId === stageField.id,
  );

  if (stageGroupedViews.length === 0) {
    console.log(
      'No view groups by the "stage" field (no Kanban/By Stage view found) — nothing to fix.',
    );

    return;
  }

  for (const view of stageGroupedViews) {
    console.log(`\nView "${view.name}" (${view.id}):`);

    const groupsJson = await request(
      'GET',
      `/rest/metadata/viewGroups?viewId=${view.id}`,
    );
    const existingGroups = unwrapList<ViewGroup>(groupsJson, 'viewGroups');

    const alreadyCorrect =
      existingGroups.length === STAGE_VALUES_IN_ORDER.length &&
      STAGE_VALUES_IN_ORDER.every((value, i) =>
        existingGroups.some((g) => g.fieldValue === value && g.position === i),
      );

    if (alreadyCorrect) {
      console.log('  columns already match the target stages, skipping');
      continue;
    }

    console.log(`  deleting ${existingGroups.length} stale column(s)...`);
    for (const group of existingGroups) {
      await request('DELETE', `/rest/metadata/viewGroups/${group.id}`);
    }

    console.log(`  creating ${STAGE_VALUES_IN_ORDER.length} column(s)...`);
    for (const [position, fieldValue] of STAGE_VALUES_IN_ORDER.entries()) {
      await request('POST', '/rest/metadata/viewGroups', {
        viewId: view.id,
        fieldValue,
        position,
        isVisible: true,
      });
    }

    console.log('  done');
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
