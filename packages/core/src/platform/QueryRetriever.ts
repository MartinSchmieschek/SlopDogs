/**
 * ~~~ THE MAP-READER ~~~
 *
 * Arr, the QueryRetriever be the hound that reads the map -- it carries
 * query parameters into the hunt, normalized and lowercased, ready fer
 * any dog that needs to know the course. It requires no parents,
 * fer the map was drawn before the voyage began.
 *
 * Its heralds are the stars it fells, the sky and Earth aflame.
 * But this hound reads only the coordinates, matey -- nothing more.
 */

import { Dog } from '../core/entities/abstractHuntingDog';
import { IHuntingDog } from '../core/entities/IHuntingDog';
import { IHuntingSeason } from '../core/entities/IHuntingSeason';

/**
 * Arr, the QueryRetriever -- the map-reader of the kennel, carrying query parameters
 * plundered from the request into the hunt. It requires no parents, fer the map
 * was drawn before the voyage began. From brooding gulfs it reads the coordinates,
 * normalized and lowercased, so any hound may chart its course through the void.
 */
export class QueryRetriever extends Dog<Record<string, string>> {
    // The normalized query data -- coordinates fer the voyage, lowercased fer consistency
    private queryData: Record<string, string> = {};

    /** Provision the map-reader with query parameters, normalizing all keys and values to lowercase */
    constructor(queryData?: Record<string, string>) {
        super();
        const raw = queryData || {};
        const normalized: Record<string, string> = {};
        Object.entries(raw).forEach(([k, v]) => {
            normalized[k.toLowerCase()] = String(v).toLowerCase();
        });
        this.queryData = normalized;
    }

    /** No parents required -- the map was drawn before we set sail */
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    /** No optional parents either -- the map-reader walks alone */
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    /** The map-reader's true name -- spoken aloud, it echoes through the abyss so all may find it */
    get name(): string {
        return QueryRetriever.name;
    }

    get description(): string {
        return 'Provides the HTTP query parameters as yield for other dogs to consume.';
    }

    /** The map-reader's sigil -- fetched from the central icon registry */
    get icon(): string | undefined {
        return "\uD83D\uDD0D";
    }

    /** Yield the query data -- the map's coordinates, plundered and ready */
    protected yieldCollectorFactory: (season: IHuntingSeason) => Promise<Record<string, string>> =
        async (season: IHuntingSeason) => {
            return this.queryData;
        };
}
