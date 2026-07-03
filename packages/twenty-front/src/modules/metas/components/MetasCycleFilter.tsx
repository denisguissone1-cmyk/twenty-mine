import { isDefined } from 'twenty-shared/utils';

import { useMetaRecords } from '@/metas/hooks/useMetaRecords';
import {
  ALL_CYCLES_FILTER_VALUE,
  selectedCycleFilterState,
} from '@/metas/states/selectedCycleFilterState';
import {
  formatMetaPeriodLabel,
  META_PERIOD_TYPE_OPTIONS,
  parseMetaPeriodValue,
} from '@/metas/types/MetaPeriod';
import { Select } from '@/ui/input/components/Select';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

// Options are derived from the periods actually in use — cycle is free-text
// now, so there's no fixed catalog to filter against.
const buildCycleOptions = (cycles: string[]) =>
  Array.from(new Set(cycles))
    .sort((a, b) => {
      const periodA = parseMetaPeriodValue(a);
      const periodB = parseMetaPeriodValue(b);

      if (!periodA || !periodB) {
        return 0;
      }

      if (periodA.year !== periodB.year) {
        return periodA.year - periodB.year;
      }

      const typeOrderA = META_PERIOD_TYPE_OPTIONS.findIndex(
        (option) => option.value === periodA.type,
      );
      const typeOrderB = META_PERIOD_TYPE_OPTIONS.findIndex(
        (option) => option.value === periodB.type,
      );

      return typeOrderA !== typeOrderB
        ? typeOrderA - typeOrderB
        : periodA.index - periodB.index;
    })
    .map((cycle) => ({
      value: cycle,
      label: formatMetaPeriodLabel(cycle) ?? cycle,
    }));

export const MetasCycleFilter = () => {
  const [selectedCycleFilter, setSelectedCycleFilter] = useAtomState(
    selectedCycleFilterState,
  );
  const { records } = useMetaRecords();

  const options = [
    { value: ALL_CYCLES_FILTER_VALUE, label: 'Todos os períodos' },
    ...buildCycleOptions(
      records.map((record) => record.cycle).filter(isDefined),
    ),
  ];

  return (
    <Select
      dropdownId="metas-cycle-filter"
      options={options}
      value={selectedCycleFilter}
      onChange={setSelectedCycleFilter}
    />
  );
};
