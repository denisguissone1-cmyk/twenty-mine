import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

// Ids of Metas whose sub-metas are currently hidden from the tree canvas.
export const collapsedMetaIdsState = createAtomState<ReadonlySet<string>>({
  key: 'collapsedMetaIdsState',
  defaultValue: new Set(),
});
