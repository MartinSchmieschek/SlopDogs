/**
 * =========================================================================
 *  OPEN LIBRARY RETRIEVER — searching the literary void
 * =========================================================================
 *
 *  Arr, matey! This hound scours the Open Library for books —
 *  titles, authors, covers, and pages — all plucked from
 *  the boundless shelves of the void.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { searchOpenLibrary } from "./openLibraryApiClient";
import type { OpenLibraryResult } from "./interfaces/openLibraryTypes";
import { OpenLibraryQueryPact, type OpenLibraryQuery } from "./pacts";

/**
 * Arr, the OpenLibraryRetriever — a spectral hound that scours
 * the Open Library for books hidden in the literary void!
 */
export class OpenLibraryRetriever extends Dog<OpenLibraryResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return OpenLibraryRetriever.name;
    }

    get description(): string {
        return 'Searches Open Library for books by title, author, or subject.';
    }

    get icon(): string | undefined {
        return "\uD83D\uDCDA";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [OpenLibraryQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<OpenLibraryResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(OpenLibraryQueryPact, d));
        const query = (queryDog?.collected as OpenLibraryQuery | undefined) ?? ({} as OpenLibraryQuery);

        const q = query['q'];
        if (!q) {
            throw new Error('OpenLibraryRetriever: Missing required query param (q)');
        }

        const limit = query['limit'] ?? "10";
        const key = `openlibrary:${q.toLowerCase().trim()}:${limit}`;

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 60 * 60_000, () =>
                searchOpenLibrary(q, limit)
            );
        }
        return searchOpenLibrary(q, limit);
    };
}
