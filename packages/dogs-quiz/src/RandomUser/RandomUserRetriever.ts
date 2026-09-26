import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getRandomUsers } from "./randomUserApiClient";
import type { RandomUserResult } from "./interfaces/randomUserTypes";
import { RandomUserQueryPact, type RandomUserQuery } from "./pacts";

export class RandomUserRetriever extends Dog<RandomUserResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return RandomUserRetriever.name;
    }

    get description(): string {
        return "randomuser.me: Fake-Profile (Geschlecht, Nationalitaet, Seed).";
    }

    get icon(): string | undefined {
        return "\uD83D\uDC64";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [RandomUserQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<RandomUserResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(RandomUserQueryPact, d));
        const query = (queryDog?.collected as RandomUserQuery | undefined) ?? {};
        const results = query.results ?? 1;
        // Nur cachen, wenn ein Seed vorgegeben wurde (reproduzierbar)
        if (query.seed && this.cacheHandler) {
            const key = `randomuser:${query.seed}:${results}:${query.gender ?? ""}:${query.nat ?? ""}`;
            return this.cacheHandler.getOrFetch(key, 24 * 60 * 60 * 1000, () =>
                getRandomUsers(results, query.gender, query.nat, query.seed),
            );
        }
        return getRandomUsers(results, query.gender, query.nat, query.seed);
    };
}
