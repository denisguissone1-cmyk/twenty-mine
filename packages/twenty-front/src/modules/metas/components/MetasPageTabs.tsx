import { styled } from '@linaria/react';
import { TabButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledTabsRow = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  padding: 0 ${themeCssVariables.spacing[4]};
`;

// Only "Mapa estratégico" is implemented today — "Metas da equipe" and
// "Minhas metas" are Asana-parity placeholders for a future iteration.
export const MetasPageTabs = () => {
  return (
    <StyledTabsRow>
      <TabButton id="strategic-map" title="Mapa estratégico" active />
      <TabButton
        id="team-metas"
        title="Metas da equipe"
        disabled
        pill="Em breve"
      />
      <TabButton id="my-metas" title="Minhas metas" disabled pill="Em breve" />
    </StyledTabsRow>
  );
};
