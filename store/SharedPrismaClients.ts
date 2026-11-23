/**
 * Ein Prisma-Client statt vier im Single-DB-Betrieb (PLAN-DOG-PAKETE P1.4).
 *
 * Store, Run-Cache, JSON-Storage und Auth haben je ein eigenes Prisma-Schema und damit je einen
 * eigenen generierten Client — jeder mit eigener Query-Engine (eigene Engine-Bibliothek, ~6-7 MB
 * RSS) und eigenem Connection-Pool. Liegen die Teile physisch in derselben Datenbank (Postgres:
 * gespiegelte DATABASE_URL; SQLite: dieselbe Datei), bedient der Store-Client sie mit. Die Regel
 * dafuer steht in scripts/dbEnv.cjs (sharesStoreDatabase) — dieselbe, nach der run-prisma-sync.cjs
 * entscheidet, welche Schemas gepusht werden.
 *
 * Mehr-DB bleibt Option: zeigt eine Teil-URL woandershin (anderer Host, andere DB, anderes
 * ?schema=, andere SQLite-Datei), entsteht fuer diesen Teil wie bisher ein eigener Client.
 *
 * Warum der Cast des Store-Clients auf den Teil-Client-Typ traegt: das Haupt-Schema
 * (store/prisma/schema.prisma bzw. schema.postgres.prisma) fuehrt dieselben Modelle 1:1 — gleiche
 * Namen, Felder, Typen (BigInt, DateTime, Float) und Schluessel. Damit hat der Store-Client
 * dieselben Delegates (cacheEntry, jsonEntry, user, …) mit demselben Laufzeitverhalten. Die
 * Teil-Clients werden nur noch per `import type` und im eigenen Fall per `require` genutzt;
 * niemand prueft `instanceof` gegen ihre Fehlerklassen (Fehler werden ueber `code` erkannt).
 * scripts/check-prisma-schemas.cjs bricht ab, sobald ein Modell abweicht.
 */

import path from 'path';
import type { PrismaClient as StorePrismaClient } from '@prisma/client';

/** Die Teil-Datenbanken neben dem Store — die Schluessel aus scripts/dbEnv.cjs. */
export type SubDatabaseKind = 'cache' | 'jsonStorage' | 'auth';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dbEnv = require(path.join(process.cwd(), 'scripts', 'dbEnv.cjs')) as {
    sharesStoreDatabase: (kind: SubDatabaseKind) => boolean;
};

/** Was jeder Prisma-Client kann und hier gebraucht wird. */
type DisconnectablePrismaClient = { $disconnect(): Promise<void> };

/**
 * Ein ausgeliehener oder eigener Prisma-Client. Nur der Besitzer trennt ihn: ein geliehener
 * Store-Client gehoert dem PrismaStore, sein Pool endet mit store.disconnect().
 */
export class PrismaClientLease<T extends DisconnectablePrismaClient> {
    constructor(
        public readonly client: T,
        public readonly owned: boolean,
    ) {}

    /** Trennt den eigenen Client; ein geliehener bleibt unberuehrt. */
    public async release(): Promise<void> {
        if (this.owned) await this.client.$disconnect();
    }
}

const SUB_DATABASE_LABELS: Record<SubDatabaseKind, string> = { cache: 'Cache', jsonStorage: 'JSON', auth: 'Auth' };

export class SharedPrismaClients {
    private readonly decisions = new Map<SubDatabaseKind, boolean>();

    /**
     * @param storeClient der Client des PrismaStore — er bleibt dessen Besitz.
     * @param sharesStoreDatabase die Regel aus scripts/dbEnv.cjs; als Parameter, damit sie sich ersetzen laesst.
     */
    constructor(
        private readonly storeClient: StorePrismaClient,
        private readonly sharesStoreDatabase: (kind: SubDatabaseKind) => boolean = dbEnv.sharesStoreDatabase,
    ) {}

    /**
     * Liefert fuer die Teil-Datenbank `kind` den Store-Client (geliehen), wenn sie physisch die
     * Store-Datenbank ist, sonst einen eigenen Client aus `createOwn`. `createOwn` laedt den
     * generierten Teil-Client erst im eigenen Fall — sonst kaeme dessen Engine trotzdem in den Prozess.
     */
    public lease<T extends DisconnectablePrismaClient>(kind: SubDatabaseKind, createOwn: () => T): PrismaClientLease<T> {
        const shared = this.sharesStoreDatabase(kind);
        this.decisions.set(kind, shared);
        // Cast: siehe Kopfkommentar (gleiche Modelle 1:1, geprueft von scripts/check-prisma-schemas.cjs).
        return shared ? new PrismaClientLease(this.storeClient as unknown as T, false) : new PrismaClientLease(createOwn(), true);
    }

    /** Eine Boot-Zeile: welche Teile den Store-Client teilen, welche eigene Clients haben. */
    public describe(): string {
        const shared = [...this.decisions].filter(([, s]) => s).map(([k]) => SUB_DATABASE_LABELS[k]);
        const separate = [...this.decisions].filter(([, s]) => !s).map(([k]) => SUB_DATABASE_LABELS[k]);
        const clientCount = 1 + separate.length;
        if (separate.length === 0) return `[db] ein Prisma-Client fuer Store+${shared.join('+')} (Single-DB)`;
        const sharedPart = shared.length ? `Store+${shared.join('+')} teilen einen` : 'Store allein';
        return `[db] ${clientCount} Prisma-Clients: ${sharedPart}, eigene Datenbank: ${separate.join(', ')}`;
    }
}
