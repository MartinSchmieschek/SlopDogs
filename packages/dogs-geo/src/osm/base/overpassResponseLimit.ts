/**
 * ~~~ OVERPASS RESPONSE LIMIT — ein Deckel auf dem, was wir puffern ~~~
 *
 * Eine Overpass-Query ist eine Bitte, keine Zusage: was zurueckkommt, bestimmt die
 * BBox und der Zustand des Mirrors. Ein `res.json()` oder `res.text()` ohne Deckel
 * puffert die Antwort vollstaendig im Heap — und ein einziger zu weit gefasster
 * Tile-Fetch reisst in einem 512-MB-Container die Wasserlinie hoch, die danach
 * nicht mehr faellt.
 *
 * Darum liest JEDER Overpass-Pfad seinen Body hier durch: erst die deklarierte
 * Groesse (`content-length`) pruefen, und wenn der Header fehlt — was bei Overpass
 * der Normalfall ist, die Antwort kommt chunked — beim Lesen mitzaehlen und den
 * Strom abbrechen, sobald der Deckel reisst. Blind puffern und hinterher messen
 * hilft niemandem: zu dem Zeitpunkt liegt der Schaden schon im Speicher.
 *
 * Deckel: `OVERPASS_MAX_RESPONSE_BYTES` (Bytes, positiver Integer), Default 8 MiB.
 */

/** Default-Deckel fuer eine einzelne Overpass-Antwort: 8 MiB. */
export const DEFAULT_OVERPASS_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

/** Liest den Deckel aus `OVERPASS_MAX_RESPONSE_BYTES`; alles Unbrauchbare faellt auf den Default. */
export function getOverpassMaxResponseBytes(): number {
    const raw = process.env.OVERPASS_MAX_RESPONSE_BYTES;
    if (raw == null || raw === "") return DEFAULT_OVERPASS_MAX_RESPONSE_BYTES;
    const parsed = parseInt(raw, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_OVERPASS_MAX_RESPONSE_BYTES;
}

function asMib(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

/**
 * Die Antwort sprengt das Budget. Bewusst KEIN transienter Fehler: ein anderer
 * Mirror liefert dieselbe Query in derselben Groesse zurueck — hier hilft nur eine
 * engere Query oder ein hoeherer Deckel.
 */
export class OverpassResponseTooLargeError extends Error {
    constructor(
        public readonly userAgentLabel: string,
        public readonly observedBytes: number,
        public readonly maxBytes: number,
        /** true = Strom mitten im Lesen abgebrochen, die echte Groesse liegt ueber `observedBytes`. */
        public readonly aborted: boolean,
    ) {
        const observed = aborted
            ? `aborted after ${observedBytes} bytes (${asMib(observedBytes)}, actual size is larger)`
            : `response is ${observedBytes} bytes (${asMib(observedBytes)})`;
        super(
            `${userAgentLabel}: Overpass response too large — ${observed}, allowed are ${maxBytes} bytes ` +
            `(${asMib(maxBytes)}, OVERPASS_MAX_RESPONSE_BYTES). Narrow the query area or raise the limit.`,
        );
        this.name = "OverpassResponseTooLargeError";
    }
}

/**
 * Liest den Antwort-Body als Text, aber niemals mehr als den Deckel.
 *
 * Reihenfolge: `content-length` zuerst — steht dort schon zu viel, wird gar nicht
 * erst gelesen. Fehlt der Header, laeuft der Body durch einen Byte-Zaehler und der
 * Strom wird beim Ueberschreiten abgebrochen.
 */
export async function readOverpassBodyText(res: Response, userAgentLabel: string): Promise<string> {
    const maxBytes = getOverpassMaxResponseBytes();

    const declared = parseInt(res.headers.get("content-length") ?? "", 10);
    if (Number.isFinite(declared) && declared > maxBytes) {
        throw new OverpassResponseTooLargeError(userAgentLabel, declared, maxBytes, false);
    }

    const reader = res.body?.getReader?.();
    if (!reader) {
        // Kein lesbarer Strom (Polyfill, leerer Body): dann bleibt nur der volle Puffer.
        // Ohne content-length ist das die einzige Messung, die uebrig ist.
        const text = await res.text();
        const size = new TextEncoder().encode(text).byteLength;
        if (size > maxBytes) {
            throw new OverpassResponseTooLargeError(userAgentLabel, size, maxBytes, false);
        }
        return text;
    }

    const decoder = new TextDecoder();
    const parts: string[] = [];
    let received = 0;

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        received += value.byteLength;
        if (received > maxBytes) {
            await reader.cancel().catch(() => undefined);
            throw new OverpassResponseTooLargeError(userAgentLabel, received, maxBytes, true);
        }
        parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());

    return parts.join("");
}
