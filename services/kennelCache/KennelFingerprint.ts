// Der Fingerabdruck eines Kennel-Laufs (PLAN-KENNEL-CACHE D1): alles, wovon das Lead-Ergebnis ausser Query, Body
// und Aufrufer abhaengt — ohne den Lauf zu starten. Dieselbe Aufloesung wie die Factory (KennelDogResolver), dazu
// `mayRun` gegen den Kennel, die Paketversionen der Base-Dogs und der Stand des Servers (ein Eintrag ueberlebt den
// Deploy nicht). Je Prozess kurz gemerkt; jede neue Dog- oder Kennel-Version verwirft das Memo (refIndex.onChange).
import { createHash } from 'crypto';
import type { IKennelConfig } from '@martinschmieschek/slopdogs-core/runtime';
import { DogRunPolicy } from '../dogAccess';
import { basePackageOf } from '../dogVersions';
import { parseList } from '../../mcp/auth/visibility';
import type { CacheClassification } from './CacheClass';
import type { KennelCacheClassifier } from './KennelCacheClassifier';
import type { ResolvedKennelDogs, ResolvedOwnDog } from './KennelDogResolver';
import { ResultCacheTtl } from './ResultCacheTtl';

export class KennelFingerprint {
    constructor(
        /** sha256 ueber den Inhalt — Teil des Cache-Schluessels. */
        readonly hash: string,
        readonly dogs: ResolvedKennelDogs,
        /** Die eigenen Dogs, die in diesem Kennel laufen duerfen (DogRunPolicy.mayRun) — genau die, die die Factory laedt. */
        readonly runnable: readonly ResolvedOwnDog[],
        readonly classification: CacheClassification,
        readonly ttl: ResultCacheTtl,
    ) {}

    /** Erreicht die Query den Lauf? Nur ueber den QueryRetriever (Plan 1). */
    get readsQuery(): boolean {
        return this.dogs.base.includes('QueryRetriever');
    }

    /** Erreicht der Body den Lauf? Nur ueber den BodyRetriever. */
    get readsBody(): boolean {
        return this.dogs.base.includes('BodyRetriever');
    }
}

interface MemoEntry {
    at: number;
    fingerprint: KennelFingerprint;
}

export class KennelFingerprints {
    static readonly MEMO_MS = 5_000;
    static readonly MAX_MEMO = 1_000;
    private readonly memo = new Map<string, MemoEntry>();

    constructor(
        private readonly classifier: KennelCacheClassifier,
        /** Server-, Commit- und core-Version als ein Text (ServerVersion.block). */
        private readonly serverStamp: () => string,
        private readonly memoMs: number = KennelFingerprints.MEMO_MS,
        private readonly now: () => number = Date.now,
    ) {}

    /** Neue Dog- oder Kennel-Version irgendwo: das Memo gilt nicht mehr. */
    invalidate(): void {
        this.memo.clear();
    }

    async of(config: IKennelConfig): Promise<KennelFingerprint> {
        const memoKey = KennelFingerprints.memoKeyOf(config);
        const known = this.memo.get(memoKey);
        if (known && this.now() - known.at < this.memoMs) return known.fingerprint;
        const fingerprint = await this.compute(config);
        if (this.memo.size >= KennelFingerprints.MAX_MEMO) {
            const oldest = this.memo.keys().next().value;
            if (oldest !== undefined) this.memo.delete(oldest);
        }
        this.memo.set(memoKey, { at: this.now(), fingerprint });
        return fingerprint;
    }

    private async compute(config: IKennelConfig): Promise<KennelFingerprint> {
        const dogs = await this.classifier.dogResolver.resolve(config.dogIds);
        const policy = new DogRunPolicy(config, undefined);
        const runnable = dogs.own.filter((dog) => policy.mayRun(dog.acl));
        const classification = await this.classifier.classifyResolved(dogs);
        const ttl = ResultCacheTtl.ofKennel(config);
        const k = config as IKennelConfig & { lineageId?: string; ownerId?: string | null; editors?: unknown };
        const content = {
            v: 1,
            server: this.serverStamp(),
            kennel: {
                version: config.id,
                lineageId: k.lineageId ?? config.id,
                dogIds: config.dogIds ?? [],
                ownerId: k.ownerId ?? null,
                editors: [...parseList(k.editors as string | string[] | null | undefined)].sort(),
                ttl: ttl.value,
            },
            own: dogs.own
                .map((dog) => [dog.lineageId, dog.versionId, dog.type, policy.mayRun(dog.acl), KennelFingerprints.aclText(dog)])
                .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
            base: dogs.base.map((name) => {
                const pkg = basePackageOf(name);
                return pkg ? `${name}=${pkg.name}@${pkg.version}` : name;
            }),
            unresolved: [...dogs.unresolved].sort(),
        };
        const hash = createHash('sha256').update(JSON.stringify(content)).digest('hex');
        return new KennelFingerprint(hash, dogs, runnable, classification, ttl);
    }

    private static aclText(dog: ResolvedOwnDog): string {
        const acl = dog.acl;
        if (!acl) return 'none';
        return JSON.stringify([acl.visibility ?? null, acl.ownerId ?? null, acl.editors ?? null, acl.viewers ?? null, acl.runners ?? null]);
    }

    private static memoKeyOf(config: IKennelConfig): string {
        const k = config as IKennelConfig & { ownerId?: string | null; editors?: unknown; resultCacheTtl?: unknown };
        return JSON.stringify([config.id, config.dogIds ?? [], k.ownerId ?? null, k.editors ?? null, k.resultCacheTtl ?? 0]);
    }
}
