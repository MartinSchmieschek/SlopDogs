import { createPact } from "@slopdogs/core";

export interface OpenFdaQuery {
    /** Endpoint: drug/event (Nebenwirkungen), drug/label (Beipackzettel), drug/enforcement (Rueckrufe), device/enforcement, food/enforcement */
    endpoint?: string;
    /** Suchausdruck in openFDA-Syntax (z.B. "patient.drug.medicinalproduct:aspirin") */
    search?: string;
    /** Limit (max 1000) — default 10 */
    limit?: number;
    /** Skip — default 0 */
    skip?: number;
}

export const OpenFdaQueryPact = createPact<OpenFdaQuery>(
    "OpenFdaQueryProvider",
    { fromSourceType: "OpenFdaQuery" }
);
