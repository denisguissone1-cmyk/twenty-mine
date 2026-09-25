// One-time import script: reads a CNPJ-registry CSV export of law firms/
// lawyers and creates one Opportunity per row, already in the "Entrada"
// stage, tagged "Advocacia". The CSV file is chosen via the LEADS_CSV env
// var (relative to repo root), defaulting to leads_advocacia_brasilia.csv.
//   TWENTY_API_KEY=<key> LEADS_CSV=leads_advocacia_sao_paulo.csv \
//     npx tsx packages/twenty-server/scripts/import-advocacia-leads.ts
// Not idempotent per-record (no CNPJ dedupe against existing Opportunities)
// — guarded by a coarse check that refuses to run twice unless FORCE=true.

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

type ObjectMetadata = { id: string; nameSingular: string; fields?: FieldMetadata[] };
type FieldMetadata = { id: string; name: string; type?: string; options?: SelectOption[] };

const API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:3000';
const API_KEY = process.env.TWENTY_API_KEY;
const FORCE = process.env.FORCE === 'true';
const BATCH_SIZE = 200; // server-enforced max per createMany call (QUERY_MAX_RECORDS)

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
): Promise<{ ok: boolean; status: number; json: unknown; text?: string }> => {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    return { ok: false, status: response.status, json: null, text: await response.text() };
  }

  return { ok: true, status: response.status, json: await response.json() };
};

const unwrapList = <T>(json: unknown, legacyKey: string): T[] => {
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

const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// --- minimal RFC4180 CSV parser (handles quoted fields, embedded commas,
// doubled "" escapes, and CRLF/LF line endings) ---
const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (char === '\r') {
      i += 1;
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
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

  const res = await request('POST', '/rest/metadata/fields', {
    objectMetadataId,
    ...input,
  });

  if (!res.ok) {
    throw new Error(`POST /rest/metadata/fields failed (${res.status}): ${res.text}`);
  }

  const created = unwrapOne<FieldMetadata>(res.json, 'createOneField');

  console.log(`  created field "${created.name}"`);
  existingFields.push(created);

  return created;
};

const main = async () => {
  console.log(`Using Twenty API at ${API_URL}`);

  // Resolved relative to CWD — this script must be run from the repo root,
  // per the usage comment at the top of the file.
  const csvFile = process.env.LEADS_CSV ?? 'leads_advocacia_brasilia.csv';
  const csvPath = resolve(process.cwd(), csvFile);
  const csvText = readFileSync(csvPath, 'utf-8').replace(/^﻿/, '');
  const rows = parseCsv(csvText);
  const header = rows[0];
  const dataRows = rows.slice(1);

  console.log(`Parsed ${dataRows.length} lead rows from ${csvPath}`);

  const col = (name: string) => header.indexOf(name);
  const idx = {
    cnpj: col('CNPJ'),
    razaoSocial: col('Razão Social'),
    nomeFantasia: col('Nome Fantasia'),
    porte: col('Porte'),
    logradouro: col('Logradouro'),
    numero: col('Número'),
    bairro: col('Bairro'),
    cep: col('CEP'),
    telefone1: col('Telefone 1'),
    telefone2: col('Telefone 2'),
    email: col('E-mail'),
  };

  for (const [key, value] of Object.entries(idx)) {
    if (value === -1) {
      throw new Error(`CSV column not found for "${key}"`);
    }
  }

  // Discover the real set of distinct "Porte" values from the data itself
  // (rather than assuming a fixed list) so no row gets rejected for an
  // out-of-options SELECT value.
  const porteValues = new Set<string>();

  for (const row of dataRows) {
    const porte = row[idx.porte]?.trim();

    if (porte) {
      porteValues.add(porte);
    }
  }

  const PORTE_OPTIONS: SelectOption[] = Array.from(porteValues)
    .sort()
    .map((label, position) => ({
      position,
      label,
      value: slugify(label),
      color: (['blue', 'green', 'orange', 'purple', 'sky', 'yellow'] as TagColor[])[
        position % 6
      ],
    }));

  const TAG_OPTIONS: SelectOption[] = [
    { position: 0, label: 'Advocacia', value: 'ADVOCACIA', color: 'purple' },
  ];

  console.log(`\nDiscovered ${PORTE_OPTIONS.length} distinct "Porte" values: ${PORTE_OPTIONS.map((o) => o.label).join(', ')}`);

  // --- ensure custom fields exist on Opportunity ---
  const objectsRes = await request('GET', '/rest/metadata/objects?limit=1000');

  if (!objectsRes.ok) {
    throw new Error(`GET /rest/metadata/objects failed (${objectsRes.status}): ${objectsRes.text}`);
  }

  const objects = unwrapList<ObjectMetadata>(objectsRes.json, 'objects');
  const opportunityObject = objects.find((o) => o.nameSingular === 'opportunity');

  if (!opportunityObject) {
    throw new Error('Could not find the "opportunity" standard object.');
  }

  const objectDetailRes = await request('GET', `/rest/metadata/objects/${opportunityObject.id}`);

  if (!objectDetailRes.ok) {
    throw new Error(`GET /rest/metadata/objects/:id failed (${objectDetailRes.status}): ${objectDetailRes.text}`);
  }

  const existingFields = unwrapOne<ObjectMetadata>(objectDetailRes.json, 'object').fields ?? [];

  console.log('\nEnsuring custom fields exist on Opportunity...');
  await createFieldIfMissing(opportunityObject.id, existingFields, {
    type: 'TEXT',
    name: 'cnpj',
    label: 'CNPJ',
    icon: 'IconId',
  });
  await createFieldIfMissing(opportunityObject.id, existingFields, {
    type: 'TEXT',
    name: 'telefone',
    label: 'Telefone',
    icon: 'IconPhone',
  });
  await createFieldIfMissing(opportunityObject.id, existingFields, {
    type: 'TEXT',
    name: 'telefone2',
    label: 'Telefone 2',
    icon: 'IconPhone',
  });
  await createFieldIfMissing(opportunityObject.id, existingFields, {
    type: 'TEXT',
    name: 'email',
    label: 'E-mail',
    icon: 'IconMail',
  });
  await createFieldIfMissing(opportunityObject.id, existingFields, {
    type: 'TEXT',
    name: 'endereco',
    label: 'Endereço',
    icon: 'IconMapPin',
  });
  const porteField = await createFieldIfMissing(opportunityObject.id, existingFields, {
    type: 'SELECT',
    name: 'porte',
    label: 'Porte',
    icon: 'IconBuildingStore',
    defaultValue: `'${PORTE_OPTIONS[0].value}'`,
    options: PORTE_OPTIONS,
  });
  const tagsField = await createFieldIfMissing(opportunityObject.id, existingFields, {
    type: 'MULTI_SELECT',
    name: 'tags',
    label: 'Tags',
    icon: 'IconTags',
    options: TAG_OPTIONS,
  });

  // If the fields already existed from a prior partial run, make sure their
  // options still cover everything we're about to import.
  const missingPorteOptions = PORTE_OPTIONS.filter(
    (option) => !(porteField.options ?? []).some((existing) => existing.value === option.value),
  );

  if (missingPorteOptions.length > 0 && porteField.options) {
    console.log(`  adding ${missingPorteOptions.length} missing "Porte" option(s) to existing field`);
    await request('PATCH', `/rest/metadata/fields/${porteField.id}`, {
      options: [...porteField.options, ...missingPorteOptions],
    });
  }

  if (!(tagsField.options ?? []).some((o) => o.value === 'ADVOCACIA')) {
    console.log('  adding missing "Advocacia" tag option to existing field');
    await request('PATCH', `/rest/metadata/fields/${tagsField.id}`, {
      options: [...(tagsField.options ?? []), ...TAG_OPTIONS],
    });
  }

  // --- coarse duplicate-import guard ---
  const existingOpportunitiesRes = await request('GET', '/rest/opportunities?limit=1');
  const existingTotalCount = existingOpportunitiesRes.ok
    ? ((existingOpportunitiesRes.json as { totalCount?: number })?.totalCount ?? 0)
    : 0;

  if (existingTotalCount > 0 && !FORCE) {
    console.error(
      `\nThere are already ${existingTotalCount} Opportunity record(s) in this workspace. ` +
        'This script does not de-duplicate by CNPJ against existing records — running it ' +
        'again would create duplicates. Re-run with FORCE=true if you are sure you want to proceed.',
    );
    process.exit(1);
  }

  // --- build and send Opportunity payloads in batches ---
  const buildEndereco = (row: string[]): string =>
    [row[idx.logradouro], row[idx.numero], row[idx.bairro], row[idx.cep] ? `CEP ${row[idx.cep]}` : '']
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(', ');

  type OpportunityPayload = Record<string, unknown>;

  const payloads: OpportunityPayload[] = [];
  let skipped = 0;

  for (const row of dataRows) {
    const razaoSocial = row[idx.razaoSocial]?.trim();
    const nomeFantasia = row[idx.nomeFantasia]?.trim();
    const cnpj = row[idx.cnpj]?.trim();
    const name = razaoSocial || nomeFantasia || cnpj;

    if (!name) {
      skipped += 1;
      continue;
    }

    const porte = row[idx.porte]?.trim();
    const telefone1 = row[idx.telefone1]?.trim();
    const telefone2 = row[idx.telefone2]?.trim();
    const email = row[idx.email]?.trim();

    payloads.push({
      name,
      stage: 'ENTRADA',
      cnpj: cnpj || null,
      telefone: telefone1 || null,
      telefone2: telefone2 || null,
      email: email || null,
      endereco: buildEndereco(row) || null,
      porte: porte ? slugify(porte) : null,
      tags: ['ADVOCACIA'],
    });
  }

  console.log(`\nImporting ${payloads.length} Opportunities (${skipped} row(s) skipped for missing name)...`);

  let created = 0;
  let failedBatches = 0;

  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const batch = payloads.slice(i, i + BATCH_SIZE);
    const res = await request('POST', '/rest/batch/opportunities', batch);

    if (!res.ok) {
      failedBatches += 1;
      console.error(`  batch ${i / BATCH_SIZE + 1} failed (${res.status}): ${res.text}`);
      continue;
    }

    created += batch.length;
    console.log(`  batch ${i / BATCH_SIZE + 1}: created ${created}/${payloads.length}`);
  }

  console.log(`\nDone. Created ${created} Opportunities. ${failedBatches} batch(es) failed.`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
