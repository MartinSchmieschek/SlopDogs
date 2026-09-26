import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getDadJoke } from "./dadJokeApiClient";
import type { DadJokeResult } from "./interfaces/dadJokeTypes";
import { DadJokeQueryPact, type DadJokeQuery } from "./pacts";

export class DadJokeRetriever extends Dog<DadJokeResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return DadJokeRetriever.name;
    }

    get description(): string {
        return "Holt einen Dad-Joke von icanhazdadjoke.com (optional nach Suchbegriff).";
    }

    get icon(): string | undefined {
        return "\uD83E\uDD26";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    // Welle 10: Query is optional -- ohne Mimic liefert die API einen Random-Joke.
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [DadJokeQueryPact];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<DadJokeResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(DadJokeQueryPact, d));
        const query = (queryDog?.collected as DadJokeQuery | undefined) ?? ({} as DadJokeQuery);

        return getDadJoke(query.term);
    };
}
