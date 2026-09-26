export interface GenderizeApiResponse {
    name: string;
    gender: "male" | "female" | null;
    probability: number;
    count: number;
    country_id?: string;
}

export interface GenderizeResult {
    name: string;
    gender: "male" | "female" | null;
    probability: number;
    sampleCount: number;
    countryCode?: string;
}
