import { createPact } from "@slopdogs/core";

export interface HolidayQuery {
    /** ISO 3166-1 alpha-2 country code (e.g. "DE", "US") */
    country: string;
    /** Year to fetch holidays for. Defaults to current year. */
    year?: string;
}

export const HolidayQueryPact = createPact<HolidayQuery>(
    "HolidayQueryProvider",
    { fromSourceType: "HolidayQuery" }
);
