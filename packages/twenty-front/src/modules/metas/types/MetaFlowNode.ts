import { type Edge, type Node } from '@xyflow/react';

import { type MetaRecord } from '@/metas/types/MetaRecord';

export const META_MISSION_NODE_ID = 'meta-mission-node';

export type MetaNodeData = {
  meta: MetaRecord;
  rollupProgress: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  childCount: number;
  ownerName: string | undefined;
};

export type MetaMissionNodeData = {
  rootCount: number;
};

export type MetaFlowNode =
  | Node<MetaNodeData, 'metaNode'>
  | Node<MetaMissionNodeData, 'missionNode'>;
export type MetaFlowEdge = Edge;
