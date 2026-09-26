export interface QuoteApiResponse {
    _id: string;
    content: string;
    author: string;
    authorSlug?: string;
    tags?: string[];
    length?: number;
    dateAdded?: string;
    dateModified?: string;
}

export interface QuoteResult {
    id: string;
    quote: string;
    author: string;
    authorSlug?: string;
    tags: string[];
    length: number;
}
