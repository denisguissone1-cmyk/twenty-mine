import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const selectedMetaIdState = createAtomState<string | undefined>({
  key: 'selectedMetaIdState',
  defaultValue: undefined,
});
