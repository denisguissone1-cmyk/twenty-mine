import { type MetaTreeNode } from '@/metas/utils/buildMetaTree';

// A Meta with sub-goals shows a derived, read-only progress: the average of
// its children's own (already-rolled-up) progress. A leaf Meta shows its own
// manually-entered `progress` value.
export const computeMetaRollupProgress = (node: MetaTreeNode): number => {
  if (node.children.length === 0) {
    return node.meta.progress ?? 0;
  }

  const childProgresses = node.children.map(computeMetaRollupProgress);
  const sum = childProgresses.reduce((total, progress) => total + progress, 0);

  return sum / childProgresses.length;
};
