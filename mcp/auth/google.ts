// Google OIDC client — discovers Google's OpenID config and constructs the openid-client `Client`.
// Used by mcp/auth/router.ts for the /auth/google/login + /auth/google/callback flow.

import { Issuer, generators, Client } from 'openid-client';

let cachedClient: Client | null = null;

export async function getGoogleClient(): Promise<Client> {
    if (cachedClient) return cachedClient;

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectBase = process.env.GOOGLE_OAUTH_REDIRECT_BASE || 'http://localhost:3000';

    if (!clientId || !clientSecret) {
        throw new Error('GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set in .env');
    }

    const issuer = await Issuer.discover('https://accounts.google.com');
    cachedClient = new issuer.Client({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uris: [`${redirectBase.replace(/\/$/, '')}/auth/google/callback`],
        response_types: ['code'],
    });

    return cachedClient;
}

export interface PkceBundle {
    codeVerifier: string;
    codeChallenge: string;
    state: string;
}

export function generatePkce(): PkceBundle {
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const state = generators.state();
    return { codeVerifier, codeChallenge, state };
}

export function getRedirectUri(): string {
    const redirectBase = process.env.GOOGLE_OAUTH_REDIRECT_BASE || 'http://localhost:3000';
    return `${redirectBase.replace(/\/$/, '')}/auth/google/callback`;
}
