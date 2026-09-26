export interface JokeApiResponse {
    error?: boolean;
    category?: string;
    type?: "single" | "twopart";
    joke?: string;
    setup?: string;
    delivery?: string;
    lang?: string;
    id?: number;
    flags?: Record<string, boolean>;
}

export interface JokeResult {
    category: string;
    type: "single" | "twopart";
    /** Bei type=single: der komplette Witz. Bei twopart: setup + delivery zusammengefuegt. */
    joke: string;
    setup?: string;
    delivery?: string;
    language: string;
    id?: number;
    flags?: Record<string, boolean>;
}
