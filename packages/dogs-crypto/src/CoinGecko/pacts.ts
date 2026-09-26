import { createPact } from "@slopdogs/core";

export interface CoinGeckoQuery {
    /** Modus: price (simple/price), markets (top coins), coin (Detail-Info), trending,
     *  search, global (Marktuebersicht) — default "price" */
    mode?: string;
    /** Coin-IDs (komma-separiert, z.B. "bitcoin,ethereum") — fuer price; bei coin einzelner Slug */
    ids?: string;
    /** Vergleichs-Currencies (komma-separiert, z.B. "usd,eur") — fuer price/markets; default "usd" */
    vs?: string;
    /** Suchstring fuer mode=search */
    q?: string;
    /** Limit fuer markets/search — default 10, max 250 */
    perPage?: number;
    /** Seite fuer markets — default 1 */
    page?: number;
    /** 24h-Veraenderung einbeziehen (price) — default true */
    includeChange?: boolean;
}

export const CoinGeckoQueryPact = createPact<CoinGeckoQuery>(
    "CoinGeckoQueryProvider",
    { fromSourceType: "CoinGeckoQuery" }
);
