// OAuthClient CRUD helpers. Clients are MCP/Action consumers (Claude Connector,
// Custom GPT, Cursor, etc.) registered via Dynamic Client Registration (RFC 7591)
// or seeded by hand. clientId is randomly generated; clientSecret is null for
// public PKCE-only clients.

import type { PrismaClient } from '../../store/generated/prisma-auth-client';
import { randomBytes } from 'crypto';

export interface RegisterClientInput {
    redirect_uris: string[];
    client_name?: string;
    token_endpoint_auth_method?: 'none' | 'client_secret_post' | 'client_secret_basic';
}

export interface RegisteredClient {
    client_id: string;
    client_secret?: string;
    client_name: string;
    redirect_uris: string[];
    token_endpoint_auth_method: 'none' | 'client_secret_post' | 'client_secret_basic';
}

const LOOPBACK_REDIRECT = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i;
const DANGEROUS_SCHEME = /^(javascript|data|vbscript|file|blob|about):/i;

/**
 * Erlaubte redirect_uri fuer die Dynamic Client Registration. Ein MCP-Client ist meist eine native App
 * (Cursor, Claude Desktop): nach RFC 8252 nutzt sie entweder einen Loopback-Redirect (§7.3) oder ein
 * eigenes "private-use URI scheme" (§7.1, z.B. `cursor://anysphere.cursor-mcp/oauth/callback`). Nur
 * `https?://` zu verlangen sperrt genau diese Clients aus ("Invalid redirect_uri: cursor://...").
 *
 * Zugelassen: https (TLS-Web), http nur Loopback (localhost/127.0.0.1/[::1]) und beliebige App-Schemata
 * ausser den im Browser ausfuehrbaren (javascript:, data:, file: ...). isRedirectAllowed bindet die URI
 * danach exakt an genau diesen Client — kein offener Redirect.
 */
export function isAllowedRedirectUri(uri: unknown): uri is string {
    if (typeof uri !== 'string' || !uri) return false;
    if (DANGEROUS_SCHEME.test(uri)) return false;
    if (/^https:\/\//i.test(uri)) return true;
    if (LOOPBACK_REDIRECT.test(uri)) return true;
    // private-use URI scheme einer nativen App (RFC 8252 §7.1): scheme:... , nicht http/https.
    return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(uri) && !/^https?:/i.test(uri);
}

function genClientId(): string {
    return 'mcpc_' + randomBytes(12).toString('base64url');
}

function genClientSecret(): string {
    return 'mcps_' + randomBytes(24).toString('base64url');
}

export async function registerClient(
    prisma: PrismaClient,
    input: RegisterClientInput,
): Promise<RegisteredClient> {
    if (!Array.isArray(input.redirect_uris) || input.redirect_uris.length === 0) {
        throw new Error('redirect_uris is required and must contain at least one URI');
    }
    for (const uri of input.redirect_uris) {
        if (!isAllowedRedirectUri(uri)) {
            throw new Error(`Invalid redirect_uri: ${uri}`);
        }
    }

    const authMethod = input.token_endpoint_auth_method ?? 'none';
    const isPublic = authMethod === 'none';
    const clientId = genClientId();
    const clientSecret = isPublic ? null : genClientSecret();

    await prisma.oAuthClient.create({
        data: {
            clientId,
            clientSecret,
            name: input.client_name ?? 'Unnamed Client',
            redirectUris: input.redirect_uris.join(','),
        },
    });

    return {
        client_id: clientId,
        ...(clientSecret ? { client_secret: clientSecret } : {}),
        client_name: input.client_name ?? 'Unnamed Client',
        redirect_uris: input.redirect_uris,
        token_endpoint_auth_method: authMethod,
    };
}

export interface LoadedClient {
    clientId: string;
    clientSecret: string | null;
    name: string;
    redirectUris: string[];
}

export async function loadClient(
    prisma: PrismaClient,
    clientId: string,
): Promise<LoadedClient | null> {
    const row = await prisma.oAuthClient.findUnique({ where: { clientId } });
    if (!row) return null;
    return {
        clientId: row.clientId,
        clientSecret: row.clientSecret,
        name: row.name,
        redirectUris: row.redirectUris.split(',').map((s) => s.trim()).filter(Boolean),
    };
}

export function isRedirectAllowed(client: LoadedClient, redirectUri: string): boolean {
    return client.redirectUris.includes(redirectUri);
}
