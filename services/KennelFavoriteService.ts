// KennelFavoriteService — Favoriten je Nutzer (Spur U): haengt `favorite` an Kennel-Antworten und
// setzt/vergisst den Favoriten des Aufrufers. Gespeichert auf die Lineage wie die Sterne. Gemerkt
// wird, was man ausfuehren darf (canRun); anders als bei den Sternen duerfen Owner und Editoren
// ihre eigenen Kennels favorisieren, und frozen/Landing sperren nichts — ein Favorit aendert den
// Kennel nicht.
import type { IKennelStatsStore } from '../store/IKennelStatsStore';
import type { AuthCtx } from '../mcp/auth/middleware';
import { canRun } from '../mcp/auth/visibility';
import { statsKeyOf, type RatableKennel } from './KennelStatsService';

type FavoriteStore = Pick<IKennelStatsStore, 'readKennelFavoriteIds' | 'addKennelFavorite' | 'deleteKennelFavorite'>;

export interface KennelFavoriteView {
    lineageId: string;
    favorite: boolean;
}

/** Ein abgelehnter Favoriten-Zugriff — Status und Code wie in der REST-Antwort. */
export class FavoriteError extends Error {
    constructor(
        readonly status: 401 | 403 | 404,
        readonly code: string,
        description?: string,
    ) {
        super(description ?? code);
        this.name = 'FavoriteError';
    }
}

export class KennelFavoriteService {
    constructor(private readonly store: FavoriteStore) {}

    /**
     * Haengt `favorite` in place an (additiv wie `stats`). Eine Abfrage je Aufruf ueber den userId-Index;
     * ohne Nutzer keine Abfrage, alles false. Sieht nur, was der Aufrufer schon durch den Rechtefilter liess.
     */
    async attach<T extends { id: string; lineageId?: string }>(
        kennels: T[],
        ctx: AuthCtx | undefined,
    ): Promise<Array<T & { favorite: boolean }>> {
        const userId = ctx?.user?.id;
        const favorites = userId && kennels.length > 0 ? new Set(await this.store.readKennelFavoriteIds(userId)) : new Set<string>();
        for (const k of kennels) (k as T & { favorite: boolean }).favorite = favorites.has(statsKeyOf(k));
        return kennels as Array<T & { favorite: boolean }>;
    }

    /** Merkt den Kennel fuer den Aufrufer — idempotent. Wirft FavoriteError. */
    async set(kennel: RatableKennel, ctx: AuthCtx | undefined): Promise<KennelFavoriteView> {
        const userId = KennelFavoriteService.holderOf(kennel, ctx);
        const lineageId = statsKeyOf(kennel);
        await this.store.addKennelFavorite(lineageId, userId);
        return { lineageId, favorite: true };
    }

    /** Vergisst den Favoriten des Aufrufers — idempotent. Wirft FavoriteError. */
    async clear(kennel: RatableKennel, ctx: AuthCtx | undefined): Promise<KennelFavoriteView> {
        const userId = KennelFavoriteService.holderOf(kennel, ctx);
        const lineageId = statsKeyOf(kennel);
        await this.store.deleteKennelFavorite(lineageId, userId);
        return { lineageId, favorite: false };
    }

    /**
     * Wer merken darf: was man ausfuehren darf — sonst 404, nichts verraten; eingeloggt (401); mit
     * echter Identitaet — der Dev-Super-User hat keine (403, wie bei den Sternen).
     */
    private static holderOf(kennel: RatableKennel, ctx: AuthCtx | undefined): string {
        if (!canRun(kennel, ctx)) throw new FavoriteError(404, 'not_found', 'Kennel not found');
        if (!ctx?.user && !ctx?.isSuperUser) throw new FavoriteError(401, 'unauthorized', 'Login required for favorites.');
        const userId = ctx?.user?.id;
        if (!userId) throw new FavoriteError(403, 'no_identity', 'Super-user mode has no user identity for favorites.');
        return userId;
    }
}
