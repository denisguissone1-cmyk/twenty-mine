import { isDefined } from 'twenty-shared/utils';

import { type MetaRecord } from '@/metas/types/MetaRecord';

export type MetaTreeNode = {
  meta: MetaRecord;
  children: MetaTreeNode[];
};

// Builds a forest (list of root trees) from a flat record list + parentMetaId
// pointers. Guards against malformed cycles (a user could edit parentMeta
// into a loop) — a record already seen on the current path is treated as a
// root instead of recursing forever.
export const buildMetaForest = (records: MetaRecord[]): MetaTreeNode[] => {
  const childrenByParentId = new Map<string, MetaRecord[]>();

  for (const record of records) {
    if (!isDefined(record.parentMetaId)) {
      continue;
    }

    const siblings = childrenByParentId.get(record.parentMetaId) ?? [];

    siblings.push(record);
    childrenByParentId.set(record.parentMetaId, siblings);
  }

  const buildNode = (
    meta: MetaRecord,
    visitedIds: ReadonlySet<string>,
  ): MetaTreeNode => {
    if (visitedIds.has(meta.id)) {
      // meta.parentMeta forms a cycle (user-editable relation) — render this
      // record as a leaf instead of recursing forever.
      return { meta, children: [] };
    }

    const nextVisitedIds = new Set(visitedIds).add(meta.id);
    const children = childrenByParentId.get(meta.id) ?? [];

    return {
      meta,
      children: children.map((child) => buildNode(child, nextVisitedIds)),
    };
  };

  return records
    .filter((record) => !isDefined(record.parentMetaId))
    .map((record) => buildNode(record, new Set()));
};
