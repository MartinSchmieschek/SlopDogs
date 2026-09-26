// The NodesRouteHandler — summoner of the hound manifest.
// From tangent planes the dogs emerge, each bearing name and form for those who seek to know.
import { BASE_DOG_PREFIX, SerializedDog } from '@slopdogs/core';
import { ControllerRegistry } from './ConfigRouteHandler';
import { accessOf, canRun, filterRunnable, runView, withMyRights, type AclEntity } from '../../mcp/auth/visibility';
import type { AuthCtx } from '../../mcp/auth/middleware';
import { ListQuery } from './ListQuery';
import { API_ROUTE } from './routeTable';
import type { DogStatsService } from '../../services/DogStatsService';
import { BaseDogPacks } from '../../services/BaseDogPacks';

/** A lean description of a base dog — enough for the toolbar to display it. */
interface IBaseDogInfo {
    id: string;
    name: string;
    description: string;
    type: string;
    icon?: string;
    /** The name this dog is bound under in a child's VM context. */
    contextName: string;
    /** P6 U5: the package it comes from (`dogs-weather`, `core`) — the browser's pack filter. */
    pack?: string;
}

/** Fields `lean=1` drops from a list entry: the code — the browser and the palette list, they do not read. */
const LEAN_DROPPED_FIELDS = ['theRun', 'lineDocs'] as const;

/** Blanke Klassennamen der Abhaengigkeiten eines Base-Dogs (required/optional sind Klassen). */
function dependencyNames(list: unknown): string[] {
    if (!Array.isArray(list)) return [];
    return list.map((dep) => (dep as any)?.name).filter((n): n is string => typeof n === 'string' && n.length > 0);
}

export class NodesRouteHandler {
    private registry: ControllerRegistry;
    private baseDogsList: IBaseDogInfo[];
    /** Die Vertraege der Base-Dogs — fuer usage.dependencies (P4b). */
    private baseDogParents = new Map<string, { parentsRequired: string[]; parentsOptional: string[] }>();

    /** @param dogStats P4b: `stats` an jedem Eintrag, `GET /api/nodes/:id/usage`. Ohne ihn: wie vor P4b. */
    constructor(registry: ControllerRegistry, baseDogs: any[], private readonly dogStats?: DogStatsService) {
        this.registry = registry;
        const packs = BaseDogPacks.fromLoadedModules();
        for (const dog of baseDogs) {
            this.baseDogParents.set(BASE_DOG_PREFIX + dog.name, {
                parentsRequired: dependencyNames(dog.required),
                parentsOptional: dependencyNames(dog.optional),
            });
        }
        this.baseDogsList = baseDogs.map(dog => ({
            id: BASE_DOG_PREFIX + dog.name,
            name: dog.name,
            description: dog.description,
            type: 'BaseDog',
            icon: dog.icon,
            // A base dog binds under its own IHuntingDog.name (its class name) — the same
            // getter SerializedDog.name implements via toCamelCase. One source, two dog kinds.
            contextName: dog.name,
            pack: packs.packOf(dog) ?? undefined,
        }));
    }

    /** `lean=1` (P6 U5): the list without code — 840 kB -> a few dozen for the /dogs browser. */
    private static leanOf<T extends Record<string, any>>(items: T[], lean: boolean): T[] {
        if (!lean) return items;
        return items.map((item) => {
            const copy: Record<string, any> = { ...item };
            for (const field of LEAN_DROPPED_FIELDS) delete copy[field];
            return copy as T;
        });
    }

    /**
     * P6 U5: a RUN view (run-only for the caller) carries the version of its head (oldest = 1) — the
     * number `[USE IN KENNEL]` pins to and says (`Pinned to v7.`). One version query per such dog;
     * readable dogs are not touched (their version list is open to them).
     */
    private async withRunViewVersions(items: Array<Record<string, any>>): Promise<void> {
        const controller = this.registry.get('nodes');
        if (!controller) return;
        const runOnly = items.filter((d) => d.type !== 'BaseDog' && d.myRights && !d.myRights.read && (d.lineageId || d.id));
        await Promise.all(runOnly.map(async (d) => {
            const history = await controller.getVersions(String(d.lineageId || d.id));
            const at = history.findIndex((v) => v.id === d.id);
            if (at >= 0) d.version = history.length - at;
        }));
    }

    /**
     * The name a dog is bound under when it serves as a parent in the VM context.
     * Derived with the very function that fills the context — never a second copy of it,
     * or the UI would one day confidently display a name that does not exist at runtime.
     */
    private static contextNameOf(dog: any): string {
        const source = dog?.displayName ?? dog?.name ?? dog?.lineageId ?? dog?.id;
        return typeof source === 'string' && source.length > 0 ? SerializedDog.toCamelCase(source) : '';
    }

    /**
     * Die Sicht eines Aufrufers auf einen Dog der Liste (W7): READ bekommt den Dog (ACL-Listen nur
     * fuer Owner/Editoren), RUN nur Name, Beschreibung und Schnittstelle — nie theRun, lineDocs
     * oder serializedDogConfig. `myRights` traegt jeder Eintrag.
     */
    private static viewFor(dog: AclEntity & Record<string, any>, ctx: AuthCtx | undefined): Record<string, any> {
        return accessOf(dog, ctx) === 'read' ? withMyRights(dog, ctx) : runView(dog, ctx);
    }

    registerRoutes(app: any): void {
        app.get(API_ROUTE.nodesList, (req: any, res: any) => this.handleList(req, res));
        app.get(API_ROUTE.nodeUsage, (req: any, res: any) => this.handleUsage(req, res));
    }

    /**
     * GET /api/nodes/:id/usage (P4b) — wo der Dog laeuft. `:id` = lineageId, Version-GUID oder `base:X`.
     * 404, wenn der Aufrufer den Dog nicht ausfuehren darf (dieselbe Sichtbarkeit wie die Liste);
     * Kennels nur, die er ausfuehren darf — der Rest als hiddenKennels.
     */
    private async handleUsage(req: any, res: any): Promise<void> {
        try {
            if (!this.dogStats) { res.status(404).json({ error: 'usage not available' }); return; }
            const id = String(req.params.id);
            const base = this.baseDogsList.find((d) => d.id === id || d.name === id);
            if (base) {
                res.status(200).json(await this.dogStats.usageOf({ id: base.id, ownerId: null, ...this.baseDogParents.get(base.id) }, req.ctx));
                return;
            }
            const controller = this.registry.get('nodes');
            const found = controller ? await controller.getById(id) : null;
            const dog = found?.ok ? (found.data as any) : null;
            if (!dog || !canRun(dog, req.ctx)) { res.status(404).json({ error: `Node ${id} not found` }); return; }
            res.status(200).json(await this.dogStats.usageOf(dog, req.ctx));
        } catch (e) {
            console.error('[/api/nodes/:id/usage]', e);
            res.status(500).json({ error: String(e) });
        }
    }

    // GET /api/nodes — summons the manifest of hounds.
    // If ?kennelId=xxx is given, only dogs that crew that kennel are returned.
    // Without kennelId, all base dogs and all serialized dogs are returned.
    private async handleList(req: any, res: any): Promise<void> {
        try {
            const controller = this.registry.get('nodes');
            if (!controller) { res.status(404).json({ error: 'Node controller not found' }); return; }

            const kennelId = req.query.kennelId as string | undefined;
            const listQuery = ListQuery.from(req.query);
            const lean = req.query.lean === '1' || req.query.lean === 'true';

            // Only list SerializedDogs — MimicDogs are pact-bound and never appear in the toolbar.
            // listLatest() queries by entityType 'SerializedDog', so MimicDogs (type 'MimicDog') are excluded.
            const result = await controller.listLatest();
            let serializedDogs = result.ok && result.data ? result.data : [];
            // Visibility filter FIRST: anonymous sees public + run-only; logged-in sees also what he
            // may run or read. It has to precede `total` and the page, or `total` would betray how
            // many foreign private dogs exist and the pages would come out with holes.
            // BaseDogs are always visible (they are project-wide infrastructure, no per-user concept).
            // P3.5 (W7, W17): run-only dogs are listed — as their RUN view, without code.
            serializedDogs = filterRunnable(serializedDogs as any[], req.ctx);
            // Additive: the name this dog answers to inside a child's VM context.
            serializedDogs = (serializedDogs as any[]).map(dog => ({
                ...NodesRouteHandler.viewFor(dog, req.ctx),
                contextName: NodesRouteHandler.contextNameOf(dog),
            }));
            await this.withRunViewVersions(serializedDogs as any[]);

            // If a kennel is specified, filter to only dogs that are in that kennel's dogIds.
            // The kennel's dogIds are its config — only a reader may filter by them.
            if (kennelId) {
                const kennelController = this.registry.get('kennels');
                const kennelResult = kennelController ? await kennelController.getById(kennelId) : null;
                const kennel = kennelResult?.data as any;
                const kennelDogIds: string[] = kennel && accessOf(kennel, req.ctx) === 'read' ? kennel.dogIds ?? [] : [];

                if (kennelDogIds.length > 0) {
                    // Build a set of all identifiers the kennel uses — both the raw entries
                    // AND the resolved dogIds (lineage GUIDs) for pinned version references.
                    const kennelSet = new Set<string>(kennelDogIds);
                    for (const kid of kennelDogIds) {
                        if (kid.startsWith(BASE_DOG_PREFIX)) continue;
                        // If this entry is a version-ID (pinned), resolve its lineageId too.
                        const match = serializedDogs.find((d: any) => d.id === kid);
                        if (match && (match as any).lineageId) {
                            kennelSet.add((match as any).lineageId);
                        }
                    }

                    // Exclude dogs already in the kennel — the toolbar shows what can be ADDED.
                    serializedDogs = serializedDogs.filter((d: any) =>
                        !kennelSet.has(d.id) && !kennelSet.has(d.lineageId)
                    );
                    const filteredBase = this.baseDogsList.filter(d => !kennelSet.has(d.id)).map((d) => ({ ...d }));
                    const scoped = [...filteredBase, ...serializedDogs];
                    if (this.dogStats) await this.dogStats.attach(scoped as any[]);
                    res.status(200).json(listQuery.envelope(listQuery.apply(NodesRouteHandler.leanOf(scoped, lean), req.ctx)));
                    return;
                }
            }

            // Base dogs take part in search, order and paging: they share one list with the
            // serialized dogs, so cutting the page after the merge is the only way page 1 and
            // page 2 stay free of overlaps. `mine=1` drops them — nobody owns infrastructure.
            const all = [...this.baseDogsList.map((d) => ({ ...d })), ...serializedDogs];
            // P4b: stats VOR ListQuery.apply — sortiert (proven, calls30d, reuse) und gefiltert (proven=1)
            // wird nach ihnen, und nur an dem, was der Rechtefilter schon durchgelassen hat.
            if (this.dogStats) await this.dogStats.attach(all as any[]);
            res.status(200).json(listQuery.envelope(listQuery.apply(NodesRouteHandler.leanOf(all, lean), req.ctx)));
        } catch (e) {
            console.error('[/api/nodes]', e);
            res.status(500).json({ error: String(e) });
        }
    }
}
