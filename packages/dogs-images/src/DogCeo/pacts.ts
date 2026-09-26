import { createPact } from "@slopdogs/core";

export interface DogCeoQuery {
    /** Rasse (lowercase, e.g. "husky", "labrador"). Leer = zufaellige Rasse. */
    breed?: string;
    /** Sub-Rasse (nur mit breed, e.g. breed="bulldog" subBreed="french") */
    subBreed?: string;
    /** Anzahl Bilder — default 1, max 50 */
    count?: number;
}

export const DogCeoQueryPact = createPact<DogCeoQuery>(
    "DogCeoQueryProvider",
    { fromSourceType: "DogCeoQuery" }
);
