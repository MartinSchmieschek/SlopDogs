// ApproxHeapSize — die Waage fuer das, was der Prozess im Gedaechtnis traegt.
// Schaetzt den Heap-Anteil eines Objektgraphen, ohne ihn zu serialisieren.
//
// Annahmen (bewusst grob, lieber zu schwer als zu leicht — ein Unterschaetzen sprengt den Heap):
//   - Iterativer Walk mit eigenem Stapel: tiefe Daten fuehren nicht zum Stack-Overflow.
//   - Identitaets-Dedupe ueber ein Set besuchter Objekte: was mehrfach referenziert wird
//     (vmContext zeigt auf dieselben Ergebnisse wie result), zaehlt einmal. Ein Schaetzer kann
//     ueber mehrere Wurzeln hinweg (waves + leadResult) dasselbe Set benutzen.
//   - Strings: Laenge x 1 Byte (Latin-1) bzw. x 2 Byte (sonst) + STRING_OVERHEAD. Gleiche
//     Strings an verschiedenen Stellen werden mehrfach gezaehlt (V8 teilt sie oft) — Ueberschaetzung.
//   - Zahlen, Booleans, null, undefined: PRIMITIVE_BYTES fix (HeapNumber/Slot).
//   - Objekte: OBJECT_OVERHEAD + je eigener Eigenschaft PROPERTY_OVERHEAD + Schluessellaenge.
//   - Arrays: OBJECT_OVERHEAD + ARRAY_SLOT_BYTES je Slot.
//   - Map/Set: wie Objekte, Schluessel und Werte werden gewalkt.
//   - ArrayBuffer und Views (Buffer, TypedArrays): byteLength + OBJECT_OVERHEAD, kein Abstieg.
//   - Funktionen und Symbole: 0, kein Abstieg (Code gehoert nicht zur Beute).
//   - Getter werden nicht ausgeloest (Property-Descriptor statt Lesen); ein Proxy oder ein
//     werfender Zugriff wird normal gelesen, Fehler verschluckt — der Eintrag zaehlt dann nur Overhead.
//   - Kein JSON.stringify des Ganzen: keine Zehn-Megabyte-String-Spitze nur fuers Wiegen.
//   - Optionales Limit: ist die Summe darueber, bricht der Walk ab — das Ergebnis ist dann
//     >= limit, genau genug fuer "zu gross".

const NON_LATIN1 = /[^\u0000-ÿ]/;

/** Arrays bis zu dieser Laenge werden per Index gelaufen, laengere (duenn besetzt) per Object.keys. */
const DENSE_ARRAY_MAX = 1 << 24;

export class ApproxHeapSize {
    static readonly OBJECT_OVERHEAD = 64;
    static readonly PROPERTY_OVERHEAD = 16;
    static readonly ARRAY_SLOT_BYTES = 8;
    static readonly STRING_OVERHEAD = 16;
    static readonly PRIMITIVE_BYTES = 16;

    private readonly visited = new Set<object>();
    private readonly stack: unknown[] = [];
    private total = 0;

    constructor(private readonly limit: number = Number.POSITIVE_INFINITY) {}

    /** Bequemer Einstieg: wiegt alle Wurzeln mit gemeinsamem Dedupe. */
    static of(roots: unknown[], limit?: number): number {
        const scale = new ApproxHeapSize(limit);
        for (const root of roots) scale.add(root);
        return scale.bytes;
    }

    /** Die bisher gezaehlten Bytes (ueber alle add()-Aufrufe). */
    get bytes(): number {
        return this.total;
    }

    /** Ist das Limit ueberschritten, wird nicht weiter gezaehlt. */
    get exceeded(): boolean {
        return this.total > this.limit;
    }

    /** Wiegt eine weitere Wurzel; bereits Gesehenes zaehlt nicht doppelt. */
    add(root: unknown): this {
        this.stack.push(root);
        while (this.stack.length > 0 && !this.exceeded) {
            this.visit(this.stack.pop());
        }
        this.stack.length = 0;
        return this;
    }

    private visit(value: unknown): void {
        switch (typeof value) {
            case 'string':
                this.total += ApproxHeapSize.stringBytes(value);
                return;
            case 'number':
            case 'boolean':
            case 'undefined':
                this.total += ApproxHeapSize.PRIMITIVE_BYTES;
                return;
            case 'bigint':
                this.total += ApproxHeapSize.PRIMITIVE_BYTES + Math.ceil(value.toString(16).length / 2);
                return;
            case 'function':
            case 'symbol':
                return;
            case 'object':
                if (value === null) {
                    this.total += ApproxHeapSize.PRIMITIVE_BYTES;
                    return;
                }
                if (this.visited.has(value)) return;
                this.visited.add(value);
                this.visitObject(value);
                return;
        }
    }

    private visitObject(obj: object): void {
        this.total += ApproxHeapSize.OBJECT_OVERHEAD;
        try {
            if (Array.isArray(obj)) return this.visitArray(obj);
            if (obj instanceof ArrayBuffer) {
                this.total += obj.byteLength;
                return;
            }
            if (ArrayBuffer.isView(obj)) {
                this.total += obj.byteLength;
                return;
            }
            if (obj instanceof Date) return;
            if (obj instanceof RegExp) {
                this.total += ApproxHeapSize.stringBytes(obj.source);
                return;
            }
            if (obj instanceof Map) {
                for (const [k, v] of obj) {
                    this.total += ApproxHeapSize.PROPERTY_OVERHEAD;
                    this.stack.push(k, v);
                }
                return;
            }
            if (obj instanceof Set) {
                for (const v of obj) {
                    this.total += ApproxHeapSize.PROPERTY_OVERHEAD;
                    this.stack.push(v);
                }
                return;
            }
            this.visitProperties(obj);
        } catch {
            // Proxy oder exotisches Objekt, das sich dem Blick verweigert — nur Overhead zaehlt.
        }
    }

    private visitArray(arr: unknown[]): void {
        const length = arr.length;
        if (length <= DENSE_ARRAY_MAX) {
            this.total += length * ApproxHeapSize.ARRAY_SLOT_BYTES;
            for (let i = 0; i < length; i++) this.stack.push(this.readIndex(arr, i));
            return;
        }
        const keys = Object.keys(arr);
        this.total += keys.length * ApproxHeapSize.ARRAY_SLOT_BYTES;
        for (const key of keys) this.stack.push(this.readOwn(arr, key));
    }

    private visitProperties(obj: object): void {
        // getOwnPropertyNames statt keys: auch nicht-aufzaehlbare Daten (message/stack an Fehlern) wiegen.
        for (const key of Object.getOwnPropertyNames(obj)) {
            this.total += ApproxHeapSize.PROPERTY_OVERHEAD + key.length;
            this.stack.push(this.readOwn(obj, key));
        }
    }

    /** Wert einer eigenen Eigenschaft, ohne einen Getter auszuloesen. */
    private readOwn(obj: object, key: string): unknown {
        try {
            const descriptor = Object.getOwnPropertyDescriptor(obj, key);
            return descriptor && 'value' in descriptor ? descriptor.value : undefined;
        } catch {
            return undefined;
        }
    }

    private readIndex(arr: unknown[], index: number): unknown {
        try {
            return arr[index];
        } catch {
            return undefined;
        }
    }

    private static stringBytes(s: string): number {
        const perChar = NON_LATIN1.test(s) ? 2 : 1;
        return ApproxHeapSize.STRING_OVERHEAD + s.length * perChar;
    }
}
