import { useDeleteOneRecord } from '@/object-record/hooks/useDeleteOneRecord';
import { METAS_OBJECT_NAME_SINGULAR } from '@/metas/constants/METAS_OBJECT_NAME_SINGULAR';

export const useDeleteMetaRecord = () => {
  const { deleteOneRecord } = useDeleteOneRecord({
    objectNameSingular: METAS_OBJECT_NAME_SINGULAR,
  });

  const deleteMetaRecord = (idToDelete: string) => deleteOneRecord(idToDelete);

  return { deleteMetaRecord };
};
