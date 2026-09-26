import { createPact } from "@slopdogs/core";

export interface MusicBrainzQuery {
    /** Entity-Typ: artist, release, recording, release-group, work, label (default: artist) */
    entity?: string;
    /** MBID (UUID) fuer direkten Lookup — ignoriert search */
    mbid?: string;
    /** Freitext-Suche (Lucene-Syntax der API) */
    search?: string;
    /** Max. Ergebnisse — default 10 */
    limit?: number;
    /** Offset — default 0 */
    offset?: number;
}

export const MusicBrainzQueryPact = createPact<MusicBrainzQuery>(
    "MusicBrainzQueryProvider",
    { fromSourceType: "MusicBrainzQuery" }
);
