export interface ChuckNorrisApiResponse {
    id: string;
    value: string;
    url: string;
    categories: string[];
    icon_url?: string;
    created_at?: string;
    updated_at?: string;
}

export interface ChuckNorrisResult {
    id: string;
    joke: string;
    url: string;
    categories: string[];
    iconUrl?: string;
}
