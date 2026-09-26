import { createPact } from "@slopdogs/core";

export interface CurrencyQuery {
    /** Base currency code (e.g. "EUR", "USD"). Defaults to EUR. */
    from?: string;
    /** Target currency code (e.g. "USD", "GBP"). If omitted, all available rates are returned. */
    to?: string;
    /** Amount to convert. Defaults to 1. */
    amount?: string;
    /** Date in ISO format (YYYY-MM-DD). Defaults to "latest". */
    date?: string;
}

export const CurrencyQueryPact = createPact<CurrencyQuery>(
    "CurrencyQueryProvider",
    { fromSourceType: "CurrencyQuery" }
);
