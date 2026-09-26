// Key-Store tools (P4c) — set_key, list_keys, delete_key. No tool reads a key back, and none ever will:
// agents may set keys, never read them; dogs use `keys.fetch` with `{{key:alias}}`, the value is
// substituted on the host and never enters the VM. REST mirrors these tools (api/routes/KeysRouteHandler.ts)
// through the same KeyStoreService — one rule set, two doors.

import { KeyStoreError, type UserKeyInput } from '../../services/KeyStoreService';
import type { AuthCtx } from '../auth/middleware';
import { type ToolDef, type ToolDeps, ok, fail } from './types';

/** The owner behind a call, or the tool error (no_identity / keystore_disabled). */
async function asKeyTool(ctx: AuthCtx, deps: ToolDeps, action: (owner: string) => Promise<unknown>) {
    try {
        const owner = deps.keyStore.requireOwner(ctx);
        return ok(await action(owner));
    } catch (err) {
        if (err instanceof KeyStoreError) return fail(`${err.code}: ${err.message}`);
        throw err;
    }
}

export function getKeyTools(): ToolDef[] {
    return [
        {
            name: 'set_key',
            description:
                'Stores a secret (API key, token) under an alias for YOUR account — create or replace. Agents may set keys, never read them: '
                + 'no tool returns the value. Dogs use it through `keys.fetch(url, opts)` with the placeholder `{{key:<alias>}}` in the url, a header value or the body; '
                + 'the server substitutes it and only calls `allowedDomains` (exact host or `*.example.com`, https only, no private networks, no redirects). '
                + 'Runs use the keys of whoever runs the kennel. alias: lowercase a-z, 0-9, _ and -, max 32. secret: 8-4096 chars, one line. '
                + 'quotaPerDay caps calls per UTC day. kennelGrants (opt-in, requires quotaPerDay) lets runs of your listed kennels use the key for other runners — you pay, capped. The key store lives in the database — a reset deletes it; add the key again.',
            inputSchema: {
                type: 'object',
                required: ['alias', 'secret', 'allowedDomains'],
                additionalProperties: false,
                properties: {
                    alias: { type: 'string', description: 'lowercase name, referenced as {{key:<alias>}}' },
                    secret: { type: 'string', description: 'the value — shown never again' },
                    allowedDomains: { type: 'array', items: { type: 'string' }, description: 'hosts keys.fetch may call with this key, e.g. ["api.openai.com"] or ["*.example.com"]' },
                    kennelGrants: { type: 'array', items: { type: 'string' }, description: 'optional: lineage ids of YOUR kennels whose runs may use this key for any runner (anonymous visitors included) — you pay; requires quotaPerDay' },
                    quotaPerDay: { type: 'integer', minimum: 1, description: 'cap of keys.fetch calls per UTC day — required with kennelGrants' },
                },
            },
            handler: async (args, ctx, deps) => asKeyTool(ctx, deps, async (owner) => ({ ok: true, key: await deps.keyStore.set(owner, args as UserKeyInput) })),
        },
        {
            name: 'list_keys',
            description: 'Lists your keys, masked: alias, last4, allowedDomains, kennelGrants, quotaPerDay, createdAt, lastUsedAt. Never the value.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            handler: async (_args, ctx, deps) => asKeyTool(ctx, deps, async (owner) => ({ ok: true, keys: await deps.keyStore.list(owner) })),
        },
        {
            name: 'delete_key',
            description: 'Deletes one of your keys by alias. Dogs using {{key:<alias>}} fail with key_not_found afterwards. Unknown and foreign aliases answer the same: not_found.',
            inputSchema: {
                type: 'object',
                required: ['alias'],
                additionalProperties: false,
                properties: { alias: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => asKeyTool(ctx, deps, async (owner) => {
                if (!(await deps.keyStore.delete(owner, String(args.alias ?? '')))) throw new KeyStoreError(404, 'not_found', 'Key not found');
                return { ok: true };
            }),
        },
    ];
}
