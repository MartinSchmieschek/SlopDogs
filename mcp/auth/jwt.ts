// HS256 JWT signing/verification with jose. Symmetric secret from MCP_TOKEN_SIGNING_KEY.
// Used for issued access tokens (refresh tokens are random + DB-stored, not JWTs).

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { randomBytes } from 'crypto';

const ALG = 'HS256';
let cachedKey: Uint8Array | null = null;

function getKey(): Uint8Array {
    if (cachedKey) return cachedKey;
    const hex = process.env.MCP_TOKEN_SIGNING_KEY;
    if (!hex) {
        throw new Error(
            'MCP_TOKEN_SIGNING_KEY must be set in .env. Generate one with:\n' +
            '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
        );
    }
    if (!/^[0-9a-fA-F]+$/.test(hex)) {
        throw new Error('MCP_TOKEN_SIGNING_KEY must be a hex string (only 0-9, a-f).');
    }
    if (hex.length < 64) {
        throw new Error(
            `MCP_TOKEN_SIGNING_KEY too short (got ${hex.length} hex chars, need 64+ = 32+ bytes for HS256). Regenerate with:\n` +
            '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
        );
    }
    cachedKey = Buffer.from(hex, 'hex');
    return cachedKey;
}

export interface AccessTokenClaims extends JWTPayload {
    sub: string;       // userId
    jti: string;       // unique token id (DB lookup for revocation)
    aud: string;       // client_id
    scope: string;     // space-separated scopes
    iss: string;
    iat: number;
    exp: number;
}

export interface IssueOpts {
    userId: string;
    clientId: string;
    scope?: string;
    ttlSeconds?: number;
}

export interface IssuedToken {
    jwt: string;
    jti: string;
    expiresAt: Date;
}

export async function issueAccessToken(opts: IssueOpts): Promise<IssuedToken> {
    const ttl = opts.ttlSeconds ?? 3600; // 1h default
    const jti = randomBytes(16).toString('hex');
    const now = Math.floor(Date.now() / 1000);
    const exp = now + ttl;
    const issuer = process.env.MCP_BASE_URL || 'http://localhost:3000';

    const jwt = await new SignJWT({ scope: opts.scope ?? 'default' })
        .setProtectedHeader({ alg: ALG, typ: 'JWT' })
        .setSubject(opts.userId)
        .setAudience(opts.clientId)
        .setIssuer(issuer)
        .setIssuedAt(now)
        .setExpirationTime(exp)
        .setJti(jti)
        .sign(getKey());

    return { jwt, jti, expiresAt: new Date(exp * 1000) };
}

export async function verifyAccessToken(jwt: string): Promise<AccessTokenClaims | null> {
    try {
        const { payload } = await jwtVerify(jwt, getKey(), {
            issuer: process.env.MCP_BASE_URL || 'http://localhost:3000',
        });
        if (!payload.sub || !payload.jti || !payload.aud) return null;
        return payload as AccessTokenClaims;
    } catch {
        return null;
    }
}

export function newRefreshToken(): string {
    return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(raw: string): string {
    // Stored hashed so DB leaks don't reveal the actual refresh tokens.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createHash } = require('crypto');
    return createHash('sha256').update(raw).digest('hex');
}
