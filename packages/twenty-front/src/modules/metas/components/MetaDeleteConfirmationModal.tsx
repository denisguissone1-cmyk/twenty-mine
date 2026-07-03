import { isDefined } from 'twenty-shared/utils';

import { META_DELETE_MODAL_ID } from '@/metas/constants/MetaDeleteModalId';
import { useDeleteMetaRecord } from '@/metas/hooks/useDeleteMetaRecord';
import { metaToDeleteIdState } from '@/metas/states/metaToDeleteIdState';
import { selectedMetaIdState } from '@/metas/states/selectedMetaIdState';
import { type MetaTreeNode } from '@/metas/utils/buildMetaTree';
import { findMetaNodeById } from '@/metas/utils/findMetaNodeById';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

export const MetaDeleteConfirmationModal = ({
  forest,
}: {
  forest: MetaTreeNode[];
}) => {
  const [metaToDeleteId, setMetaToDeleteId] = useAtomState(metaToDeleteIdState);
  const setSelectedMetaId = useSetAtomState(selectedMetaIdState);
  const { deleteMetaRecord } = useDeleteMetaRecord();

  if (!isDefined(metaToDeleteId)) {
    return null;
  }

  const metaName =
    findMetaNodeById(forest, metaToDeleteId)?.meta.name ?? 'esta meta';

  const handleConfirm = async () => {
    await deleteMetaRecord(metaToDeleteId);
    setSelectedMetaId((currentId) =>
      currentId === metaToDeleteId ? undefined : currentId,
    );
    setMetaToDeleteId(undefined);
  };

  return (
    <ConfirmationModal
      modalInstanceId={META_DELETE_MODAL_ID}
      title="Excluir meta?"
      subtitle={`"${metaName}" será excluída. As sub-metas passam a ser metas de topo. Esta ação não pode ser desfeita.`}
      onConfirmClick={handleConfirm}
      onClose={() => setMetaToDeleteId(undefined)}
      confirmButtonText="Excluir meta"
    />
  );
};
