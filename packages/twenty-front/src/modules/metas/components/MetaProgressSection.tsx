import { styled } from '@linaria/react';
import { Button } from 'twenty-ui/input';
import { IconChartLine } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { META_PROGRESS_UPDATE_MODAL_ID } from '@/metas/constants/MetaProgressUpdateModalId';
import { MetaProgressChart } from '@/metas/components/MetaProgressChart';
import { MetaProgressUpdateModal } from '@/metas/components/MetaProgressUpdateModal';
import { useMetaProgressUpdates } from '@/metas/hooks/useMetaProgressUpdates';
import { type MetaTreeNode } from '@/metas/utils/buildMetaTree';
import { computeMetaRollupProgress } from '@/metas/utils/computeMetaRollupProgress';
import { useModal } from '@/ui/layout/modal/hooks/useModal';

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

const StyledRollupText = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

const StyledCurrentValue = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

export const MetaProgressSection = ({ node }: { node: MetaTreeNode }) => {
  const { openModal } = useModal();
  const hasChildren = node.children.length > 0;
  const { progressUpdates, refetch } = useMetaProgressUpdates(
    hasChildren ? undefined : node.meta.id,
  );

  return (
    <StyledSection>
      <StyledSectionTitle>Progresso</StyledSectionTitle>

      {hasChildren ? (
        <StyledRollupText>
          Calculado automaticamente pela média das sub-metas:{' '}
          {Math.round(computeMetaRollupProgress(node))}%
        </StyledRollupText>
      ) : (
        <>
          <StyledCurrentValue>
            {Math.round(node.meta.progress ?? 0)}%
          </StyledCurrentValue>
          <Button
            title="Atualizar o progresso"
            Icon={IconChartLine}
            variant="secondary"
            onClick={() => openModal(META_PROGRESS_UPDATE_MODAL_ID)}
          />
          <MetaProgressChart progressUpdates={progressUpdates} />
          <MetaProgressUpdateModal
            key={node.meta.id}
            metaId={node.meta.id}
            currentValue={node.meta.progress ?? 0}
            onSaved={refetch}
          />
        </>
      )}
    </StyledSection>
  );
};
