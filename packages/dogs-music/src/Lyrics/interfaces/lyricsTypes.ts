export interface LyricsApiResponse {
    lyrics?: string;
    error?: string;
}

export interface LyricsResult {
    artist: string;
    title: string;
    lyrics: string;
}
