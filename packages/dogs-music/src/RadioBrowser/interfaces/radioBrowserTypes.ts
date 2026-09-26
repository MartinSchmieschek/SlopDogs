export interface RadioBrowserStation {
    stationuuid: string;
    name: string;
    url: string;
    url_resolved?: string;
    homepage?: string;
    favicon?: string;
    tags?: string;
    country?: string;
    countrycode?: string;
    language?: string;
    codec?: string;
    bitrate?: number;
    clickcount?: number;
    votes?: number;
}

export interface RadioBrowserResult {
    mode: string;
    query: string;
    count: number;
    stations: RadioBrowserStation[];
}
