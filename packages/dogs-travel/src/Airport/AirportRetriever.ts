import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { fetchAirportIndex, resolveAirport, type AirportIndex } from "./airportApiClient";
import type { AirportResult } from "./interfaces/airportTypes";
import { AirportQueryPact, type AirportQuery } from "./pacts";

const AIRPORT_INDEX_KEY = "airport-index:mwgg";
const AIRPORT_INDEX_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class AirportRetriever extends Dog<AirportResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return AirportRetriever.name;
    }

    get description(): string {
        return "Airport-Lookup per IATA oder ICAO aus dem mwgg/Airports-Snapshot.";
    }

    get icon(): string | undefined {
        return "\uD83D\uDEEB";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [AirportQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<AirportResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(AirportQueryPact, d));
        const query = (queryDog?.collected as AirportQuery | undefined) ?? {};

        const index: AirportIndex = this.cacheHandler
            ? await this.cacheHandler.getOrFetch(AIRPORT_INDEX_KEY, AIRPORT_INDEX_TTL_MS, fetchAirportIndex)
            : await fetchAirportIndex();

        return resolveAirport(index, query.iata, query.icao);
    };
}
