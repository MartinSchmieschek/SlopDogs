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
        if (typeof uri !== 'string' || !/^https?:\/\//.test(uri)) {
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
