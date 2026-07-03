import { type MetaTreeNode } from '@/metas/utils/buildMetaTree';

// Flattens the forest back to a depth-first list of nodes (used to populate the
// parent-goal picker from the tree already held in memory).
export const flattenMetaForest = (forest: MetaTreeNode[]): MetaTreeNode[] => {
  const nodes: MetaTreeNode[] = [];

  const visit = (node: MetaTreeNode) => {
    nodes.push(node);
    node.children.forEach(visit);
  };

  forest.forEach(visit);

  return nodes;
};
