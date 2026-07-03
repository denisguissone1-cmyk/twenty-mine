import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { METAS_OBJECT_NAME_SINGULAR } from '@/metas/constants/METAS_OBJECT_NAME_SINGULAR';
import { type MetaRecord } from '@/metas/types/MetaRecord';

// Deliberately flat — no nested `parentMeta` relation object is requested
// here, to avoid unbounded self-referencing query depth. The tree is
// reconstructed client-side from `parentMetaId` (see buildMetaTree.ts).
const META_RECORD_GQL_FIELDS = {
  id: true,
  name: true,
  cycle: true,
  progress: true,
  status: true,
  description: true,
  dueDate: true,
  parentMetaId: true,
  ownerId: true,
  companyId: true,
  opportunityId: true,
};

export const useMetaRecords = () => {
  const { records, loading, error, refetch } = useFindManyRecords<MetaRecord>({
    objectNameSingular: METAS_OBJECT_NAME_SINGULAR,
    recordGqlFields: META_RECORD_GQL_FIELDS,
    limit: 1000,
  });

  return { records, loading, error, refetch };
};
