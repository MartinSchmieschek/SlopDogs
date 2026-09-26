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
