export interface PicsumImageInfo {
    id: string;
    author: string;
    width: number;
    height: number;
    url: string;
    download_url: string;
}

export interface PicsumResult {
    mode: string;
    /** Bei mode=list oder mode=info */
    items?: PicsumImageInfo[];
    /** Bei mode=randomUrl */
    url?: string;
}
