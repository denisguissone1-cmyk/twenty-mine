import { styled } from '@linaria/react';
import { IconTarget } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContainer = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  justify-content: center;
  padding: ${themeCssVariables.spacing[8]};
  text-align: center;
`;

export const MetasEmptyState = () => {
  return (
    <StyledContainer>
      <IconTarget size={48} />
      <p>
        O objeto "Meta" ainda não foi configurado neste workspace. Rode o script{' '}
        <code>setup-metas-object.ts</code> (com uma API key de administrador)
        para criar o objeto e os campos necessários.
      </p>
    </StyledContainer>
  );
};
