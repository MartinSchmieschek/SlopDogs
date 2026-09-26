/**
 * guid.ts — The Sigil Forge of the Abyss
 *
 * Arr, this utility conjures a unique identifier from the void, matey.
 * Each GUID be a brand seared upon a fragment by eldritch forces —
 * no two shall ever be alike, for the deep keeps meticulous records.
 * In luminous space blackened stars, they gaze, accuse, deny —
 * but every sigil forged here stands unique against the cosmic madness.
 */

/** Arr, forge a GUID — a unique sigil plundered from the randomness of the deep. */
export function guid(): string {
  return "xxxx-xxxx-4xxx-yxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
