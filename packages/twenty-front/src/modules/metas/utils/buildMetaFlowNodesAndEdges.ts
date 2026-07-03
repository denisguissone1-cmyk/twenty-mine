import {
  META_MISSION_NODE_ID,
  type MetaFlowEdge,
  type MetaFlowNode,
} from '@/metas/types/MetaFlowNode';
import { type MetaTreeNode } from '@/metas/utils/buildMetaTree';
import { computeMetaRollupProgress } from '@/metas/utils/computeMetaRollupProgress';

export const buildMetaFlowNodesAndEdges = (
  forest: MetaTreeNode[],
  collapsedMetaIds: ReadonlySet<string>,
  ownerNamesById: ReadonlyMap<string, string>,
): { nodes: MetaFlowNode[]; edges: MetaFlowEdge[] } => {
  const nodes: MetaFlowNode[] = [];
  const edges: MetaFlowEdge[] = [];

  const visit = (node: MetaTreeNode) => {
    const isCollapsed = collapsedMetaIds.has(node.meta.id);

    nodes.push({
      id: node.meta.id,
      type: 'metaNode',
      position: { x: 0, y: 0 },
      data: {
        meta: node.meta,
        rollupProgress: computeMetaRollupProgress(node),
        hasChildren: node.children.length > 0,
        isCollapsed,
        childCount: node.children.length,
        ownerName: node.meta.ownerId
          ? ownerNamesById.get(node.meta.ownerId)
          : undefined,
      },
    });

    if (isCollapsed) {
      return;
    }

    for (const child of node.children) {
      edges.push({
        id: `e-${node.meta.id}-${child.meta.id}`,
        source: node.meta.id,
        target: child.meta.id,
      });
      visit(child);
    }
  };

  nodes.push({
    id: META_MISSION_NODE_ID,
    type: 'missionNode',
    position: { x: 0, y: 0 },
    data: { rootCount: forest.length },
  });

  forest.forEach((rootNode) => {
    edges.push({
      id: `e-${META_MISSION_NODE_ID}-${rootNode.meta.id}`,
      source: META_MISSION_NODE_ID,
      target: rootNode.meta.id,
    });
    visit(rootNode);
  });

  return { nodes, edges };
};
