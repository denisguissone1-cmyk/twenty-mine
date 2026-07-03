import { styled } from '@linaria/react';
import {
  Background,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'twenty-ui/theme-constants';

import { MetaMissionNode } from '@/metas/meta-nodes/components/MetaMissionNode';
import { MetaNode } from '@/metas/meta-nodes/components/MetaNode';
import { MetaNodeContextMenu } from '@/metas/meta-nodes/components/MetaNodeContextMenu';
import { MetaDeleteConfirmationModal } from '@/metas/components/MetaDeleteConfirmationModal';
import { MetasCanvasControls } from '@/metas/components/MetasCanvasControls';
import { MetasToolbar } from '@/metas/components/MetasToolbar';
import { collapsedMetaIdsState } from '@/metas/states/collapsedMetaIdsState';
import { type MetaFlowNode } from '@/metas/types/MetaFlowNode';
import { type MetaTreeNode } from '@/metas/utils/buildMetaTree';
import { buildMetaFlowNodesAndEdges } from '@/metas/utils/buildMetaFlowNodesAndEdges';
import { computeMetaTreeLayout } from '@/metas/utils/computeMetaTreeLayout';
import { useMetaOwnerNamesById } from '@/metas/hooks/useMetaOwnerNamesById';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

const StyledCanvasContainer = styled.div`
  flex: 1;
  min-height: 0;
  position: relative;
`;

const NODE_TYPES = { metaNode: MetaNode, missionNode: MetaMissionNode };

// Copies just `data` from `fresh` onto `node`, preserving everything else
// (position, measured size, selection...). Narrows on `type` so the
// discriminated union's `data` stays correctly paired with its node type.
const withFreshData = (
  node: MetaFlowNode,
  fresh: MetaFlowNode,
): MetaFlowNode => {
  if (node.type === 'metaNode' && fresh.type === 'metaNode') {
    return { ...node, data: fresh.data };
  }

  if (node.type === 'missionNode' && fresh.type === 'missionNode') {
    return { ...node, data: fresh.data };
  }

  return node;
};

export const MetasTreeCanvas = ({ forest }: { forest: MetaTreeNode[] }) => {
  const theme = useTheme();
  const reactFlow = useReactFlow();
  const collapsedMetaIds = useAtomStateValue(collapsedMetaIdsState);
  const ownerNamesById = useMetaOwnerNamesById();
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildMetaFlowNodesAndEdges(forest, collapsedMetaIds, ownerNamesById),
    [forest, collapsedMetaIds, ownerNamesById],
  );

  // Changes only when the tree's SHAPE changes (a node is added/removed, or
  // an edge changes) — not when a field like name/status/progress is merely
  // edited. Gates the (expensive) dagre re-layout below so editing a field
  // doesn't retrigger a full recompute on every keystroke.
  const structuralKey = useMemo(() => {
    const nodeIdsKey = initialNodes
      .map((node) => node.id)
      .sort()
      .join(',');
    const edgeKeysKey = initialEdges
      .map((edge) => `${edge.source}>${edge.target}`)
      .sort()
      .join(',');

    return `${nodeIdsKey}|${edgeKeysKey}`;
  }, [initialNodes, initialEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Ids of nodes the user has manually dragged — the layout effect below skips
  // repositioning these, so a drag survives re-layouts triggered by unrelated
  // data changes (e.g. editing a field elsewhere). Cleared once the node is
  // removed from the tree. Read (not listed as a dependency) inside the effect
  // below so a drag alone doesn't retrigger a full structural sync.
  const [pinnedNodeIds, setPinnedNodeIds] = useState<Set<string>>(new Set());
  const [previousNodeIds, setPreviousNodeIds] = useState<Set<string> | null>(
    null,
  );

  const handleNodeDragStop: OnNodeDrag<MetaFlowNode> = (_event, node) => {
    setPinnedNodeIds((previous) =>
      previous.has(node.id) ? previous : new Set(previous).add(node.id),
    );
  };

  // "Organizar" button: forgets every manually-dragged position and
  // recomputes the dagre layout for the current nodes/edges immediately —
  // unlike the sync effect above, this runs on a direct user click, so it's
  // free of the "next render" staleness that effect works around.
  const handleTidyUp = () => {
    setPinnedNodeIds(new Set());
    setNodes((currentNodes) => {
      const positions = computeMetaTreeLayout(currentNodes, edges);

      return currentNodes.map((node) => {
        const position = positions.get(node.id);

        return position ? { ...node, position } : node;
      });
    });
    requestAnimationFrame(() => reactFlow.fitView({ maxZoom: 1 }));
  };

  // Cheap: keep each existing node's `data` (name, status, progress, cycle,
  // owner...) live as records are edited, WITHOUT touching position/layout.
  // Runs on every forest change, including pure content edits — but doing
  // only this (no dagre call) is what keeps typing in a field smooth.
  useEffect(() => {
    setNodes((currentNodes) => {
      const freshById = new Map(initialNodes.map((node) => [node.id, node]));

      return currentNodes.map((node) => {
        const fresh = freshById.get(node.id);

        return fresh ? withFreshData(node, fresh) : node;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNodes, setNodes]);

  // Expensive: full structural sync + dagre re-layout. Gated on
  // `structuralKey`, not `initialNodes`/`initialEdges` directly, so it only
  // runs when the tree's shape actually changes (add/remove a node,
  // expand/collapse) — not on every keystroke editing a field, which was
  // previously retriggering a full dagre recompute per character and made
  // typing feel laggy/janky.
  //
  // Splitting "sync structure" and "compute layout" into separate effects
  // previously meant the layout pass read `nodes` from *before* a brand-new
  // node was merged in (React doesn't see a same-cycle setNodes
  // synchronously), so a just-created node's layout used a node list that
  // didn't include it yet and it was left stranded at its default (0, 0)
  // position. Reconciling and laying out in one pass, against the
  // functional-updater's `currentNodes`, keeps everything consistent within
  // a single render — `initialNodes`/`initialEdges` are read fresh via
  // closure (recomputed every render regardless) rather than listed as
  // dependencies, same reasoning as `pinnedNodeIds`/`previousNodeIds` below.
  useEffect(() => {
    const currentIds = new Set(initialNodes.map((node) => node.id));

    setPinnedNodeIds((previous) => {
      const next = new Set([...previous].filter((id) => currentIds.has(id)));

      return next.size === previous.size ? previous : next;
    });

    setNodes((currentNodes) => {
      const currentById = new Map(currentNodes.map((node) => [node.id, node]));

      // Preserve the live node (measured dimensions + position) for ids that
      // already existed; brand-new ids fall back to the freshly-built node
      // (default dimensions), which is enough for dagre to place them
      // sensibly on their very first render.
      const reconciledNodes = initialNodes.map(
        (node) => currentById.get(node.id) ?? node,
      );

      const positions = computeMetaTreeLayout(reconciledNodes, initialEdges);

      return reconciledNodes.map((node) => {
        if (pinnedNodeIds.has(node.id)) {
          return node;
        }

        const position = positions.get(node.id);

        return position ? { ...node, position } : node;
      });
    });
    setEdges(initialEdges);

    const isFirstLayout = previousNodeIds === null;
    const hasNewNodes =
      !isFirstLayout && [...currentIds].some((id) => !previousNodeIds.has(id));

    // Only snap the viewport to fit when nodes first appear — not on every
    // unrelated data change — so manual pan/zoom isn't reset underneath the user.
    if (isFirstLayout || hasNewNodes) {
      requestAnimationFrame(() => reactFlow.fitView({ maxZoom: 1 }));
    }

    setPreviousNodeIds(currentIds);
    // pinnedNodeIds/previousNodeIds/reactFlow/initialNodes/initialEdges are
    // read for their latest value but intentionally excluded — see comment
    // above the effect for why.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structuralKey, setNodes, setEdges]);

  return (
    <StyledCanvasContainer ref={canvasContainerRef}>
      <ReactFlow
        nodeTypes={NODE_TYPES}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        // Space + drag pans the viewport even when starting on a node — the
        // xyflow default, kept explicit since it's exactly the "hold space to
        // move the view, plain drag to move the goal" behavior asked for.
        panActivationKeyCode="Space"
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <MetasToolbar />
        <MetasCanvasControls
          canvasContainerRef={canvasContainerRef}
          onTidyUp={handleTidyUp}
        />
        <Background color={theme.border.color.medium} size={2} />
      </ReactFlow>
      <MetaNodeContextMenu />
      <MetaDeleteConfirmationModal forest={forest} />
    </StyledCanvasContainer>
  );
};
