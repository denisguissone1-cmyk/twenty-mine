import { styled } from '@linaria/react';
import { useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { IconTarget } from 'twenty-ui/icon';

import { useDoObjectMetadataItemsExist } from '@/object-metadata/hooks/useDoObjectMetadataItemsExist';
import { PageCardLayout } from '@/ui/layout/page/components/PageCardLayout';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { MetaDetailSidePanel } from '@/metas/components/MetaDetailSidePanel';
import { MetasEmptyState } from '@/metas/components/MetasEmptyState';
import { MetasPageTabs } from '@/metas/components/MetasPageTabs';
import { MetasTreeCanvas } from '@/metas/components/MetasTreeCanvas';
import { METAS_OBJECT_NAME_SINGULAR } from '@/metas/constants/METAS_OBJECT_NAME_SINGULAR';
import { useMetaRecords } from '@/metas/hooks/useMetaRecords';
import {
  ALL_CYCLES_FILTER_VALUE,
  selectedCycleFilterState,
} from '@/metas/states/selectedCycleFilterState';
import { buildMetaForest } from '@/metas/utils/buildMetaTree';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

const StyledBody = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
`;

export const MetasPage = () => {
  const doesMetaObjectExist = useDoObjectMetadataItemsExist([
    METAS_OBJECT_NAME_SINGULAR,
  ]);

  if (!doesMetaObjectExist) {
    return (
      <PageCardLayout header={<PageHeader title="Metas" Icon={IconTarget} />}>
        <MetasEmptyState />
      </PageCardLayout>
    );
  }

  return <MetasPageContent />;
};

const MetasPageContent = () => {
  const { records } = useMetaRecords();
  const selectedCycleFilter = useAtomStateValue(selectedCycleFilterState);

  const fullForest = useMemo(() => buildMetaForest(records), [records]);

  const visibleForest = useMemo(
    () =>
      selectedCycleFilter === ALL_CYCLES_FILTER_VALUE
        ? fullForest
        : fullForest.filter((node) => node.meta.cycle === selectedCycleFilter),
    [fullForest, selectedCycleFilter],
  );

  return (
    <PageCardLayout
      header={<PageHeader title="Metas" Icon={IconTarget} />}
      secondaryBar={<MetasPageTabs />}
    >
      <StyledBody>
        <ReactFlowProvider>
          <MetasTreeCanvas forest={visibleForest} />
        </ReactFlowProvider>
        <MetaDetailSidePanel forest={fullForest} />
      </StyledBody>
    </PageCardLayout>
  );
};
