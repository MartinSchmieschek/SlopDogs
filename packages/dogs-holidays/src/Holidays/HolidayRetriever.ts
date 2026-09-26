import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { HolidayQueryPact, type HolidayQuery } from "./pacts";

const NAGER_BASE = "https://date.nager.at/api/v3/publicholidays";

interface NagerHoliday {
    date: string;
    localName: string;
    name: string;
    countryCode: string;
    fixed: boolean;
    global: boolean;
    types: string[];
}

export interface HolidayEntry {
    date: string;
    localName: string;
    name: string;
    fixed: boolean;
    global: boolean;
    types: string[];
}

export interface HolidayResult {
    country: string;
    year: number;
    holidays: HolidayEntry[];
    nextHoliday: {
        date: string;
        localName: string;
        name: string;
        daysUntil: number;
    } | null;
    totalCount: number;
}

export class HolidayRetriever extends Dog<HolidayResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return HolidayRetriever.name;
    }

    get description(): string {
        return "Fetches public holidays for a given country and year via the Nager.Date API.";
    }

    get icon(): string | undefined {
        return "\uD83C\uDF89";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [HolidayQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<HolidayResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(HolidayQueryPact, d));
        const query = (queryDog?.collected as HolidayQuery | undefined) ?? ({} as HolidayQuery);

        const country = (query.country ?? "").toUpperCase();
        if (!country) {
            throw new Error("HolidayRetriever: Missing required query param (country)");
        }

        const year = query.year ? parseInt(query.year, 10) : new Date().getFullYear();
        if (isNaN(year)) {
            throw new Error("HolidayRetriever: Invalid year");
        }

        const url = `${NAGER_BASE}/${year}/${encodeURIComponent(country)}`;
        const key = `holidays:${country}:${year}`;

        const fetchHolidays = async (): Promise<HolidayResult> => {
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
                    `HolidayRetriever: HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`
                );
            }

            const raw = await res.json() as NagerHoliday[];

            const holidays: HolidayEntry[] = raw.map(h => ({
                date: h.date,
                localName: h.localName,
                name: h.name,
                fixed: h.fixed,
                global: h.global,
                types: h.types,
            }));

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const futureHolidays = holidays
                .filter(h => new Date(h.date) >= today)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            let nextHoliday: HolidayResult["nextHoliday"] = null;
            if (futureHolidays.length > 0) {
                const next = futureHolidays[0];
                const nextDate = new Date(next.date);
                const diffMs = nextDate.getTime() - today.getTime();
                const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                nextHoliday = {
                    date: next.date,
                    localName: next.localName,
                    name: next.name,
                    daysUntil,
                };
            }

            return {
                country,
                year,
                holidays,
                nextHoliday,
                totalCount: holidays.length,
            };
        };

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 6 * 60 * 60_000, fetchHolidays);
        }
        return fetchHolidays();
    };
}
