import { styled } from '@linaria/react';
import { Handle, Position } from '@xyflow/react';
import { IconFlag } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContainer = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  height: 96px;
  justify-content: center;
  width: 254px;
`;

const StyledLabel = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledIconBadge = styled.div`
  align-items: center;
  background: ${themeCssVariables.color.blue};
  border-radius: ${themeCssVariables.border.radius.rounded};
  display: flex;
  height: 20px;
  justify-content: center;
  width: 20px;
`;

export const MetaMissionNode = () => {
  return (
    <StyledContainer>
      <Handle type="source" position={Position.Bottom} />
      <StyledLabel>Nossa missão</StyledLabel>
      <StyledIconBadge>
        <IconFlag size={12} color={themeCssVariables.font.color.inverted} />
      </StyledIconBadge>
    </StyledContainer>
  );
};
