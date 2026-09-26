export interface GeoNamesNearbyEntry {
    geonameId: number;
    name: string;
    countryCode?: string;
    countryName?: string;
    adminName1?: string;
    population?: number;
    lat: number;
    lng: number;
    distance?: number;
    fcl?: string;
    fcode?: string;
}

export interface GeoNamesResult {
    lat: number;
    lng: number;
    entries: GeoNamesNearbyEntry[];
}
