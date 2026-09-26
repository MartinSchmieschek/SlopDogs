import { createPact } from "@slopdogs/core";

/** Abfrage fuer icanhazdadjoke — Input ist optional, Default: zufaelliger Dad-Joke */
export interface DadJokeQuery {
    /** Suchbegriff (optional) — liefert zufaelligen Treffer aus den Suchergebnissen */
    term?: string;
}

export const DadJokeQueryPact = createPact<DadJokeQuery>(
    "DadJokeQueryProvider",
    { fromSourceType: "DadJokeQuery" }
);
