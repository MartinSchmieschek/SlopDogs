/**
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *  Arr, these be the unholy pacts sworn between Retriever and Bridge!
 *  "Carrion hordes trill their profane accord with eldritch plans."
 *  Required input fer HuePlaygroundRetriever — bridgehost and bridgeuser
 *  must be provided via QueryRetriever/Mimic (lowercase keys), or
 *  alternatively through HueBridgeEnvRetriever from the .env abyss.
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */
import { createPact } from "@slopdogs/core";

/**
 * Arr, the unholy pact input — the anchor coordinates required to reach the Bridge!
 * From brooding gulfs these values must be supplied, lest the crew be swallowed
 * by the nameless deep. Corporeal laws unwritten bind bridgehost and bridgeuser together.
 */
export interface HueBridgeQueryInput {
    /** The IP or hostname of the Hue-Bridge — the eldritch beacon that guides the vessel through the void. */
    bridgehost: string;
    /** The Hue API username (issued by the Bridge itself — an eldritch token from the deep). */
    bridgeuser: string;
}

/** Forge the pact that binds the crew to the Bridge — ye cannot sail without it, matey. */
export const HueBridgeQueryPact = createPact<HueBridgeQueryInput>(
    "HueBridgeQueryProvider",
    { fromSourceType: "HueBridgeQueryInput" }
);
