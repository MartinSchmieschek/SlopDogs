export interface WikidataSearchHit {
    id: string;
    label: string;
    description?: string;
    conceptUri?: string;
    url?: string;
}

export interface WikidataEntityClaim {
    property: string;
    /** String-Repraesentation — Wikidata-Claims sind sehr heterogen, so bleibt es robust */
    value: string;
}

export interface WikidataEntity {
    id: string;
    label?: string;
    description?: string;
    aliases?: string[];
    claims: WikidataEntityClaim[];
}

export interface WikidataSparqlResult {
    /** SELECT-Variablen */
    head: { vars: string[] };
    /** Bindings — jeder Eintrag ist ein Objekt var -> { type, value } */
    bindings: Array<Record<string, { type: string; value: string; datatype?: string; 'xml:lang'?: string }>>;
}

export interface WikidataResult {
    mode: "search" | "entity" | "sparql";
    query: string;
    lang: string;
    /** Bei mode=search */
    hits?: WikidataSearchHit[];
    /** Bei mode=entity */
    entity?: WikidataEntity;
    /** Bei mode=sparql */
    sparql?: WikidataSparqlResult;
}
