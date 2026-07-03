import { computeWorkflowLayout } from 'twenty-shared/workflow';

import {
  type MetaFlowEdge,
  type MetaFlowNode,
} from '@/metas/types/MetaFlowNode';

const DEFAULT_META_NODE_WIDTH = 240;
const DEFAULT_META_NODE_HEIGHT = 96;

// Reuses Twenty's existing dagre-based layout util (default rankdir is
// already top-to-bottom, exactly what a goal tree needs).
export const computeMetaTreeLayout = (
  nodes: MetaFlowNode[],
  edges: MetaFlowEdge[],
): Map<string, { x: number; y: number }> => {
  const positions = computeWorkflowLayout({
    nodes: nodes.map((node) => ({
      id: node.id,
      width: node.measured?.width ?? DEFAULT_META_NODE_WIDTH,
      height: node.measured?.height ?? DEFAULT_META_NODE_HEIGHT,
    })),
    edges: edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
    })),
  });

  return new Map(positions.map((position) => [position.id, position.position]));
};
