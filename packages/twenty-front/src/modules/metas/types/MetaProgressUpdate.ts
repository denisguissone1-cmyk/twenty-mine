import { type ObjectRecord } from '@/object-record/types/ObjectRecord';

// One record per "Atualizar o progresso" entry, linked to a meta via the
// `metaId` FK. Ordered by `date` to draw the progress-over-time chart.
export type MetaProgressUpdate = ObjectRecord & {
  value: number | null;
  date: string | null;
  metaId: string | null;
};
