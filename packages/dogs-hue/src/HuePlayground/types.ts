/**
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *  Arr, the types that anchor our vessel to reality — such as it remains.
 *  "Corporeal laws are unwritten, as suns and love retreat."
 *  Read-only snapshot of the Hue-Bridge: lanterns as illuminable entities,
 *  each one a flickering defiance against the nameless void.
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */

/** A single lantern entry — its light holds back the abyss, however briefly. */
export interface HuePlaygroundLightEntry {
    /** The lantern's unique identifier, plundered from the Bridge's roiling manifest of the deep. */
    id: number | string;
    /** The human-readable name of this lantern — a fragile label against the nameless void. */
    name: string;
    /** Whether this lantern blazes defiantly against the abyss, or has succumbed to darkness. */
    on: boolean;
    /** Brightness (1-254 on the Hue scale), or null when the lantern be extinguished — swallowed by the void. */
    bri: number | null;
    /** The eldritch unique hardware identifier, whispered from brooding gulfs by the Bridge itself. */
    uniqueid?: string;
}

/** The full snapshot plundered from the Bridge — bridgeHost and all its captive lanterns. */
export interface HuePlaygroundSnapshot {
    /** The IP or hostname of the Hue-Bridge from whence this snapshot was dredged — the anchor to corporeal laws unwritten. */
    bridgeHost: string;
    /** The carrion hordes of lantern entries, each plundered from the Bridge's luminous depths. */
    lights: HuePlaygroundLightEntry[];
}
