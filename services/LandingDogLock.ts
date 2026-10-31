// LandingDogLock — welche Dogs die Landing-Kennels nutzen (fix/k-sandbox, 2026-10-31).
//
// `/` und `/k/<landing>` laufen ohne Sandbox auf dem Origin der App. Ein Dog ohne Besitzer ist nach den
// Rechten v2 fuer jeden Eingeloggten aenderbar (community) — steckt er in einer Landing, waere die Startseite
// damit fuer jeden umschreibbar. Diese Klasse rechnet die Menge der Lineages, die die Landing-Kennels nutzen
// (dogIds und deren Parents, transitiv), und legt sie in LandingKennels ab; isLandingLocked sperrt daraus die
// besitzerlosen. Dogs mit Besitzer bleiben beim Besitzer. Keine Datenmigration: die Regel liest nur, was da ist.
//
// Berechnet wird beim Start (im Hintergrund; bis dahin gelten besitzerlose Dogs als gesperrt), nach jeder
// Aenderung am Referenzindex (gebuendelt) und in einem festen Takt (Env-/Seed-Aenderungen ohne Index-Ereignis).
import { BASE_DOG_PREFIX } from '@martinschmieschek/slopdogs-core/runtime';
import { LandingKennels } from '../mcp/auth/landingKennels';

/** Die Kopfversion eines Dogs, soweit die Sperre sie braucht. */
export interface LandingDogHead {
    lineageId?: string;
    id?: string;
    parentsRequired?: unknown;
    parentsOptional?: unknown;
}

export interface LandingDogLockDeps {
    /** dogIds der Kopfversion eines Kennels; null, wenn es ihn nicht gibt. */
    kennelDogIds(kennelId: string): Promise<string[] | null>;
    /** Eine Referenz (lineageId, Versions-GUID, base:X, blanker Klassenname) -> lineageId; null fuer Base-Dogs. */
    lineageOf(ref: string): Promise<string | null>;
    /** Kopfversionen dieser Lineages (SerializedDog und MimicDog). */
    dogHeads(lineageIds: string[]): Promise<LandingDogHead[]>;
    /** Abhaengige melden Aenderungen (DogReferenceIndex.onChange). */
    onChange?(listener: () => void): void;
}

export interface LandingDogLockOptions {
    /** Buendelung nach einer Aenderung, Default 1000 ms. */
    debounceMs?: number;
    /** Fester Takt, Default 300000 ms; 0 schaltet ab. */
    intervalMs?: number;
    /** Obergrenze der besuchten Dogs je Berechnung. */
    maxDogs?: number;
}

function refList(raw: unknown): string[] {
    let list: unknown = raw;
    if (typeof raw === 'string') {
        try {
            list = JSON.parse(raw);
        } catch {
            return [];
        }
    }
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
}

export class LandingDogLock {
    static readonly DEFAULT_DEBOUNCE_MS = 1_000;
    static readonly DEFAULT_INTERVAL_MS = 300_000;
    static readonly DEFAULT_MAX_DOGS = 2_000;

    private timer: NodeJS.Timeout | null = null;
    private interval: NodeJS.Timeout | null = null;
    private running: Promise<void> | null = null;
    private again = false;

    constructor(
        private readonly deps: LandingDogLockDeps,
        private readonly options: LandingDogLockOptions = {},
    ) {}

    /** Haengt sich an die Aenderungen, startet den Takt und die erste Berechnung (nicht abgewartet). */
    start(): this {
        this.deps.onChange?.(() => this.schedule());
        const intervalMs = this.options.intervalMs ?? LandingDogLock.DEFAULT_INTERVAL_MS;
        if (intervalMs > 0) {
            this.interval = setInterval(() => void this.refresh(), intervalMs);
            this.interval.unref?.();
        }
        void this.refresh();
        return this;
    }

    stop(): void {
        if (this.timer) clearTimeout(this.timer);
        if (this.interval) clearInterval(this.interval);
        this.timer = null;
        this.interval = null;
    }

    /** Nach einer Aenderung: einmal gebuendelt neu rechnen. */
    schedule(): void {
        if (this.timer) return;
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.refresh();
        }, this.options.debounceMs ?? LandingDogLock.DEFAULT_DEBOUNCE_MS);
        this.timer.unref?.();
    }

    /** Rechnet die Menge neu und legt sie ab. Laeuft schon eine Berechnung, folgt genau eine weitere. Wirft nie. */
    refresh(): Promise<void> {
        if (this.running) {
            this.again = true;
            return this.running;
        }
        this.running = (async () => {
            do {
                this.again = false;
                try {
                    const lineages = await this.compute();
                    LandingKennels.setLockedDogs(lineages);
                } catch (err) {
                    // Die alte Menge bleibt; vor der ersten gilt jeder besitzerlose Dog als gesperrt.
                    console.error(
                        '[LandingDogLock] Berechnung gescheitert — bisherige Sperre bleibt:',
                        err instanceof Error ? err.message : err,
                    );
                }
            } while (this.again);
        })().finally(() => {
            this.running = null;
        });
        return this.running;
    }

    /** Alle Dog-Lineages, die die Landing-Kennels nutzen — Breitensuche ueber dogIds und Parents. */
    async compute(): Promise<Set<string>> {
        const maxDogs = this.options.maxDogs ?? LandingDogLock.DEFAULT_MAX_DOGS;
        const seen = new Set<string>();
        let frontier: string[] = [];
        for (const kennelId of LandingKennels.protectedIds()) {
            const dogIds = await this.deps.kennelDogIds(kennelId);
            if (dogIds) frontier.push(...dogIds);
        }
        while (frontier.length > 0 && seen.size < maxDogs) {
            const next: string[] = [];
            for (const ref of frontier) {
                if (ref.startsWith(BASE_DOG_PREFIX)) continue;
                const lineageId = await this.deps.lineageOf(ref);
                if (!lineageId || seen.has(lineageId)) continue;
                seen.add(lineageId);
                next.push(lineageId);
            }
            if (next.length === 0) break;
            const heads = await this.deps.dogHeads(next);
            frontier = [];
            for (const head of heads) {
                frontier.push(...refList(head.parentsRequired), ...refList(head.parentsOptional));
            }
        }
        if (seen.size >= maxDogs) {
            console.warn(`[LandingDogLock] Obergrenze ${maxDogs} Dogs erreicht — Landing-Kette ungewoehnlich gross.`);
        }
        return seen;
    }
}
