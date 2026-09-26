export interface NpmDownloads {
    package: string;
    period: string;
    start: string;
    end: string;
    downloads: number;
}

export interface NpmResult {
    package: string;
    mode: string;
    /** Paket-Metadaten von registry.npmjs.org (gekuerzt) */
    meta?: {
        name?: string;
        description?: string;
        license?: string;
        homepage?: string;
        repository?: string;
        latest?: string;
        versions?: string[];
        maintainers?: { name: string; email?: string }[];
        time?: Record<string, string>;
    };
    downloads?: NpmDownloads;
}
