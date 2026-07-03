import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

// Id of the Meta awaiting delete confirmation (drives the ConfirmationModal on
// the tree canvas). Set from the right-click menu, cleared on confirm/cancel.
export const metaToDeleteIdState = createAtomState<string | undefined>({
  key: 'metaToDeleteIdState',
  defaultValue: undefined,
});
