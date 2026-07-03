import { styled } from '@linaria/react';
import { Panel } from '@xyflow/react';
import { Button } from 'twenty-ui/input';
import { IconPlus } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { MetasCycleFilter } from '@/metas/components/MetasCycleFilter';
import { useCreateMetaRecord } from '@/metas/hooks/useCreateMetaRecord';

const StyledToolbar = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  box-shadow: ${themeCssVariables.boxShadow.light};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
`;

export const MetasToolbar = () => {
  const { createMetaRecord } = useCreateMetaRecord();

  const handleCreateMeta = () => {
    createMetaRecord({ name: 'Nova meta', progress: 0 });
  };

  return (
    <Panel position="top-left" data-canvas-export-ignore="true">
      <StyledToolbar>
        <Button
          title="Criar meta"
          Icon={IconPlus}
          variant="secondary"
          onClick={handleCreateMeta}
        />
        <MetasCycleFilter />
      </StyledToolbar>
    </Panel>
  );
};
