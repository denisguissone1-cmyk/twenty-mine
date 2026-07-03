import { styled } from '@linaria/react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { isDefined } from 'twenty-shared/utils';
import { Avatar, Tag } from 'twenty-ui/data-display';
import { ProgressBar } from 'twenty-ui/feedback';
import {
  IconCalendar,
  IconChevronDown,
  IconChevronUp,
  IconPlus,
  IconTarget,
} from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useCreateMetaRecord } from '@/metas/hooks/useCreateMetaRecord';
import { collapsedMetaIdsState } from '@/metas/states/collapsedMetaIdsState';
import { metaContextMenuState } from '@/metas/states/metaContextMenuState';
import { selectedMetaIdState } from '@/metas/states/selectedMetaIdState';
import { type MetaFlowNode } from '@/metas/types/MetaFlowNode';
import { formatMetaPeriodLabel } from '@/metas/types/MetaPeriod';
import { META_STATUS_OPTIONS } from '@/metas/types/MetaStatus';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

const StyledNodeWrapper = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;

  .add-sub-meta-action {
    opacity: 0;
    pointer-events: none;
    transition: opacity 160ms ease;
  }

  &:hover .add-sub-meta-action {
    opacity: 1;
    pointer-events: auto;
  }
`;

const StyledNodeContainer = styled.div<{ selected: boolean }>`
  background: ${themeCssVariables.background.primary};
  border: 1px solid
    ${({ selected }) =>
      selected
        ? themeCssVariables.color.blue
        : themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
  width: 240px;
`;

const StyledTopRow = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  justify-content: space-between;
`;

const StyledTopRowLabel = styled.span`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledSubMetasLabel = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledFooterRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
`;

const StyledCycleBadge = styled.span`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledOwnerBadge = styled.span`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  overflow: hidden;
`;

const StyledOwnerName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledBelowCardRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  margin-top: -${themeCssVariables.spacing[2]};
  width: 240px;
  z-index: 1;
`;

const StyledToggleButton = styled.button`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.rounded};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  display: flex;
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  padding: 2px ${themeCssVariables.spacing[2]};
`;

const StyledAddSubMetaButton = styled.button`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.rounded};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  display: flex;
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  margin-left: auto;
  padding: 2px ${themeCssVariables.spacing[2]};

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

type MetaNodeProps = NodeProps<Extract<MetaFlowNode, { type: 'metaNode' }>>;

export const MetaNode = ({ id, data, selected }: MetaNodeProps) => {
  const setSelectedMetaId = useSetAtomState(selectedMetaIdState);
  const setCollapsedMetaIds = useSetAtomState(collapsedMetaIdsState);
  const setMetaContextMenu = useSetAtomState(metaContextMenuState);
  const { createMetaRecord } = useCreateMetaRecord();

  const cycleLabel = formatMetaPeriodLabel(data.meta.cycle);
  const statusOption = META_STATUS_OPTIONS.find(
    (option) => option.value === data.meta.status,
  );

  const handleToggleCollapse = (event: React.MouseEvent) => {
    event.stopPropagation();

    setCollapsedMetaIds((previousIds) => {
      const nextIds = new Set(previousIds);

      if (nextIds.has(id)) {
        nextIds.delete(id);
      } else {
        nextIds.add(id);
      }

      return nextIds;
    });
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMetaContextMenu({ x: event.clientX, y: event.clientY, metaId: id });
  };

  const handleAddSubMeta = async (event: React.MouseEvent) => {
    event.stopPropagation();

    const created = await createMetaRecord({
      name: 'Nova meta',
      progress: 0,
      parentMetaId: id,
    });

    if (isDefined(created)) {
      setSelectedMetaId(created.id);
    }
  };

  return (
    <StyledNodeWrapper>
      <StyledNodeContainer
        selected={selected}
        onClick={() => setSelectedMetaId(id)}
        onContextMenu={handleContextMenu}
      >
        <Handle type="target" position={Position.Top} />
        <StyledTopRow>
          <StyledTopRowLabel>
            <IconTarget size={14} />
            Meta
          </StyledTopRowLabel>
          {statusOption && (
            <Tag color={statusOption.color} text={statusOption.label} />
          )}
        </StyledTopRow>
        <StyledName>{data.meta.name}</StyledName>
        <ProgressBar value={data.rollupProgress} withBorderRadius />
        <StyledSubMetasLabel>
          {Math.round(data.rollupProgress)}%
          {data.hasChildren
            ? ` · ${data.childCount} submeta${data.childCount > 1 ? 's' : ''}`
            : ' · Nenhuma submeta'}
        </StyledSubMetasLabel>
        <StyledFooterRow>
          {cycleLabel && (
            <StyledCycleBadge>
              <IconCalendar size={14} />
              {cycleLabel}
            </StyledCycleBadge>
          )}
          {data.ownerName && (
            <StyledOwnerBadge>
              <Avatar placeholder={data.ownerName} size="sm" />
              <StyledOwnerName>{data.ownerName}</StyledOwnerName>
            </StyledOwnerBadge>
          )}
        </StyledFooterRow>
        <Handle type="source" position={Position.Bottom} />
      </StyledNodeContainer>
      <StyledBelowCardRow>
        {data.hasChildren && (
          <StyledToggleButton type="button" onClick={handleToggleCollapse}>
            {data.isCollapsed ? (
              <IconChevronDown size={14} />
            ) : (
              <IconChevronUp size={14} />
            )}
            {data.isCollapsed ? data.childCount : 'Recolher'}
          </StyledToggleButton>
        )}
        <StyledAddSubMetaButton
          type="button"
          className="add-sub-meta-action"
          onClick={handleAddSubMeta}
        >
          <IconPlus size={14} />
          Adicionar sub-meta
        </StyledAddSubMetaButton>
      </StyledBelowCardRow>
    </StyledNodeWrapper>
  );
};
