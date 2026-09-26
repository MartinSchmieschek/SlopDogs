import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getLyrics } from "./lyricsApiClient";
import type { LyricsResult } from "./interfaces/lyricsTypes";
import { LyricsQueryPact, type LyricsQuery } from "./pacts";

const LYRICS_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class LyricsRetriever extends Dog<LyricsResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return LyricsRetriever.name;
    }

    get description(): string {
        return "Song-Texte von lyrics.ovh — verlangt 'artist' und 'title'.";
    }

    get icon(): string | undefined {
        return "\uD83C\uDFA4";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [LyricsQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<LyricsResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(LyricsQueryPact, d));
        const query = queryDog?.collected as LyricsQuery | undefined;
        if (!query?.artist || !query?.title) {
            throw new Error("LyricsRetriever: Missing required query params 'artist' and 'title'");
        }
        const key = `lyrics:${query.artist.toLowerCase().trim()}:${query.title.toLowerCase().trim()}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, LYRICS_CACHE_TTL_MS, () =>
                getLyrics(query.artist, query.title),
            );
        }
        return getLyrics(query.artist, query.title);
    };
}
