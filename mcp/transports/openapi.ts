// OpenAPI 3.1 adapter at /actions/*. Same 13 tools as the MCP transport,
// served as plain REST so ChatGPT Custom GPT Actions, Vertex AI Agent Engine,
// or any HTTP client without MCP support can consume them.
//
//   POST /actions/<tool_name>     run the tool, body = arguments JSON
//   GET  /actions/openapi.json    auto-generated OpenAPI 3.1 spec
//   GET  /actions/gpt-template    JSON config block for Custom GPT setup

import { Router, type Request, type Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { getKennelTools } from '../tools/kennels';
import { getNodeTools } from '../tools/nodes';
import { getMetaTools } from '../tools/meta';
import { getAclTools } from '../tools/acl';
import { getKeyTools } from '../tools/keys';
import { paramString } from '../../api/utils/routeParams';
import { getSnapshotTools } from '../tools/snapshots';
import { type ToolDeps, type ToolDef, unknownArgsRefusal } from '../tools/types';

function baseUrl(req: Request): string {
    if (process.env.MCP_BASE_URL) return process.env.MCP_BASE_URL.replace(/\/$/, '');
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
    const host = (req.get('x-forwarded-host') || req.get('host') || 'localhost:3000').split(',')[0].trim();
    return `${proto}://${host}`;
}

function unwrapToolResult(result: { content: Array<{ type: string; text?: string }>; isError?: boolean }): {
    status: number;
    body: any;
} {
    const text = result.content?.[0]?.type === 'text' ? result.content[0].text ?? '' : '';
    let parsed: any = text;
    try { parsed = JSON.parse(text); } catch { /* leave as raw string */ }
    if (result.isError) {
        return { status: 400, body: { error: parsed } };
    }
    return { status: 200, body: { result: parsed } };
}

let cachedSkill: string | null = null;

async function loadSkill(projectRoot: string): Promise<string> {
    if (cachedSkill !== null) return cachedSkill;
    const candidates = [
        path.join(projectRoot, 'mcp', 'skill.md'),
        path.join(projectRoot, '..', 'mcp', 'skill.md'),
    ];
    for (const p of candidates) {
        try {
            cachedSkill = await fs.readFile(p, 'utf-8');
            return cachedSkill;
        } catch { /* try next */ }
    }
    cachedSkill = '';
    return cachedSkill;
}

export function createActionsRouter(deps: ToolDeps): Router {
    const router = Router();
    const tools: ToolDef[] = [
        ...getKennelTools(),
        ...getNodeTools(),
        ...getSnapshotTools(),
        ...getAclTools(),
        ...getKeyTools(),
        ...getMetaTools(),
    ];
    const toolMap = new Map(tools.map((t) => [t.name, t]));

    // === GET /actions/openapi.json ===
    router.get('/openapi.json', (req: Request, res: Response) => {
        const base = baseUrl(req);
        const spec: any = {
            openapi: '3.1.0',
            info: {
                title: 'SlopDogs Actions',
                version: '0.1.0',
                description:
                    'Build and call SlopDogs kennels — reusable hunting packs that fetch and combine data from external sources.',
            },
            servers: [{ url: `${base}/actions` }],
            paths: {},
            components: {
                securitySchemes: {
                    bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
                },
            },
            security: [{ bearerAuth: [] }],
        };

        for (const t of tools) {
            spec.paths[`/${t.name}`] = {
                post: {
                    operationId: t.name,
                    summary: t.description.split('.')[0],
                    description: t.description,
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: t.inputSchema,
                            },
                        },
                    },
                    responses: {
                        '200': {
                            description: 'Tool succeeded',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            result: {
                                                description: 'Tool output (JSON or string).',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        '400': {
                            description: 'Tool returned an error or input was invalid',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: { error: {} },
                                    },
                                },
                            },
                        },
                        '401': {
                            description: 'Bearer token missing or invalid',
                        },
                    },
                },
            };
        }

        res.json(spec);
    });

    // === GET /actions/gpt-template ===
    router.get('/gpt-template', async (req: Request, res: Response) => {
        const base = baseUrl(req);
        const instructions = await loadSkill(deps.projectRoot);
        res.json({
            name: 'SlopDogs — Kennel Master',
            description:
                'Build and call SlopDogs kennels: hunting packs that fetch and combine data from external APIs.',
            instructions,
            capabilities: { web_browsing: false, dalle: false, code_interpreter: false },
            actions: {
                schema_url: `${base}/actions/openapi.json`,
                auth: {
                    primary_recommendation: 'API Key (paste a Personal Access Token)',
                    api_key: {
                        instructions: `Open ${base}/auth/tokens, click "Generate new token", paste the token here as the API key.`,
                        auth_type: 'Bearer',
                        custom_header_name: 'Authorization',
                    },
                    oauth: {
                        client_url: `${base}/auth/authorize`,
                        authorization_url: `${base}/auth/authorize`,
                        token_url: `${base}/auth/token`,
                        scope: 'default',
                        instructions: `Register a client first: POST ${base}/auth/register with redirect_uris=["https://chat.openai.com/aip/<your-gpt-id>/oauth/callback"]. Use the returned client_id/client_secret in the GPT auth config.`,
                    },
                },
            },
            conversation_starters: [
                'What kennels can I see?',
                'Run the public weather kennel at /k/weather for Munich',
                'Build me a kennel that combines weather and species data near a coordinate',
                'Show me the SlopDogs README',
            ],
        });
    });

    // === POST /actions/<tool_name> ===
    router.post('/:tool', async (req: Request, res: Response) => {
        const toolName = paramString(req.params.tool);
        const tool = toolMap.get(toolName);
        if (!tool) {
            res.status(404).json({ error: `Unknown tool: ${toolName}` });
            return;
        }

        const ctx = req.ctx;
        if (!ctx) {
            res.status(500).json({ error: 'no auth context' });
            return;
        }
        if (!ctx.user && !ctx.isSuperUser) {
            const base = baseUrl(req);
            res.setHeader(
                'WWW-Authenticate',
                `Bearer realm="SlopDogs Actions", resource_metadata="${base}/.well-known/oauth-protected-resource"`,
            );
            res.status(401).json({ error: 'unauthorized' });
            return;
        }

        const refused = unknownArgsRefusal(tool, req.body);
        if (refused) {
            res.status(400).json({ error: 'unknown_argument', error_description: refused.message, unknown: refused.unknown });
            return;
        }

        try {
            const result = await tool.handler(req.body ?? {}, ctx, deps);
            const { status, body } = unwrapToolResult(result);
            res.status(status).json(body);
        } catch (err: any) {
            console.error(`[actions/${tool.name}]`, err);
            res.status(500).json({ error: err?.message ?? String(err) });
        }
    });

    // GET on actions/* (other than the spec/template paths handled above) — not allowed.
    router.get('/:tool', (req: Request, res: Response) => {
        res.set('Allow', 'POST').status(405).json({
            error: 'method_not_allowed',
            error_description: `POST /actions/${req.params.tool} with a JSON body.`,
        });
    });

    return router;
}
