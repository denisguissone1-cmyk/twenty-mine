import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { META_PROGRESS_UPDATE_OBJECT_NAME_SINGULAR } from '@/metas/constants/META_PROGRESS_UPDATE_OBJECT_NAME_SINGULAR';
import { useUpdateMetaRecord } from '@/metas/hooks/useUpdateMetaRecord';
import { type MetaProgressUpdate } from '@/metas/types/MetaProgressUpdate';

export const useCreateMetaProgressUpdate = () => {
  const { createOneRecord } = useCreateOneRecord<MetaProgressUpdate>({
    objectNameSingular: META_PROGRESS_UPDATE_OBJECT_NAME_SINGULAR,
  });
  const { updateMetaRecord } = useUpdateMetaRecord();

  // Records a progress point in the history AND syncs the meta's own `progress`
  // field to the latest value, so the node badge + parent rollup stay in step.
  // `date` is a plain YYYY-MM-DD string, matching the DATE field type.
  const createMetaProgressUpdate = async (
    metaId: string,
    value: number,
    date: string,
  ) => {
    await createOneRecord({
      metaId,
      value,
      date,
    });
    await updateMetaRecord(metaId, { progress: value });
  };

  return { createMetaProgressUpdate };
};
