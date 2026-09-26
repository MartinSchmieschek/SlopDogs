export {};
import { OsmPowerRetriever, OsmPowerPact } from "@slopdogs/dogs-geo";
import type { IHuntingSeason, IHuntingDog } from "@slopdogs/core";

function mockSeason(pactClass: new () => IHuntingDog<unknown>, query: unknown): IHuntingSeason {
    const p = new pactClass();
    (p as any).result = query;
    return { withBeesInThePants: [], exhausted: [p], runIndex: 1, maxRuns: 10, wave: [], readTracking: [], currentWaveIndex: 0 };
}

async function main() {
    const dog = new OsmPowerRetriever();
    // Smaller radius — Power tiles are sparse; 2km should be enough to find substations + lines.
    const t0 = Date.now();
    const r: any = await dog.collectYield(mockSeason(OsmPowerPact, { lat: "50.1078", lng: "8.6638", radius: "2000" }));
    const elapsed = Date.now() - t0;
    const c: Record<string, number> = {};
    for (const f of r.geojson.features) { const t = f.geometry?.type ?? "?"; c[t] = (c[t] ?? 0) + 1; }
    const byPower: Record<string, number> = {};
    for (const f of r.geojson.features) { const p = f.properties?.power ?? "?"; byPower[p] = (byPower[p] ?? 0) + 1; }
    console.log(`Power in ${elapsed}ms: count=${r.geojson.features.length} (${Object.entries(c).map(([k,v])=>`${k}=${v}`).join(", ")})`);
    console.log(`  by power-value: ${Object.entries(byPower).map(([k,v])=>`${k}=${v}`).join(", ")}`);
    console.log(`  first sample: ${JSON.stringify(r.geojson.features[0]?.properties).slice(0, 200)}`);
}
main().catch(e => { console.error(e?.message || e); process.exit(1); });
