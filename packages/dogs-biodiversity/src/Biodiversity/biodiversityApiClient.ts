/**
 * =========================================================================
 *  BIODIVERSITY API CLIENT — reading the naturalist void through iNaturalist
 * =========================================================================
 *
 *  Arr, this module speaks the tongue of the iNaturalist oracle —
 *  a free, keyless gateway to species observation data across the globe.
 *  No API key required — nature grants passage freely, matey.
 *
 *  Endpoint: https://api.inaturalist.org/v1/observations
 * =========================================================================
 */

import type { SpeciesObservation, BiodiversityResult } from "./interfaces/biodiversityTypes";

const INATURALIST_BASE = "https://api.inaturalist.org/v1";

/** Parse a single iNaturalist observation into our typed form */
function parseObservation(raw: any): SpeciesObservation {
    const taxon = raw.taxon ?? {};
    const photos = raw.photos ?? [];

    return {
        id: raw.id,
        speciesName: taxon.preferred_common_name ?? taxon.name ?? 'Unknown',
        scientificName: taxon.name ?? '',
        iconicTaxon: taxon.iconic_taxon_name ?? 'Unknown',
        photoUrl: photos.length > 0 ? photos[0].url?.replace('square', 'medium') : null,
        observedOn: raw.observed_on ?? raw.created_at ?? '',
        location: {
            lat: parseFloat(raw.geojson?.coordinates?.[1] ?? raw.location?.split(',')[0] ?? '0'),
            lng: parseFloat(raw.geojson?.coordinates?.[0] ?? raw.location?.split(',')[1] ?? '0'),
        },
        placeGuess: raw.place_guess ?? null,
        qualityGrade: raw.quality_grade ?? 'casual',
    };
}

/**
 * Fetch species observations from iNaturalist near given GPS coordinates.
 * Returns research-grade and needs_id observations with photos.
 */
export async function fetchSpeciesObservations(
    lat: number,
    lng: number,
    radiusKm: number = 10,
    taxon?: string,
    months?: string
): Promise<{ observations: SpeciesObservation[]; totalResults: number }> {
    const params: string[] = [
        `lat=${lat}`,
        `lng=${lng}`,
        `radius=${radiusKm}`,
        `order_by=observed_on`,
        `order=desc`,
        `per_page=30`,
        `quality_grade=research,needs_id`,
        `photos=true`,
    ];

    if (taxon) {
        params.push(`iconic_taxa=${encodeURIComponent(taxon)}`);
    }
    if (months) {
        params.push(`month=${encodeURIComponent(months)}`);
    }

    const url = `${INATURALIST_BASE}/observations?${params.join('&')}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
        res = await fetch(url, {
            headers: {
                "Accept": "application/json",
                "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)",
            },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`iNaturalist failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }

    const data = await res.json() as any;
    const observations = (data.results ?? []).map(parseObservation);

    return {
        observations,
        totalResults: data.total_results ?? observations.length,
    };
}

/**
 * Build a BiodiversityResult from lat/lng and optional filters.
 */
export async function getSpecies(
    lat: number,
    lng: number,
    radiusKm: number = 10,
    taxon?: string,
    months?: string
): Promise<BiodiversityResult> {
    const { observations, totalResults } = await fetchSpeciesObservations(lat, lng, radiusKm, taxon, months);

    return {
        observations,
        totalResults,
        searchLocation: { lat, lng },
        radiusKm,
        taxonFilter: taxon ?? null,
    };
}
