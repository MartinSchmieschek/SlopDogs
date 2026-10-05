// /auth/* routes — Google login flow + session inspection.
//
// Endpoints:
//   GET  /auth/google/login     -> redirects to Google consent screen (?betaKey= rides along in the session)
//   GET  /auth/google/callback  -> handles Google's redirect, upserts the User, sets session. With
//                                  SLOPDOGS_STAGE=beta and auth on, every Google account must be unlocked once
//                                  with a beta key (one key, one account) — else the key page (beta-page.ts)
//   GET  /auth/me               -> returns current user from session, or 401
//   POST /auth/logout           -> clears session
//
// MCP-OAuth-AS endpoints (/auth/authorize, /auth/token, /auth/register) come later.

import { Router, type Request, type Response } from 'express';
import type { PrismaClient } from '../../store/generated/prisma-auth-client';
import { getGoogleClient, generatePkce, getRedirectUri } from './google';
import { createOAuthRouter } from './oauth-as';
import { createPersonalTokensRouter } from './personal-tokens';
import { BetaKeyError, BetaKeys, type BetaKeyPrisma } from './betaKeys';
import { renderBetaKeyPage } from './beta-page';

export function createAuthRouter(prisma: PrismaClient): Router {
    const router = Router();
    const betaKeys = new BetaKeys(prisma as unknown as BetaKeyPrisma);

    // OAuth 2.1 AS endpoints — /authorize, /token, /revoke, /register
    router.use('/', createOAuthRouter(prisma));

    // Personal Access Tokens — /tokens (HTML UI + form posts)
    router.use('/tokens', createPersonalTokensRouter(prisma));

    // Only allow returnTo values that are same-origin paths (start with "/" but not "//").
    // Prevents open-redirect via ?returnTo=https://attacker.example/.
    // Laenge begrenzt: der Wert reist in der (anonym anlegbaren) Session mit.
    function safeReturnTo(raw: unknown): string | undefined {
        if (typeof raw !== 'string') return undefined;
        if (raw.length > 2048) return undefined;
        if (!raw.startsWith('/') || raw.startsWith('//')) return undefined;
        return raw;
    }

    router.get('/google/login', async (req: Request, res: Response) => {
        try {
            const client = await getGoogleClient();
            const { codeVerifier, codeChallenge, state } = generatePkce();

            req.session.pkce = {
                codeVerifier,
                state,
                returnTo: safeReturnTo(req.query.returnTo),
            };
            // Beta: der Key reist in der Session bis zum Callback; ohne Key bleibt ein frueherer stehen.
            const betaKey = typeof req.query.betaKey === 'string' ? req.query.betaKey.trim().slice(0, 100) : '';
            if (betaKey) req.session.betaKey = betaKey;

            const url = client.authorizationUrl({
                scope: 'openid email profile',
                state,
                code_challenge: codeChallenge,
                code_challenge_method: 'S256',
            });

            res.redirect(url);
        } catch (err: any) {
            console.error('[auth/google/login]', err);
            res.status(500).json({ error: err.message ?? 'login init failed' });
        }
    });

    router.get('/google/callback', async (req: Request, res: Response) => {
        try {
            const client = await getGoogleClient();
            const pkce = req.session.pkce;

            if (!pkce) {
                res.status(400).send('No PKCE state in session — login flow expired or session lost. Try again from /auth/google/login.');
                return;
            }

            const params = client.callbackParams(req);
            const tokenSet = await client.callback(getRedirectUri(), params, {
                code_verifier: pkce.codeVerifier,
                state: pkce.state,
            });

            const claims = tokenSet.claims();
            const googleSub = claims.sub;
            const email = claims.email as string | undefined;
            const name = (claims.name as string | undefined) ?? null;
            const picture = (claims.picture as string | undefined) ?? null;

            if (!googleSub || !email) {
                res.status(400).send('Google did not return sub/email — check OAuth scopes (openid email profile).');
                return;
            }

            // Beta (SLOPDOGS_STAGE=beta, Auth an): jedes Google-Konto muss einmal mit einem Key freigeschaltet sein —
            // ein neues beim Anlegen, ein bestehendes beim naechsten Login. BETA_ADMIN_EMAILS kommen ohne Key herein.
            let user: { id: string };
            if (!BetaKeys.required() || BetaKeys.isAdminEmail(email)) {
                user = await prisma.user.upsert({
                    where: { googleSub },
                    create: { googleSub, email, name, picture },
                    update: { email, name, picture },
                });
            } else {
                const existing = await prisma.user.findUnique({ where: { googleSub }, select: { id: true } });
                try {
                    user = await betaKeys.admit(req.session.betaKey, { googleSub, email, name, picture }, existing);
                } catch (err) {
                    if (!(err instanceof BetaKeyError)) throw err;
                    delete req.session.betaKey;
                    delete req.session.pkce;
                    res.status(403).type('html').send(renderBetaKeyPage({ reason: err.reason, returnTo: pkce.returnTo }));
                    return;
                }
            }
            delete req.session.betaKey;

            req.session.userId = user.id;
            const returnTo = pkce.returnTo ?? '/auth/me';
            delete req.session.pkce;

            res.redirect(returnTo);
        } catch (err: any) {
            console.error('[auth/google/callback]', err);
            res.status(500).send(`Login failed: ${err.message ?? 'unknown error'}`);
        }
    });

    router.get('/me', async (req: Request, res: Response) => {
        if (!req.session.userId) {
            res.status(401).json({ authenticated: false });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: req.session.userId },
            select: { id: true, email: true, name: true, picture: true, createdAt: true },
        });

        if (!user) {
            req.session.userId = undefined;
            res.status(401).json({ authenticated: false });
            return;
        }

        res.json({ authenticated: true, user });
    });

    router.post('/logout', (req: Request, res: Response) => {
        req.session.destroy(() => {
            res.clearCookie('slopdogs.sid');
            res.clearCookie('datadogs.sid'); // Cookie-Name vor der Umbenennung
            res.json({ ok: true });
        });
    });

    return router;
}
