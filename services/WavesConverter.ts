// The WavesConverter — the chronicler of the hunt, who turns the raw season into Waves of plunder.
// After the dogs have hunted, their season must be charted in a form the crew can read.
// Carrion hordes trill their profane accord with eldritch plans: each wave is a tide of results.
import {
    IHuntingSeason,
    IWaveEntry,
    IReadTrackingEntry,
    IHuntingDog,
    SerializedDog,
    MimicDog,
    IKennelConfig,
} from '@slopdogs/core';
import { TypeDefBuilder } from './TypeDefBuilder';

/**
 * Records who read from whom during the hunt — the data lineage of the pack.
 * Its heralds are the stars it fells: we track every read as a star felled by another dog.
 */
export type ReadTrackingEntry = {
    waveIndex: number;
    readerInstanceName: string;
    sourceInstanceName: string;
    propertyPath: string;
};

/**
 * A single dog's entry in the wave — its plunder, its lineage, its code, and its context.
 * For SerializedDogs, the code and VM context are preserved so the crew may inspect the hunt.
 * The return-type alias is unique per instance to prevent eldritch type collisions in the VM.
 */
export type NodeEntry = {
    id: string;
    /** The lineage GUID — binds all incarnations of this spirit across branches */
    lineageId?: string;
    /** The spirit's true name — changeable without breaking pacts */
    displayName?: string;
    name: string;
    /**
     * The name this dog is bound under when it serves as a parent in a child's VM context.
     * Same value for every dog kind — SerializedDogs report toCamelCase(displayName), base dogs
     * their class name — so the UI never has to tell the kinds apart, and never has to compute
     * the transformation itself.
     */
    contextName: string;
    /** A brief description of what this dog does */
    description?: string;
    icon?: string;
    result: any;
    error?: string;
    codeTs?: string;
    vmContext?: Record<string, any>;
    vmContextTypeDef?: string;
    /** The unique return-type alias for this dog's instance in the context lib. */
    vmExpectedReturnTypeName?: string;
    parentsRequired?: string[];
    parentsOptional?: string[];
    /** Whether this node can be deleted from the kennel — mimics and pact-bound spirits cannot */
    deletable: boolean;
    /** Whether this node's code can be edited and saved — base dogs are read-only */
    editable: boolean;
    /** Whether this node is a shapeshifter wearing a borrowed form */
    mimic: boolean;
    serializedDogConfig?: {
        theRun: string;
        lineageId?: string;
        parentId?: string | null;
        displayName?: string;
        version?: number;
        parentsRequired?: string[];
        parentsOptional?: string[];
    };
    readFrom?: ReadTrackingEntry[];
    readBy?: ReadTrackingEntry[];
    /**
     * Liegt dieser Knoten auf einem transitiven Pfad, der das Lead-Ergebnis speist —
     * Lead selbst, statische parentsRequired/parentsOptional-Kette, und per readFrom
 * weiterverfolgte Datenquellen, globales readTracking, und Initiatoren der ersten Welle,
 * die den Lead noch per Kanten-Graph erreichen. Nur gesetzt, wenn eine Kennel-Config
 * übergeben wurde; sonst undefined (unbekannt).
 */
    onLeadDependencyPath?: boolean;
};

/**
 * The Waves — a 2D tide of NodeEntries, each wave a parallel surge of dog results.
 * To cosmic forms from tangent planes we end as we began: wave by wave, the hunt unfolds.
 */
export type Waves = NodeEntry[][];

/**
 * Resolve a dog instance's canonical ID.
 * SerializedDogs carry their own storageId; BaseDogs are known by their name.
 * From brooding gulfs are we beheld: every dog must be named before it can be tracked.
 */
function resolveInstanceId(instance: any): string {
    return (instance instanceof SerializedDog)
        ? (instance as SerializedDog<unknown>).storageId
        : instance.name;
}

/**
 * Lead-Knoten aus den Waves — gleiche Semantik wie @slopdogs/swaggrid (Herald) / öffentliche API:
 * erster `dogIds`-Eintrag; `base:`-Prefix optional; Versions-Suffix optional;
 * bei SerializedDogs oft `lineageId` in der Kennel-Charter, `id` in den Waves = `storageId`.
 */
export function findLeadNodeEntry(waves: Waves, kennelConfig: IKennelConfig): NodeEntry | null {
    const leadId = kennelConfig.dogIds?.[0];
    if (!leadId) return null;
    const searchId = leadId.startsWith('base:') ? leadId.substring(5) : leadId;

    for (const wave of waves) {
        for (const node of wave) {
            if (
                node.id === searchId ||
                node.id === leadId ||
                node.id.replace(/-v\d+$/, '') === searchId.replace(/-v\d+$/, '') ||
                (node.lineageId != null &&
                    (node.lineageId === leadId || node.lineageId === searchId))
            ) {
                return node;
            }
        }
    }
    return null;
}

/**
 * Ein parentsRequired/Optional-Eintrag kann storageId, lineageId oder Base-Dog-Name sein —
 * parallel zu SerializedDog.findParentDog.
 */
function resolveParentRefToNode(ref: string, nodes: NodeEntry[]): NodeEntry | undefined {
    return nodes.find(n =>
        n.id === ref ||
        (n.lineageId != null && n.lineageId === ref) ||
        n.name === ref
    );
}

/**
 * Transitiver Abschluss vom Lead zu allen Knoten, von denen das Lead (statisch) abhängt,
 * plus Fixpunkt-Erweiterung über readFrom (welche Quellen jeder Knoten in der Hülle las).
 */
function computeLeadDependencyClosure(lead: NodeEntry, allNodes: NodeEntry[]): Set<string> {
    const closure = new Set<string>();
    const queue: string[] = [lead.id];

    while (queue.length > 0) {
        const id = queue.shift()!;
        if (closure.has(id)) continue;
        closure.add(id);
        const node = allNodes.find(n => n.id === id);
        if (!node) continue;

        const refs = [
            ...(node.parentsRequired || []),
            ...(node.parentsOptional || []),
        ];
        for (const ref of refs) {
            const parent = resolveParentRefToNode(ref, allNodes);
            if (parent) {
                queue.push(parent.id);
            }
        }
    }

    let changed = true;
    while (changed) {
        changed = false;
        for (const id of closure) {
            const node = allNodes.find(n => n.id === id);
            if (!node?.readFrom?.length) continue;
            for (const rt of node.readFrom) {
                const source = allNodes.find(n =>
                    n.name === rt.sourceInstanceName ||
                    n.id === rt.sourceInstanceName
                );
                if (source && !closure.has(source.id)) {
                    closure.add(source.id);
                    changed = true;
                }
            }
        }
    }

    return closure;
}

function cleanParentRefForEdge(parentId: string): string {
    return parentId.startsWith('base:') ? parentId.substring(5) : parentId;
}

/** Parent → Kinder (gleiche Semantik wie der UI-Graph). */
function buildParentToChildrenMapFromWaves(waves: Waves): Map<string, Set<string>> {
    const children = new Map<string, Set<string>>();
    const add = (parentId: string, childId: string) => {
        if (!children.has(parentId)) children.set(parentId, new Set());
        children.get(parentId)!.add(childId);
    };
    for (const wave of waves) {
        for (const dog of wave) {
            for (const pid of dog.parentsRequired ?? []) {
                add(cleanParentRefForEdge(pid), dog.id);
            }
            for (const pid of dog.parentsOptional ?? []) {
                add(cleanParentRefForEdge(pid), dog.id);
            }
        }
    }
    return children;
}

/** Forward-Erreichbarkeit entlang Parent→Kind (Datenfluss zum Lead). */
function canReachForward(
    children: Map<string, Set<string>>,
    start: string,
    target: string
): boolean {
    const q: string[] = [start];
    const seen = new Set<string>();
    while (q.length > 0) {
        const x = q.shift()!;
        if (x === target) return true;
        if (seen.has(x)) continue;
        seen.add(x);
        for (const c of children.get(x) ?? []) {
            if (!seen.has(c)) q.push(c);
        }
    }
    return false;
}

/**
 * Initiatoren in Welle 0, die den Lead noch über den Kanten-Graph „vorwärts“ erreichen,
 * in die Hülle aufnehmen (löst Lücken, wenn Eltern-Ketten nicht alle Reads abbilden).
 */
function extendClosureWithWaveZeroReachableToLead(
    waves: Waves,
    leadId: string,
    closure: Set<string>
): boolean {
    if (!waves.length || !waves[0].length) return false;
    const children = buildParentToChildrenMapFromWaves(waves);
    let changed = false;
    for (const n of waves[0]) {
        if (closure.has(n.id)) continue;
        if (canReachForward(children, n.id, leadId)) {
            closure.add(n.id);
            changed = true;
        }
    }
    return changed;
}

/**
 * Vollständiges readTracking: jede Kante Reader→Quelle zieht die Quelle in die Hülle,
 * wenn der Reader schon drin ist (Fixpunkt bis stabil).
 */
function closureContainsReader(
    closure: Set<string>,
    allNodes: NodeEntry[],
    readerInstance: IHuntingDog<unknown>
): boolean {
    const rid = resolveInstanceId(readerInstance);
    if (closure.has(rid)) return true;
    return allNodes.some(
        n => closure.has(n.id) && n.name === readerInstance.name
    );
}

function expandClosureWithGlobalReadTracking(
    closure: Set<string>,
    allNodes: NodeEntry[],
    readTracking: IReadTrackingEntry[]
): void {
    let pass = true;
    while (pass) {
        pass = false;
        for (const rt of readTracking) {
            const sourceId = resolveInstanceId(rt.sourceInstance);
            if (!closureContainsReader(closure, allNodes, rt.readerInstance)) continue;
            if (closure.has(sourceId)) continue;
            const sourceNode = allNodes.find(
                n => n.id === sourceId || n.name === rt.sourceInstance.name
            );
            if (sourceNode) {
                closure.add(sourceNode.id);
                pass = true;
            }
        }
    }
}

function applyLeadPathAnnotation(
    waves: Waves,
    kennelConfig: IKennelConfig,
    readTracking: IReadTrackingEntry[]
): void {
    const flat = waves.flat();
    const lead = findLeadNodeEntry(waves, kennelConfig);
    if (!lead) {
        return;
    }

    const closure = computeLeadDependencyClosure(lead, flat);

    let iter = 0;
    const maxIter = 32;
    while (iter < maxIter) {
        iter++;
        const sizeBefore = closure.size;
        expandClosureWithGlobalReadTracking(closure, flat, readTracking);
        extendClosureWithWaveZeroReachableToLead(waves, lead.id, closure);
        if (closure.size === sizeBefore) break;
    }

    for (const n of flat) {
        n.onLeadDependencyPath = closure.has(n.id);
    }
}

/** Der Scrub eines Laufs (P4c, KeyRunState) — hier nur die Form, damit der Konverter nichts vom Key-Store weiss. */
export interface WavesScrub {
    scrubValue<T>(value: T): T;
    scrubText(text: string): string;
}

/**
 * Convert the raw IHuntingSeason into Waves — the structured chronicle of the hunt.
 * Each wave is a parallel surge; each node entry is a dog's full account of what it seized.
 * ReadTracking is resolved bidirectionally: who fed this dog, and who did this dog feed.
 *
 * @param kennelConfig — wenn gesetzt, markiert jeder Knoten `onLeadDependencyPath`, ob er
 *   nach einem Run transitiv zum Lead-Ergebnis beiträgt (Eltern-Graph rekursiv + readFrom).
 * @param scrub — P4c (Defense-in-Depth): ersetzt jeden im Lauf benutzten Schluessel-Wert in
 *   result, error (`__error`) und vmContext durch `[redacted:key]`, bevor die Waves irgendwohin gehen.
 */
export function convertSeasonToWaves(theHunt: IHuntingSeason, kennelConfig?: IKennelConfig, scrub?: WavesScrub): Waves {
    const waves: Waves = [];

    theHunt.wave.forEach((wave: IWaveEntry[]) => {
        waves.push(wave.map((entry: IWaveEntry) => {
            const instance = entry.instance;
            const instanceId = resolveInstanceId(instance);
            const instanceName = instance.name;

            const readFrom: any[] = [];
            const readBy: any[] = [];

            // Walk the read-tracking log to discover this dog's place in the data lineage.
            // In luminous space, blackened stars: each tracking entry illuminates a connection.
            theHunt.readTracking.forEach((trackingEntry: any) => {
                const readerName = trackingEntry.readerInstance.name;
                const sourceName = trackingEntry.sourceInstance.name;
                const readerId = resolveInstanceId(trackingEntry.readerInstance);
                const sourceId = resolveInstanceId(trackingEntry.sourceInstance);

                // This dog was a reader — it drank from another dog's plunder.
                if (readerId === instanceId || readerName === instanceName) {
                    readFrom.push({
                        waveIndex: trackingEntry.waveIndex,
                        readerInstanceName: readerName,
                        sourceInstanceName: sourceName,
                        propertyPath: trackingEntry.propertyPath
                    });
                }

                // This dog was a source — others drank from its plunder.
                if (sourceId === instanceId || sourceName === instanceName) {
                    readBy.push({
                        waveIndex: trackingEntry.waveIndex,
                        readerInstanceName: readerName,
                        sourceInstanceName: sourceName,
                        propertyPath: trackingEntry.propertyPath
                    });
                }
            });

            const isMimic = instance instanceof MimicDog;
            const isSerialized = instance instanceof SerializedDog;

            const nodeEntry = {
                id: instanceId,
                lineageId: isSerialized
                    ? (instance as SerializedDog<unknown>).lineageId
                    : undefined,
                displayName: isSerialized
                    ? (instance as SerializedDog<unknown>).instanceConfig?.displayName
                    : undefined,
                name: instanceName,
                // The binding name, straight from the live instance's IHuntingDog.name getter —
                // the very value mergeParentDogsIntoContext writes into the context. Set here in
                // the shared literal, so SerializedDogs and base dogs carry it alike.
                contextName: instanceName,
                description: (instance as IHuntingDog<unknown>).description ?? undefined,
                icon: (isSerialized
                    ? (instance as SerializedDog<unknown>).icon
                    : (instance as IHuntingDog<unknown>).icon) ?? undefined,
                result: scrub ? scrub.scrubValue(instance.collected) : instance.collected,
                error: ((instance as any).__error && scrub ? scrub.scrubText((instance as any).__error) : (instance as any).__error) || undefined,
                // Mimics are pact-bound shapeshifters — they cannot be deleted from the kennel.
                // BaseDogs are born of code, not the store — they too resist deletion.
                deletable: !isMimic,
                editable: isSerialized,
                mimic: isMimic,
                parentsOptional: [],
                parentsRequired: [],
                readFrom: readFrom.length > 0 ? readFrom : undefined,
                readBy: readBy.length > 0 ? readBy : undefined,
            } as NodeEntry;

            if (entry.instance instanceof SerializedDog) {
                // SerializedDogs carry their own code and VM context — expose it all for the crew.
                // Through endless faces, countless forms: each SerializedDog may have unique typings.
                const seDog = entry.instance as SerializedDog<unknown>;
                nodeEntry.codeTs = seDog.instanceConfig.theRun;
                const vmCtx = scrub ? scrub.scrubValue(seDog.simpleVmContext || {}) : (seDog.simpleVmContext || {});
                nodeEntry.vmContext = vmCtx;
                nodeEntry.vmExpectedReturnTypeName = TypeDefBuilder.expectedReturnAliasTypeName(instanceId);
                nodeEntry.vmContextTypeDef = TypeDefBuilder.buildContextLib(
                    seDog.name,
                    vmCtx,
                    entry.instance,
                    instanceId
                );
                nodeEntry.serializedDogConfig = {
                    theRun: seDog.instanceConfig.theRun,
                    lineageId: seDog.instanceConfig.lineageId,
                    parentId: seDog.instanceConfig.parentId,
                    displayName: seDog.instanceConfig.displayName,
                    version: seDog.instanceConfig.version,
                    parentsRequired: seDog.instanceConfig.parentsRequired || [],
                    parentsOptional: seDog.instanceConfig.parentsOptional || [],
                    ...(typeof seDog.instanceConfig.icon === 'string'
                        ? { icon: seDog.instanceConfig.icon }
                        : {}),
                };
                nodeEntry.parentsRequired = seDog.instanceConfig.parentsRequired || [];
                nodeEntry.parentsOptional = seDog.instanceConfig.parentsOptional || [];
            } else {
                // BaseDogs derive their parents from the hunt's dependency graph — not from a stored config.
                nodeEntry.parentsOptional = [...entry.optionalRequiresFrom ? entry.optionalRequiresFrom.map((r: any) => {
                    return resolveInstanceId(r.instance);
                }) : []];
                nodeEntry.parentsRequired = [...entry.requiresFrom ? entry.requiresFrom.map((r: any) => {
                    return resolveInstanceId(r.instance);
                }) : []];
            }

            return nodeEntry;
        }));
    });

    if (kennelConfig) {
        applyLeadPathAnnotation(waves, kennelConfig, theHunt.readTracking ?? []);
    }

    return waves;
}
