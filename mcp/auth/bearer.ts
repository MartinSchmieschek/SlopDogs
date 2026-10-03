// Resolve an authenticated user from a Bearer Authorization header.
// Returns null if header missing, malformed, JWT invalid, or token revoked/expired.
// Used by mcp/auth/middleware.ts before falling back to the session cookie.

import type { Request } from 'express';
import type { PrismaClient } from '../../store/generated/prisma-auth-client';
import { verifyAccessToken } from './jwt';

export interface BearerUser {
    id: string;
    email: string;
    name: string | null;
    clientId: string;
    scope: string;
}

function extractBearer(req: Request): string | null {
    const h = req.headers.authorization;
    if (!h) return null;
    const m = /^Bearer\s+(.+)$/i.exec(h);
    return m ? m[1].trim() : null;
}

export async function tryResolveBearerUser(
    req: Request,
    prisma: PrismaClient,
): Promise<BearerUser | null> {
    const token = extractBearer(req);
    if (!token) return null;

    const claims = await verifyAccessToken(token);
    if (!claims) return null;

    // Revocation + expiry check via DB row.
    const row = await prisma.accessToken.findUnique({ where: { jti: claims.jti } });
    if (!row) return null;
    if (row.revokedAt) return null;
    if (row.expiresAt.getTime() < Date.now()) return null;

    // Nutzungsspur, nicht blockierend (fire-and-forget): Zaehler + letzter Zeitpunkt + Ringpuffer der
    // letzten Calls auf der Token-Zeile. Per Design begrenzt (max RECENT_CALLS_MAX), keine wachsende Tabelle.
    void recordTokenUse(prisma, row, req);

    const user = await prisma.user.findUnique({
        where: { id: claims.sub },
        select: { id: true, email: true, name: true },
    });
    if (!user) return null;

    return {
        ...user,
        clientId: claims.aud,
        scope: claims.scope,
    };
}

/** Wie viele der letzten Calls je Token behalten werden — der Ringpuffer bleibt klein und begrenzt. */
const RECENT_CALLS_MAX = 20;

/**
 * Nutzungsspur eines Tokens fortschreiben: useCount hoch (atomar), lastUsedAt gesetzt, und der Call
 * (Zeit/Methode/Pfad) an den Ringpuffer recentCalls gehaengt, auf die letzten RECENT_CALLS_MAX gekuerzt.
 * Bewusst fire-and-forget und best-effort: ein Fehler hier darf nie eine Anfrage scheitern lassen, und
 * ein unter Nebenlauf verlorener Ringpuffer-Eintrag ist hinnehmbar (useCount bleibt via increment korrekt).
 */
async function recordTokenUse(
    prisma: PrismaClient,
    row: { jti: string; recentCalls: string | null },
    req: Request,
): Promise<void> {
    try {
        let calls: Array<{ at: string; method: string; path: string }> = [];
        try {
            const parsed = row.recentCalls ? JSON.parse(row.recentCalls) : [];
            if (Array.isArray(parsed)) calls = parsed;
        } catch { /* kaputter Puffer -> frisch anfangen */ }
        const path = String(req.originalUrl || req.path || '').split('?')[0].slice(0, 200);
        calls.push({ at: new Date().toISOString(), method: String(req.method || ''), path });
        if (calls.length > RECENT_CALLS_MAX) calls = calls.slice(-RECENT_CALLS_MAX);
        await prisma.accessToken.update({
            where: { jti: row.jti },
            data: { useCount: { increment: 1 }, lastUsedAt: new Date(), recentCalls: JSON.stringify(calls) },
        });
    } catch { /* best-effort: Nutzungsspur darf nie eine Anfrage blockieren */ }
}
