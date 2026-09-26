import { createPact } from "@slopdogs/core";

/** Abfrage fuer JokeAPI (jokeapi.dev) */
export interface JokeQuery {
    /** Kategorie: Programming, Misc, Dark, Pun, Spooky, Christmas, Any (default: Any) */
    category?: string;
    /** Sprache: en, de, es, fr, pt, cs (default: en) */
    lang?: string;
    /** Kommaseparierte Blacklist-Flags: nsfw, religious, political, racist, sexist, explicit */
    blacklist?: string;
    /** Jokes-Typ: single | twopart (default: beides) */
    type?: string;
}

export const JokeQueryPact = createPact<JokeQuery>(
    "JokeQueryProvider",
    { fromSourceType: "JokeQuery" }
);
