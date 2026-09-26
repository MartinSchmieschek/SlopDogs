import { randomUUID } from 'crypto';
import { IStore } from '../../store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@slopdogs/core';
import { kennelExists, saveKennelSeed, saveMimic } from '../seed-helpers';
export async function seedCompareKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'compare-locations';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // Wave 2: Fetch both locations by calling the public smart-guide kennel (/k/smart-guide).
    // Zwei Laeufe mit verschiedenen Adressen — als Parent-Dog nicht verdrahtbar (ein Parent laeuft
    // einmal je Lauf). Die VM kennt weder Host noch PORT: `?base=` setzt die Basis-URL, Default lokal.
    const fetcherVersionId = randomUUID();
    const fetcherDogId = randomUUID();
    const fetcherCfg = {
        id: fetcherVersionId,
        lineageId: fetcherDogId,
        parentId: null,
        displayName: 'Fetch Both Locations',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `
const from = QueryRetriever.from;
const to = QueryRetriever.to;

if (!from || !to) throw new Error("Bitte 'from' und 'to' Adressen angeben");

const origin = String(QueryRetriever.base || "http://localhost:3000");
const base = (origin.endsWith("/") ? origin.slice(0, -1) : origin) + "/k/smart-guide?address=";

const [locationA, locationB] = await Promise.all([
    fetch(base + encodeURIComponent(from)).then(r => r.json()),
    fetch(base + encodeURIComponent(to)).then(r => r.json()),
]);

return { locationA, locationB, addressA: from, addressB: to }
`,
    };
    await nodesStore.save({
        id: fetcherVersionId,
        type: SerializedDog.name,
        lineageId: fetcherDogId,
        parentId: null,
        displayName: 'Fetch Both Locations',
        serializedDogConfig: JSON.stringify(fetcherCfg),
        createdAt: new Date(),
    });

    // Wave 3: Compare both locations
    const comparatorVersionId = randomUUID();
    const comparatorDogId = randomUUID();
    const comparatorCfg = {
        id: comparatorVersionId,
        lineageId: comparatorDogId,
        parentId: null,
        displayName: 'Location Comparator',
        parentsRequired: [fetcherDogId],
        parentsOptional: [],
        theRun: `
const a = FetchBothLocations.locationA;
const b = FetchBothLocations.locationB;

// Smart Guide hat: resolvedAddress, recommendation, highlight, transport
function summarize(loc, label) {
    const rec = loc.recommendation || {};
    const cond = rec.conditions || {};
    const trans = loc.transport || {};
    const hl = loc.highlight || {};
    const addr = loc.resolvedAddress || {};

    return {
        address: addr.displayName || label,
        city: addr.city || null,
        score: rec.score || 0,
        overall: rec.overall || null,
        activities: rec.activities || [],
        warnings: rec.warnings || [],
        temperature: cond.temperature || null,
        weather: cond.weatherDescription || null,
        airQuality: cond.airQuality || null,
        uvIndex: cond.uvIndex || null,
        windSpeed: cond.windSpeed || null,
        transportStations: trans.stations ? trans.stations.length : 0,
        topStation: trans.stations && trans.stations[0] ? trans.stations[0].name : null,
        highlight: hl.highlight ? hl.highlight.title : null,
        highlightExtract: hl.highlight ? hl.highlight.extract : null,
        nearbyArticles: hl.nearby ? hl.nearby.length : 0,
    };
}

const sumA = summarize(a, FetchBothLocations.addressA);
const sumB = summarize(b, FetchBothLocations.addressB);

const winner = sumA.score > sumB.score
    ? FetchBothLocations.addressA
    : sumA.score < sumB.score
        ? FetchBothLocations.addressB
        : "Unentschieden";

return {
    locationA: sumA,
    locationB: sumB,
    winner,
    verdict: sumA.score > sumB.score
        ? sumA.address.split(",")[0] + " gewinnt mit " + sumA.score + " vs " + sumB.score + " Punkten"
        : sumA.score < sumB.score
            ? sumB.address.split(",")[0] + " gewinnt mit " + sumB.score + " vs " + sumA.score + " Punkten"
            : "Beide Orte sind gleichwertig (" + sumA.score + " Punkte)",
}
`,
    };
    await nodesStore.save({
        id: comparatorVersionId,
        type: SerializedDog.name,
        lineageId: comparatorDogId,
        parentId: null,
        displayName: 'Location Comparator',
        serializedDogConfig: JSON.stringify(comparatorCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Compare Locations',
        description: 'Zwei Adressen vergleichen: Kennel ruft Kennel auf — Wetter, Luft, OEPNV, Kultur im Vergleich',
        emoji: '\u2696\uFE0F',
        dogIds: [
            comparatorDogId,
            BASE_DOG_PREFIX + 'QueryRetriever',
            fetcherDogId,
        ],
        defaultQuery: { from: 'Koelner Dom', to: 'Brandenburger Tor Berlin' },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await saveKennelSeed(kennelsStore, kennelConfig.id, {
        name: kennelConfig.name,
        description: kennelConfig.description,
        emoji: kennelConfig.emoji,
        dogIds: kennelConfig.dogIds,
        defaultQuery: kennelConfig.defaultQuery,
        defaultBody: undefined,
    });

    console.log(`\u2705 Seeded Compare Locations Kennel (kennelId: ${kennelId})`);
}

/**
 * The Smart Guide kennel — the deepest dog chain (7 waves).
 *
 * Wave 1: QueryRetriever (captures ?address=...)
 * Wave 2: GeocodingMimic (address → GeocodingQuery)
 * Wave 3: GeocodingRetriever (address → lat/lng)
 * Wave 4: Weather/Air/Sun/Transport/Wiki Mimics (read GPS FROM GeocodingRetriever)
 * Wave 5: All 5 Retrievers run in parallel
 * Wave 6: ActivityRecommender (reads Weather + AirQuality + Sun → generates activity advice)
 *         + WikiHighlightPicker (reads WikiNearby → picks the best article to visit)
 * Wave 7: Lead dog combines everything + recommendation + highlight
 */
