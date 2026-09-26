// Dog-Zugriff im Lauf — wer darf welchen Dog ausfuehren, und mit wessen Kapazitaeten?
// Eine Definition fuer den Lauf (KennelRunHandler) und die Redaktion (wavesRedaction):
// die Rechte eines Dogs sind die seines Lineage-Kopfes, nie die einer gepinnten alten Version.
import {
    SerializedDog,
    MimicDog,
    type IKennelConfig,
    type IMimicDogConfig,
    type ISerializedDogConfig,
    type VmGlobalCapabilityContext,
} from '@slopdogs/core';
import type { IStore } from '../store/IStore';
import type { AuthCtx } from '../mcp/auth/middleware';
import {
    accessOf,
    aclOf,
    applyCreateDefaults,
    canRead,
    canRun,
    effectiveVisibility,
    parseList,
    type Access,
    type AclEntity,
    type Visibility,
} from '../mcp/auth/visibility';

/** Ein Verweis auf einen Dog: Version-GUID und/oder lineageId. */
export interface DogRef {
    id?: string | null;
    lineageId?: string | null;
}

/**
 * Die Rechte der Dogs eines Laufs, aufgeloest auf den Kopf ihrer Lineage. Ein Dog, dessen Zeile
 * fehlt, hat keine Rechte — fail-closed ({@link accessOf} liefert dann 'none').
 */
export class DogAclIndex {
    private constructor(private readonly byKey: Map<string, AclEntity>) {}

    /**
     * Zwei Wege je Typ: Refs mit lineageId holen den Kopf ihrer Lineage, Refs ohne (Altbestand)
     * ihre eigene Zeile. Ohne Refs keine Abfrage.
     */
    static async load(nodesStore: IStore, refs: DogRef[]): Promise<DogAclIndex> {
        const lineageIds = [...new Set(refs.map((r) => r.lineageId).filter((v): v is string => !!v))];
        const bareIds = [...new Set(refs.filter((r) => !r.lineageId && r.id).map((r) => String(r.id)))];
        const byKey = new Map<string, AclEntity>();
        for (const ids of [lineageIds, bareIds]) {
            if (ids.length === 0) continue;
            const [serialized, mimics] = await Promise.all([
                nodesStore.findLatestVersionsByType(SerializedDog.name, ids),
                nodesStore.findLatestVersionsByType(MimicDog.name, ids),
            ]);
            for (const row of [...serialized, ...mimics] as any[]) {
                const key = ids === lineageIds ? row.lineageId : row.id;
                if (key && ids.includes(String(key))) byKey.set(String(key), aclOf(row));
            }
        }
        return new DogAclIndex(byKey);
    }

    aclOf(ref: DogRef): AclEntity | undefined {
        return (ref.lineageId && this.byKey.get(String(ref.lineageId))) || (ref.id ? this.byKey.get(String(ref.id)) : undefined);
    }

    accessOf(ref: DogRef, ctx: AuthCtx | undefined): Access {
        if (ctx?.isSuperUser) return 'read';
        const acl = this.aclOf(ref);
        return acl ? accessOf(acl, ctx) : 'none';
    }
}

/** Warum ein Kennel einen Dog nicht referenzieren darf (W21). */
export interface RefusedDogRef {
    id: string;
    /** forbidden: kein RUN. pin_required: nur RUN, und die Referenz ist keine Version-GUID (8.15). */
    reason: 'forbidden' | 'pin_required';
}

/**
 * W21: ein Kennel referenziert nur Dogs, die der Aufrufer ausfuehren darf (canRun). Fremde Dogs,
 * die er nicht lesen darf, nur als Version-Pin: der Autor soll keinen neuen Code in einen fremden
 * Kennel schieben koennen, der dort im Kontext anderer laeuft (8.15, Nira C). Base-Dogs und
 * ungespeicherte ids (Geschwister eines build_kennel, Basis-Namen) laesst die Pruefung der Laufzeit.
 */
export async function firstRefusedDogRef(
    dogIds: unknown,
    ctx: AuthCtx | undefined,
    lookup: (id: string) => Promise<(AclEntity & { id?: string }) | null | undefined>,
): Promise<RefusedDogRef | null> {
    if (ctx?.isSuperUser) return null;
    const ids = Array.isArray(dogIds) ? dogIds.filter((d): d is string => typeof d === 'string') : [];
    for (const id of ids) {
        if (id.startsWith('base:')) continue; // BaseDogs are public infrastructure
        const dog = await lookup(id);
        if (!dog) continue; // not a stored node → leave to runtime
        if (!canRun(dog, ctx)) return { id, reason: 'forbidden' };
        if (!canRead(dog, ctx) && dog.id !== id) return { id, reason: 'pin_required' };
    }
    return null;
}

/** Die Antwort auf eine verweigerte Referenz — ein Text fuer MCP und REST. */
export function refusedDogRefMessage(refused: RefusedDogRef): string {
    return refused.reason === 'pin_required'
        ? `pin_required: dog ${refused.id} is run-only for you — reference one of its version GUIDs (the id from list_nodes or get_node_schema), not its lineageId.`
        : `Not authorized to reference dog ${refused.id} — a kennel may only use dogs you can run (your own, public, run-only, or granted to you as runner).`;
}

/** Der Laufzeit-Kontext eines Laufs, als AuthCtx gelesen — fuer die Praedikate in visibility.ts. */
function authOfCapability(ctx: VmGlobalCapabilityContext | undefined): AuthCtx | undefined {
    if (!ctx) return undefined;
    return {
        user: ctx.userId ? { id: ctx.userId, email: '', name: null } : null,
        isSuperUser: ctx.isSuperUser === true,
    };
}

/**
 * Welche Dogs laufen in einem Kennel, und mit welchen Kapazitaeten (P3.5 3.5.4, 3.5.7, 8.15)?
 *
 * 1. Ausfuehren darf ein Dog, wenn der Kennel ihn tragen darf: er gehoert dem Kennel-Owner oder
 *    einem Kennel-Editor (dieselbe Hand hat ihn eingesetzt), oder der Kennel-Owner darf ihn
 *    ausfuehren (canRun — oeffentlich, run-only, oder er steht in runners). Sonst fehlt der Dog
 *    im Lauf: ein fremder privater Dog im Altbestand laeuft nicht, auch wenn der Aufrufer ihn
 *    zufaellig lesen duerfte — der Lauf eines Kennels haengt nicht davon ab, wer ihn ansieht.
 * 2. Darf der AUFRUFER den Dog nicht lesen, laeuft er in einem eigenen Namensraum: jsonStore unter
 *    `user:<aufrufer>:dog:<lineage>:` statt `user:<aufrufer>:`. Fremder Code sieht so nie die Ablage
 *    (und spaeter die Keys) dessen, der ihn ausfuehrt. Anonyme Aufrufer teilen sich ohnehin `anon:`.
 */
export class DogRunPolicy {
    private readonly kennelOwnerId: string | null;
    private readonly kennelVisibility: Visibility;
    private readonly kennelHands: Set<string>;
    private readonly kennelOwnerCtx: AuthCtx;
    private readonly runnerCtx: AuthCtx | undefined;

    constructor(kennel: IKennelConfig, private readonly capabilityCtx: VmGlobalCapabilityContext | undefined) {
        this.kennelOwnerId = (kennel as any).ownerId ?? null;
        this.kennelVisibility = effectiveVisibility(kennel as AclEntity);
        this.kennelHands = new Set([
            ...(this.kennelOwnerId ? [this.kennelOwnerId] : []),
            ...parseList((kennel as any).editors),
        ]);
        this.kennelOwnerCtx = {
            user: this.kennelOwnerId ? { id: this.kennelOwnerId, email: '', name: null } : null,
            isSuperUser: false,
        };
        this.runnerCtx = authOfCapability(capabilityCtx);
    }

    /** Darf dieser Dog in diesem Kennel ueberhaupt laufen? */
    mayRun(dog: AclEntity | undefined): boolean {
        if (!dog) return false;
        const dogOwnerId = dog.ownerId ?? null;
        if (dogOwnerId === this.kennelOwnerId) return true;
        if (dogOwnerId && this.kennelHands.has(dogOwnerId)) return true;
        return canRun(dog, this.kennelOwnerCtx);
    }

    /**
     * Die Rechte eines neu angelegten Auto-Mimics: er gehoert dem Kennel-Owner und ist so sichtbar
     * wie sein Kennel — nie mehr Community/public, nur weil ihn ein Lauf erzeugt hat. Ein Community-
     * Kennel hat keinen Owner: dann gelten die Create-Defaults des Ausloesers (Owner = der
     * eingeloggte Aufrufer), solange der Mimic damit in diesem Kennel noch laufen darf; sonst bleibt
     * er Community wie sein Kennel (anonymer Ausloeser, privater Community-Kennel).
     */
    newMimicAcl(): { ownerId: string | null; visibility: Visibility } {
        const visibility = this.kennelVisibility;
        if (this.kennelOwnerId) return { ownerId: this.kennelOwnerId, visibility };
        const byTrigger = { ownerId: (applyCreateDefaults({}, this.runnerCtx).ownerId ?? null) as string | null, visibility };
        return this.mayRun(byTrigger) ? byTrigger : { ownerId: null, visibility };
    }

    /** Laeuft er im eigenen Namensraum? Ja, wenn der Aufrufer seinen Code nicht lesen darf. */
    isForeignToRunner(dog: AclEntity): boolean {
        if (!this.runnerCtx || this.runnerCtx.isSuperUser) return false;
        return !canRead(dog, this.runnerCtx);
    }

    /** Die Instanz fuer den Lauf — im eigenen Namensraum, wenn sie dem Aufrufer fremd ist. */
    instantiate(config: ISerializedDogConfig | IMimicDogConfig, storageId: string, dog: AclEntity, lineageId: string): SerializedDog<unknown> {
        const imitates = (config as IMimicDogConfig).imitates;
        const isMimic = typeof imitates === 'string' && imitates.length > 0;
        if (!this.isForeignToRunner(dog)) {
            return isMimic ? new MimicDog(config as IMimicDogConfig, storageId) : new SerializedDog(config, storageId);
        }
        const scope: ForeignDogScope = { lineageId, ownerMayRead: canRead(dog, this.kennelOwnerCtx) };
        return isMimic
            ? new RunnerScopedMimicDog(config as IMimicDogConfig, storageId, scope)
            : new RunnerScopedSerializedDog(config, storageId, scope);
    }
}

/** Wer ein fremder Dog ist: seine Lineage und ob der Kennel-Owner seinen Code lesen darf (P4c 8.8). */
export interface ForeignDogScope {
    lineageId: string;
    ownerMayRead: boolean;
}

/**
 * Der Kapazitaets-Kontext eines fremden Dogs: die userId wird zu `<user>:dog:<lineage>`. Jede
 * Kapazitaet, die nach userId trennt (jsonStore), sieht damit einen eigenen, leeren Namensraum statt
 * der Ablage des Aufrufers — fail-closed, auch fuer kuenftige Kapazitaeten. `foreignDog` sagt es
 * ausdruecklich (auch Anonymen): `keys` gibt einem solchen Dog keinen Schluessel des Runners (P4c).
 */
export function scopeCapabilityToDog(
    ctx: VmGlobalCapabilityContext | undefined,
    scope: ForeignDogScope,
): VmGlobalCapabilityContext | undefined {
    if (!ctx || ctx.isSuperUser) return ctx;
    const foreignDog = { lineageId: scope.lineageId, ownerMayRead: scope.ownerMayRead };
    if (!ctx.userId) return { ...ctx, foreignDog };
    return { ...ctx, userId: `${ctx.userId}:dog:${scope.lineageId}`, foreignDog };
}

/** Ein SerializedDog, der dem Aufrufer fremd ist: gleicher Code, eigener Namensraum. */
export class RunnerScopedSerializedDog<T> extends SerializedDog<T> {
    constructor(config: ISerializedDogConfig, storageId: string, private readonly scope: ForeignDogScope) {
        super(config, storageId);
    }

    public setCapabilityContext(ctx: VmGlobalCapabilityContext | undefined): void {
        super.setCapabilityContext(scopeCapabilityToDog(ctx, this.scope));
    }
}

/** Dasselbe fuer einen MimicDog. */
export class RunnerScopedMimicDog<T> extends MimicDog<T> {
    constructor(config: IMimicDogConfig, storageId: string, private readonly scope: ForeignDogScope) {
        super(config, storageId);
    }

    public setCapabilityContext(ctx: VmGlobalCapabilityContext | undefined): void {
        super.setCapabilityContext(scopeCapabilityToDog(ctx, this.scope));
    }
}
