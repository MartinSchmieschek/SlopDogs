// The KennelSwaggerHandler — Xata's herald, forging truth from the hunt into OpenAPI scrolls.
// Its heralds are the stars it fells, the sky and Earth aflame.
import { castGrimoire } from '@slopdogs/swaggrid';
import { publicKennelDocsPath, publicKennelOpenApiPath } from '@slopdogs/core';
import { toSwaggridCast } from '../../services/swaggridAdapter';
import { KennelRunHandler } from './KennelRunHandler';
import { accessOf } from '../../mcp/auth/visibility';
import { redactWavesForCtx } from '../../services/wavesRedaction';
import type { IStore } from '../../store/IStore';
import { LEGACY_ROUTE, PUBLIC_ROUTE } from './routeTable';

/**
 * Handles Swagger/OpenAPI endpoints for kennels.
 * Delegates kennel loading and running to the KennelRunHandler.
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export class KennelSwaggerHandler {
    constructor(private runHandler: KennelRunHandler, private nodesStore: IStore) {}

    /**
     * Doku und Spec gehoeren zur Ware: `/k/:id/docs` und `/k/:id/openapi.json`.
     * Die alten Adressen unter `/api/kennels/:id/…` antworten dauerhaft 308 — ohne DB-Lookup.
     */
    registerRoutes(app: any): void {
        app.get(PUBLIC_ROUTE.openapi, (req: any, res: any) => this.handleSwaggerJson(req, res));
        app.get(PUBLIC_ROUTE.docs, (req: any, res: any) => this.handleSwaggerUi(req, res));
        app.get(LEGACY_ROUTE.swagger, (req: any, res: any) =>
            this.redirectLegacy(req, res, publicKennelOpenApiPath(req.params.id)),
        );
        app.get(LEGACY_ROUTE.docs, (req: any, res: any) =>
            this.redirectLegacy(req, res, publicKennelDocsPath(req.params.id)),
        );
    }

    /** 308 auf die neue Adresse; die Query (z. B. `?version=`) reist unveraendert mit. */
    private redirectLegacy(req: any, res: any, target: string): void {
        const originalUrl = String(req.originalUrl ?? '');
        const queryStart = originalUrl.indexOf('?');
        res.redirect(308, target + (queryStart >= 0 ? originalUrl.slice(queryStart) : ''));
    }

    private async handleSwaggerJson(req: any, res: any): Promise<void> {
        try {
            const config = await this.runHandler.loadKennelConfig(req.params.id, req.query.version);
            if (!config) {
                res.status(404).json({ error: `Kennel ${req.params.id} not found` });
                return;
            }

            // SECURITY (Nira F3, P3.5 W12): the spec is NOT discoverable to everyone. Gate RUN —
            // whoever may run the kennel may read how to call it; nobody else learns it exists
            // (404, like /run). The defaults (defaultQuery/defaultBody as examples) are config:
            // READ only. A RUN caller gets the lead's shape and nothing of the pack behind it.
            const access = accessOf(config as any, req.ctx);
            if (access === 'none') {
                res.status(404).json({ error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }
            const query = this.runHandler.mergeQueryParams(config.defaultQuery, req.query);
            const body = config.defaultBody;
            const rawWaves = await this.runHandler.runKennel(
                config, query, body, this.runHandler.toCapabilityCtx(req.ctx), undefined, { source: 'swagger' },
            );
            // Every wave node's result lands in the spec as a schema example — dogs the caller
            // may not read inside a readable kennel are redacted exactly like /run.
            const waves = access === 'read' ? await redactWavesForCtx(rawWaves, req.ctx, this.nodesStore) : rawWaves;

            const spec: any = castGrimoire(toSwaggridCast(config, waves, {
                includeDefaults: access === 'read',
                leadOnly: access !== 'read',
            }));
            this.augmentForVisibility(spec, config, req);
            res.json(spec);
        } catch (err) {
            console.error('[KennelSwaggerHandler.handleSwaggerJson]', err);
            res.status(500).json({ error: String(err) });
        }
    }

    /**
     * For private kennels, mark every operation with bearerAuth security so the Swagger UI
     * shows the lock icon and the "Authorize" button. The user pastes a PAT (from /auth/tokens)
     * and can then "Try it out" — the actual endpoint enforces canRead with that token.
     */
    private augmentForVisibility(spec: any, config: any, req: any): void {
        if (config.visibility !== 'private') return;
        spec.components = spec.components || {};
        spec.components.securitySchemes = spec.components.securitySchemes || {};
        spec.components.securitySchemes.bearerAuth = {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Personal Access Token from /auth/tokens, or OAuth-issued access token.',
        };
        const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
        const host = (req.get('x-forwarded-host') || req.get('host') || 'localhost:3000').split(',')[0].trim();
        const base = process.env.MCP_BASE_URL?.replace(/\/$/, '') || `${proto}://${host}`;
        spec.components.securitySchemes.oauth2 = {
            type: 'oauth2',
            description: 'Authorization Code + PKCE. Discovery: ' + base + '/.well-known/oauth-authorization-server',
            flows: {
                authorizationCode: {
                    authorizationUrl: base + '/auth/authorize',
                    tokenUrl: base + '/auth/token',
                    scopes: { default: 'Default access' },
                },
            },
        };
        spec.info = spec.info || {};
        const note =
            '\n\n> 🔒 **This pen is private.** Click **Authorize** above and paste a Bearer token ' +
            `from [${base}/auth/tokens](${base}/auth/tokens) (the owner's account) — or run the ` +
            'OAuth flow. Anonymous calls return 404.';
        spec.info.description = (spec.info.description ?? '') + note;
        for (const pathItem of Object.values(spec.paths ?? {}) as any[]) {
            if (!pathItem || typeof pathItem !== 'object') continue;
            for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
                if (!pathItem[method]) continue;
                pathItem[method].security = [{ bearerAuth: [] }, { oauth2: ['default'] }];
            }
        }
    }

    private async handleSwaggerUi(req: any, res: any): Promise<void> {
        try {
            const config = await this.runHandler.loadKennelConfig(req.params.id, req.query.version);
            if (!config) {
                res.status(404).json({ error: `Kennel ${req.params.id} not found` });
                return;
            }
            // SECURITY (Nira F3, P3.5 W12): the title alone confirms a private kennel exists —
            // 404 like the spec, for everyone who may not run it. The lock and "Authorize" button
            // remain for private kennels the caller may run (e.g. to try it out with a PAT).
            if (accessOf(config as any, req.ctx) === 'none') {
                res.status(404).json({ error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }
            const title = config.name || config.id;
            const titleSafe = escapeHtml(title);
            const versionSuffix = req.query.version ? `?version=${encodeURIComponent(String(req.query.version))}` : '';
            const specUrl = `${publicKennelOpenApiPath(req.params.id)}${versionSuffix}`;
            const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${titleSafe} — API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; display: flex; flex-direction: column; min-height: 100vh; background: #fafafa; }
    #swagger-ui { flex: 1; min-height: 0; }

    /* OpenAPI-Info: mehrschichtig (Winkel/Stops wie von dir eingestellt) */
    .swagger-ui .info {
      margin: clamp(1.25rem, 4vw, 3rem) 0;
      width: 100%;
      box-sizing: border-box;
      padding: 1.25rem 1.5rem;
      padding-inline-start: min(22rem, 58vw);
      min-height: clamp(9rem, 22vw, 12rem);
      color: #e6f7ec;
      border: 1px solid rgba(100, 200, 140, 0.35);
      border-radius: 10px;
      background-color: #1a3d32;
      background-image:
        url(/static/swagrid.png),
        repeating-linear-gradient(
          340deg,
          transparent 0,
          transparent 18px,
          rgba(210, 255, 235, 0.2) 18px,
          rgba(210, 255, 235, 0.2) 23px,
          transparent 23px,
          transparent 52px
        ),
        repeating-linear-gradient(
          339deg,
          transparent 0,
          transparent 5px,
          rgba(255, 255, 255, 0.09) 5px,
          rgba(255, 255, 255, 0.09) 6px,
          transparent 6px,
          transparent 68px
        ),
        radial-gradient(
          ellipse 122% 90% at 0% 100%,
          rgba(160, 245, 200, 0.5) 0%,
          rgba(90, 180, 140, 0.15) 45%,
          transparent 62%
        ),
        linear-gradient(
          to top right,
          #d8df69 0%,
          #a3e7ce 32%,
          #3a8f72 66%,
          #6ca5a3 116%
        );
      background-repeat: no-repeat, no-repeat, no-repeat, no-repeat, no-repeat;
      background-position: left bottom, center, center, center, center;
    background-size: clamp(11rem, 36rem, 27rem) auto, 100% 100%, 100% 100%, 100% 100%, 100% 100%;
    }
    .swagger-ui .info .main {
      margin-left: auto;
      max-width: min(100%, 40rem);
      text-align: left;
    }
    .swagger-ui .info .title,
    .swagger-ui .info h1,
    .swagger-ui .info h2 {
      color: #f5fff8 !important;
    }
    .swagger-ui .info a {
      color: #a8f090 !important;
    }
    .swagger-ui .info code,
    .swagger-ui .info .base-url {
      color: #c8ead4 !important;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "${specUrl}",
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      deepLinking: true,
    });
  </script>
</body>
</html>`;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        } catch (err) {
            console.error('[KennelSwaggerHandler.handleSwaggerUi]', err);
            res.status(500).json({ error: String(err) });
        }
    }
}
