// BoundedSessionStore — der Session-Speicher mit Deckel.
// Ersetzt den MemoryStore von express-session, der ohne Obergrenze waechst und nur beim Zugriff
// aufraeumt: jeder anonyme Aufruf von /auth/google/login legt eine Sitzung (pkce) an, die sonst bis
// zum Neustart bleibt.
//
// Regeln:
//   - Werte liegen als JSON-String (wie MemoryStore) — keine geteilten Referenzen.
//   - Eingeloggte Sitzungen (sess.userId gesetzt) verfallen mit cookie.expires.
//   - Pending-Sitzungen ohne userId (nur pkce/betaKey/returnTo) verfallen zusaetzlich nach
//     pendingTtlMs seit dem letzten set/touch — genug fuer den Rundlauf login -> Google -> callback.
//   - Obergrenze max: beim set ueber der Grenze gehen erst Abgelaufene, dann die aeltesten
//     Pending-Sitzungen, erst danach die aeltesten ueberhaupt (LRU nach letztem set/touch).
//     Eine eingeloggte Sitzung weicht also nur, wenn keine Pending-Sitzung mehr da ist.
//   - Ein periodischer Prune-Timer (unref) raeumt Abgelaufene auch ohne Zugriff.
//
// LRU-Ordnung: die Map haelt Einfuegereihenfolge; set/touch loeschen und fuegen neu ein,
// der erste Eintrag ist damit immer der am laengsten unberuehrte.

import session from 'express-session';
import type { SessionData } from 'express-session';

const DEFAULT_MAX = 10_000;
const DEFAULT_PENDING_TTL_MS = 15 * 60 * 1000;
const DEFAULT_PRUNE_INTERVAL_MS = 60 * 1000;

export interface BoundedSessionStoreOptions {
    /** Obergrenze der gehaltenen Sitzungen. Default 10000. */
    max?: number;
    /** Lebensdauer einer Pending-Sitzung (ohne userId) seit letztem set/touch. Default 15 min. */
    pendingTtlMs?: number;
    /** Takt des Prune-Timers; 0 schaltet ihn ab. Default 60 s. */
    pruneIntervalMs?: number;
    /** Uhr (ms) — fuer Tests austauschbar. */
    now?: () => number;
}

export interface BoundedSessionStoreStats {
    sessions: number;
    pending: number;
    max: number;
}

interface StoredSession {
    json: string;
    pending: boolean;
    /** Zeitpunkt (ms), ab dem die Sitzung als verfallen gilt; Infinity = nie. */
    expiresAt: number;
}

type Callback = (err?: any) => void;

function positiveIntFromEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt((process.env[name] || '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const defer = (fn: (...args: any[]) => void, ...args: any[]): void => {
    setImmediate(fn, ...args);
};

export class BoundedSessionStore extends session.Store {
    private readonly sessions = new Map<string, StoredSession>();
    private readonly max: number;
    private readonly pendingTtlMs: number;
    private readonly now: () => number;
    private pruneTimer: NodeJS.Timeout | null = null;

    constructor(options: BoundedSessionStoreOptions = {}) {
        super();
        this.max = options.max ?? DEFAULT_MAX;
        this.pendingTtlMs = options.pendingTtlMs ?? DEFAULT_PENDING_TTL_MS;
        this.now = options.now ?? Date.now;
        const interval = options.pruneIntervalMs ?? DEFAULT_PRUNE_INTERVAL_MS;
        if (interval > 0) {
            this.pruneTimer = setInterval(() => this.prune(), interval);
            this.pruneTimer.unref();
        }
    }

    /** Grenzen aus der Umgebung: SESSION_STORE_MAX, SESSION_PENDING_TTL_MS (positive Integer, sonst Default). */
    static fromEnv(): BoundedSessionStore {
        return new BoundedSessionStore({
            max: positiveIntFromEnv('SESSION_STORE_MAX', DEFAULT_MAX),
            pendingTtlMs: positiveIntFromEnv('SESSION_PENDING_TTL_MS', DEFAULT_PENDING_TTL_MS),
        });
    }

    get(sid: string, callback: (err: any, session?: SessionData | null) => void): void {
        const stored = this.liveRecord(sid);
        defer(callback, null, stored ? (JSON.parse(stored.json) as SessionData) : null);
    }

    set(sid: string, sess: SessionData, callback?: Callback): void {
        this.sessions.delete(sid);
        this.sessions.set(sid, this.recordOf(sess));
        if (this.sessions.size > this.max) this.enforceMax();
        if (callback) defer(callback);
    }

    destroy(sid: string, callback?: Callback): void {
        this.sessions.delete(sid);
        if (callback) defer(callback);
    }

    /** Frischt Ablauf und LRU-Rang auf; das Cookie kommt neu, der Rest bleibt wie gespeichert. */
    touch(sid: string, sess: SessionData, callback?: () => void): void {
        const stored = this.liveRecord(sid);
        if (stored) {
            const current = JSON.parse(stored.json) as SessionData;
            current.cookie = sess.cookie;
            this.sessions.delete(sid);
            this.sessions.set(sid, this.recordOf(current));
        }
        if (callback) defer(callback);
    }

    all(callback: (err: any, obj?: { [sid: string]: SessionData } | null) => void): void {
        this.prune();
        const out: { [sid: string]: SessionData } = Object.create(null);
        for (const [sid, stored] of this.sessions) {
            out[sid] = JSON.parse(stored.json) as SessionData;
        }
        defer(callback, null, out);
    }

    length(callback: (err: any, length?: number) => void): void {
        this.prune();
        defer(callback, null, this.sessions.size);
    }

    clear(callback?: Callback): void {
        this.sessions.clear();
        if (callback) defer(callback);
    }

    /** Zahlen fuer die Diagnose — keine Sitzungs-IDs. */
    stats(): BoundedSessionStoreStats {
        this.prune();
        let pending = 0;
        for (const stored of this.sessions.values()) {
            if (stored.pending) pending++;
        }
        return { sessions: this.sessions.size, pending, max: this.max };
    }

    /** Entfernt alle verfallenen Sitzungen. */
    prune(): void {
        const now = this.now();
        for (const [sid, stored] of this.sessions) {
            if (stored.expiresAt <= now) this.sessions.delete(sid);
        }
    }

    /** Stoppt den Prune-Timer (Tests, geordnetes Herunterfahren). */
    close(): void {
        if (this.pruneTimer) clearInterval(this.pruneTimer);
        this.pruneTimer = null;
    }

    private liveRecord(sid: string): StoredSession | undefined {
        const stored = this.sessions.get(sid);
        if (!stored) return undefined;
        if (stored.expiresAt <= this.now()) {
            this.sessions.delete(sid);
            return undefined;
        }
        return stored;
    }

    private recordOf(sess: SessionData): StoredSession {
        // userId kommt aus der SessionData-Erweiterung in sessions.ts; hier ohne sie lesbar.
        const pending = !(sess as { userId?: unknown }).userId;
        const cookieExpiry = BoundedSessionStore.cookieExpiry(sess);
        const expiresAt = pending ? Math.min(cookieExpiry, this.now() + this.pendingTtlMs) : cookieExpiry;
        return { json: JSON.stringify(sess), pending, expiresAt };
    }

    private static cookieExpiry(sess: SessionData): number {
        const raw = (sess.cookie as { expires?: Date | string | null } | undefined)?.expires;
        if (!raw) return Number.POSITIVE_INFINITY;
        const ms = (typeof raw === 'string' ? new Date(raw) : raw).getTime();
        return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
    }

    /** Ueber der Grenze: Abgelaufene, dann aelteste Pending, dann aelteste ueberhaupt. */
    private enforceMax(): void {
        this.prune();
        if (this.sessions.size <= this.max) return;
        for (const [sid, stored] of this.sessions) {
            if (this.sessions.size <= this.max) return;
            if (stored.pending) this.sessions.delete(sid);
        }
        for (const sid of this.sessions.keys()) {
            if (this.sessions.size <= this.max) return;
            this.sessions.delete(sid);
        }
    }
}
