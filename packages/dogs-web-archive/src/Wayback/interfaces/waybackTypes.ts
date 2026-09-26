export interface WaybackSnapshot {
    status?: string;
    available?: boolean;
    url?: string;
    timestamp?: string;
}

export interface WaybackApiResponse {
    url?: string;
    archived_snapshots?: {
        closest?: WaybackSnapshot;
    };
}

export interface WaybackResult {
    url: string;
    requestedTimestamp?: string;
    found: boolean;
    snapshot?: WaybackSnapshot;
}
