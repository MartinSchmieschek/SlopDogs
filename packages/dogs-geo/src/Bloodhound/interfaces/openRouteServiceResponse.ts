/**
 * =========================================================================
 *  OPEN ROUTE SERVICE RESPONSE — whispers from the eldritch cartographers
 * =========================================================================
 *
 *  Arr, these be the minimal types for the messages returned by the
 *  OpenRouteService abyss — only the fields our crew dares to read.
 *  Roiling, moaning, this realm of ours, in madness lost shall die,
 *  but at least we have typed interfaces, matey.
 *
 *  Its heralds are the stars it fells, the sky and Earth aflame.
 * =========================================================================
 */

/** Minimal types for ORS Directions JSON — only the fields we dare plunder from the deep */
export interface OpenRouteServiceResponse {
    features: [
        {
            geometry: { coordinates: number[][] };
            properties: {
                segments: Array<{
                    steps: Array<{
                        way_points: number[];
                        distance: number;
                        duration: number;
                        instruction: string;
                    }>;
                }>;
            };
        }
    ];
}

/** Minimal types for Isochrone JSON — the void's reach given form, arr */
export interface IsochroneResponse {
    features: Array<{
        geometry: { coordinates: number[][][] };
        properties: { value: number; center: number[] };
    }>;
}
