/**
 * Smoke-Test fuer die drei neuen OSM-Geometry-Hunde:
 *   OsmBuildingsRetriever, OsmRailsRetriever, OsmLandscapeFeaturesRetriever
 *
 * Ruft jeden Hund mit kleiner Radius-Query auf Frankfurt-Innenstadt auf,
 * ohne Kennel-Infrastruktur (kein TileFeatureCache, direkter Overpass-Fetch).
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/test-osm-geometry-dogs.ts
 */
export {};

import {
    OsmBuildingsRetriever,
    OsmBuildingsGeometryPact,
    OsmRailsRetriever,
    OsmRailsGeometryPact,
    OsmLandscapeFeaturesRetriever,
    OsmLandscapeFeaturesPact,
} from "@slopdogs/dogs-geo";
import type { IHuntingSeason, IHuntingDog } from "@slopdogs/core";

/**
 * Stellt eine Mock-Season her, in der ein Pact-Hund bereits "exhausted" ist
 * und seine Query in `.collected` liegt. Die Retriever finden den Pact via
 * `season.exhausted.find(d => instanceof Pact)`.
 */
function mockSeason(pactClass: new () => IHuntingDog<unknown>, query: unknown): IHuntingSeason {
    const pactInstance = new pactClass();
    // private result-Feld ist Compile-Time only — Runtime via cast.
    (pactInstance as any).result = query;
    return {
        withBeesInThePants: [],
        exhausted: [pactInstance],
        runIndex: 1,
        maxRuns: 10,
        wave: [],
        readTracking: [],
        currentWaveIndex: 0,
    };
}

function geomTypeHistogram(fc: { features: Array<{ geometry?: { type: string } }> }): string {
    const counts: Record<string, number> = {};
    for (const f of fc.features) {
        const t = f.geometry?.type ?? "(none)";
        counts[t] = (counts[t] ?? 0) + 1;
    }
    return Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", ");
}

const FRANKFURT = { lat: "50.1136", lng: "8.6797" }; // Goetheplatz

async function testBuildings() {
    console.log("\n--- OsmBuildingsRetriever ---");
    const dog = new OsmBuildingsRetriever();
    const season = mockSeason(OsmBuildingsGeometryPact, {
        ...FRANKFURT,
        radius: "150",
    });
    const t0 = Date.now();
    const r = await dog.collectYield(season);
    const elapsed = Date.now() - t0;
    console.log(`  fetched in ${elapsed}ms`);
    console.log(`  center: ${r.center.lat}, ${r.center.lng} | radius: ${r.radiusM}m`);
    console.log(`  building filter: [${r.building.join(", ")}]`);
    console.log(`  features: ${r.geojson.features.length} (${geomTypeHistogram(r.geojson)})`);

    // Helper-Test: simplify
    const simplified = (r as any).simplify(2);
    console.log(`  simplify(2m) → ${simplified.geojson.features.length} features (${geomTypeHistogram(simplified.geojson)})`);

    // Helper-Test: merge
    const merged = (r as any).merge();
    console.log(`  merge()      → ${merged.geojson.features.length} features (${geomTypeHistogram(merged.geojson)})`);
}

async function testRails() {
    console.log("\n--- OsmRailsRetriever ---");
    const dog = new OsmRailsRetriever();
    // Frankfurt Hauptbahnhof / Innenstadt — groesserer Radius fuer Schienen.
    const season = mockSeason(OsmRailsGeometryPact, {
        lat: "50.1078",
        lng: "8.6638",
        radius: "800",
    });
    const t0 = Date.now();
    const r = await dog.collectYield(season);
    const elapsed = Date.now() - t0;
    console.log(`  fetched in ${elapsed}ms`);
    console.log(`  center: ${r.center.lat}, ${r.center.lng} | radius: ${r.radiusM}m`);
    console.log(`  railway filter: [${r.railway.join(", ")}]`);
    console.log(`  features: ${r.geojson.features.length} (${geomTypeHistogram(r.geojson)})`);

    const simplified = (r as any).simplify(5);
    console.log(`  simplify(5m) → ${simplified.geojson.features.length} features (${geomTypeHistogram(simplified.geojson)})`);
}

async function testLandscape() {
    console.log("\n--- OsmLandscapeFeaturesRetriever ---");
    const dog = new OsmLandscapeFeaturesRetriever();
    const season = mockSeason(OsmLandscapeFeaturesPact, {
        ...FRANKFURT,
        radius: "400",
        // Defaults explizit dokumentieren — kann auch weggelassen werden.
    });
    const t0 = Date.now();
    const r = await dog.collectYield(season);
    const elapsed = Date.now() - t0;
    console.log(`  fetched in ${elapsed}ms`);
    console.log(`  center: ${r.center.lat}, ${r.center.lng} | radius: ${r.radiusM}m`);
    console.log(`  nature: [${r.nature.join(", ")}]`);
    console.log(`  barrier: [${r.barrier.join(", ")}]`);
    console.log(`  manMade: [${r.manMade.join(", ")}]`);
    console.log(`  features: ${r.geojson.features.length} (${geomTypeHistogram(r.geojson)})`);

    // Aufteilung pro Tag-Key zeigen
    const byKey: Record<string, number> = {};
    for (const f of r.geojson.features) {
        const props = (f as any).properties ?? {};
        const key = props.natural ? `natural=${props.natural}`
            : props.barrier ? `barrier=${props.barrier}`
            : props.man_made ? `man_made=${props.man_made}`
            : "(other)";
        byKey[key] = (byKey[key] ?? 0) + 1;
    }
    console.log(`  by tag: ${Object.entries(byKey).map(([k, v]) => `${k}=${v}`).join(", ")}`);
}

async function main() {
    console.log("Testing 3 new OSM geometry dogs against live Overpass...");
    const tasks = [
        { name: "Buildings", fn: testBuildings },
        { name: "Rails", fn: testRails },
        { name: "LandscapeFeatures", fn: testLandscape },
    ];
    let failed = 0;
    for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        try {
            await t.fn();
        } catch (e: any) {
            failed++;
            console.error(`\n[FAIL] ${t.name}: ${(e?.message ?? String(e)).split("\n")[0]}`);
        }
        // Overpass-Mirrors mit Atempause zwischen Hunden — sonst 429.
        if (i < tasks.length - 1) {
            await new Promise((r) => setTimeout(r, 5000));
        }
    }
    console.log(`\n${tasks.length - failed}/${tasks.length} dogs returned data.`);
    if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
});
