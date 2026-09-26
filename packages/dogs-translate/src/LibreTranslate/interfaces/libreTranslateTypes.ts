export interface LibreTranslateApiResponse {
    translatedText?: string;
    detectedLanguage?: { confidence: number; language: string };
    error?: string;
}

export interface LibreTranslateResult {
    source: string;
    target: string;
    originalText: string;
    translatedText: string;
    detectedLanguage?: string;
    detectedConfidence?: number;
    instance: string;
}
