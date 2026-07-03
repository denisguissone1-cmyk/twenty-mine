import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { META_PROGRESS_UPDATE_OBJECT_NAME_SINGULAR } from '@/metas/constants/META_PROGRESS_UPDATE_OBJECT_NAME_SINGULAR';
import { type MetaProgressUpdate } from '@/metas/types/MetaProgressUpdate';

const META_PROGRESS_UPDATE_GQL_FIELDS = {
  id: true,
  value: true,
  date: true,
  metaId: true,
};

export const useMetaProgressUpdates = (metaId: string | undefined) => {
  const { records, loading, refetch } = useFindManyRecords<MetaProgressUpdate>({
    objectNameSingular: META_PROGRESS_UPDATE_OBJECT_NAME_SINGULAR,
    recordGqlFields: META_PROGRESS_UPDATE_GQL_FIELDS,
    filter: metaId ? { metaId: { eq: metaId } } : undefined,
    orderBy: [{ date: 'AscNullsLast' }],
    skip: !metaId,
    limit: 1000,
  });

  return { progressUpdates: records, loading, refetch };
};
