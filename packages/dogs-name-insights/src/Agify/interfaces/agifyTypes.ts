export interface AgifyApiResponse {
    name: string;
    age: number | null;
    count: number;
    country_id?: string;
}

export interface AgifyResult {
    name: string;
    age: number | null;
    sampleCount: number;
    countryCode?: string;
}
