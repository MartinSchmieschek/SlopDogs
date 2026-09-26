export interface DuckApiResponse {
    url: string;
    message?: string;
}

export interface DuckResult {
    mediaUrl: string;
    mediaType: "image" | "gif" | "video";
}
