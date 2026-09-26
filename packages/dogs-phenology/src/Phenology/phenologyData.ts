/**
 * =========================================================================
 *  PHENOLOGY DATA — the ten seasons etched into the botanical void
 * =========================================================================
 *
 *  Arr, the mortal calendar be a lie — there be not four seasons
 *  but TEN, each marked by the stirring of specific plants and
 *  creatures. The DWD (Deutscher Wetterdienst) knows this truth,
 *  and so now do we.
 *
 *  These phases be calibrated for Central Europe (lat ~47-55).
 *  For the southern hemisphere, we shift by ~183 days.
 * =========================================================================
 */

import type { PhenologicalPhase } from "./interfaces/phenologyTypes";

interface PhaseEntry {
    phase: PhenologicalPhase;
    startDay: number; // day-of-year when this phase begins (northern hemisphere)
    endDay: number;   // day-of-year when this phase ends
}

const PHASES: PhaseEntry[] = [
    {
        startDay: 43,  // ~Feb 12
        endDay: 78,    // ~Mar 19
        phase: {
            name: "Vorfruehling",
            nameEn: "Pre-Spring",
            indicatorPlants: ["Hasel", "Schneegloeckchen"],
            typicalBloom: ["Haselkaetzchen", "Schneegloeckchen", "Winterling", "Krokus"],
            typicalFauna: ["Stare kehren zurueck", "Amseln singen morgens", "Erdkroeten wandern"],
        },
    },
    {
        startDay: 79,  // ~Mar 20
        endDay: 104,   // ~Apr 14
        phase: {
            name: "Erstfruehling",
            nameEn: "Early Spring",
            indicatorPlants: ["Forsythie", "Kirsche"],
            typicalBloom: ["Forsythie", "Kirschbluete", "Schlehe", "Birne", "Loewenzahn"],
            typicalFauna: ["Kuckuck ruft", "Bienen aktiv", "Zitronenfalter fliegen", "Blindschleichen erwachen"],
        },
    },
    {
        startDay: 105, // ~Apr 15
        endDay: 131,   // ~May 11
        phase: {
            name: "Vollfruehling",
            nameEn: "Full Spring",
            indicatorPlants: ["Apfel", "Flieder"],
            typicalBloom: ["Apfelbluete", "Flieder", "Rosskastanie", "Maiglöckchen", "Raps"],
            typicalFauna: ["Mauersegler kommen", "Froeschlaich", "Maikaefer", "Nachtigall singt"],
        },
    },
    {
        startDay: 132, // ~May 12
        endDay: 161,   // ~Jun 10
        phase: {
            name: "Fruehsommer",
            nameEn: "Early Summer",
            indicatorPlants: ["Holunder", "Robinie"],
            typicalBloom: ["Holunderbluete", "Robinie", "Pfingstrose", "Mohn", "Kornblume"],
            typicalFauna: ["Gluehwuermchen", "Jungvoegel fluegge", "Libellen schluepfen", "Rehkitze"],
        },
    },
    {
        startDay: 162, // ~Jun 11
        endDay: 201,   // ~Jul 20
        phase: {
            name: "Hochsommer",
            nameEn: "Midsummer",
            indicatorPlants: ["Linde", "Lavendel"],
            typicalBloom: ["Linde", "Lavendel", "Sonnenblume", "Johanniskraut"],
            typicalFauna: ["Heuschrecken zirpen", "Schmetterlingsvielfalt", "Schwalben fuettern", "Fledermaeuse jagen"],
        },
    },
    {
        startDay: 202, // ~Jul 21
        endDay: 237,   // ~Aug 25
        phase: {
            name: "Spaetsommer",
            nameEn: "Late Summer",
            indicatorPlants: ["Fruehapfel", "Eberesche"],
            typicalBloom: ["Heidekraut", "Herbstzeitlose beginnt", "Fruehapfel reif", "Brombeeren"],
            typicalFauna: ["Zugvoegel sammeln sich", "Jungstörche ueben Flug", "Wespen aktiv", "Grashüpfer"],
        },
    },
    {
        startDay: 238, // ~Aug 26
        endDay: 268,   // ~Sep 25
        phase: {
            name: "Fruehherbst",
            nameEn: "Early Autumn",
            indicatorPlants: ["Holunder reif", "Zwetschge"],
            typicalBloom: ["Herbstanemone", "Astern", "Efeu blueht"],
            typicalFauna: ["Spinnennetze im Morgentau", "Hirschbrunft beginnt", "Zugvoegel ziehen", "Eichhoernchen sammeln"],
        },
    },
    {
        startDay: 269, // ~Sep 26
        endDay: 293,   // ~Oct 20
        phase: {
            name: "Vollherbst",
            nameEn: "Full Autumn",
            indicatorPlants: ["Kartoffelernte", "Eiche verfaerbt"],
            typicalBloom: ["Herbstlaub Hoehepunkt", "Pilzsaison", "Hagebutten reif", "Schlehen reif"],
            typicalFauna: ["Kraniche ziehen", "Igel suchen Winterquartier", "Eichelhaeher verstecken Vorraete"],
        },
    },
    {
        startDay: 294, // ~Oct 21
        endDay: 324,   // ~Nov 20
        phase: {
            name: "Spaetherbst",
            nameEn: "Late Autumn",
            indicatorPlants: ["Eiche entlaubt", "Stieleiche"],
            typicalBloom: ["Laubfall", "letzte Pilze", "Hagebutten"],
            typicalFauna: ["Igel im Winterquartier", "Wintergaeste treffen ein", "Rehe in Winterdecke"],
        },
    },
    {
        startDay: 325, // ~Nov 21
        endDay: 42,    // ~Feb 11 (wraps around new year)
        phase: {
            name: "Winter",
            nameEn: "Winter",
            indicatorPlants: ["Immergruene Pflanzen", "Mistel"],
            typicalBloom: ["Christrose", "Winterjasmin", "Mistelbeeren"],
            typicalFauna: ["Winterschlaf", "Wintergaeste (Seidenschwanz, Bergfink)", "Rehe im Wald", "Spuren im Schnee"],
        },
    },
];

/**
 * Shift a day-of-year by an offset, wrapping around the year boundary.
 */
function shiftDay(day: number, offset: number): number {
    return ((day - 1 + offset + 365) % 365) + 1;
}

/**
 * Determine the current phenological phase for a given day-of-year and hemisphere.
 * For the southern hemisphere, phases are shifted by ~183 days.
 */
export function getPhenologicalPhase(
    dayOfYear: number,
    hemisphere: 'north' | 'south'
): { current: PhenologicalPhase; upcoming: PhenologicalPhase | null } {
    const shift = hemisphere === 'south' ? 183 : 0;
    const adjustedDay = shift > 0 ? shiftDay(dayOfYear, -shift) : dayOfYear;

    for (let i = 0; i < PHASES.length; i++) {
        const entry = PHASES[i];
        const { startDay, endDay } = entry;

        let match: boolean;
        if (startDay <= endDay) {
            match = adjustedDay >= startDay && adjustedDay <= endDay;
        } else {
            // Wraps around year boundary (Winter: Nov 21 -> Feb 11)
            match = adjustedDay >= startDay || adjustedDay <= endDay;
        }

        if (match) {
            const nextIndex = (i + 1) % PHASES.length;
            return {
                current: entry.phase,
                upcoming: PHASES[nextIndex].phase,
            };
        }
    }

    // Fallback — should not happen, but the void is unpredictable
    return { current: PHASES[9].phase, upcoming: PHASES[0].phase };
}
