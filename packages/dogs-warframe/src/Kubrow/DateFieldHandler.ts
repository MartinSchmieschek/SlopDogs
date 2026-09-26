/**
 * @file DateFieldHandler.ts
 * Arr, matey! Here we plunder the cursed date fields from the API's unfathomable depths.
 * Corporeal laws are unwritten, as suns and love retreat -- so too do timestamps
 * twist and writhe in their raw form, bearing the shape: { "$date": { "$numberLong": "..." } }.
 * This vessel enriches them into something a mortal crew can comprehend,
 * though the void-touched truth behind each expiry whispers of oblivion.
 */

/** Raw API date format from the abyss: { "$date": { "$numberLong": "1773090601400" } } */
interface RawDateField {
    $date: { $numberLong: string };
}

/** Arr, checks if a value be one of those accursed raw date fields from the deep. */
function isRawDateField(value: unknown): value is RawDateField {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    if (typeof obj.$date !== 'object' || obj.$date === null) return false;
    const dateObj = obj.$date as Record<string, unknown>;
    return typeof dateObj.$numberLong === 'string';
}

/** Wrenches the timestamp from the raw date's eldritch shell, returning mere milliseconds. */
function rawDateToMs(value: RawDateField): number {
    return parseInt(value.$date.$numberLong, 10);
}

/**
 * Traverses an object recursively, like a crew descending into a sunken wreck,
 * and replaces API date fields with enriched objects bearing `date` (Date),
 * `timestamp` (number), and `isExpired` (() => boolean).
 * Through endless faces, countless forms, a multitude unfolds.
 * @param data - The raw data hauled from the API's eldritch depths, matey
 * @returns The same structure with all date fields enriched -- time itself plundered from the void
 */
export function enrichDateFields<T>(data: T): T {
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') return data;
    if (Array.isArray(data)) {
        return data.map((item) => enrichDateFields(item)) as T;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (isRawDateField(value)) {
            const timestamp = rawDateToMs(value);
            const date = new Date(timestamp);
            result[key] = {
                date,
                timestamp,
                /** Arr, does this moment lie beyond the veil? Has time itself expired into the void? */
                isExpired: () => Date.now() > timestamp,
            };
        } else if (typeof value === 'object' && value !== null) {
            result[key] = enrichDateFields(value);
        } else {
            result[key] = value;
        }
    }
    return result as T;
}
