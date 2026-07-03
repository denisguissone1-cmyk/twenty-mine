import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { METAS_OBJECT_NAME_SINGULAR } from '@/metas/constants/METAS_OBJECT_NAME_SINGULAR';
import { type MetaRecord } from '@/metas/types/MetaRecord';

export const useUpdateMetaRecord = () => {
  const { updateOneRecord } = useUpdateOneRecord();

  const updateMetaRecord = (
    idToUpdate: string,
    updateOneRecordInput: Partial<Omit<MetaRecord, 'id'>>,
  ) =>
    updateOneRecord<MetaRecord>({
      objectNameSingular: METAS_OBJECT_NAME_SINGULAR,
      idToUpdate,
      updateOneRecordInput,
    });

  return { updateMetaRecord };
};
