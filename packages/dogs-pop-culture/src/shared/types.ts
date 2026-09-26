/**
 * Generisches Ergebnis-Envelope fuer Pop-Culture-APIs.
 * Die rohen Datenstrukturen der APIs sind sehr heterogen —
 * wir exponieren sie daher als `items[]` beliebiger Form.
 */
export interface PopCultureListResult<T = unknown> {
    mode: "list";
    source: string;
    resource: string;
    count: number;
    page: number;
    hasMore: boolean;
    items: T[];
}

export interface PopCultureItemResult<T = unknown> {
    mode: "item";
    source: string;
    resource: string;
    id: string;
    item: T;
}

export type PopCultureResult<T = unknown> = PopCultureListResult<T> | PopCultureItemResult<T>;
