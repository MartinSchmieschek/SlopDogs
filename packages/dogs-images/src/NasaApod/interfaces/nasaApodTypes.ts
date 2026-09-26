export interface NasaApodApiResponse {
    date: string;
    explanation: string;
    hdurl?: string;
    media_type: "image" | "video";
    service_version?: string;
    title: string;
    url: string;
    copyright?: string;
}

export interface NasaApodResult {
    date: string;
    title: string;
    explanation: string;
    mediaType: "image" | "video";
    url: string;
    hdUrl?: string;
    copyright?: string;
}
