// The KennelBundleHandler — Khra's vessel, carrying a kennel's soul across the void.
// To cosmic forms from tangent planes, we end as we began.
import {
    SerializedDog,
    MimicDog,
    kennelIdBlockedReason,
    suggestKennelImportTarget,
    isKennelIdTakenInList,
    isKennelNameTakenInList,
    type KennelIdNameListEntry,
} from '@slopdogs/core';
import { KennelController } from '../KennelController';
import { IStore } from '../../store/IStore';
import { generateVersionId, generateLineageId } from '../utils/versioning';
import { KennelRunHandler } from './KennelRunHandler';
import { canRead, applyCreateDefaults, normalizeVisibility } from '../../mcp/auth/visibility';
import { DogAclIndex } from '../../services/dogAccess';

/**
 * Export-Scan (P4c, L10): rohe Schluessel-Muster in Dog-Code und Kennel-Defaults. Eine Obermenge von
 * Plan 4c.6 bei `sk-` (auch `sk-proj-…` mit Binde- und Unterstrich). `{{key:alias}}` trifft keins davon.
 */
const RAW_KEY_PATTERNS: RegExp[] = [
    /sk-[A-Za-z0-9_-]{20,}/g,
    /AKIA[0-9A-Z]{16}/g,
    /ghp_[A-Za-z0-9]{36}/g,
    /Bearer [A-Za-z0-9._-]{20,}/g,
];

/** Ersetzt rohe Schluessel-Muster auf dem serialisierten Wert und zaehlt die Treffer. */
export class RawKeyScan {
    hits = 0;

    redact<T>(value: T): T {
        if (value === undefined || value === null) return value;
        const json = JSON.stringify(value);
        if (json === undefined) return value;
        let out = json;
        for (const rx of RAW_KEY_PATTERNS) {
            out = out.replace(rx, () => {
                this.hits++;
                return '[redacted]';
            });
        }
        return out === json ? value : (JSON.parse(out) as T);
    }
}

/**
 * Handles kennel export and import — the rites of passage across systems.
 *
 * Rules:
 *  - Export: keep `base:` refs as-is (runtime-provided), transitively collect
 *    every reachable SerializedDog/MimicDog via parentsRequired/parentsOptional,
 *    no history. Only the current stand travels.
 *  - Import: validate every `base:` ref against the local baseDogsMap (fail if
 *    missing), mint fresh lineage+version GUIDs for each serialized dog,
 *    remap parent refs accordingly. No history restore — a single fresh version.
 */
export class KennelBundleHandler {
    constructor(
        private runHandler: KennelRunHandler,
        private kennelsController: KennelController,
        private nodesStore: IStore,
        private baseDogsMap: Map<string, new () => any>,
    ) {}

    registerRoutes(app: any): void {
        app.get('/api/kennels/:id/export', (req: any, res: any) => this.handleExport(req, res));
        app.post('/api/kennels/import', (req: any, res: any) => this.handleImport(req, res));
    }

    private parseDogConfig(row: any): any {
        const raw = row?.serializedDogConfig;
        if (!raw) return {};
        if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { return {}; }
        }
        return raw;
    }

    private collectRefs(cfg: any): string[] {
        const out: string[] = [];
        if (Array.isArray(cfg?.parentsRequired)) out.push(...cfg.parentsRequired);
        if (Array.isArray(cfg?.parentsOptional)) out.push(...cfg.parentsOptional);
        return out;
    }

    /**
     * GET /api/kennels/:id/export
     * Walks the kennel's serialized dogs transitively, collects every reachable
     * SerializedDog/MimicDog. `base:` refs travel as plain references.
     */
    private async handleExport(req: any, res: any): Promise<void> {
        try {
            const config = await this.runHandler.loadKennelConfig(req.params.id, req.query.version);
            if (!config) {
                res.status(404).json({ error: `Kennel ${req.params.id} not found` });
                return;
            }
            if (!canRead(config as any, req.ctx)) {
                res.status(404).json({ error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }

            const seedIds = (config.dogIds ?? []).filter(id => !id.startsWith('base:'));
            const visited = new Set<string>();
            const collectedRows: any[] = [];
            const queue: string[] = [...seedIds];

            while (queue.length > 0) {
                const batch = queue.splice(0, queue.length).filter(id => !visited.has(id));
                if (batch.length === 0) continue;
                batch.forEach(id => visited.add(id));

                const [serialized, mimics] = await Promise.all([
                    this.nodesStore.findLatestVersionsByType(SerializedDog.name, batch),
                    this.nodesStore.findLatestVersionsByType(MimicDog.name, batch),
                ]);
                const rows = [...serialized, ...mimics] as any[];
                // P3.5 (W10): the rights of a pinned version are those of its lineage head.
                const acl = await DogAclIndex.load(this.nodesStore, rows.map((r) => ({ id: r.id, lineageId: r.lineageId })));

                for (const row of rows) {
                    // SECURITY (Nira F1): a readable kennel may reference dogs the caller
                    // may NOT read (run-only or private). Those travel as a reference stub —
                    // identity only, no config — and their parents are not walked (that would
                    // be the code's structure, again). COPY = READ (W16).
                    if (acl.accessOf({ id: row.id, lineageId: row.lineageId }, req.ctx) !== 'read') {
                        collectedRows.push({ row, cfg: null });
                        continue;
                    }
                    const cfg = this.parseDogConfig(row);
                    collectedRows.push({ row, cfg });
                    for (const ref of this.collectRefs(cfg)) {
                        if (typeof ref !== 'string') continue;
                        if (ref.startsWith('base:')) continue;
                        if (!visited.has(ref)) queue.push(ref);
                    }
                }
            }

            const dogs = collectedRows.map(({ row, cfg }) => cfg === null ? {
                lineageId: row.lineageId,
                versionId: row.id,
                displayName: row.displayName,
                redacted: true,
            } : {
                lineageId: row.lineageId || cfg.lineageId,
                versionId: row.id,
                displayName: row.displayName || cfg.displayName,
                type: cfg.imitates ? 'MimicDog' : 'SerializedDog',
                config: cfg,
            });

            // P4c (L10): der Key-Store reist nie mit; rohe Schluessel, die jemand in Code oder
            // Defaults geschrieben hat, werden ersetzt. `{{key:*}}`-Platzhalter reisen unveraendert.
            const scan = new RawKeyScan();
            const bundle = {
                bundleVersion: 2,
                kennel: {
                    kennelId: (config as any).lineageId || req.params.id,
                    name: config.name,
                    description: config.description,
                    emoji: config.emoji,
                    dogIds: config.dogIds,
                    defaultQuery: scan.redact(config.defaultQuery),
                    defaultBody: scan.redact(config.defaultBody),
                    task: config.task,
                    nodes: config.nodes,
                    edges: config.edges,
                },
                dogs: dogs.map((d: any) => (d.config ? { ...d, config: scan.redact(d.config) } : d)),
                ...(scan.hits > 0 ? {
                    redactions: {
                        count: scan.hits,
                        note: 'Raw API keys were found in dog code or kennel defaults and replaced by [redacted]. Store keys with set_key and use {{key:<alias>}} with keys.fetch instead.',
                    },
                } : {}),
            };

            res.json(bundle);
        } catch (err) {
            console.error('[KennelBundleHandler.handleExport]', err);
            res.status(500).json({ error: String(err) });
        }
    }

    /**
     * POST /api/kennels/import
     * Bundle rules:
     *  - `base:` refs must resolve against baseDogsMap, else 400.
     *  - SerializedDogs get fresh lineage+version GUIDs; parent refs are remapped.
     *  - Kennel is created as a single fresh version — no history restore.
     */
    private async handleImport(req: any, res: any): Promise<void> {
        try {
            if (!req.ctx?.user && !req.ctx?.isSuperUser) {
                res.status(401).json({ error: 'unauthorized', error_description: 'Login required to import kennels' });
                return;
            }
            const { importTarget, ...bundle } = req.body || {};
            if (!bundle?.kennel || !Array.isArray(bundle.dogs)) {
                res.status(400).json({ error: 'Invalid bundle: kennel and dogs[] required' });
                return;
            }

            // 1. Collect every base: ref the bundle relies on — from dog parents
            //    and from the kennel's own dogIds — and verify they all exist locally.
            const baseRefs = new Set<string>();
            const addBase = (ref: unknown) => {
                if (typeof ref === 'string' && ref.startsWith('base:')) baseRefs.add(ref);
            };
            for (const dog of bundle.dogs) {
                const cfg = dog?.config || {};
                (cfg.parentsRequired || []).forEach(addBase);
                (cfg.parentsOptional || []).forEach(addBase);
            }
            (bundle.kennel.dogIds || []).forEach(addBase);

            const missingBase: string[] = [];
            for (const ref of baseRefs) {
                const name = ref.substring('base:'.length);
                if (!this.baseDogsMap.has(name)) missingBase.push(ref);
            }
            if (missingBase.length > 0) {
                res.status(400).json({
                    error: `Import failed: Base dogs missing on this server: ${missingBase.join(', ')}`,
                });
                return;
            }

            // 2. Target kennel id + display name: explicit importTarget or bundle-based suggestion.
            const listRes = await this.kennelsController.list();
            const kennelRows: KennelIdNameListEntry[] =
                listRes.ok && listRes.data
                    ? (listRes.data as any[]).map((k) => ({
                            lineageId: (k as any).lineageId,
                            id: (k as any).id,
                            name: (k as any).name,
                        }))
                    : [];

            let kennelId: string;
            let kennelName: string;
            if (
                importTarget &&
                typeof importTarget.kennelId === 'string' &&
                typeof importTarget.name === 'string'
            ) {
                kennelId = importTarget.kennelId.trim();
                kennelName = importTarget.name.trim() || kennelId;
            } else {
                const s = suggestKennelImportTarget(bundle, kennelRows);
                kennelId = s.kennelId;
                kennelName = s.name;
            }

            // Segment-Regel (Name = zweites Segment hinter /k/); der Anzeigename ist frei.
            const idErr = kennelIdBlockedReason(kennelId);
            if (idErr) {
                res.status(400).json({ error: idErr });
                return;
            }

            if (isKennelIdTakenInList(kennelId, kennelRows)) {
                res
                    .status(400)
                    .json({ error: `Kennel id is already in use: ${kennelId}. Choose a free id in the import dialog.` });
                return;
            }
            if (isKennelNameTakenInList(kennelName, kennelRows)) {
                res
                    .status(400)
                    .json({ error: `Kennel name is already in use: ${kennelName}. Change it in the import dialog.` });
                return;
            }

            // Reference stubs (export of a dog the exporter could not read): no config to
            // persist. The reference stays as it is — it resolves if the dog exists on this
            // server and the importer may run it; otherwise the kennel reports it missing.
            const stubs = bundle.dogs.filter((dog: any) => dog?.redacted === true || !dog?.config);
            const hinweise: string[] = stubs.map((dog: any) =>
                `Dog ${dog?.displayName ?? dog?.lineageId ?? '?'} (${dog?.lineageId ?? dog?.versionId ?? '?'}) `
                + 'kam als Referenz ohne Code (redacted) — nicht importiert, die Referenz bleibt stehen.',
            );
            const importDogs = bundle.dogs.filter((dog: any) => !stubs.includes(dog));

            // 3. Build ID mapping for serialized/mimic dogs: old lineageId + old versionId → new lineageId.
            const idMap = new Map<string, string>();
            for (const dog of importDogs) {
                const newLineageId = generateLineageId();
                if (dog.lineageId) idMap.set(dog.lineageId, newLineageId);
                if (dog.versionId) idMap.set(dog.versionId, newLineageId);
            }

            // Stubs stay references — pinned to the exported version (8.15): the exporter could not
            // read the dog, so it may be someone's run-only dog, and a lineage reference would let
            // its author change the code this kennel runs.
            const stubPins = new Map<string, string>();
            for (const stub of stubs) {
                if (stub?.lineageId && stub?.versionId) stubPins.set(stub.lineageId, stub.versionId);
            }

            const remap = (ref: string): string => {
                if (typeof ref !== 'string') return ref;
                if (ref.startsWith('base:')) return ref; // base refs travel untouched
                return idMap.get(ref) ?? stubPins.get(ref) ?? ref;
            };

            // SECURITY: imported dogs are never ownerless. Without ACL columns they were
            // community-owned and public — the importer's copy of someone's code, open to all.
            // Same rule as every other create: owner = importer, visibility by his default.
            // Nothing ACL-related is taken from the bundle.
            const dogAcl = applyCreateDefaults({ ownerId: req.ctx?.user?.id ?? null }, req.ctx);

            // 4. Persist every dog with fresh GUIDs and remapped parent refs.
            for (const dog of importDogs) {
                const newLineageId = idMap.get(dog.lineageId) || idMap.get(dog.versionId) || generateLineageId();
                const newVersionId = generateVersionId();

                const cfg = { ...(dog.config || {}) };
                cfg.id = newVersionId;
                cfg.lineageId = newLineageId;
                cfg.parentId = null;
                cfg.displayName = dog.displayName || cfg.displayName;

                if (Array.isArray(cfg.parentsRequired)) {
                    cfg.parentsRequired = cfg.parentsRequired.map(remap);
                }
                if (Array.isArray(cfg.parentsOptional)) {
                    cfg.parentsOptional = cfg.parentsOptional.map(remap);
                }

                const type = cfg.imitates ? MimicDog.name : SerializedDog.name;

                await this.nodesStore.save({
                    id: newVersionId,
                    type,
                    lineageId: newLineageId,
                    parentId: null,
                    displayName: cfg.displayName,
                    serializedDogConfig: JSON.stringify(cfg),
                    visibility: dogAcl.visibility,
                    ownerId: dogAcl.ownerId,
                    createdAt: new Date(),
                });
            }

            // 5. Create the kennel as a single fresh version — no history restore.
            //    Imported kennels get ownerId from the importer; visibility follows the create
            //    defaults (the bundle's 'public' hint can override). A public kennel makes the
            //    importer's own dogs public via the controller's cascade.
            const remappedDogIds = (bundle.kennel.dogIds || []).map(remap);
            const kennelAcl = applyCreateDefaults(
                {
                    visibility: normalizeVisibility(bundle.kennel.visibility),
                    ownerId: req.ctx?.user?.id ?? null,
                },
                req.ctx,
            );
            const remappedNodes = Array.isArray(bundle.kennel.nodes)
                ? bundle.kennel.nodes.map((n: any) => ({ ...n, id: remap(n.id) }))
                : undefined;
            const remappedEdges = Array.isArray(bundle.kennel.edges)
                ? bundle.kennel.edges.map((e: any) => ({
                    ...e,
                    fromId: remap(e.fromId),
                    toId: remap(e.toId),
                }))
                : undefined;
            const createResult = await this.kennelsController.create({
                id: kennelId,
                name: kennelName,
                description: bundle.kennel.description,
                emoji: bundle.kennel.emoji,
                dogIds: remappedDogIds,
                task: bundle.kennel.task,
                nodes: remappedNodes,
                edges: remappedEdges,
                visibility: kennelAcl.visibility,
                ownerId: kennelAcl.ownerId,
            } as any);
            if (!createResult.ok) {
                res.status(500).json({ error: createResult.error });
                return;
            }

            if (bundle.kennel.defaultQuery || bundle.kennel.defaultBody) {
                await this.kennelsController.heal(kennelId, {
                    defaultQuery: bundle.kennel.defaultQuery,
                    defaultBody: bundle.kennel.defaultBody,
                } as any);
            }

            res.json({
                ok: true,
                kennelId,
                name: kennelName,
                idMap: Object.fromEntries(idMap),
                ...(hinweise.length > 0 ? { hinweise } : {}),
            });
        } catch (err) {
            console.error('[KennelBundleHandler.handleImport]', err);
            res.status(500).json({ error: String(err) });
        }
    }
}
