import { MiniMap, Panel, useReactFlow, type Node } from '@xyflow/react';
import { saveAs } from 'file-saver';
import { toBlob } from 'html-to-image';
import { type RefObject, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import {
  IconMap,
  IconMaximize,
  IconMinus,
  IconPhoto,
  IconPlus,
  IconReorder,
} from 'twenty-ui/icon';
import { FloatingIconButtonGroup } from 'twenty-ui/input';
import { useTheme } from 'twenty-ui/theme-constants';

// Marks our own floating UI (toolbar, this control strip, the minimap) so the
// screenshot export can exclude it and capture only the diagram itself.
export const CANVAS_EXPORT_IGNORE_ATTRIBUTE = 'data-canvas-export-ignore';

export const MetasCanvasControls = ({
  canvasContainerRef,
  onTidyUp,
}: {
  canvasContainerRef: RefObject<HTMLDivElement | null>;
  onTidyUp: () => void;
}) => {
  const theme = useTheme();
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [showMiniMap, setShowMiniMap] = useState(false);

  const handleScreenshot = async () => {
    const container = canvasContainerRef.current;

    if (!isDefined(container)) {
      return;
    }

    const blob = await toBlob(container, {
      backgroundColor: theme.background.primary,
      filter: (domNode) =>
        !(domNode instanceof HTMLElement) ||
        !domNode.hasAttribute(CANVAS_EXPORT_IGNORE_ATTRIBUTE),
    });

    if (isDefined(blob)) {
      saveAs(blob, 'mapa-estrategico.png');
    }
  };

  return (
    <>
      <Panel position="bottom-right" data-canvas-export-ignore="true">
        <FloatingIconButtonGroup
          iconButtons={[
            {
              Icon: IconMap,
              ariaLabel: 'Mostrar/ocultar minimapa',
              isActive: showMiniMap,
              onClick: () => setShowMiniMap((previous) => !previous),
            },
            {
              Icon: IconPhoto,
              ariaLabel: 'Salvar captura de tela',
              onClick: handleScreenshot,
            },
            {
              Icon: IconMinus,
              ariaLabel: 'Diminuir zoom',
              onClick: () => zoomOut(),
            },
            {
              Icon: IconPlus,
              ariaLabel: 'Aumentar zoom',
              onClick: () => zoomIn(),
            },
            {
              Icon: IconReorder,
              ariaLabel: 'Organizar metas automaticamente',
              onClick: onTidyUp,
            },
            {
              Icon: IconMaximize,
              ariaLabel: 'Ajustar à visualização',
              onClick: () => fitView({ maxZoom: 1 }),
            },
          ]}
        />
      </Panel>
      {showMiniMap && (
        <MiniMap
          data-canvas-export-ignore="true"
          position="bottom-left"
          pannable
          zoomable
          bgColor={theme.background.secondary}
          maskColor={theme.background.transparent.medium}
          nodeColor={(node: Node) =>
            node.type === 'missionNode' ? theme.color.blue : theme.color.gray
          }
        />
      )}
    </>
  );
};
