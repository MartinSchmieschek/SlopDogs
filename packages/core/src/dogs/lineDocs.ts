/**
 * ~~~ LINE DOCS — ANNOTATIONS UPON A SPIRIT'S SCROLL ~~~
 *
 * A SerializedDog carries its purpose as code. lineDocs annotate ranges of that
 * code (1-based, inclusive) with a plain sentence — "the combat part lives in
 * lines 40-58" — so a reader can reach for one section without reading the whole
 * incantation. The docs are stored inside serializedDogConfig, travel with the
 * dog, and are read back by id + line.
 *
 * These are pure helpers: validate at the boundary (sanitizeLineDocs), query by
 * range (selectLineDocs), and slice the underlying code (sliceDogCodeLines).
 */

/** One annotation over a range of a dog's source code — 1-based, inclusive. */
export interface ILineDoc {
    /** First line of the annotated section (1-based, inclusive). */
    von: number;
    /** Last line of the annotated section (1-based, inclusive). */
    bis: number;
    /** What this section of the code does — a short sentence. */
    text: string;
}

/**
 * Normalize untrusted input into a clean list of lineDocs. Boundary guard:
 * every entry must carry finite positive integers with von <= bis and a
 * non-empty text; malformed entries are dropped. Returns an array (possibly
 * empty) so callers can store an explicit [] to clear existing docs.
 */
export function sanitizeLineDocs(input: unknown): ILineDoc[] {
    if (!Array.isArray(input)) return [];
    const out: ILineDoc[] = [];
    for (const raw of input) {
        if (!raw || typeof raw !== 'object') continue;
        const von = Math.trunc(Number((raw as any).von));
        const bis = Math.trunc(Number((raw as any).bis));
        const text = (raw as any).text;
        if (!Number.isFinite(von) || !Number.isFinite(bis)) continue;
        if (von < 1 || bis < von) continue;
        if (typeof text !== 'string' || text.trim().length === 0) continue;
        out.push({ von, bis, text: text.trim() });
    }
    return out;
}

/**
 * Return every annotation whose [von, bis] range intersects the requested
 * [fromLine, toLine] window. Defensive: tolerates malformed stored entries.
 */
export function selectLineDocs(lineDocs: unknown, fromLine: number, toLine: number): ILineDoc[] {
    if (!Array.isArray(lineDocs)) return [];
    const lo = Math.min(fromLine, toLine);
    const hi = Math.max(fromLine, toLine);
    const out: ILineDoc[] = [];
    for (const d of lineDocs as any[]) {
        if (!d || typeof d !== 'object') continue;
        const von = Math.trunc(Number(d.von));
        const bis = Math.trunc(Number(d.bis));
        if (!Number.isFinite(von) || !Number.isFinite(bis)) continue;
        if (von <= hi && bis >= lo) {
            out.push({ von, bis, text: String(d.text ?? '') });
        }
    }
    return out;
}

/**
 * Slice a dog's source code to the requested line window (1-based, inclusive),
 * clamped to the available lines. Returns null when the source is empty or the
 * window starts past the end.
 */
export function sliceDogCodeLines(
    source: unknown,
    fromLine: number,
    toLine: number,
): { fromLine: number; toLine: number; text: string } | null {
    if (typeof source !== 'string' || source.length === 0) return null;
    const lines = source.split('\n');
    const lo = Math.max(1, Math.min(fromLine, toLine));
    if (lo > lines.length) return null;
    const hi = Math.min(lines.length, Math.max(fromLine, toLine));
    return { fromLine: lo, toLine: hi, text: lines.slice(lo - 1, hi).join('\n') };
}
