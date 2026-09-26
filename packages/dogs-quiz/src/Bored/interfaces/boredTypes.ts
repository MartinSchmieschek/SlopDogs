export interface BoredApiResponse {
    activity?: string;
    type?: string;
    participants?: number;
    price?: number;
    link?: string;
    key?: string;
    accessibility?: number;
    error?: string;
}

export interface BoredResult {
    activity: string;
    type: string;
    participants: number;
    price: number;
    accessibility: number;
    link?: string;
    key?: string;
}
