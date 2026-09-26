// Resolves the current user from Bearer header (MCP/Action clients) or session
// cookie (browser flow), and attaches it to req.ctx. Never blocks — filtering
// happens in route handlers.
//
// MCP_AUTH_REQUIRED=false  -> ctx.isSuperUser=true, all access granted
// MCP_AUTH_REQUIRED=true   -> ctx.user set if Bearer or session resolves, anon otherwise

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { PrismaClient } from '../../store/generated/prisma-auth-client';
import { tryResolveBearerUser } from './bearer';

export interface AuthCtx {
    user: { id: string; email: string; name: string | null } | null;
    isSuperUser: boolean;
    via?: 'bearer' | 'session';
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            ctx?: AuthCtx;
        }
    }
}

export function isAuthRequired(): boolean {
    return process.env.MCP_AUTH_REQUIRED === 'true';
}

/** Exit-Code des Startup-Guards: EX_CONFIG (sysexits.h) — die Konfiguration ist falsch, nicht der Code. */
export const EX_CONFIG = 78;

/**
 * Startup-Guard (P3.5): der Super-User-Modus (jede Anfrage darf alles) ist nur fuer die lokale
 * Entwicklung. In production/integration ohne `MCP_AUTH_REQUIRED=true` waere jeder Besucher
 * Super-User — dann startet der Dienst nicht. Liefert die Fehlerzeile oder null; in dev die
 * einmalige Hinweiszeile ueber `onOpen`.
 */
export function authModeBootError(
    env: NodeJS.ProcessEnv,
    onOpen: (line: string) => void = () => undefined,
): string | null {
    const nodeEnv = (env.NODE_ENV || 'development').trim();
    if (env.MCP_AUTH_REQUIRED === 'true') return null;
    if (nodeEnv === 'production' || nodeEnv === 'integration') {
        return '[boot] MCP_AUTH_REQUIRED must be true in production/integration';
    }
    onOpen('[boot] superuser mode (MCP_AUTH_REQUIRED unset)');
    return null;
}

export function createAuthContextMiddleware(prisma: PrismaClient): RequestHandler {
    return async (req: Request, _res: Response, next: NextFunction) => {
        try {
            // Dev mode: skip auth entirely, every request is super-user.
            if (!isAuthRequired()) {
                req.ctx = { user: null, isSuperUser: true };
                next();
                return;
            }

            // Bearer first (MCP / Action / API clients). Falls back to session.
            const bearer = await tryResolveBearerUser(req, prisma);
            if (bearer) {
                req.ctx = {
                    user: { id: bearer.id, email: bearer.email, name: bearer.name },
                    isSuperUser: false,
                    via: 'bearer',
                };
                next();
                return;
            }

            // Session cookie (browser flow).
            const userId = req.session?.userId;
            if (!userId) {
                req.ctx = { user: null, isSuperUser: false };
                next();
                return;
            }

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, email: true, name: true },
            });

            if (!user) {
                // Stale session — clear it.
                if (req.session) req.session.userId = undefined;
                req.ctx = { user: null, isSuperUser: false };
                next();
                return;
            }

            req.ctx = { user, isSuperUser: false, via: 'session' };
            next();
        } catch (err) {
            console.error('[auth/middleware]', err);
            // On error, fail closed: no user, no super-user.
            req.ctx = { user: null, isSuperUser: false };
            next();
        }
    };
}
