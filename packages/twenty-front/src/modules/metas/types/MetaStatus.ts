import { type TagColor } from 'twenty-ui/data-display';

export type MetaStatusOption = {
  value: string;
  label: string;
  color: TagColor;
};

// Mirrors packages/twenty-server/scripts/setup-metas-object.ts STATUS_OPTIONS
// — keep both in sync.
export const META_STATUS_OPTIONS: MetaStatusOption[] = [
  { value: 'NOT_STARTED', label: 'Não iniciada', color: 'gray' },
  { value: 'IN_PROGRESS', label: 'Em andamento', color: 'blue' },
  { value: 'AT_RISK', label: 'Em risco', color: 'red' },
  { value: 'DONE', label: 'Concluída', color: 'green' },
];

export type MetaStatus = (typeof META_STATUS_OPTIONS)[number]['value'];
