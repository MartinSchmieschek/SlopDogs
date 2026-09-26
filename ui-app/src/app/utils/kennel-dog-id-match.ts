/**
 * Graph-Knoten-id (Laufzeit) mit Kennel-dogIds-Eintrag abgleichen.
 * Matches by exact version ID, lineageId (lineage GUID), or base-dog name.
 */
export function graphNodeIdMatchesKennelDogId(
  graphNodeId: string,
  kennelDogId: string,
  graphNodeLineageId?: string
): boolean {
  if (kennelDogId.startsWith('base:')) {
    const baseName = kennelDogId.slice('base:'.length);
    return graphNodeId === baseName;
  }
  // Match by exact version ID, or by lineageId (lineage GUID)
  return graphNodeId === kennelDogId ||
    (!!graphNodeLineageId && graphNodeLineageId === kennelDogId);
}

/** Index in dogIds für einen Graph-Knoten (oder emitierten id), sonst -1 */
export function findKennelDogIndex(
  dogIds: string[],
  graphOrEmittedId: string,
  graphNodeLineageId?: string
): number {
  return dogIds.findIndex(kid =>
    graphNodeIdMatchesKennelDogId(graphOrEmittedId, kid, graphNodeLineageId)
  );
}
