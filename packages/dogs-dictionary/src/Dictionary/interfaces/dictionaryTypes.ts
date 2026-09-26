export interface DictionaryApiDefinition {
    definition: string;
    example?: string;
    synonyms?: string[];
    antonyms?: string[];
}

export interface DictionaryApiMeaning {
    partOfSpeech: string;
    definitions: DictionaryApiDefinition[];
    synonyms?: string[];
    antonyms?: string[];
}

export interface DictionaryApiPhonetic {
    text?: string;
    audio?: string;
    sourceUrl?: string;
}

export interface DictionaryApiEntry {
    word: string;
    phonetic?: string;
    phonetics?: DictionaryApiPhonetic[];
    meanings: DictionaryApiMeaning[];
    sourceUrls?: string[];
}

export interface DictionaryResult {
    word: string;
    phonetic?: string;
    audioUrl?: string;
    meanings: DictionaryApiMeaning[];
    synonyms: string[];
    antonyms: string[];
    sourceUrls: string[];
}
