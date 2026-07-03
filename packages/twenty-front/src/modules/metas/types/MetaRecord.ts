import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { type MetaStatus } from '@/metas/types/MetaStatus';

// Flat shape only — deliberately does NOT include the nested `parentMeta`
// relation object, to avoid unbounded self-referencing query depth. The tree
// is reconstructed client-side from `parentMetaId` (see buildMetaTree.ts).
export type MetaRecord = ObjectRecord & {
  name: string;
  // Free-text period value, e.g. "BIMESTER_2026_3" — see types/MetaPeriod.ts.
  cycle: string | null;
  progress: number | null;
  status: MetaStatus | null;
  description: string | null;
  dueDate: string | null;
  parentMetaId: string | null;
  ownerId: string | null;
  companyId: string | null;
  opportunityId: string | null;
};
