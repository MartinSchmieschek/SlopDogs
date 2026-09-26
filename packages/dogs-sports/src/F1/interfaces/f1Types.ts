export interface F1Result {
    season: string;
    round?: string;
    resource: string;
    total: number;
    /** Rohes MRData — strukturvariabel je nach Ressource */
    data: unknown;
}
