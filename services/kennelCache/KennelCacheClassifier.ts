// Die Cache-Klasse eines Kennels (PLAN-KENNEL-CACHE 2.2): die strengste Klasse im gefuellten Kennel, mit Gruenden.
// Eigene Dogs ueber ihren Code (DogCodeCacheClassifier, je Version gemerkt), Base-Dogs ueber `cacheClass` bzw. die
// Ausweichtabelle. Der Code wird nur fuer Versionen geladen, die der Klassifizierer noch nicht kennt.
import type { IStore } from '../../store/IStore';
import { CacheClassification, type CacheClassReason } from './CacheClass';
import { BaseDogCacheClasses } from './BaseDogCacheClasses';
import { DogCodeCacheClassifier, type DogCodeVerdict } from './DogCodeCacheClassifier';
import { KennelDogResolver, type ResolvedKennelDogs, type ResolvedOwnDog } from './KennelDogResolver';
import { ResultCacheTtl } from './ResultCacheTtl';

/** Was get_kennel, build_kennel, create_kennel, update_kennel und die UI zeigen. */
export interface CacheClassView {
    klasse: CacheClassification['klasse'];
    gruende: string[];
    /** Welche resultCacheTtl die Klasse zulaesst. */
    erlaubt: string[];
    /** Gesetzt, wenn die gespeicherte TTL zur heutigen Klasse nicht passt: der Kennel cacht dann nicht. */
    ruht?: string;
}

export class KennelCacheClassifier {
    constructor(
        private readonly nodesStore: IStore,
        private readonly resolver: KennelDogResolver,
        private readonly baseDogs: BaseDogCacheClasses,
        private readonly code: DogCodeCacheClassifier = new DogCodeCacheClassifier(),
    ) {}

    /** Ein Klassifizierer mit eigener Aufloesung ueber `nodesStore` und den Base-Dogs der Registry. */
    static over(nodesStore: IStore, baseDogsMap: Map<string, new () => unknown>): KennelCacheClassifier {
        const baseDogs = new BaseDogCacheClasses(baseDogsMap);
        return new KennelCacheClassifier(nodesStore, new KennelDogResolver(nodesStore, baseDogs), baseDogs);
    }

    get dogResolver(): KennelDogResolver {
        return this.resolver;
    }

    static view(classification: CacheClassification, ttl: ResultCacheTtl = ResultCacheTtl.OFF): CacheClassView {
        const ruht = ttl.refusalFor(classification);
        return {
            klasse: classification.klasse,
            gruende: classification.gruende,
            erlaubt: ResultCacheTtl.allowedFor(classification.klasse),
            ...(ruht ? { ruht } : {}),
        };
    }

    /** Fuer KennelController (IResultCacheTtlGate): passt die TTL zur Klasse dieser Crew? */
    async ttlRefusal(ttl: ResultCacheTtl, dogIds: unknown): Promise<string | null> {
        if (!ttl.enabled) return null;
        return ttl.refusalFor(await this.classify({ dogIds }));
    }

    async classify(kennel: { dogIds?: unknown }): Promise<CacheClassification> {
        return this.classifyResolved(await this.resolver.resolve(kennel?.dogIds));
    }

    async classifyResolved(dogs: ResolvedKennelDogs): Promise<CacheClassification> {
        const verdicts = await this.verdictsOf(dogs.own);
        const reasons: CacheClassReason[] = [];
        for (const dog of dogs.own) {
            const verdict = verdicts.get(dog.versionId);
            if (!verdict || verdict.klasse === 'rein') continue;
            reasons.push({ klasse: verdict.klasse, dog: KennelCacheClassifier.label(dog), detail: verdict.detail, acl: dog.acl });
        }
        for (const name of dogs.base) {
            const base = this.baseDogs.classOf(name);
            reasons.push({ klasse: base.klasse, dog: name, detail: base.detail });
        }
        // Eine ID ohne Zeile laeuft nicht; der Lead faellt dann aus — keine eigene Klasse, aber sichtbar.
        for (const id of dogs.unresolved) reasons.push({ klasse: 'fluechtig', dog: id, detail: 'nicht gefunden' });
        return CacheClassification.of(reasons);
    }

    private async verdictsOf(own: readonly ResolvedOwnDog[]): Promise<Map<string, DogCodeVerdict>> {
        const out = new Map<string, DogCodeVerdict>();
        const missing: string[] = [];
        for (const dog of own) {
            const known = this.code.verdictOf(dog.versionId);
            if (known) out.set(dog.versionId, known);
            else missing.push(dog.versionId);
        }
        if (missing.length === 0) return out;
        for (const row of await this.nodesStore.findRowsByIds(missing)) {
            out.set(String(row.id), this.code.classify(String(row.id), KennelCacheClassifier.codeOf(row)));
        }
        return out;
    }

    private static codeOf(row: { serializedDogConfig?: unknown }): string {
        let cfg: unknown = row.serializedDogConfig;
        if (typeof cfg === 'string') {
            try {
                cfg = JSON.parse(cfg);
            } catch {
                return '';
            }
        }
        const c = (cfg ?? {}) as { theRun?: unknown; tsCode?: unknown };
        if (typeof c.theRun === 'string' && c.theRun.length > 0) return c.theRun;
        return typeof c.tsCode === 'string' ? c.tsCode : '';
    }

    private static label(dog: ResolvedOwnDog): string {
        return `${dog.displayName ?? 'Dog'} (${dog.lineageId})`;
    }
}
