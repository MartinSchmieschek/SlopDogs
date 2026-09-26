export {};
import { OsmPowerRetriever, OsmPowerPact } from "@slopdogs/dogs-geo";
import type { IHuntingSeason, IHuntingDog } from "@slopdogs/core";

function mockSeason(pactClass: new () => IHuntingDog<unknown>, query: unknown): IHuntingSeason {
    const p = new pactClass();
    (p as any).result = query;
    return { withBeesInThePants: [], exhausted: [p], runIndex: 1, maxRuns: 10, wave: [], readTracking: [], currentWaveIndex: 0 };
}

async function probe(label: string, lat: string, lng: string, radius: string) {
    const dog = new OsmPowerRetriever();
    const t0 = Date.now();
    const r: any = await dog.collectYield(mockSeason(OsmPowerPact, { lat, lng, radius }));
    const elapsed = Date.now() - t0;
    const bySource: Record<string, number> = {};
    let windSamples: any[] = [];
    for (const f of r.geojson.features) {
        const src = f.properties?.["generator:source"] ?? "(not-generator)";
        bySource[src] = (bySource[src] ?? 0) + 1;
        if (src === "wind" && windSamples.length < 2) windSamples.push(f.properties);
    }
    console.log(`\n[${label}] ${lat},${lng} r=${radius}m — ${r.geojson.features.length} features in ${elapsed}ms`);
    console.log(`  generator:source breakdown: ${Object.entries(bySource).map(([k,v])=>`${k}=${v}`).join(", ")}`);
    for (const w of windSamples) {
        console.log(`  WIND sample: ${JSON.stringify({
            source: w["generator:source"],
            output: w["generator:output:electricity"],
            method: w["generator:method"],
            manufacturer: w.manufacturer,
            model: w.model,
            height: w.height,
            "rotor:diameter": w["rotor:diameter"],
            operator: w.operator,
        })}`);
    }
}

async function main() {
    // Nordfriesland — Onshore-Wind dicht
    await probe("Nordfriesland (Husum-Gebiet)", "54.50", "8.95", "5000");
    await new Promise(r => setTimeout(r, 5000));
    // Brandenburg — auch wind-dicht
    await probe("Brandenburg (östl. Berlin)", "52.45", "14.10", "5000");
}
main().catch(e => { console.error(e?.message || e); process.exit(1); });
