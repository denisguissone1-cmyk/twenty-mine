import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { METAS_OBJECT_NAME_SINGULAR } from '@/metas/constants/METAS_OBJECT_NAME_SINGULAR';
import { type MetaRecord } from '@/metas/types/MetaRecord';

export const useCreateMetaRecord = () => {
  const { createOneRecord } = useCreateOneRecord<MetaRecord>({
    objectNameSingular: METAS_OBJECT_NAME_SINGULAR,
  });

  const createMetaRecord = (input: Partial<Omit<MetaRecord, 'id'>>) =>
    createOneRecord(input);

  return { createMetaRecord };
};
