import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export type MetaContextMenu = {
  x: number;
  y: number;
  metaId: string;
};

// Position + target of the right-click "Excluir meta" menu on the tree canvas.
export const metaContextMenuState = createAtomState<
  MetaContextMenu | undefined
>({
  key: 'metaContextMenuState',
  defaultValue: undefined,
});
