// OAuth 2.1 + MCP discovery metadata served at /.well-known/*.
// Lets MCP/Action clients auto-configure: read this URL, extract endpoints, go.

import { Router, type Request, type Response } from 'express';

function baseUrl(req: Request): string {
    if (process.env.MCP_BASE_URL) return process.env.MCP_BASE_URL.replace(/\/$/, '');
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
    const host = (req.get('x-forwarded-host') || req.get('host') || 'localhost:3000').split(',')[0].trim();
    return `${proto}://${host}`;
}

export function createDiscoveryRouter(): Router {
    const router = Router();

    // RFC 8414 — OAuth 2.0 Authorization Server Metadata.
    router.get('/oauth-authorization-server', (req: Request, res: Response) => {
        const base = baseUrl(req);
        res.json({
            issuer: base,
            authorization_endpoint: `${base}/auth/authorize`,
            token_endpoint: `${base}/auth/token`,
            revocation_endpoint: `${base}/auth/revoke`,
            registration_endpoint: `${base}/auth/register`,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            code_challenge_methods_supported: ['S256'],
            token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
            scopes_supported: ['default'],
            service_documentation: `${base}/api/readme`,
        });
    });

    // RFC 9728 — OAuth 2.0 Protected Resource Metadata (used by MCP clients).
    router.get('/oauth-protected-resource', (req: Request, res: Response) => {
        const base = baseUrl(req);
        res.json({
            resource: base,
            authorization_servers: [base],
            scopes_supported: ['default'],
            bearer_methods_supported: ['header'],
        });
    });

    return router;
}
