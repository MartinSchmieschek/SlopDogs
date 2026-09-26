export interface NationalizeCountry {
    country_id: string;
    probability: number;
}

export interface NationalizeApiResponse {
    name: string;
    count: number;
    country: NationalizeCountry[];
}

export interface NationalizeResult {
    name: string;
    sampleCount: number;
    countries: NationalizeCountry[];
    /** Hoechstwahrscheinliches Land (falls vorhanden) */
    topCountry?: NationalizeCountry;
}
