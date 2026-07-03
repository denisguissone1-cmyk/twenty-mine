import { styled } from '@linaria/react';
import { useRef } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { IconTrash } from 'twenty-ui/icon';
import { MenuItem } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { META_DELETE_MODAL_ID } from '@/metas/constants/MetaDeleteModalId';
import { metaContextMenuState } from '@/metas/states/metaContextMenuState';
import { metaToDeleteIdState } from '@/metas/states/metaToDeleteIdState';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { useListenClickOutside } from '@/ui/utilities/pointer-event/hooks/useListenClickOutside';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

const StyledContainer = styled.div<{ x: number; y: number }>`
  background: ${themeCssVariables.background.primary};
  border-radius: ${themeCssVariables.spacing[2]};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
  left: ${({ x }) => `${x}px`};
  padding: ${themeCssVariables.spacing[1]};
  position: fixed;
  top: ${({ y }) => `${y}px`};
  width: 180px;
  z-index: 1000;
`;

export const MetaNodeContextMenu = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [metaContextMenu, setMetaContextMenu] =
    useAtomState(metaContextMenuState);
  const setMetaToDeleteId = useSetAtomState(metaToDeleteIdState);
  const { openModal } = useModal();

  useListenClickOutside({
    refs: [containerRef],
    callback: () => setMetaContextMenu(undefined),
    listenerId: 'meta-node-context-menu',
  });

  if (!isDefined(metaContextMenu)) {
    return null;
  }

  const handleDelete = () => {
    setMetaToDeleteId(metaContextMenu.metaId);
    setMetaContextMenu(undefined);
    openModal(META_DELETE_MODAL_ID);
  };

  return (
    <StyledContainer
      ref={containerRef}
      x={metaContextMenu.x}
      y={metaContextMenu.y}
    >
      <MenuItem
        text="Excluir meta"
        LeftIcon={IconTrash}
        accent="danger"
        onClick={handleDelete}
      />
    </StyledContainer>
  );
};
