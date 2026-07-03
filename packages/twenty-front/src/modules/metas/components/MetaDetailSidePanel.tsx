import { styled } from '@linaria/react';
import { useEffect, useMemo, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { isDefined } from 'twenty-shared/utils';
import { Avatar } from 'twenty-ui/data-display';
import { Button } from 'twenty-ui/input';
import { IconTarget, IconX } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { getLinkToShowPage } from '@/object-metadata/utils/getLinkToShowPage';
import { Select } from '@/ui/input/components/Select';
import { TextArea } from '@/ui/input/components/TextArea';
import { TextInput } from '@/ui/input/components/TextInput';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { METAS_OBJECT_NAME_SINGULAR } from '@/metas/constants/METAS_OBJECT_NAME_SINGULAR';
import { MetaDueDateField } from '@/metas/components/MetaDueDateField';
import { MetaPeriodField } from '@/metas/components/MetaPeriodField';
import { MetaProgressSection } from '@/metas/components/MetaProgressSection';
import { useUpdateMetaRecord } from '@/metas/hooks/useUpdateMetaRecord';
import { selectedMetaIdState } from '@/metas/states/selectedMetaIdState';
import { formatMetaPeriodLabel } from '@/metas/types/MetaPeriod';
import { META_STATUS_OPTIONS } from '@/metas/types/MetaStatus';
import { type MetaTreeNode } from '@/metas/utils/buildMetaTree';
import { collectMetaSubtreeIds } from '@/metas/utils/collectMetaSubtreeIds';
import { computeMetaRollupProgress } from '@/metas/utils/computeMetaRollupProgress';
import { findMetaNodeById } from '@/metas/utils/findMetaNodeById';
import { flattenMetaForest } from '@/metas/utils/flattenMetaForest';

const StyledPanel = styled.aside`
  background: ${themeCssVariables.background.primary};
  border-left: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[4]};
  width: 360px;
`;

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
`;

const StyledTitleRow = styled.div`
  align-items: center;
  display: flex;
  flex: 1;
  gap: ${themeCssVariables.spacing[2]};
  min-width: 0;
`;

const StyledHeaderActions = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledCloseButton = styled.button`
  align-items: center;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
`;

const StyledSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledSectionTitle = styled.h3`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
  text-transform: uppercase;
`;

const StyledFieldRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledFieldLabel = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.sm};
  width: 132px;
`;

const StyledFieldValue = styled.div`
  flex: 1;
  min-width: 0;
`;

const StyledParentCard = styled.div`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledParentCardName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledParentCardMeta = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

export const MetaDetailSidePanel = ({ forest }: { forest: MetaTreeNode[] }) => {
  const [selectedMetaId, setSelectedMetaId] = useAtomState(selectedMetaIdState);
  const { updateMetaRecord } = useUpdateMetaRecord();

  const { records: workspaceMembers } = useFindManyRecords({
    objectNameSingular: 'workspaceMember',
    recordGqlFields: { id: true, name: { firstName: true, lastName: true } },
    skip: !isDefined(selectedMetaId),
  });

  const selectedNode = useMemo(
    () =>
      isDefined(selectedMetaId)
        ? findMetaNodeById(forest, selectedMetaId)
        : undefined,
    [forest, selectedMetaId],
  );

  // Local drafts give instant typing feedback; the actual mutation is
  // debounced so a keystroke doesn't fire a network round-trip (which, at
  // full speed, could visibly stutter/flicker the field as responses land
  // out of order). Redrawn only when switching to a different meta — not on
  // every external `meta.name` change — so in-progress typing is never
  // clobbered by the record's own value catching up.
  const [nameDraft, setNameDraft] = useState(selectedNode?.meta.name ?? '');
  const [descriptionDraft, setDescriptionDraft] = useState(
    selectedNode?.meta.description ?? '',
  );

  const debouncedUpdateName = useDebouncedCallback(
    (metaId: string, name: string) => updateMetaRecord(metaId, { name }),
    400,
  );
  const debouncedUpdateDescription = useDebouncedCallback(
    (metaId: string, description: string) =>
      updateMetaRecord(metaId, { description }),
    400,
  );

  useEffect(() => {
    setNameDraft(selectedNode?.meta.name ?? '');
    setDescriptionDraft(selectedNode?.meta.description ?? '');

    return () => {
      // Switching metas (or closing the drawer) shouldn't silently drop a
      // pending debounced edit typed just before the switch.
      debouncedUpdateName.flush();
      debouncedUpdateDescription.flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.meta.id]);

  const parentOptions = useMemo(() => {
    if (!isDefined(selectedNode)) {
      return [];
    }

    const excludedIds = collectMetaSubtreeIds(selectedNode);

    return flattenMetaForest(forest)
      .filter((node) => !excludedIds.has(node.meta.id))
      .map((node) => ({ value: node.meta.id, label: node.meta.name }));
  }, [forest, selectedNode]);

  const ownerName = useMemo(() => {
    const owner = workspaceMembers.find(
      (member) => member.id === selectedNode?.meta.ownerId,
    );

    return isDefined(owner)
      ? `${owner.name?.firstName ?? ''} ${owner.name?.lastName ?? ''}`.trim()
      : undefined;
  }, [workspaceMembers, selectedNode]);

  if (!isDefined(selectedNode)) {
    return null;
  }

  const { meta } = selectedNode;

  const parentNode = isDefined(meta.parentMetaId)
    ? findMetaNodeById(forest, meta.parentMetaId)
    : undefined;
  const parentCycleLabel = formatMetaPeriodLabel(parentNode?.meta.cycle);

  return (
    <StyledPanel>
      <StyledHeader>
        <StyledTitleRow>
          {isDefined(ownerName) ? (
            <Avatar
              placeholder={ownerName}
              placeholderColorSeed={meta.ownerId ?? meta.id}
              size="md"
            />
          ) : (
            <IconTarget size={18} />
          )}
          <TextInput
            value={nameDraft}
            fullWidth
            onChange={(name) => {
              setNameDraft(name);
              debouncedUpdateName(meta.id, name);
            }}
          />
        </StyledTitleRow>
        <StyledHeaderActions>
          <Button
            title="Ver a meta"
            variant="secondary"
            size="small"
            to={getLinkToShowPage(METAS_OBJECT_NAME_SINGULAR, { id: meta.id })}
          />
          <StyledCloseButton
            type="button"
            onClick={() => setSelectedMetaId(undefined)}
          >
            <IconX />
          </StyledCloseButton>
        </StyledHeaderActions>
      </StyledHeader>

      <StyledSection>
        <StyledFieldRow>
          <StyledFieldLabel>Proprietário da meta</StyledFieldLabel>
          <StyledFieldValue>
            <Select
              dropdownId="meta-detail-owner"
              options={workspaceMembers.map((member) => ({
                value: member.id,
                label:
                  `${member.name?.firstName ?? ''} ${member.name?.lastName ?? ''}`.trim(),
              }))}
              value={meta.ownerId ?? undefined}
              onChange={(ownerId) => updateMetaRecord(meta.id, { ownerId })}
            />
          </StyledFieldValue>
        </StyledFieldRow>

        <StyledFieldRow>
          <StyledFieldLabel>Período</StyledFieldLabel>
          <StyledFieldValue>
            <MetaPeriodField
              dropdownId="meta-detail-cycle"
              value={meta.cycle}
              onChange={(cycle) => updateMetaRecord(meta.id, { cycle })}
            />
          </StyledFieldValue>
        </StyledFieldRow>

        <StyledFieldRow>
          <StyledFieldLabel>Status</StyledFieldLabel>
          <StyledFieldValue>
            <Select
              dropdownId="meta-detail-status"
              options={META_STATUS_OPTIONS}
              value={meta.status ?? undefined}
              onChange={(status) => updateMetaRecord(meta.id, { status })}
            />
          </StyledFieldValue>
        </StyledFieldRow>

        <StyledFieldRow>
          <StyledFieldLabel>Data de conclusão</StyledFieldLabel>
          <StyledFieldValue>
            <MetaDueDateField
              dropdownId="meta-detail-due-date"
              value={meta.dueDate}
              onChange={(dueDate) => updateMetaRecord(meta.id, { dueDate })}
            />
          </StyledFieldValue>
        </StyledFieldRow>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Metas principais</StyledSectionTitle>
        {isDefined(parentNode) && (
          <StyledParentCard>
            <StyledParentCardName>{parentNode.meta.name}</StyledParentCardName>
            <StyledParentCardMeta>
              {Math.round(computeMetaRollupProgress(parentNode))}%
              {isDefined(parentCycleLabel) ? ` · ${parentCycleLabel}` : ''}
            </StyledParentCardMeta>
          </StyledParentCard>
        )}
        {parentOptions.length > 0 ? (
          <Select
            dropdownId="meta-detail-parent"
            options={parentOptions}
            emptyOption={{ value: '', label: 'Nenhuma (meta de topo)' }}
            value={meta.parentMetaId ?? ''}
            onChange={(parentMetaId) =>
              updateMetaRecord(meta.id, {
                parentMetaId: parentMetaId === '' ? null : parentMetaId,
              })
            }
          />
        ) : (
          <StyledParentCardMeta>
            Nenhuma outra meta disponível para vincular.
          </StyledParentCardMeta>
        )}
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Descrição</StyledSectionTitle>
        <TextArea
          textAreaId="meta-detail-description"
          placeholder="Clique para adicionar contexto a esta meta. Por que ela é importante? Como se definirá o seu sucesso?"
          value={descriptionDraft}
          minRows={3}
          onChange={(description) => {
            setDescriptionDraft(description);
            debouncedUpdateDescription(meta.id, description);
          }}
        />
      </StyledSection>

      <MetaProgressSection node={selectedNode} />
    </StyledPanel>
  );
};
