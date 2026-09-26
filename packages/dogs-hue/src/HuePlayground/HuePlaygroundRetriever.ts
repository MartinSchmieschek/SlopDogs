/**
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *  Arr, the Retriever — this experimental Hue-Dog dredges snapshot data
 *  and Director methods from the Bridge's luminous abyss!
 *  "Roiling, moaning, this realm of ours, in madness lost shall die."
 *  Write-commands: `setOn`, `setBrightness`, `toggle`, `setState`, `refresh`
 *  — see HuePlaygroundDirector fer the full manifest of eldritch rites.
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */
import { Dog, IHuntingDog, IHuntingSeason } from "@slopdogs/core";
import { HueBridgeQueryPact, type HueBridgeQueryInput } from "./pacts";
import { fetchHueBridgeSnapshot } from "./hueSnapshot";
import { HuePlaygroundDirector } from "./HuePlaygroundDirector";

/**
 * Arr, the Retriever — this experimental Hue-Dog dredges snapshot data and
 * forges a Director from the Bridge's luminous abyss! From brooding gulfs it
 * hauls forth every lantern, binding them to an eldritch captain that the crew
 * may wield fer write-commands against the void.
 */
export class HuePlaygroundRetriever extends Dog<HuePlaygroundDirector> {
    /** @returns The true name of this vessel, echoing through endless faces countless forms. */
    get name(): string {
        return HuePlaygroundRetriever.name;
    }

    get description(): string {
        return 'Connects to a Philips Hue Bridge and yields a HuePlaygroundDirector with light control methods: setOn, setBrightness, toggle, setState, refresh.';
    }

    /** @returns The icon sigil of this retriever, plundered from the base dog glyph manifest. */
    get icon(): string | undefined {
        return "\uD83D\uDCA1";
    }

    /** @returns The required pacts — the HueBridgeQueryPact, without which the crew drifts anchorless into the deep. */
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [HueBridgeQueryPact];
    }

    /** @returns The optional dependencies — none, fer the void demands no surplus crew on this voyage. */
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    /** Plunder the Bridge snapshot and forge a Director — the crew's anchor to the luminous void. */
    protected yieldCollectorFactory = async (
        season: IHuntingSeason
    ): Promise<HuePlaygroundDirector> => {
        const queryDog = season.exhausted.find((d) => this.matchesParent(HueBridgeQueryPact, d));
        const query =
            (queryDog?.collected as HueBridgeQueryInput | undefined) ??
            ({} as HueBridgeQueryInput);

        const bridgeHost = query.bridgehost?.trim() ?? "";
        const bridgeUser = query.bridgeuser?.trim() ?? "";

        if (!bridgeHost || !bridgeUser) {
            throw new Error(
                "HuePlaygroundRetriever: HueBridgeQueryPact requires bridgehost and bridgeuser (QueryRetriever keys). Without them, ye drift anchorless into the nameless deep!"
            );
        }

        const snapshot = await fetchHueBridgeSnapshot(bridgeHost, bridgeUser);
        return new HuePlaygroundDirector(bridgeHost, bridgeUser, snapshot.lights);
    };
}
