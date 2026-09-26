// Cookie-based session middleware for the browser login flow.
// Stores PKCE state during the OAuth round-trip, then the resolved userId after callback.
// Memory store is fine for single-instance Render — for horizontal scaling, swap to Postgres/Redis later.

import session from 'express-session';
import type { RequestHandler } from 'express';

declare module 'express-session' {
    interface SessionData {
        userId?: string;
        /** Beta-Key aus /auth/google/login?betaKey= — gilt nur fuer das Anlegen eines neuen Kontos (BETA_MODE). */
        betaKey?: string;
        pkce?: {
            codeVerifier: string;
            state: string;
            returnTo?: string;
        };
    }
}

export function createSessionMiddleware(): RequestHandler {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
        throw new Error('SESSION_SECRET must be set in .env (32+ random chars)');
    }

    // Deployed (Render, hinter TLS-Proxy) braucht das Session-Cookie secure:true --
    // zusammen mit `trust proxy` (siehe createHttpApplication) wird es dann korrekt
    // gesetzt. Lokal (development, http://localhost) MUSS secure:false sein, sonst
    // liefert der Browser das Cookie nie aus -> kein Login noetig, aber Flows testbar.
    // Default nach NODE_ENV; SESSION_COOKIE_SECURE ueberschreibt explizit.
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isDeployed = nodeEnv === 'production' || nodeEnv === 'integration';
    const secureOverride = process.env.SESSION_COOKIE_SECURE;
    const secure =
        secureOverride != null && secureOverride.trim() !== ''
            ? secureOverride === 'true'
            : isDeployed;

    return session({
        secret,
        name: 'slopdogs.sid',
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure,
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        },
    });
}
