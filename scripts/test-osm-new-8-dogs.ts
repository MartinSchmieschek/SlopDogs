/**
 * Smoke-Test fuer die 8 NEUEN OSM-Hunde (Phase 2):
 *   Water, Landuse, Amenities, Boundaries, Power,
 *   PublicTransitStops, Shops, SportsRecreation
 *
 * Direkter Klassen-Aufruf ohne Kennel — kleine Radien um Overpass nicht zu reizen.
 * Run: npx ts-node -r tsconfig-paths/register scripts/test-osm-new-8-dogs.ts
 */
export {};

import {
    OsmWaterRetriever, OsmWaterPact,
    OsmLanduseRetriever, OsmLandusePact,
    OsmAmenitiesRetriever, OsmAmenitiesPact,
    OsmBoundariesRetriever, OsmBoundariesPact,
    OsmPowerRetriever, OsmPowerPact,
    OsmPublicTransitStopsRetriever, OsmPublicTransitStopsPact,
    OsmShopsRetriever, OsmShopsPact,
    OsmSportsRecreationRetriever, OsmSportsRecreationPact,
} from "@slopdogs/dogs-geo";
import type { IHuntingSeason, IHuntingDog } from "@slopdogs/core";

function mockSeason(pactClass: new () => IHuntingDog<unknown>, query: unknown): IHuntingSeason {
    const pactInstance = new pactClass();
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

const FRANKFURT_HBF = { lat: "50.1078", lng: "8.6638" };

interface DogProbe {
    name: string;
    radius: string;
    runner: () => Promise<{ featureCount: number; geomTypes: string; sampleTag?: string }>;
}

const probes: DogProbe[] = [
    {
        name: "Water",
        radius: "1500",
        runner: async () => {
            const dog = new OsmWaterRetriever();
            const r: any = await dog.collectYield(mockSeason(OsmWaterPact, { ...FRANKFURT_HBF, radius: "1500" }));
            return { featureCount: r.geojson.features.length, geomTypes: geomTypeHistogram(r.geojson), sampleTag: r.geojson.features[0]?.properties?.name ?? r.geojson.features[0]?.properties?.waterway ?? r.geojson.features[0]?.properties?.natural };
        },
    },
    {
        name: "Landuse",
        radius: "800",
        runner: async () => {
            const dog = new OsmLanduseRetriever();
            const r: any = await dog.collectYield(mockSeason(OsmLandusePact, { ...FRANKFURT_HBF, radius: "800" }));
            return { featureCount: r.geojson.features.length, geomTypes: geomTypeHistogram(r.geojson), sampleTag: r.geojson.features[0]?.properties?.landuse };
        },
    },
    {
        name: "Amenities",
        radius: "300",
        runner: async () => {
            const dog = new OsmAmenitiesRetriever();
            const r: any = await dog.collectYield(mockSeason(OsmAmenitiesPact, { ...FRANKFURT_HBF, radius: "300" }));
            return { featureCount: r.geojson.features.length, geomTypes: geomTypeHistogram(r.geojson), sampleTag: r.geojson.features[0]?.properties?.amenity };
        },
    },
    {
        name: "Boundaries",
        radius: "5000",
        runner: async () => {
            const dog = new OsmBoundariesRetriever();
            const r: any = await dog.collectYield(mockSeason(OsmBoundariesPact, { ...FRANKFURT_HBF, radius: "5000", adminLevel: "[4,6,8]" }));
            return { featureCount: r.geojson.features.length, geomTypes: geomTypeHistogram(r.geojson), sampleTag: r.geojson.features[0]?.properties?.name };
        },
    },
    {
        name: "Power",
        radius: "5000",
        runner: async () => {
            const dog = new OsmPowerRetriever();
            const r: any = await dog.collectYield(mockSeason(OsmPowerPact, { ...FRANKFURT_HBF, radius: "5000" }));
            return { featureCount: r.geojson.features.length, geomTypes: geomTypeHistogram(r.geojson), sampleTag: r.geojson.features[0]?.properties?.power };
        },
    },
    {
        name: "PublicTransitStops",
        radius: "500",
        runner: async () => {
            const dog = new OsmPublicTransitStopsRetriever();
            const r: any = await dog.collectYield(mockSeason(OsmPublicTransitStopsPact, { ...FRANKFURT_HBF, radius: "500" }));
            return { featureCount: r.geojson.features.length, geomTypes: geomTypeHistogram(r.geojson), sampleTag: r.geojson.features[0]?.properties?.name };
        },
    },
    {
        name: "Shops",
        radius: "300",
        runner: async () => {
            const dog = new OsmShopsRetriever();
            const r: any = await dog.collectYield(mockSeason(OsmShopsPact, { ...FRANKFURT_HBF, radius: "300" }));
            return { featureCount: r.geojson.features.length, geomTypes: geomTypeHistogram(r.geojson), sampleTag: r.geojson.features[0]?.properties?.shop };
        },
    },
    {
        name: "SportsRecreation",
        radius: "2000",
        runner: async () => {
            const dog = new OsmSportsRecreationRetriever();
            const r: any = await dog.collectYield(mockSeason(OsmSportsRecreationPact, { ...FRANKFURT_HBF, radius: "2000" }));
            return { featureCount: r.geojson.features.length, geomTypes: geomTypeHistogram(r.geojson), sampleTag: r.geojson.features[0]?.properties?.leisure };
        },
    },
];

async function main() {
    console.log(`Testing 8 new OSM dogs against live Overpass (Frankfurt Hbf)...\n`);
    const results: Array<{ name: string; ok: boolean; ms?: number; summary?: string; error?: string }> = [];
    for (let i = 0; i < probes.length; i++) {
        const p = probes[i];
        process.stdout.write(`[${i + 1}/${probes.length}] ${p.name} (radius=${p.radius}m)... `);
        const t0 = Date.now();
        try {
            const r = await p.runner();
            const ms = Date.now() - t0;
            const summary = `count=${r.featureCount} (${r.geomTypes})${r.sampleTag ? ` first=${r.sampleTag}` : ""}`;
            console.log(`OK in ${ms}ms — ${summary}`);
            results.push({ name: p.name, ok: true, ms, summary });
        } catch (e: any) {
            const ms = Date.now() - t0;
            const error = (e?.message ?? String(e)).split("\n")[0].slice(0, 200);
            console.log(`FAIL in ${ms}ms — ${error}`);
            results.push({ name: p.name, ok: false, ms, error });
        }
        if (i < probes.length - 1) await new Promise((r) => setTimeout(r, 4000));
    }

    const passed = results.filter((r) => r.ok).length;
    console.log(`\n=== ${passed}/${results.length} dogs returned data ===`);
    if (passed < results.length) process.exitCode = 1;
}

main().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
});
