import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryMusicBrainz } from "./musicBrainzApiClient";
import type { MusicBrainzResult } from "./interfaces/musicBrainzTypes";
import { MusicBrainzQueryPact, type MusicBrainzQuery } from "./pacts";

const MB_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class MusicBrainzRetriever extends Dog<MusicBrainzResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return MusicBrainzRetriever.name;
    }

    get description(): string {
        return "MusicBrainz: Kuenstler/Alben/Recording-Metadaten per MBID oder Volltextsuche.";
    }

    get icon(): string | undefined {
        return "\uD83C\uDFB5";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [MusicBrainzQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<MusicBrainzResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(MusicBrainzQueryPact, d));
        const query = (queryDog?.collected as MusicBrainzQuery | undefined) ?? {};
        const entity = (query.entity ?? "artist").toLowerCase();
        const limit = query.limit ?? 10;
        const offset = query.offset ?? 0;

        const key = `musicbrainz:${entity}:${query.mbid ?? ""}:${(query.search ?? "").toLowerCase()}:${limit}:${offset}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, MB_CACHE_TTL_MS, () =>
                queryMusicBrainz(entity, query.mbid, query.search, limit, offset),
            );
        }
        return queryMusicBrainz(entity, query.mbid, query.search, limit, offset);
    };
}
