export interface DatamuseApiWord {
    word: string;
    score?: number;
    numSyllables?: number;
    tags?: string[];
}

export interface DatamuseResult {
    word: string;
    relation: string;
    words: DatamuseApiWord[];
}
