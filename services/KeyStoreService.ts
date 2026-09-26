// Nutzergebundener Key-Store (P4c) — Schluessel unter einem Alias, AES-256-GCM im Auth-Client.
//
// Was hier NIE passiert: ein Klartext verlaesst diesen Dienst ueber eine Lese-API. `list` liefert
// die maskierte Sicht (last4), `decrypt` nutzt nur die Host-Capability `keys.fetch`
// (services/keysCapability.ts), die den Wert hinter der Worker-Membran einsetzt. Der VM-Code
// hat keinen Bridge-Zugang zum Auth-Client.
//
// Master-Keys aus der Env: KEYSTORE_MASTER_KEY_V1 (hex, 64 Zeichen = 32 Byte), fuer die Rotation
// KEYSTORE_MASTER_KEY_V2, … — die Spalte keyVersion waehlt beim Entschluesseln. Fehlt V1, ist der
// Key-Store aus (REST 503 keystore_disabled, keys.fetch -> keys_unavailable); alles andere laeuft.
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { isIP } from 'net';
import type { PrismaClient } from '../store/generated/prisma-auth-client';

/** Aliase sind lowercase-only: ein Platzhalter in `defaultQuery` ueberlebt `mergeQueryParams`. */
export const KEY_ALIAS_RX = /^[a-z0-9][a-z0-9_-]{0,31}$/;
/** Unter 8 Zeichen wuerde der Scrub zu viele Falsch-Treffer erzeugen — solche Keys nehmen wir nicht. */
export const KEY_SECRET_MIN = 8;
export const KEY_SECRET_MAX = 4096;
const MAX_DOMAINS = 20;
const MAX_GRANTS = 50;
/** Eine Kennel-Lineage (Kennel-ID oder GUID) — ohne Komma, sie steht in einer CSV-Spalte. */
const KENNEL_GRANT_RX = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const HOST_LABEL_RX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const MASTER_KEY_ENV_RX = /^KEYSTORE_MASTER_KEY_V([1-9][0-9]*)$/;
const CIPHER = 'aes-256-gcm';

/** Ein Fehler des Key-Stores — die Tuer (REST oder MCP) uebersetzt ihn in ihre Sprache. */
export class KeyStoreError extends Error {
    constructor(readonly status: number, readonly code: string, message: string) {
        super(message);
    }
}

/** Die Zeile, wie der Auth-Client sie liefert. */
export interface UserKeyRow {
    id: string;
    ownerId: string;
    alias: string;
    last4: string;
    ciphertext: string;
    iv: string;
    authTag: string;
    keyVersion: number;
    allowedDomains: string;
    kennelGrants: string | null;
    quotaPerDay: number | null;
    usedToday: number;
    usedDayStamp: string | null;
    createdAt: Date;
    lastUsedAt: Date | null;
}

/** Was eine Lese-API zeigen darf — nie mehr. */
export interface KeyView {
    alias: string;
    last4: string;
    allowedDomains: string[];
    kennelGrants: string[];
    quotaPerDay: number | null;
    createdAt: string;
    lastUsedAt: string | null;
}

/** Eingabe fuer set (REST POST /api/keys, MCP set_key). */
export interface UserKeyInput {
    alias: unknown;
    secret: unknown;
    allowedDomains: unknown;
    /** Kennel-Lineages, in deren Laeufen dieser Key auch fuer fremde Runner gilt (8.8) — nur mit quotaPerDay. */
    kennelGrants?: unknown;
    quotaPerDay?: unknown;
}

/** Nur die Tabelle, die der Key-Store braucht — Tests reichen denselben Client. */
export type KeyStorePrisma = Pick<PrismaClient, 'userKey'>;

/** Wer verwaltet — die AuthCtx-Form von REST und MCP. */
export interface KeyStoreIdentityCtx {
    user?: { id: string } | null;
    isSuperUser?: boolean;
}

/** Tag im UTC-Kalender (wie KennelCallDaily) — Reset-Marke der Quota. */
export function keyQuotaDay(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/**
 * Die Master-Keys aus der Env. Verschluesselt wird mit der hoechsten Version, entschluesselt mit
 * der Version der Zeile. Validierung wie `mcp/auth/jwt.ts`: hex, genau 64 Zeichen.
 */
export class MasterKeyring {
    private constructor(private readonly byVersion: Map<number, Buffer>) {}

    /** null, wenn KEYSTORE_MASTER_KEY_V1 fehlt; wirft mit Erklaerung bei falschem Format. */
    static fromEnv(env: NodeJS.ProcessEnv): MasterKeyring | null {
        if (!(env.KEYSTORE_MASTER_KEY_V1 || '').trim()) return null;
        const keys = new Map<number, Buffer>();
        for (const [name, raw] of Object.entries(env)) {
            const m = MASTER_KEY_ENV_RX.exec(name);
            const hex = (raw || '').trim();
            if (!m || !hex) continue;
            keys.set(Number(m[1]), MasterKeyring.parseHex(name, hex));
        }
        return new MasterKeyring(keys);
    }

    /** Fuer Tests und das Rotations-Skript: Versionen direkt aus Byte-Puffern. */
    static fromKeys(keys: Record<number, Buffer>): MasterKeyring {
        const map = new Map<number, Buffer>();
        for (const [version, key] of Object.entries(keys)) {
            if (key.length !== 32) throw new Error(`master key V${version}: 32 bytes required`);
            map.set(Number(version), key);
        }
        return new MasterKeyring(map);
    }

    private static parseHex(name: string, hex: string): Buffer {
        if (!/^[0-9a-fA-F]+$/.test(hex)) {
            throw new Error(`${name} must be a hex string (only 0-9, a-f).`);
        }
        if (hex.length !== 64) {
            throw new Error(
                `${name} must be 64 hex chars (32 bytes for AES-256-GCM), got ${hex.length}. Generate one with:\n`
                + '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
            );
        }
        return Buffer.from(hex, 'hex');
    }

    get currentVersion(): number {
        return Math.max(...this.byVersion.keys());
    }

    keyFor(version: number): Buffer | undefined {
        return this.byVersion.get(version);
    }

    /**
     * Verschluesseln mit der aktuellen Version. Die Zeilen-Identitaet (owner, alias) ist AAD:
     * ein Chiffrat, das in eine fremde Zeile kopiert wird, entschluesselt dort nicht.
     */
    seal(ownerId: string, alias: string, secret: string): Pick<UserKeyRow, 'ciphertext' | 'iv' | 'authTag' | 'keyVersion'> {
        const keyVersion = this.currentVersion;
        const iv = randomBytes(12);
        const cipher = createCipheriv(CIPHER, this.keyFor(keyVersion)!, iv);
        cipher.setAAD(MasterKeyring.aadOf(ownerId, alias));
        const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
        return {
            ciphertext: ciphertext.toString('base64'),
            iv: iv.toString('base64'),
            authTag: cipher.getAuthTag().toString('base64'),
            keyVersion,
        };
    }

    /** Entschluesseln; wirft bei unbekannter Version oder falschem Tag (falscher Master-Key). */
    open(row: Pick<UserKeyRow, 'ownerId' | 'alias' | 'ciphertext' | 'iv' | 'authTag' | 'keyVersion'>): string {
        const key = this.keyFor(row.keyVersion);
        if (!key) throw new Error(`unknown keyVersion ${row.keyVersion}`);
        const decipher = createDecipheriv(CIPHER, key, Buffer.from(row.iv, 'base64'));
        decipher.setAAD(MasterKeyring.aadOf(row.ownerId, row.alias));
        decipher.setAuthTag(Buffer.from(row.authTag, 'base64'));
        return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, 'base64')), decipher.final()]).toString('utf8');
    }

    private static aadOf(ownerId: string, alias: string): Buffer {
        return Buffer.from(`${ownerId}\u0000${alias}`, 'utf8');
    }
}

/** Ein Hostname wie `api.example.com` oder eine Wildcard `*.example.com` — nie eine IP, nie ein Einzel-Label. */
function normalizeDomain(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const d = raw.trim().toLowerCase().replace(/\.$/, '');
    const wildcard = d.startsWith('*.');
    const host = wildcard ? d.slice(2) : d;
    if (!host || host.length > 253 || isIP(host)) return null;
    const labels = host.split('.');
    if (labels.length < 2 || !labels.every((l) => HOST_LABEL_RX.test(l))) return null;
    return wildcard ? `*.${host}` : host;
}

/** Die Allowlist aus der Eingabe: mindestens eine gueltige Domain, sonst invalid_domains. */
export function normalizeAllowedDomains(input: unknown): string[] {
    const list = Array.isArray(input) ? input : [];
    const out = [...new Set(list.map(normalizeDomain))];
    if (out.length === 0 || out.length > MAX_DOMAINS || out.some((d) => d === null)) {
        throw new KeyStoreError(400, 'invalid_domains',
            `allowedDomains: 1-${MAX_DOMAINS} hostnames required (api.example.com or *.example.com; no IPs, no single labels).`);
    }
    return out as string[];
}

/** Ist der Host erlaubt? Exakt, oder `*.suffix` fuer echte Subdomains (nicht die Domain selbst). */
export function hostAllowedBy(host: string, allowedDomains: string[]): boolean {
    const h = host.trim().toLowerCase().replace(/\.$/, '');
    return allowedDomains.some((d) => (d.startsWith('*.') ? h.endsWith(d.slice(1)) : h === d));
}

function parseCsv(csv: string | null | undefined): string[] {
    return (csv || '').split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Der Key-Store. Verwaltung (set/list/delete) je Besitzer; Aufloesung und Entschluesselung nur fuer
 * die Host-Capability. Ein Fehler beim Entschluesseln (falscher Master-Key, unbekannte keyVersion)
 * wird einmal je Prozess geloggt und als `key_undecryptable:<alias>` gemeldet — ohne Absturz.
 */
export class KeyStoreService {
    private undecryptableLogged = false;

    constructor(
        private readonly prisma: KeyStorePrisma,
        private readonly keyring: MasterKeyring | null,
        private readonly options: { superuserOwner?: string | null } = {},
    ) {}

    /**
     * Aus der Env: Master-Keys und — nur lokal (development) — KEYSTORE_SUPERUSER_OWNER. Ein falsch
     * geformter Master-Key schaltet den Store aus (laut, einmal), statt den Dienst zu stoppen.
     */
    static fromEnv(prisma: KeyStorePrisma, env: NodeJS.ProcessEnv = process.env): KeyStoreService {
        let keyring: MasterKeyring | null = null;
        try {
            keyring = MasterKeyring.fromEnv(env);
        } catch (err) {
            console.error(`[KeyStore] aus — ${(err as Error).message}`);
        }
        if (!keyring) console.log('[KeyStore] aus (KEYSTORE_MASTER_KEY_V1 fehlt) — POST /api/keys antwortet 503 keystore_disabled.');
        const nodeEnv = (env.NODE_ENV || 'development').trim();
        const rawOwner = (env.KEYSTORE_SUPERUSER_OWNER || '').trim();
        const superuserOwner = rawOwner && nodeEnv === 'development' ? rawOwner : null;
        if (rawOwner && !superuserOwner) console.warn(`[KeyStore] KEYSTORE_SUPERUSER_OWNER ignoriert (NODE_ENV=${nodeEnv}; nur lokal).`);
        if (superuserOwner) console.log('[KeyStore] KEYSTORE_SUPERUSER_OWNER gesetzt — Super-User-Laeufe nutzen die Keys dieses Nutzers (nur lokal).');
        return new KeyStoreService(prisma, keyring, { superuserOwner });
    }

    get enabled(): boolean {
        return this.keyring !== null;
    }

    /**
     * Wem gehoeren die Keys dieses Aufrufers? Die echte user.id; der Super-User ohne user nur, wenn
     * lokal KEYSTORE_SUPERUSER_OWNER gesetzt ist — sonst niemand (fail-closed).
     */
    identityOf(ctx: KeyStoreIdentityCtx | null | undefined): string | null {
        const userId = ctx?.user?.id;
        if (typeof userId === 'string' && userId.length > 0) return userId;
        if (ctx?.isSuperUser) return this.options.superuserOwner ?? null;
        return null;
    }

    /** Wie identityOf, aber als Fehler: 403 no_identity (Super-User ohne user), 503 wenn der Store aus ist. */
    requireOwner(ctx: KeyStoreIdentityCtx | null | undefined): string {
        const owner = this.identityOf(ctx);
        if (!owner) throw new KeyStoreError(403, 'no_identity', 'Keys belong to a real user — log in (the super-user has no identity).');
        if (!this.enabled) throw new KeyStoreError(503, 'keystore_disabled', 'The key store is off on this server.');
        return owner;
    }

    /** Anlegen oder ersetzen je (ownerId, alias). Antwort: die maskierte Sicht. */
    async set(ownerId: string, input: UserKeyInput): Promise<KeyView> {
        const keyring = this.requireKeyring();
        const alias = KeyStoreService.validAlias(input.alias);
        const secret = KeyStoreService.validSecret(input.secret);
        const allowedDomains = normalizeAllowedDomains(input.allowedDomains);
        const quotaPerDay = KeyStoreService.validQuota(input.quotaPerDay);
        const kennelGrants = KeyStoreService.validGrants(input.kennelGrants);
        if (kennelGrants.length > 0 && quotaPerDay === null) {
            throw new KeyStoreError(400, 'quota_required', 'kennelGrants need quotaPerDay — a granted key is used by other people, so it gets a daily cap.');
        }
        const sealed = keyring.seal(ownerId, alias, secret);
        const data = {
            last4: secret.slice(-4),
            ...sealed,
            allowedDomains: allowedDomains.join(','),
            kennelGrants: kennelGrants.length > 0 ? kennelGrants.join(',') : null,
            quotaPerDay,
        };
        const row = await this.prisma.userKey.upsert({
            where: { ownerId_alias: { ownerId, alias } },
            create: { ownerId, alias, ...data },
            update: data,
        });
        return KeyStoreService.viewOf(row as UserKeyRow);
    }

    /** Nur die eigenen, maskiert. */
    async list(ownerId: string): Promise<KeyView[]> {
        const rows = await this.prisma.userKey.findMany({ where: { ownerId }, orderBy: { alias: 'asc' } });
        return (rows as UserKeyRow[]).map((r) => KeyStoreService.viewOf(r));
    }

    /** true, wenn eine eigene Zeile fiel; fremd und unbekannt sind gleich (false). */
    async delete(ownerId: string, alias: string): Promise<boolean> {
        if (typeof alias !== 'string' || !KEY_ALIAS_RX.test(alias)) return false;
        const { count } = await this.prisma.userKey.deleteMany({ where: { ownerId, alias } });
        return count > 0;
    }

    /** Eine Zeile des Besitzers — fuer die Capability, nie fuer eine Antwort. */
    async findRow(ownerId: string, alias: string): Promise<UserKeyRow | null> {
        return (await this.prisma.userKey.findUnique({ where: { ownerId_alias: { ownerId, alias } } })) as UserKeyRow | null;
    }

    /**
     * Ein Key des Kennel-Owners, den er diesem Kennel freigegeben hat (8.8) — fuer Laeufe fremder
     * Runner. Nur mit Eintrag in kennelGrants; die Pflicht-Quota deckelt, was das kostet.
     */
    async findGrantedRow(ownerId: string, alias: string, kennelLineageId: string): Promise<UserKeyRow | null> {
        const row = await this.findRow(ownerId, alias);
        if (!row || row.quotaPerDay === null || row.quotaPerDay === undefined) return null;
        return parseCsv(row.kennelGrants).includes(kennelLineageId) ? row : null;
    }

    /** Der Klartext — nur im Speicher der Capability. Wirft key_undecryptable:<alias>. */
    decrypt(row: UserKeyRow): string {
        const keyring = this.keyring;
        try {
            if (!keyring) throw new Error('key store off');
            return keyring.open(row);
        } catch (err) {
            if (!this.undecryptableLogged) {
                this.undecryptableLogged = true;
                console.error(`[KeyStore] Schluessel nicht entschluesselbar (keyVersion ${row.keyVersion}: ${(err as Error).message}) — falscher Master-Key oder Rotation unvollstaendig. Einmal je Prozess gemeldet.`);
            }
            throw new KeyStoreError(500, `key_undecryptable:${row.alias}`, `key_undecryptable:${row.alias}`);
        }
    }

    /**
     * Quota je Key (4c.4 Schritt 4), atomar in der Datenbank: am selben Tag nur hoch, solange
     * usedToday < quotaPerDay; an einem neuen Tag zaehlt der Aufruf als erster. false = erschoepft.
     */
    async consumeQuota(row: UserKeyRow, now: Date = new Date()): Promise<boolean> {
        if (row.quotaPerDay === null || row.quotaPerDay === undefined) return true;
        const today = keyQuotaDay(now);
        const sameDay = await this.prisma.userKey.updateMany({
            where: { id: row.id, usedDayStamp: today, usedToday: { lt: row.quotaPerDay } },
            data: { usedToday: { increment: 1 } },
        });
        if (sameDay.count > 0) return true;
        if (row.quotaPerDay < 1) return false;
        const newDay = await this.prisma.userKey.updateMany({
            where: { id: row.id, OR: [{ usedDayStamp: null }, { usedDayStamp: { not: today } }] },
            data: { usedToday: 1, usedDayStamp: today },
        });
        return newDay.count > 0;
    }

    /** lastUsedAt nach einem Aufruf — best effort, ein Fehler kostet nur die Anzeige. */
    async touch(rowId: string, now: Date = new Date()): Promise<void> {
        try {
            await this.prisma.userKey.update({ where: { id: rowId }, data: { lastUsedAt: now } });
        } catch {
            /* Zeile inzwischen geloescht — nichts zu tun */
        }
    }

    /**
     * Umschluesseln auf die aktuelle Master-Key-Version (scripts/rotateKeystore.cjs). Batchweise,
     * ohne Ausgabe eines Werts; Zeilen, die nicht entschluesseln, bleiben unangetastet (failed).
     */
    async rotate(options: { ownerId?: string; batchSize?: number } = {}): Promise<{ target: number; rotated: number; failed: number }> {
        const keyring = this.requireKeyring();
        const target = keyring.currentVersion;
        const take = Math.max(1, options.batchSize ?? 100);
        let rotated = 0;
        let failed = 0;
        let cursor: string | undefined;
        for (;;) {
            const rows = (await this.prisma.userKey.findMany({
                where: { keyVersion: { not: target }, ...(options.ownerId ? { ownerId: options.ownerId } : {}) },
                orderBy: { id: 'asc' },
                take,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            })) as UserKeyRow[];
            if (rows.length === 0) break;
            for (const row of rows) {
                let secret: string;
                try {
                    secret = keyring.open(row);
                } catch {
                    failed++;
                    continue;
                }
                const sealed = keyring.seal(row.ownerId, row.alias, secret);
                await this.prisma.userKey.updateMany({
                    where: { id: row.id, keyVersion: row.keyVersion },
                    data: sealed,
                });
                rotated++;
            }
            cursor = rows[rows.length - 1].id;
        }
        return { target, rotated, failed };
    }

    static viewOf(row: UserKeyRow): KeyView {
        return {
            alias: row.alias,
            last4: row.last4,
            allowedDomains: parseCsv(row.allowedDomains),
            kennelGrants: parseCsv(row.kennelGrants),
            quotaPerDay: row.quotaPerDay ?? null,
            createdAt: new Date(row.createdAt).toISOString(),
            lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null,
        };
    }

    static allowedDomainsOf(row: UserKeyRow): string[] {
        return parseCsv(row.allowedDomains);
    }

    private requireKeyring(): MasterKeyring {
        if (!this.keyring) throw new KeyStoreError(503, 'keystore_disabled', 'The key store is off on this server.');
        return this.keyring;
    }

    private static validAlias(raw: unknown): string {
        if (typeof raw !== 'string' || !KEY_ALIAS_RX.test(raw)) {
            throw new KeyStoreError(400, 'invalid_alias', 'alias: 1-32 chars, lowercase a-z, 0-9, _ and -, starting with a letter or digit.');
        }
        return raw;
    }

    private static validSecret(raw: unknown): string {
        if (typeof raw !== 'string' || raw.length < KEY_SECRET_MIN || raw.length > KEY_SECRET_MAX || /[\r\n\0]/.test(raw)) {
            throw new KeyStoreError(400, 'invalid_secret', `secret: ${KEY_SECRET_MIN}-${KEY_SECRET_MAX} chars, one line.`);
        }
        return raw;
    }

    private static validGrants(raw: unknown): string[] {
        if (raw === undefined || raw === null) return [];
        const list = Array.isArray(raw) ? raw : null;
        if (!list || list.length > MAX_GRANTS || list.some((g) => typeof g !== 'string' || !KENNEL_GRANT_RX.test(g))) {
            throw new KeyStoreError(400, 'invalid_grants', `kennelGrants: up to ${MAX_GRANTS} kennel lineage ids.`);
        }
        return [...new Set(list as string[])];
    }

    private static validQuota(raw: unknown): number | null {
        if (raw === undefined || raw === null) return null;
        if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || raw > 1_000_000) {
            throw new KeyStoreError(400, 'invalid_quota', 'quotaPerDay: an integer from 1 to 1000000.');
        }
        return raw;
    }
}
