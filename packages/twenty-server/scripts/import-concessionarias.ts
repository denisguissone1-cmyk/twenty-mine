// Configures the Opportunity "By Stage" board for dealership prospecting and
// imports one card per CSV row, preserving every source column.
//
// TWENTY_API_KEY=<key> TWENTY_API_URL=<url> \
//   CONCESSIONARIAS_CSV=concessionarias_sp.csv \
//   npx tsx packages/twenty-server/scripts/import-concessionarias.ts

export {};

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

type FieldMetadata = {
  id: string;
  name: string;
  options?: SelectOption[];
};

type ObjectMetadata = {
  id: string;
  nameSingular: string;
  fields?: FieldMetadata[];
};

type View = {
  id: string;
  name: string;
  mainGroupByFieldMetadataId?: string | null;
};

type ViewGroup = {
  id: string;
  fieldValue: string;
  position: number;
};

type ApiResult = {
  ok: boolean;
  status: number;
  json: unknown;
  text?: string;
};

const API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:3000';
const API_KEY = process.env.TWENTY_API_KEY;
const CSV_FILE = process.env.CONCESSIONARIAS_CSV;
const BATCH_SIZE = 200;

if (!API_KEY || !CSV_FILE) {
  console.error(
    'TWENTY_API_KEY and CONCESSIONARIAS_CSV environment variables are required.',
  );
  process.exit(1);
}

const request = async (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<ApiResult> => {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      json: null,
      text: await response.text(),
    };
  }

  return { ok: true, status: response.status, json: await response.json() };
};

const requireOk = (result: ApiResult, operation: string): unknown => {
  if (!result.ok) {
    throw new Error(`${operation} failed (${result.status}): ${result.text}`);
  }

  return result.json;
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

  if (data && typeof data === 'object' && legacyKey in data) {
    return (data as Record<string, unknown>)[legacyKey] as T;
  }

  return (data ?? json) as T;
};

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (character !== '\r') {
      field += character;
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some(Boolean));
};

const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

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

const TEXT_FIELDS = [
  ['cnpj', 'CNPJ', 'IconId'],
  ['razaoSocial', 'Razão Social', 'IconBuilding'],
  ['nomeFantasia', 'Nome Fantasia', 'IconBuildingStore'],
  ['segmento', 'Segmento', 'IconCar'],
  ['naturezaJuridica', 'Natureza Jurídica', 'IconScale'],
  ['matrizFilial', 'Matriz/Filial', 'IconHierarchy'],
  ['capitalSocial', 'Capital Social', 'IconCash'],
  ['dataAbertura', 'Data de Abertura', 'IconCalendar'],
  ['logradouro', 'Logradouro', 'IconMapPin'],
  ['numeroEndereco', 'Número', 'IconMapPin'],
  ['bairro', 'Bairro', 'IconMapPin'],
  ['cep', 'CEP', 'IconMapPin'],
  ['telefone', 'Telefone 1', 'IconPhone'],
  ['telefone2', 'Telefone 2', 'IconPhone'],
  ['email', 'E-mail', 'IconMail'],
  ['quantidadeSocios', 'Qtd. Sócios', 'IconUsers'],
  ['socios', 'Sócios', 'IconUsersGroup'],
] as const;

const createFieldIfMissing = async (
  objectMetadataId: string,
  fields: FieldMetadata[],
  input: Record<string, unknown>,
): Promise<FieldMetadata> => {
  const name = input.name as string;
  const existing = fields.find((field) => field.name === name);

  if (existing) {
    return existing;
  }

  const json = requireOk(
    await request('POST', '/rest/metadata/fields', {
      objectMetadataId,
      ...input,
    }),
    `Creating field ${name}`,
  );
  const created = unwrapOne<FieldMetadata>(json, 'createOneField');

  fields.push(created);
  console.log(`  created field ${name}`);

  return created;
};

const main = async () => {
  console.log(`Using Twenty API at ${API_URL}`);
  const csvPath = resolve(process.cwd(), CSV_FILE);
  const parsedRows = parseCsv(
    readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, ''),
  );
  const headers = parsedRows[0];
  const rows = parsedRows.slice(1);
  const column = (name: string): number => {
    const index = headers.indexOf(name);

    if (index < 0) {
      throw new Error(`CSV column not found: ${name}`);
    }

    return index;
  };
  const indexes = {
    cnpj: column('CNPJ'),
    razaoSocial: column('Razão Social'),
    nomeFantasia: column('Nome Fantasia'),
    segmento: column('Segmento'),
    naturezaJuridica: column('Natureza Jurídica'),
    matrizFilial: column('Matriz/Filial'),
    porte: column('Porte'),
    capitalSocial: column('Capital Social'),
    dataAbertura: column('Data Abertura'),
    logradouro: column('Logradouro'),
    numeroEndereco: column('Número'),
    bairro: column('Bairro'),
    cep: column('CEP'),
    telefone: column('Telefone 1'),
    telefone2: column('Telefone 2'),
    email: column('E-mail'),
    quantidadeSocios: column('Qtd Sócios'),
    socios: column('Sócios'),
  };

  console.log(`Parsed ${rows.length} dealership rows from ${csvPath}`);

  const objects = unwrapList<ObjectMetadata>(
    requireOk(
      await request('GET', '/rest/metadata/objects?limit=1000'),
      'Loading objects',
    ),
    'objects',
  );
  const opportunityObject = objects.find(
    (object) => object.nameSingular === 'opportunity',
  );

  if (!opportunityObject) {
    throw new Error('Opportunity object not found.');
  }

  const objectDetail = unwrapOne<ObjectMetadata>(
    requireOk(
      await request('GET', `/rest/metadata/objects/${opportunityObject.id}`),
      'Loading Opportunity metadata',
    ),
    'object',
  );
  const fields = objectDetail.fields ?? [];
  const stageField = fields.find((field) => field.name === 'stage');

  if (!stageField) {
    throw new Error('Opportunity stage field not found.');
  }

  await request('PATCH', `/rest/metadata/fields/${stageField.id}`, {
    options: STAGE_OPTIONS,
    defaultValue: "'ENTRADA'",
  }).then((result) => requireOk(result, 'Updating stage options'));

  for (const [name, label, icon] of TEXT_FIELDS) {
    await createFieldIfMissing(opportunityObject.id, fields, {
      type: 'TEXT',
      name,
      label,
      icon,
    });
  }

  const porteLabels = Array.from(
    new Set(rows.map((row) => row[indexes.porte].trim()).filter(Boolean)),
  ).sort();
  const porteOptions = porteLabels.map<SelectOption>((label, position) => ({
    position,
    label,
    value: slugify(label),
    color: ['blue', 'green', 'orange', 'purple', 'sky'][
      position % 5
    ] as TagColor,
  }));
  const porteField = await createFieldIfMissing(opportunityObject.id, fields, {
    type: 'SELECT',
    name: 'porte',
    label: 'Porte',
    icon: 'IconBuildingStore',
    options: porteOptions,
    defaultValue: porteOptions[0] ? `'${porteOptions[0].value}'` : undefined,
  });
  const mergedPorteOptions = [...(porteField.options ?? [])];

  for (const option of porteOptions) {
    if (
      !mergedPorteOptions.some((existing) => existing.value === option.value)
    ) {
      mergedPorteOptions.push({
        ...option,
        position: mergedPorteOptions.length,
      });
    }
  }

  if (mergedPorteOptions.length !== (porteField.options ?? []).length) {
    requireOk(
      await request('PATCH', `/rest/metadata/fields/${porteField.id}`, {
        options: mergedPorteOptions,
      }),
      'Updating Porte options',
    );
  }

  const views = unwrapList<View>(
    requireOk(
      await request(
        'GET',
        `/rest/metadata/views?objectMetadataId=${opportunityObject.id}`,
      ),
      'Loading views',
    ),
    'views',
  );
  const stageViews = views.filter(
    (view) => view.mainGroupByFieldMetadataId === stageField.id,
  );

  if (stageViews.length === 0) {
    throw new Error('No Opportunity view grouped by stage was found.');
  }

  for (const view of stageViews) {
    const groups = unwrapList<ViewGroup>(
      requireOk(
        await request('GET', `/rest/metadata/viewGroups?viewId=${view.id}`),
        `Loading columns for ${view.name}`,
      ),
      'viewGroups',
    );

    for (const group of groups) {
      requireOk(
        await request('DELETE', `/rest/metadata/viewGroups/${group.id}`),
        `Deleting stale column ${group.fieldValue}`,
      );
    }

    for (const option of STAGE_OPTIONS) {
      requireOk(
        await request('POST', '/rest/metadata/viewGroups', {
          viewId: view.id,
          fieldValue: option.value,
          position: option.position,
          isVisible: true,
        }),
        `Creating column ${option.label}`,
      );
    }
    console.log(`Configured ${STAGE_OPTIONS.length} columns in "${view.name}"`);
  }

  const value = (row: string[], index: number): string | null =>
    row[index]?.trim() || null;
  const payloads = rows.map((row) => ({
    name:
      value(row, indexes.nomeFantasia) ??
      value(row, indexes.razaoSocial) ??
      value(row, indexes.cnpj) ??
      'Concessionária sem nome',
    stage: 'ENTRADA',
    cnpj: value(row, indexes.cnpj),
    razaoSocial: value(row, indexes.razaoSocial),
    nomeFantasia: value(row, indexes.nomeFantasia),
    segmento: value(row, indexes.segmento),
    naturezaJuridica: value(row, indexes.naturezaJuridica),
    matrizFilial: value(row, indexes.matrizFilial),
    porte: value(row, indexes.porte)
      ? slugify(value(row, indexes.porte) as string)
      : null,
    capitalSocial: value(row, indexes.capitalSocial),
    dataAbertura: value(row, indexes.dataAbertura),
    logradouro: value(row, indexes.logradouro),
    numeroEndereco: value(row, indexes.numeroEndereco),
    bairro: value(row, indexes.bairro),
    cep: value(row, indexes.cep),
    telefone: value(row, indexes.telefone),
    telefone2: value(row, indexes.telefone2),
    email: value(row, indexes.email),
    quantidadeSocios: value(row, indexes.quantidadeSocios),
    socios: value(row, indexes.socios),
  }));

  let created = 0;

  for (let index = 0; index < payloads.length; index += BATCH_SIZE) {
    const batch = payloads.slice(index, index + BATCH_SIZE);
    requireOk(
      await request('POST', '/rest/batch/opportunities', batch),
      `Importing batch ${index / BATCH_SIZE + 1}`,
    );
    created += batch.length;
    console.log(`Imported ${created}/${payloads.length} cards`);
  }

  console.log(`Done. Imported ${created} dealership cards into Entrada.`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
