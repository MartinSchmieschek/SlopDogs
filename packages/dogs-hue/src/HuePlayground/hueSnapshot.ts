/**
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *  Arr, this be the snapshot conjurer — it reads all lanterns from the
 *  local Hue-Bridge via HTTPS (node-hue-api v5) and maps their raw
 *  forms into entries fit fer the crew's manifest.
 *  "To cosmic forms from tangent planes, we end as we began."
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */
import { api } from "node-hue-api";
import type { HuePlaygroundLightEntry, HuePlaygroundSnapshot } from "./types";
import { wrapHueApiError } from "./hueBridgeErrors";

/** Map a raw lantern from the Bridge's unknowable depths into a readable entry. */
function mapLight(raw: unknown): HuePlaygroundLightEntry {
    const L = raw as {
        id?: string | number;
        name?: string;
        uniqueid?: string;
        state?: { on?: boolean; bri?: number };
    };
    const state = L.state;
    const bri = state?.bri;
    return {
        id: L.id ?? "",
        name: String(L.name ?? ""),
        on: Boolean(state?.on),
        bri: typeof bri === "number" ? bri : null,
        ...(L.uniqueid !== undefined ? { uniqueid: L.uniqueid } : {}),
    };
}

/**
 * Fetch all lanterns from the local Hue-Bridge — peer into the abyss, matey,
 * and plunder every illuminated soul ye find anchored there.
 * "Through endless faces, countless forms, a multitude unfolds."
 */
export async function fetchHueBridgeSnapshot(
    bridgeHost: string,
    bridgeUser: string
): Promise<HuePlaygroundSnapshot> {
    const trimmedHost = bridgeHost.trim();
    const trimmedUser = bridgeUser.trim();
    if (!trimmedHost) {
        throw new Error("HuePlaygroundRetriever: bridgehost is missing or empty — the anchor coordinates be lost to the void!");
    }
    if (!trimmedUser) {
        throw new Error("HuePlaygroundRetriever: bridgeuser is missing or empty — ye cannot board the Bridge without a name, matey!");
    }

    try {
        const hueApi = await api.createLocal(trimmedHost).connect(trimmedUser);
        const allLights = await hueApi.lights.getAll();
        const lights = allLights.map(mapLight);
        return { bridgeHost: trimmedHost, lights };
    } catch (e: unknown) {
        throw wrapHueApiError(e, "HuePlaygroundRetriever (Snapshot)", trimmedHost);
    }
}
