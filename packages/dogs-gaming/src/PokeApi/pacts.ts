import { createPact } from "@slopdogs/core";

export interface PokeApiQuery {
    /** Endpoint: pokemon, pokemon-species, ability, type, move, generation, nature, berry */
    endpoint?: string;
    /** Name oder ID */
    idOrName?: string;
    /** List-Modus: wenn true und kein idOrName, werden die ersten `limit` Eintraege gelistet */
    list?: boolean;
    /** Limit fuer list-Modus — default 20, max 1200 */
    limit?: number;
    /** Offset fuer list-Modus — default 0 */
    offset?: number;
}

export const PokeApiQueryPact = createPact<PokeApiQuery>(
    "PokeApiQueryProvider",
    { fromSourceType: "PokeApiQuery" }
);
