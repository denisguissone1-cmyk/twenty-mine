import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const ALL_CYCLES_FILTER_VALUE = 'ALL';

export const selectedCycleFilterState = createAtomState<string>({
  key: 'selectedCycleFilterState',
  defaultValue: ALL_CYCLES_FILTER_VALUE,
});
