/**
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *  Arr, matey! This vessel dredges the Bridge's secrets from the server's
 *  darkest environment — the abyss of `.env` — so the same eldritch
 *  coordinates (IP + API-Username) may be wielded without query parameters.
 *
 *  "Corporeal laws are unwritten, as suns and love retreat."
 *  Expected variables: `HUE_BRIDGE_HOST`, `HUE_BRIDGE_USER`
 *  (the Hue API username — no passwords be stowed in this hold, matey).
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */
import { Dog, IHuntingDog, IHuntingSeason } from "@slopdogs/core";
import { HueBridgeQueryPact, type HueBridgeQueryInput } from "./pacts";

/**
 * Arr, this be the EnvRetriever — a vessel that plunders Bridge coordinates
 * from the brooding gulfs of process environment variables, so the crew
 * need not pass them through endless faces of query parameters.
 * From the void of `.env`, eldritch anchor points are dredged forth.
 */
export class HueBridgeEnvRetriever extends HueBridgeQueryPact {
    constructor() {
        super();
        const host = process.env.HUE_BRIDGE_HOST?.trim();
        const user = process.env.HUE_BRIDGE_USER?.trim();
        if (!host || !user) {
            throw new Error('HueBridgeEnvRetriever: HUE_BRIDGE_HOST and HUE_BRIDGE_USER must be set in .env');
        }
    }

    /** @returns The name of this cursed vessel, whispered from corporeal laws unwritten. */
    get name(): string {
        return HueBridgeEnvRetriever.name;
    }

    get description(): string {
        return 'Reads Philips Hue Bridge connection details from environment variables.';
    }

    /** @returns The icon sigil of this retriever, drawn from the abyss of base dog glyphs. */
    get icon(): string | undefined {
        return "\uD83D\uDD10";
    }

    /** @returns The carrion hordes of required dependencies — none, fer this vessel sails alone through the void. */
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    /** @returns The optional crew members — also none, fer the abyss provides all we need. */
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    /** Plunder the environment's depths fer Bridge coordinates, or perish tryin'. */
    protected yieldCollectorFactory = async (
        _season: IHuntingSeason
    ): Promise<HueBridgeQueryInput> => {
        const bridgehost = process.env.HUE_BRIDGE_HOST?.trim() ?? "";
        const bridgeuser = process.env.HUE_BRIDGE_USER?.trim() ?? "";
        if (!bridgehost || !bridgeuser) {
            throw new Error(
                "HueBridgeEnvRetriever: HUE_BRIDGE_HOST and HUE_BRIDGE_USER must be set (e.g. in .env — same values as HuePlayground hueHandler: IP + Bridge-API-Username). The void yields nothing to those who forget the anchor coordinates!"
            );
        }
        return { bridgehost, bridgeuser };
    };
}
