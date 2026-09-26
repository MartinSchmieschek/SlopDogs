/**
 * =========================================================================
 *  PHENOLOGY RETRIEVER — sniffin' out the seasons from the botanical abyss
 * =========================================================================
 *
 *  Arr, matey! This hound reads the calendar of the living world —
 *  not the crude four-season lie the mortals tell, but the true
 *  TEN phenological seasons recognized by the DWD.
 *
 *  From the first Hasel catkins of Vorfruehling to the silent
 *  slumber of Winter, this hound knows what blooms, what fruits,
 *  and what creatures stir in each season's cursed embrace.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getPhenologicalPhase } from "./phenologyData";
import type { PhenologyResult } from "./interfaces/phenologyTypes";
import { PhenologyQueryPact, type PhenologyQuery } from "./pacts";

/**
 * Arr, the PhenologyRetriever — a spectral hound that reads the
 * botanical calendar of the void!
 * What blooms, what fruits, what creatures stir —
 * all plunder from the phenological abyss.
 */
export class PhenologyRetriever extends Dog<PhenologyResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return PhenologyRetriever.name;
    }

    get description(): string {
        return 'Determines current phenological season, blooming plants and fauna activity. No API key required (local data).';
    }

    get icon(): string | undefined {
        return "\uD83C\uDF38";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [PhenologyQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<PhenologyResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(PhenologyQueryPact, d));
        const query = (queryDog?.collected as PhenologyQuery | undefined) ?? ({} as PhenologyQuery);

        const lat = parseFloat(query['lat']);
        const lng = parseFloat(query['lng']);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('PhenologyRetriever: Missing required query params (lat, lng)');
        }

        const hemisphere: 'north' | 'south' = lat >= 0 ? 'north' : 'south';

        const dateStr = query['date'] ?? new Date().toISOString().split('T')[0];
        const dateObj = new Date(dateStr + 'T00:00:00');
        const startOfYear = new Date(dateObj.getFullYear(), 0, 0);
        const diff = dateObj.getTime() - startOfYear.getTime();
        const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

        const key = `phenology:${dayOfYear}:${hemisphere}`;

        const compute = async (): Promise<PhenologyResult> => {
            const { current, upcoming } = getPhenologicalPhase(dayOfYear, hemisphere);

            const bloomList = current.typicalBloom.slice(0, 3).join(', ');
            const faunaHint = current.typicalFauna[0] ?? '';
            const seasonalInfo = `Es ist ${current.name} — ${bloomList} bluehen${faunaHint ? `, ${faunaHint.charAt(0).toLowerCase() + faunaHint.slice(1)}` : ''}.`;

            return {
                currentPhase: current,
                date: dateStr,
                dayOfYear,
                hemisphere,
                seasonalInfo,
                upcomingPhase: upcoming,
            };
        };

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 6 * 60 * 60_000, compute);
        }
        return compute();
    };
}
