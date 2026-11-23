// Your pages — get_my_pages, set_my_pages: a signed-in user's own landing (`/`) and kennel list (`/kennels`), each a
// kennel they can see. REST mirrors these tools (api/routes/MyPagesRouteHandler.ts) through the same MyPagesService —
// one rule set, two doors. The app sets them under /account (profile tab).

import { publicKennelPath } from '@martinschmieschek/slopdogs-core/runtime';
import { MyPagesError, type MyPagesService, type MyPagesView } from '../../services/MyPagesService';
import { type ToolDef, type ToolDeps, ok, fail } from './types';

/** The pages as a tool answer: the lineage ids and their public paths, null where the default shows. */
function pagesResult(pages: MyPagesView) {
    return {
        ok: true,
        landing: pages.landing,
        list: pages.list,
        landingUrl: pages.landing ? publicKennelPath(pages.landing) : null,
        listUrl: pages.list ? publicKennelPath(pages.list) : null,
    };
}

/** The service's refusals become tool errors (`code: message`); without the service: my_pages_unavailable. */
async function asMyPagesTool(deps: ToolDeps, action: (myPages: MyPagesService) => Promise<MyPagesView>) {
    if (!deps.myPages) return fail('my_pages_unavailable: Your pages are not available on this server.');
    try {
        return ok(pagesResult(await action(deps.myPages)));
    } catch (err) {
        if (err instanceof MyPagesError) return fail(`${err.code}: ${err.message}`);
        throw err;
    }
}

const PAGE_ARG = (where: string) => ({
    type: ['string', 'null'],
    description: `kennel id or version GUID for ${where}; null or "" resets to the default`,
});

export function getMyPagesTools(): ToolDef[] {
    return [
        {
            name: 'get_my_pages',
            description:
                'Shows your own landing page (/) and kennel list (/kennels): the kennel ids you set, null where the default shows. ' +
                'Signed in with a page set, / and /kennels redirect you to /k/<id> (your query rides along); signed out, or without a setting, ' +
                'everyone sees the default. Set them with set_my_pages, people do it in the app under /account.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            handler: async (_args, ctx, deps) => asMyPagesTool(deps, (myPages) => myPages.get(ctx)),
        },
        {
            name: 'set_my_pages',
            description:
                'Set your own landing page (/) and kennel list (/kennels) to any kennel you can see; null resets to the default. ' +
                'Pass a kennel id or a version GUID — the kennel id (its lineage) is stored, so later versions show up; the kennel needs at least one dog. ' +
                'Only the keys you pass change. Afterwards / and /kennels redirect you to /k/<id>, where the kennel runs like any kennel page. ' +
                'In local mode the one local user is everyone on the network, so the setting applies to every device there. ' +
                'Refusals: kennel_not_found (missing or not visible to you — the same answer), kennel_has_no_dogs, no_identity (super-user), my_pages_unavailable.',
            inputSchema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    landing: PAGE_ARG('your landing page (/)'),
                    list: PAGE_ARG('your kennel list (/kennels)'),
                },
            },
            handler: async (args, ctx, deps) => asMyPagesTool(deps, (myPages) => myPages.set(ctx, args)),
        },
    ];
}
