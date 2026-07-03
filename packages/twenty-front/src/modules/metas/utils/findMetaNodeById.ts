import { isDefined } from 'twenty-shared/utils';

import { type MetaTreeNode } from '@/metas/utils/buildMetaTree';

// Depth-first lookup of a Meta node in the forest by its record id.
export const findMetaNodeById = (
  forest: MetaTreeNode[],
  id: string,
): MetaTreeNode | undefined => {
  for (const node of forest) {
    if (node.meta.id === id) {
      return node;
    }

    const found = findMetaNodeById(node.children, id);

    if (isDefined(found)) {
      return found;
    }
  }

  return undefined;
};
