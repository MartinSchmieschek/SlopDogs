import { createPact } from "@slopdogs/core";

/**
 * Gemeinsamer Lookup-Pact fuer alle 4 Pop-Culture-Hunde.
 *
 * Jeder Hund akzeptiert:
 *  - resource: Ressourcentyp (API-spezifisch, siehe Hund-Description)
 *  - id: Einzelressource nach ID/Slug
 *  - search: Volltextsuche (API-spezifisch unterstuetzt)
 *  - page: Paginierung (wo relevant)
 */
export interface PopCultureQuery {
    /** Ressource: z.B. StarWars "people"/"films"/"planets"/"species"/"vehicles"/"starships"; RickMorty "character"/"location"/"episode"; HP "characters"/"spells"/"houses"; Ghibli "films"/"people"/"locations"/"species"/"vehicles" */
    resource?: string;
    /** Einzel-ID (numerisch oder Slug je nach API) */
    id?: string;
    /** Freitext-Suche */
    search?: string;
    /** Seite (default 1) */
    page?: number;
}

export const PopCultureQueryPact = createPact<PopCultureQuery>(
    "PopCultureQueryProvider",
    { fromSourceType: "PopCultureQuery" }
);
