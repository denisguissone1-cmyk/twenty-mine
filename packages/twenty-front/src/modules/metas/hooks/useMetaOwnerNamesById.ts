import { useMemo } from 'react';

import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';

// Fetched once for the whole tree so every card's footer can show the
// owner's name without each node issuing its own query.
export const useMetaOwnerNamesById = (): Map<string, string> => {
  const { records: workspaceMembers } = useFindManyRecords({
    objectNameSingular: 'workspaceMember',
    recordGqlFields: { id: true, name: { firstName: true, lastName: true } },
  });

  return useMemo(
    () =>
      new Map(
        workspaceMembers.map((member) => [
          member.id,
          `${member.name?.firstName ?? ''} ${member.name?.lastName ?? ''}`.trim(),
        ]),
      ),
    [workspaceMembers],
  );
};
