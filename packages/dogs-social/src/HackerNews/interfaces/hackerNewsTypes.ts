export interface HackerNewsItem {
    id: number;
    type?: "story" | "comment" | "job" | "poll" | "pollopt";
    by?: string;
    time?: number;
    text?: string;
    dead?: boolean;
    deleted?: boolean;
    parent?: number;
    kids?: number[];
    url?: string;
    score?: number;
    title?: string;
    descendants?: number;
}

export interface HackerNewsUser {
    id: string;
    created?: number;
    karma?: number;
    about?: string;
    submitted?: number[];
}

export interface HackerNewsResult {
    endpoint: string;
    /** Bei Listen: hydrierte Items; sonst einzelnes Item/User */
    items?: HackerNewsItem[];
    item?: HackerNewsItem;
    user?: HackerNewsUser;
    /** Anzahl IDs, die der Endpoint vor dem Limit liefern wuerde */
    totalIds?: number;
}
