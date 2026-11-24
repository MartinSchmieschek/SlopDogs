import { canRead, type AclEntity } from '../../mcp/auth/visibility';
import type { AuthCtx } from '../../mcp/auth/middleware';

// Cache-Klassen des Ergebnis-Caches (PLAN-KENNEL-CACHE 2.1): wovon das Lead-Ergebnis eines Kennels abhaengt und
// damit, welche TTL ein Besitzer setzen darf. Die strengste Klasse eines Dogs im gefuellten Kennel gilt fuer den Kennel.

/** rein < fluechtig < persoenlich < live — in dieser Reihenfolge streng. */
export const CACHE_CLASSES = ['rein', 'fluechtig', 'persoenlich', 'live'] as const;
export type CacheClass = (typeof CACHE_CLASSES)[number];

export function isCacheClass(value: unknown): value is CacheClass {
    return typeof value === 'string' && (CACHE_CLASSES as readonly string[]).includes(value);
}

export function strictnessOf(klasse: CacheClass): number {
    return CACHE_CLASSES.indexOf(klasse);
}

export function stricterOf(a: CacheClass, b: CacheClass): CacheClass {
    return strictnessOf(a) >= strictnessOf(b) ? a : b;
}

/** Ein Grund fuer eine Klasse: welcher Dog, welche Klasse, und — nur fuer Leser des Dogs — was im Code steht. */
export interface CacheClassReason {
    klasse: CacheClass;
    /** Base-Dog-Name oder "<displayName> (<lineageId>)". */
    dog: string;
    /** z. B. "fetch, Zeile 12" oder "Ausweichtabelle"; fehlt, wenn der Betrachter den Dog nicht lesen darf. */
    detail?: string;
    /** Die Rechte eines eigenen Dogs (Lineage-Kopf); Base-Dogs haben keine — ihr Code ist oeffentlich. */
    acl?: AclEntity;
}

/**
 * Die Klasse eines Kennels samt Gruenden. Unveraenderlich; `with()` liefert eine neue, strengere oder gleiche.
 * Ohne Gruende ist der Kennel `rein` (nur Code-Versionen, Query und Body).
 */
export class CacheClassification {
    static readonly MAX_REASONS = 20;

    private constructor(
        readonly klasse: CacheClass,
        readonly reasons: readonly CacheClassReason[],
    ) {}

    static rein(): CacheClassification {
        return new CacheClassification('rein', []);
    }

    static of(reasons: CacheClassReason[]): CacheClassification {
        return reasons.reduce((acc, r) => acc.with(r), CacheClassification.rein());
    }

    with(reason: CacheClassReason): CacheClassification {
        if (reason.klasse === 'rein') return this;
        return new CacheClassification(stricterOf(this.klasse, reason.klasse), [...this.reasons, reason]);
    }

    /** Die Gruende als Text, strengste zuerst, gedeckelt — fuer get_kennel, build_kennel und die UI. */
    get gruende(): string[] {
        return [...this.reasons]
            .sort((a, b) => strictnessOf(b.klasse) - strictnessOf(a.klasse))
            .slice(0, CacheClassification.MAX_REASONS)
            .map((r) => `${r.dog}: ${r.klasse}${r.detail ? ` (${r.detail})` : ''}`);
    }

    /** Die Gruende ohne Code-Fundstellen der Dogs, die `ctx` nicht lesen darf (eine Fundstelle ist Code, also READ). */
    redactedFor(ctx: AuthCtx | undefined): CacheClassification {
        const hidden = (r: CacheClassReason) => r.detail !== undefined && r.acl !== undefined && !canRead(r.acl, ctx);
        return new CacheClassification(
            this.klasse,
            this.reasons.map((r) => (hidden(r) ? { klasse: r.klasse, dog: r.dog, acl: r.acl } : r)),
        );
    }
}
