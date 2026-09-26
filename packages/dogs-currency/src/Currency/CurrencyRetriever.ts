import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { CurrencyQueryPact, type CurrencyQuery } from "./pacts";

const FRANKFURTER_BASE = "https://api.frankfurter.app";

export interface CurrencyResult {
    base: string;
    date: string;
    rates: Record<string, number>;
    converted?: {
        from: string;
        to: string;
        amount: number;
        result: number;
        rate: number;
    };
}

export class CurrencyRetriever extends Dog<CurrencyResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return CurrencyRetriever.name;
    }

    get description(): string {
        return "Fetches live exchange rates and currency conversions via the Frankfurter API.";
    }

    get icon(): string | undefined {
        return "\uD83D\uDCB1";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [CurrencyQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<CurrencyResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(CurrencyQueryPact, d));
        const query = (queryDog?.collected as CurrencyQuery | undefined) ?? ({} as CurrencyQuery);

        const from = (query.from ?? "EUR").toUpperCase();
        const to = query.to?.toUpperCase();
        const amountStr = query.amount ?? "1";
        const amount = parseFloat(amountStr);
        const dateSegment = query.date ?? "latest";

        const params = new URLSearchParams();
        params.set("from", from);
        if (to) {
            params.set("to", to);
        }

        const url = `${FRANKFURTER_BASE}/${encodeURIComponent(dateSegment)}?${params.toString()}`;
        const key = `currency:${from}:${to ?? "all"}:${dateSegment}`;

        const fetchRates = async (): Promise<CurrencyResult> => {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 15_000);

            let res: Response;
            try {
                res = await fetch(url, { signal: ctrl.signal });
            } finally {
                clearTimeout(timer);
            }

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(
                    `CurrencyRetriever: HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`
                );
            }

            const json = await res.json() as { base: string; date: string; rates: Record<string, number> };

            const result: CurrencyResult = {
                base: json.base,
                date: json.date,
                rates: json.rates,
            };

            if (to && !isNaN(amount) && json.rates[to] != null) {
                const rate = json.rates[to];
                result.converted = {
                    from,
                    to,
                    amount,
                    result: Math.round(amount * rate * 10000) / 10000,
                    rate,
                };
            }

            return result;
        };

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 30 * 60_000, fetchRates);
        }
        return fetchRates();
    };
}
