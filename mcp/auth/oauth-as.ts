// OAuth 2.1 Authorization Server endpoints.
//
//   GET  /auth/authorize   browser flow start; renders consent if logged in
//   POST /auth/authorize   consent submit; issues authorization code
//   POST /auth/token       code -> tokens, refresh -> new access token
//   POST /auth/revoke      revoke an access or refresh token
//   POST /auth/register    Dynamic Client Registration (RFC 7591)
//
// PKCE (S256) is REQUIRED for all authorization_code flows. Refresh tokens are
// random + DB-stored hashed; access tokens are JWTs (HS256) plus a DB row keyed
// by jti so revocation works for both.

import { Router, type Request, type Response } from 'express';
import type { PrismaClient } from '../../store/generated/prisma-auth-client';
import { randomBytes, createHash } from 'crypto';
import {
    issueAccessToken,
    newRefreshToken,
    hashRefreshToken,
    verifyAccessToken,
} from './jwt';
import { loadClient, isRedirectAllowed, registerClient } from './clients';
import { renderConsentPage } from './consent-page';

const ACCESS_TTL_SEC = 3600;            // 1 hour
const REFRESH_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
const CODE_TTL_SEC = 600;               // 10 minutes

declare module 'express-session' {
    interface SessionData {
        oauthCsrf?: string;
        oauthPending?: {
            clientId: string;
            redirectUri: string;
            state?: string;
            scope: string;
            codeChallenge: string;
            codeChallengeMethod: string;
        };
    }
}

function s256(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
}

function badRequest(res: Response, error: string, description?: string) {
    res.status(400).json({ error, ...(description ? { error_description: description } : {}) });
}

export function createOAuthRouter(prisma: PrismaClient): Router {
    const router = Router();

    // === POST /auth/register — Dynamic Client Registration (RFC 7591) ===
    router.post('/register', async (req: Request, res: Response) => {
        try {
            const client = await registerClient(prisma, req.body ?? {});
            res.status(201).json({
                ...client,
                grant_types: ['authorization_code', 'refresh_token'],
                response_types: ['code'],
            });
        } catch (err: any) {
            badRequest(res, 'invalid_client_metadata', err.message ?? 'registration failed');
        }
    });

    // === GET /auth/authorize — browser flow entry point ===
    router.get('/authorize', async (req: Request, res: Response) => {
        const {
            response_type,
            client_id,
            redirect_uri,
            state,
            scope,
            code_challenge,
            code_challenge_method,
        } = req.query as Record<string, string>;

        if (response_type !== 'code') {
            return badRequest(res, 'unsupported_response_type', 'only "code" is supported');
        }
        if (!client_id || !redirect_uri || !code_challenge) {
            return badRequest(
                res,
                'invalid_request',
                'client_id, redirect_uri and code_challenge are required',
            );
        }
        if (code_challenge_method !== 'S256') {
            return badRequest(
                res,
                'invalid_request',
                'code_challenge_method must be S256 (PKCE)',
            );
        }

        const client = await loadClient(prisma, client_id);
        if (!client) return badRequest(res, 'invalid_client', `unknown client_id: ${client_id}`);
        if (!isRedirectAllowed(client, redirect_uri)) {
            return badRequest(res, 'invalid_request', 'redirect_uri not registered for this client');
        }

        // Not logged in → bounce through Google login, come back here.
        if (!req.session.userId) {
            const here = req.originalUrl;
            res.redirect('/auth/google/login?returnTo=' + encodeURIComponent(here));
            return;
        }

        // Stash params in session for the POST submit + generate CSRF.
        const csrf = randomBytes(16).toString('hex');
        req.session.oauthCsrf = csrf;
        req.session.oauthPending = {
            clientId: client_id,
            redirectUri: redirect_uri,
            state,
            scope: scope || 'default',
            codeChallenge: code_challenge,
            codeChallengeMethod: code_challenge_method,
        };

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(renderConsentPage({
            clientName: client.name,
            scope: scope || 'default',
            csrf,
        }));
    });

    // === POST /auth/authorize — consent submit ===
    router.post('/authorize', async (req: Request, res: Response) => {
        const { csrf, decision } = req.body ?? {};
        const pending = req.session.oauthPending;
        const sessCsrf = req.session.oauthCsrf;

        if (!pending || !sessCsrf || csrf !== sessCsrf) {
            return badRequest(res, 'invalid_request', 'consent state expired or CSRF mismatch');
        }
        if (!req.session.userId) {
            return badRequest(res, 'login_required', 'session lost');
        }

        // Clear the pending state regardless of outcome.
        delete req.session.oauthCsrf;
        delete req.session.oauthPending;

        if (decision !== 'approve') {
            const params = new URLSearchParams({
                error: 'access_denied',
                ...(pending.state ? { state: pending.state } : {}),
            });
            res.redirect(`${pending.redirectUri}?${params.toString()}`);
            return;
        }

        // Issue authorization code.
        const code = randomBytes(32).toString('base64url');
        await prisma.authorizationCode.create({
            data: {
                code,
                clientId: pending.clientId,
                userId: req.session.userId,
                redirectUri: pending.redirectUri,
                codeChallenge: pending.codeChallenge,
                codeChallengeMethod: pending.codeChallengeMethod,
                scope: pending.scope,
                expiresAt: new Date(Date.now() + CODE_TTL_SEC * 1000),
            },
        });

        const params = new URLSearchParams({
            code,
            ...(pending.state ? { state: pending.state } : {}),
        });
        res.redirect(`${pending.redirectUri}?${params.toString()}`);
    });

    // === POST /auth/token ===
    router.post('/token', async (req: Request, res: Response) => {
        const grant = req.body?.grant_type;

        if (grant === 'authorization_code') {
            return handleAuthCodeGrant(prisma, req, res);
        }
        if (grant === 'refresh_token') {
            return handleRefreshGrant(prisma, req, res);
        }
        return badRequest(res, 'unsupported_grant_type', `grant_type "${grant}" is not supported`);
    });

    // === POST /auth/revoke (RFC 7009) ===
    router.post('/revoke', async (req: Request, res: Response) => {
        const token = req.body?.token;
        const hint = req.body?.token_type_hint as string | undefined;
        if (!token || typeof token !== 'string') {
            // RFC 7009 says: invalid tokens should still return 200.
            res.status(200).end();
            return;
        }

        // Try as access token (JWT) first.
        if (hint !== 'refresh_token') {
            const claims = await verifyAccessToken(token);
            if (claims) {
                await prisma.accessToken.update({
                    where: { jti: claims.jti },
                    data: { revokedAt: new Date() },
                }).catch(() => undefined);
                res.status(200).end();
                return;
            }
        }
        // Try as refresh token.
        const hashed = hashRefreshToken(token);
        await prisma.refreshToken.update({
            where: { token: hashed },
            data: { revokedAt: new Date() },
        }).catch(() => undefined);
        res.status(200).end();
    });

    return router;
}

async function authenticateClient(
    prisma: PrismaClient,
    req: Request,
): Promise<{ clientId: string; isPublic: boolean } | null> {
    const bodyId = req.body?.client_id as string | undefined;
    const bodySecret = req.body?.client_secret as string | undefined;

    // HTTP Basic
    const basic = req.headers.authorization?.startsWith('Basic ')
        ? Buffer.from(req.headers.authorization.slice(6), 'base64').toString('utf-8')
        : null;
    let basicId: string | undefined;
    let basicSecret: string | undefined;
    if (basic) {
        const colon = basic.indexOf(':');
        if (colon > 0) {
            basicId = basic.slice(0, colon);
            basicSecret = basic.slice(colon + 1);
        }
    }

    const clientId = bodyId ?? basicId;
    if (!clientId) return null;
    const client = await loadClient(prisma, clientId);
    if (!client) return null;

    if (client.clientSecret === null) return { clientId, isPublic: true };

    const provided = bodySecret ?? basicSecret;
    if (provided !== client.clientSecret) return null;
    return { clientId, isPublic: false };
}

async function handleAuthCodeGrant(prisma: PrismaClient, req: Request, res: Response) {
    const { code, redirect_uri, code_verifier } = req.body ?? {};
    if (!code || !redirect_uri || !code_verifier) {
        return badRequest(res, 'invalid_request', 'code, redirect_uri, code_verifier required');
    }

    const auth = await authenticateClient(prisma, req);
    if (!auth) return badRequest(res, 'invalid_client', 'client authentication failed');

    const codeRow = await prisma.authorizationCode.findUnique({ where: { code } });
    if (!codeRow) return badRequest(res, 'invalid_grant', 'unknown or used code');
    if (codeRow.expiresAt.getTime() < Date.now()) {
        await prisma.authorizationCode.delete({ where: { code } }).catch(() => undefined);
        return badRequest(res, 'invalid_grant', 'code expired');
    }
    if (codeRow.clientId !== auth.clientId) {
        return badRequest(res, 'invalid_grant', 'code belongs to a different client');
    }
    if (codeRow.redirectUri !== redirect_uri) {
        return badRequest(res, 'invalid_grant', 'redirect_uri mismatch');
    }
    if (codeRow.codeChallenge && s256(code_verifier) !== codeRow.codeChallenge) {
        return badRequest(res, 'invalid_grant', 'PKCE verification failed');
    }

    // Single-use: delete the code now.
    await prisma.authorizationCode.delete({ where: { code } });

    const access = await issueAccessToken({
        userId: codeRow.userId,
        clientId: codeRow.clientId,
        scope: codeRow.scope,
        ttlSeconds: ACCESS_TTL_SEC,
    });
    await prisma.accessToken.create({
        data: {
            jti: access.jti,
            userId: codeRow.userId,
            clientId: codeRow.clientId,
            scope: codeRow.scope,
            expiresAt: access.expiresAt,
        },
    });

    const refresh = newRefreshToken();
    await prisma.refreshToken.create({
        data: {
            token: hashRefreshToken(refresh),
            userId: codeRow.userId,
            clientId: codeRow.clientId,
            scope: codeRow.scope,
            expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
        },
    });

    res.status(200).json({
        access_token: access.jwt,
        token_type: 'Bearer',
        expires_in: ACCESS_TTL_SEC,
        refresh_token: refresh,
        scope: codeRow.scope,
    });
}

async function handleRefreshGrant(prisma: PrismaClient, req: Request, res: Response) {
    const { refresh_token } = req.body ?? {};
    if (!refresh_token) return badRequest(res, 'invalid_request', 'refresh_token required');

    const auth = await authenticateClient(prisma, req);
    if (!auth) return badRequest(res, 'invalid_client', 'client authentication failed');

    const hashed = hashRefreshToken(refresh_token);
    const row = await prisma.refreshToken.findUnique({ where: { token: hashed } });
    if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
        return badRequest(res, 'invalid_grant', 'refresh token invalid or expired');
    }
    if (row.clientId !== auth.clientId) {
        return badRequest(res, 'invalid_grant', 'token belongs to a different client');
    }

    // Rotate: revoke old refresh, issue new one + new access.
    await prisma.refreshToken.update({
        where: { token: hashed },
        data: { revokedAt: new Date() },
    });

    const access = await issueAccessToken({
        userId: row.userId,
        clientId: row.clientId,
        scope: row.scope,
        ttlSeconds: ACCESS_TTL_SEC,
    });
    await prisma.accessToken.create({
        data: {
            jti: access.jti,
            userId: row.userId,
            clientId: row.clientId,
            scope: row.scope,
            expiresAt: access.expiresAt,
        },
    });

    const newRefresh = newRefreshToken();
    await prisma.refreshToken.create({
        data: {
            token: hashRefreshToken(newRefresh),
            userId: row.userId,
            clientId: row.clientId,
            scope: row.scope,
            expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
        },
    });

    res.status(200).json({
        access_token: access.jwt,
        token_type: 'Bearer',
        expires_in: ACCESS_TTL_SEC,
        refresh_token: newRefresh,
        scope: row.scope,
    });
}
