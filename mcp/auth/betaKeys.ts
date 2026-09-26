// Beta-Keys (2026-09-26, 10-0: "ein key ein google user"). Ein Schalter: SLOPDOGS_STAGE=beta. Er zeigt den
// Beta-Sticker der Landing (LandingPage.withHost) und verlangt Beta-Keys — aber nur, wenn Auth an ist
// (MCP_AUTH_REQUIRED=true); lokal ohne Auth gibt es keine Konten, also auch keine Keys.
//
// Mit Keys: jedes Google-Konto muss einmal freigeschaltet sein — ein neues beim Anlegen, ein bestehendes beim
// naechsten Login. Ein Key schaltet genau ein Konto frei und laeuft nicht ab; er endet durch Einloesen oder
// Widerruf. Gespeichert wird nur der SHA-256-Hash (wie RefreshToken); den Klartext sieht nur, wer ihn anlegt,
// einmal. Die Adressen in BETA_ADMIN_EMAILS kommen ohne Key herein und verwalten die Keys; lokal der Super-User.

import { createHash, randomBytes } from 'crypto';
import type { AuthCtx } from './middleware';

/** Eine Zeile der Tabelle BetaKey (store/prisma-auth/schema*.prisma). */
export interface BetaKeyRow {
    id: string;
    codeHash: string;
    last4: string;
    note: string | null;
    createdBy: string | null;
    createdAt: Date;
    revokedAt: Date | null;
    usedByUserId: string | null;
    usedAt: Date | null;
}

export interface BetaUserRow {
    id: string;
    email: string;
    name: string | null;
    picture: string | null;
}

export interface GoogleProfile {
    googleSub: string;
    email: string;
    name: string | null;
    picture: string | null;
}

/**
 * Der Ausschnitt des Auth-Clients, den die Beta-Keys brauchen — strukturell, damit Tests ihn faelschen koennen
 * und der Typ nicht am generierten Client haengt.
 */
export interface BetaKeyTx {
    betaKey: {
        create(args: { data: Partial<BetaKeyRow> & { codeHash: string; last4: string } }): Promise<BetaKeyRow>;
        findMany(args?: { orderBy?: Record<string, 'asc' | 'desc'> }): Promise<BetaKeyRow[]>;
        findUnique(args: { where: { id?: string; codeHash?: string; usedByUserId?: string } }): Promise<BetaKeyRow | null>;
        update(args: { where: { id: string }; data: Partial<BetaKeyRow> }): Promise<BetaKeyRow>;
        updateMany(args: { where: Record<string, unknown>; data: Partial<BetaKeyRow> }): Promise<{ count: number }>;
    };
    user: {
        create(args: { data: GoogleProfile }): Promise<BetaUserRow>;
        update(args: { where: { id: string }; data: Partial<GoogleProfile> }): Promise<BetaUserRow>;
        findMany(args: { where: { id: { in: string[] } }; select: { id: true; email: true } }): Promise<Array<{ id: string; email: string }>>;
    };
}

export interface BetaKeyPrisma extends BetaKeyTx {
    $transaction<T>(fn: (tx: BetaKeyTx) => Promise<T>): Promise<T>;
}

/** Warum ein Key nicht (mehr) taugt — die Key-Seite sagt es dem Menschen, ohne den Key zu nennen. */
export type BetaKeyRefusal = 'missing' | 'invalid' | 'used' | 'revoked';

export class BetaKeyError extends Error {
    constructor(readonly reason: BetaKeyRefusal) {
        super(`beta_key_${reason}`);
    }
}

/** Was eine Liste zeigt: nie Hash oder Klartext. */
export interface BetaKeyView {
    id: string;
    last4: string;
    note: string | null;
    createdBy: string | null;
    createdAt: string;
    revokedAt: string | null;
    usedAt: string | null;
    usedBy: string | null;
    state: 'open' | 'used' | 'revoked';
}

export class BetaKeys {
    static readonly PREFIX = 'sdbeta_';
    /** Der Wert von SLOPDOGS_STAGE, der Sticker und Keys einschaltet. */
    static readonly BETA_STAGE = 'beta';
    /** Menschenlesbare Texte je Ablehnung (Key-Seite, englisch wie die App). */
    static readonly REFUSAL_TEXT: Record<BetaKeyRefusal, string> = {
        missing: 'SlopDogs is in closed beta. Your Google account needs a beta key, once.',
        invalid: 'That beta key is not valid.',
        used: 'That beta key has already unlocked another Google account.',
        revoked: 'That beta key has been revoked.',
    };

    constructor(private readonly prisma: BetaKeyPrisma, private readonly now: () => Date = () => new Date()) {}

    /** SLOPDOGS_STAGE, normalisiert (Kleinbuchstaben, nur [a-z0-9-]) — sicher fuer ein HTML-Attribut. */
    static stage(env: NodeJS.ProcessEnv = process.env): string {
        return (env.SLOPDOGS_STAGE ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32);
    }

    /** Keys werden verlangt: Stage beta UND Auth an. Lokal ohne Auth nie. */
    static required(env: NodeJS.ProcessEnv = process.env): boolean {
        return BetaKeys.stage(env) === BetaKeys.BETA_STAGE && env.MCP_AUTH_REQUIRED === 'true';
    }

    /** BETA_ADMIN_EMAILS (kommagetrennt, ohne Gross-/Kleinschreibung). */
    static isAdminEmail(email: string | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
        const wanted = email?.trim().toLowerCase();
        if (!wanted) return false;
        return (env.BETA_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean).includes(wanted);
    }

    /** Wer Keys verwaltet: BETA_ADMIN_EMAILS, lokal zusaetzlich der Super-User. */
    static isAdmin(ctx: AuthCtx | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
        if (ctx?.isSuperUser) return true;
        return BetaKeys.isAdminEmail(ctx?.user?.email, env);
    }

    static hash(code: string): string {
        return createHash('sha256').update(code.trim()).digest('hex');
    }

    /** Ein neuer Klartext-Key: Praefix + 24 Zeichen base64url (144 Bit). */
    static generate(): string {
        return BetaKeys.PREFIX + randomBytes(18).toString('base64url');
    }

    /** Legt einen Key an. Der Klartext kommt nur hier einmal zurueck. */
    async create(input: { note?: unknown }, createdBy: string | null): Promise<{ code: string; key: BetaKeyView }> {
        const code = BetaKeys.generate();
        const row = await this.prisma.betaKey.create({
            data: {
                codeHash: BetaKeys.hash(code),
                last4: code.slice(-4),
                note: typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 200) : null,
                createdBy,
            },
        });
        return { code, key: this.view(row, new Map()) };
    }

    async list(): Promise<BetaKeyView[]> {
        const rows = await this.prisma.betaKey.findMany({ orderBy: { createdAt: 'desc' } });
        const userIds = rows.map((r) => r.usedByUserId).filter((id): id is string => !!id);
        const users = userIds.length
            ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
            : [];
        const emails = new Map(users.map((u) => [u.id, u.email]));
        return rows.map((r) => this.view(r, emails));
    }

    /** Widerrufen: ein offener Key taugt danach nicht mehr; ein eingeloester bleibt eingeloest (das Konto bleibt frei). */
    async revoke(id: string): Promise<BetaKeyView | null> {
        const row = await this.prisma.betaKey.findUnique({ where: { id } });
        if (!row) return null;
        const next = row.revokedAt ? row : await this.prisma.betaKey.update({ where: { id }, data: { revokedAt: this.now() } });
        return this.view(next, new Map());
    }

    /** Ist dieses Konto schon freigeschaltet (hat es einen Key eingeloest)? */
    async isUnlocked(userId: string): Promise<boolean> {
        return !!(await this.prisma.betaKey.findUnique({ where: { usedByUserId: userId } }));
    }

    /**
     * Die Anmeldung mit Beta-Keys: ein freigeschaltetes Konto kommt herein (Profil aktualisiert); sonst braucht es
     * einen gueltigen Key — ein neues Konto wird dabei angelegt, ein bestehendes freigeschaltet. Nutzer und Key in
     * einer Transaktion, der Key per bedingtem Update (offen, nicht widerrufen): trifft es nichts, rollt der Nutzer
     * zurueck. Zwei gleichzeitige Anmeldungen mit einem Key ergeben genau ein freigeschaltetes Konto.
     */
    async admit(code: string | undefined, profile: GoogleProfile, existing: { id: string } | null): Promise<BetaUserRow> {
        if (existing && (await this.isUnlocked(existing.id))) {
            return this.prisma.user.update({ where: { id: existing.id }, data: profile });
        }
        if (!code || !code.trim()) throw new BetaKeyError('missing');
        const codeHash = BetaKeys.hash(code);
        const refusal = this.refusalOf(await this.prisma.betaKey.findUnique({ where: { codeHash } }));
        if (refusal) throw new BetaKeyError(refusal);
        const now = this.now();
        return this.prisma.$transaction(async (tx) => {
            const user = existing
                ? await tx.user.update({ where: { id: existing.id }, data: profile })
                : await tx.user.create({ data: profile });
            const taken = await tx.betaKey.updateMany({
                where: { codeHash, usedByUserId: null, revokedAt: null },
                data: { usedByUserId: user.id, usedAt: now },
            });
            if (taken.count !== 1) throw new BetaKeyError('used');
            return user;
        });
    }

    private refusalOf(row: BetaKeyRow | null): BetaKeyRefusal | null {
        if (!row) return 'invalid';
        if (row.revokedAt) return 'revoked';
        if (row.usedByUserId) return 'used';
        return null;
    }

    private view(r: BetaKeyRow, emails: Map<string, string>): BetaKeyView {
        const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
        return {
            id: r.id,
            last4: r.last4,
            note: r.note,
            createdBy: r.createdBy,
            createdAt: new Date(r.createdAt).toISOString(),
            revokedAt: iso(r.revokedAt),
            usedAt: iso(r.usedAt),
            usedBy: r.usedByUserId ? emails.get(r.usedByUserId) ?? r.usedByUserId : null,
            state: r.usedByUserId ? 'used' : r.revokedAt ? 'revoked' : 'open',
        };
    }
}
