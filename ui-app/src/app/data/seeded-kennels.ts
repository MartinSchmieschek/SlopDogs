/**
 * The kennels the server seeds from the repo when they are missing (Spur K, mcp/auth/landingKennels.ts `seededIds`).
 * A maintainer may delete them: unused dogs go with them, and the next restart seeds them again.
 */
export const SEEDED_KENNEL_IDS: readonly string[] = ['slopdogs-landing', 'slopdogs-kennels'];

export function isSeededKennel(ref: string | null | undefined): boolean {
  const wanted = (ref ?? '').toLowerCase();
  return !!wanted && SEEDED_KENNEL_IDS.includes(wanted);
}

/** `GET /api/kennels/:id/delete-preview` and the answer of `DELETE` on a seeded kennel. */
export interface SeededKennelDeleteReport {
  ok: boolean;
  dogsDeleted?: Array<{ lineageId: string; displayName: string }>;
  dogsKept?: Array<{ lineageId: string; displayName: string; usedBy: string[] }>;
  reseed?: string;
}

export const RESEED_NOTE = 'It is seeded again from the repo at the next restart.';

/** "N dogs are deleted with it. M stay because other kennels use them: …" plus the reseed note. */
export function seededDeleteSummary(report: SeededKennelDeleteReport, done: boolean): string {
  const gone = report.dogsDeleted?.length ?? 0;
  const kept = report.dogsKept ?? [];
  const dogs = (n: number) => `${n} dog${n === 1 ? '' : 's'}`;
  const parts = [done ? `Deleted. ${dogs(gone)} went with it.` : `${dogs(gone)} ${gone === 1 ? 'is' : 'are'} deleted with it.`];
  if (kept.length) {
    const names = kept.map((d) => `${d.displayName} (${d.usedBy.join(', ')})`).join('; ');
    parts.push(`${kept.length} ${kept.length === 1 ? 'stays' : 'stay'} because other kennels use ${kept.length === 1 ? 'it' : 'them'}: ${names}.`);
  }
  parts.push(RESEED_NOTE);
  return parts.join(' ');
}
