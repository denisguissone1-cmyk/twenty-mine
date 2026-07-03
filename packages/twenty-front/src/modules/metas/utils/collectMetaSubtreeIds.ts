import { type MetaTreeNode } from '@/metas/utils/buildMetaTree';

// A meta's own id plus every descendant id — the set of metas that must NOT be
// selectable as its parent (choosing one would create a cycle).
export const collectMetaSubtreeIds = (node: MetaTreeNode): Set<string> => {
  const ids = new Set<string>([node.meta.id]);

  for (const child of node.children) {
    for (const descendantId of collectMetaSubtreeIds(child)) {
      ids.add(descendantId);
    }
  }

  return ids;
};
