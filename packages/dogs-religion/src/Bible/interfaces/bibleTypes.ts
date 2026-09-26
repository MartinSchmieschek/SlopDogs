export interface BibleVerse {
    book_id: string;
    book_name: string;
    chapter: number;
    verse: number;
    text: string;
}

export interface BibleApiResponse {
    reference: string;
    verses: BibleVerse[];
    text: string;
    translation_id?: string;
    translation_name?: string;
    translation_note?: string;
    error?: string;
}

export interface BibleResult {
    reference: string;
    translationId: string;
    translationName?: string;
    text: string;
    verses: BibleVerse[];
}
