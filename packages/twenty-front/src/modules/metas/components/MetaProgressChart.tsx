import { styled } from '@linaria/react';
import { ResponsiveLine } from '@nivo/line';
import { format } from 'date-fns';
import { isDefined } from 'twenty-shared/utils';
import { useTheme } from 'twenty-ui/theme-constants';

import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { type MetaProgressUpdate } from '@/metas/types/MetaProgressUpdate';
import { dateLocaleState } from '~/localization/states/dateLocaleState';

const StyledChartContainer = styled.div`
  height: 200px;
  width: 100%;
`;

export const MetaProgressChart = ({
  progressUpdates,
}: {
  progressUpdates: MetaProgressUpdate[];
}) => {
  const theme = useTheme();
  const dateLocale = useAtomStateValue(dateLocaleState);

  const points = progressUpdates
    .filter((update) => isDefined(update.date) && isDefined(update.value))
    .map((update) => ({
      // "d MMM" (e.g. "2 jul") sidesteps day/month-order ambiguity while still
      // following the user's language via the locale catalog.
      x: format(new Date(update.date as string), 'd MMM', {
        locale: dateLocale.localeCatalog,
      }),
      y: update.value as number,
    }));

  if (points.length === 0) {
    return null;
  }

  return (
    <StyledChartContainer>
      <ResponsiveLine
        data={[{ id: 'Progresso', data: points }]}
        curve="monotoneX"
        enableArea
        colors={[theme.color.blue]}
        margin={{ top: 16, right: 24, bottom: 32, left: 40 }}
        xScale={{ type: 'point' }}
        yScale={{ type: 'linear', min: 0, max: 100, stacked: false }}
        axisBottom={{ tickSize: 5, tickPadding: 5 }}
        axisLeft={{
          tickSize: 6,
          tickPadding: 5,
          tickValues: 5,
          format: (value) => `${value}%`,
        }}
        enableGridX={false}
        gridYValues={5}
        pointSize={6}
        pointColor={theme.color.blue}
        useMesh
        theme={{
          text: {
            fill: theme.font.color.light,
            fontSize: theme.font.size.sm,
            fontFamily: theme.font.family,
          },
          axis: {
            domain: { line: { stroke: theme.border.color.strong } },
            ticks: { line: { stroke: theme.border.color.strong } },
          },
          grid: { line: { stroke: theme.border.color.medium } },
        }}
      />
    </StyledChartContainer>
  );
};
