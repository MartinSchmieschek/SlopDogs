export interface DadJokeApiResponse {
    id: string;
    joke: string;
    status: number;
}

export interface DadJokeSearchApiResponse {
    results: DadJokeApiResponse[];
    total_jokes?: number;
    search_term?: string;
}

export interface DadJokeResult {
    id: string;
    joke: string;
    searchTerm?: string;
}
