import { randomUUID } from 'crypto';
import { IStore } from '../../store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@slopdogs/core';
import { kennelExists, saveKennelSeed, saveMimic } from '../seed-helpers';
export async function seedSmartGuideKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'smart-guide';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // --- Wave 2: Geocoding ---
    const geoMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...geoMimic,
        displayName: 'SG: Address → Geocoding',
        imitates: 'GeocodingQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { address: QueryRetriever.address, limit: "1" }`,
    });

    // --- Wave 4: GPS Mimics (read from GeocodingRetriever) ---
    const weatherMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...weatherMimic,
        displayName: 'SG: GPS → Weather',
        imitates: 'WeatherQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `const loc = GeocodingRetriever.results[0]; return { lat: String(loc.lat), lng: String(loc.lng) }`,
    });

    const airMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...airMimic,
        displayName: 'SG: GPS → AirQuality',
        imitates: 'AirQualityQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `const loc = GeocodingRetriever.results[0]; return { lat: String(loc.lat), lng: String(loc.lng) }`,
    });

    const sunMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...sunMimic,
        displayName: 'SG: GPS → Sun',
        imitates: 'SunQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `const loc = GeocodingRetriever.results[0]; return { lat: String(loc.lat), lng: String(loc.lng), days: "3" }`,
    });

    const transportMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...transportMimic,
        displayName: 'SG: GPS → Transport',
        imitates: 'PublicTransportQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `const loc = GeocodingRetriever.results[0]; return { lat: String(loc.lat), lng: String(loc.lng), radius: "500", results: "5" }`,
    });

    const wikiMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...wikiMimic,
        displayName: 'SG: GPS → Wiki',
        imitates: 'WikiNearbyQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `const loc = GeocodingRetriever.results[0]; return { lat: String(loc.lat), lng: String(loc.lng), radius: "1000", limit: "10", lang: "de" }`,
    });

    // --- Wave 6: Activity Recommender (reads Weather + AirQuality + Sun) ---
    const recommenderVersionId = randomUUID();
    const recommenderDogId = randomUUID();
    const recommenderCfg = {
        id: recommenderVersionId,
        lineageId: recommenderDogId,
        parentId: null,
        displayName: 'Activity Recommender',
        parentsRequired: ['WeatherRetriever', 'AirQualityRetriever', 'SunRetriever'],
        parentsOptional: [],
        theRun: `
const temp = WeatherRetriever.current.temperature;
const weatherCode = WeatherRetriever.current.weatherCode;
const wind = WeatherRetriever.current.windSpeed;
const aqi = AirQualityRetriever.current.europeanAqi;
const uv = SunRetriever.today.uvIndexMax;
const sunHours = SunRetriever.today.sunshineHours;
const birch = AirQualityRetriever.pollen ? AirQualityRetriever.pollen.birch : 0;
const grass = AirQualityRetriever.pollen ? AirQualityRetriever.pollen.grass : 0;

const activities = [];
const warnings = [];

// Temperature-based
if (temp >= 15 && temp <= 28) activities.push("Perfekt fuer einen Spaziergang oder Radtour");
else if (temp >= 10 && temp < 15) activities.push("Angenehm fuer eine Wanderung mit leichter Jacke");
else if (temp >= 0 && temp < 10) activities.push("Kuehl — warm anziehen fuer Outdoor-Aktivitaeten");
else if (temp < 0) activities.push("Frostig — Indoor-Aktivitaeten empfohlen");
else activities.push("Sehr warm — Schatten suchen, viel trinken");

// Weather code based
if (weatherCode <= 3) activities.push("Klarer Himmel — gut fuer Sightseeing und Fotografie");
else if (weatherCode >= 51 && weatherCode <= 67) {
    warnings.push("Regen erwartet — Regenschirm nicht vergessen");
    activities.push("Museen und Indoor-Sehenswuerdigkeiten bevorzugen");
}
else if (weatherCode >= 71 && weatherCode <= 77) warnings.push("Schneefall — vorsichtig auf glatten Wegen");
else if (weatherCode >= 95) warnings.push("Gewitter — besser drinnen bleiben");

// Air quality
if (aqi > 60) warnings.push("Schlechte Luftqualitaet (AQI " + aqi + ") — Aufenthalt im Freien einschraenken");
if (birch > 100 || grass > 50) warnings.push("Hoher Pollenflug — Allergiker aufgepasst");

// UV
if (uv >= 6) warnings.push("Hoher UV-Index (" + uv.toFixed(1) + ") — Sonnenschutz tragen");
else if (uv >= 3) activities.push("Maessige UV-Strahlung — Sonnenbrille empfohlen");

// Wind
if (wind > 40) warnings.push("Sturmwarnung — starker Wind (" + wind + " km/h)");
else if (wind > 20) warnings.push("Windiger Tag (" + wind + " km/h)");

// Sunshine
if (sunHours > 8) activities.push("Sonnenreicher Tag — ideal fuer Outdoor-Erkundungen");

// Overall score
let score = 50;
if (temp >= 12 && temp <= 25) score += 20;
if (weatherCode <= 3) score += 15;
if (aqi <= 40) score += 10;
if (uv < 8) score += 5;
if (wind < 20) score += 5;
score = Math.min(100, Math.max(0, score));

let overall;
if (score >= 80) overall = "Ausgezeichnet — perfekter Tag fuer draussen";
else if (score >= 60) overall = "Gut — angenehme Bedingungen";
else if (score >= 40) overall = "Maessig — mit Einschraenkungen machbar";
else overall = "Ungünstig — Indoor-Alternativen empfohlen";

return {
    score,
    overall,
    activities,
    warnings,
    conditions: {
        temperature: temp,
        weatherDescription: WeatherRetriever.current.weatherDescription,
        airQuality: AirQualityRetriever.current.aqiDescription,
        uvIndex: uv,
        windSpeed: wind,
    },
}
`,
    };
    await nodesStore.save({
        id: recommenderVersionId,
        type: SerializedDog.name,
        lineageId: recommenderDogId,
        parentId: null,
        displayName: 'Activity Recommender',
        serializedDogConfig: JSON.stringify(recommenderCfg),
        createdAt: new Date(),
    });

    // --- Wave 6: Wiki Highlight Picker (reads WikiNearby → picks best article) ---
    const highlightVersionId = randomUUID();
    const highlightDogId = randomUUID();
    const highlightCfg = {
        id: highlightVersionId,
        lineageId: highlightDogId,
        parentId: null,
        displayName: 'Wiki Highlight Picker',
        parentsRequired: ['WikiNearbyRetriever'],
        parentsOptional: [],
        theRun: `
const articles = WikiNearbyRetriever.articles;
if (!articles || articles.length === 0) return { highlight: null, nearby: [] };

// Pick the article with the longest extract as "highlight" (most notable)
const sorted = [...articles].sort((a, b) => b.extract.length - a.extract.length);
const highlight = sorted[0];

// Rest sorted by distance
const nearby = articles
    .filter(a => a.pageId !== highlight.pageId)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)
    .map(a => ({ title: a.title, distance: a.distance, url: a.articleUrl }));

return {
    highlight: {
        title: highlight.title,
        extract: highlight.extract,
        url: highlight.articleUrl,
        thumbnail: highlight.thumbnailUrl,
        distance: highlight.distance,
    },
    nearby,
}
`,
    };
    await nodesStore.save({
        id: highlightVersionId,
        type: SerializedDog.name,
        lineageId: highlightDogId,
        parentId: null,
        displayName: 'Wiki Highlight Picker',
        serializedDogConfig: JSON.stringify(highlightCfg),
        createdAt: new Date(),
    });

    // --- Wave 7: Lead dog — the grand combiner ---
    const leadVersionId = randomUUID();
    const leadDogId = randomUUID();
    const leadCfg = {
        id: leadVersionId,
        lineageId: leadDogId,
        parentId: null,
        displayName: 'Smart Guide',
        parentsRequired: [
            'GeocodingRetriever',
            recommenderDogId,
            highlightDogId,
            'PublicTransportRetriever',
        ],
        parentsOptional: [],
        theRun: `
const geo = GeocodingRetriever.results[0];

return {
    resolvedAddress: {
        displayName: geo.displayName,
        lat: geo.lat,
        lng: geo.lng,
        city: geo.address.city,
    },
    recommendation: ${JSON.stringify(recommenderDogId).replace(/"/g, "'")} in this ? this[${JSON.stringify(recommenderDogId).replace(/"/g, "'")}] : null,
    highlight: ${JSON.stringify(highlightDogId).replace(/"/g, "'")} in this ? this[${JSON.stringify(highlightDogId).replace(/"/g, "'")}] : null,
    transport: {
        stations: PublicTransportRetriever.stations.slice(0, 3).map(s => ({
            name: s.station.name,
            distance: s.station.distance,
            departures: s.departures.slice(0, 2).map(d => d.line + " -> " + d.direction),
        })),
    },
}
`,
    };

    // Hmm, the lead dog accesses SerializedDogs by their storageId as globals.
    // Let me fix the theRun to use the display names instead.
    // Actually, SerializedDog parents are accessed by their storageId in the VM context.
    // But the recommender and highlight dogs are SerializedDogs referenced by lineageId.
    // The VM context maps parent names. Let me check...
    // For SerializedDogs, the global variable name in VM is the storageId (which is the versionId or lineageId).
    // That won't be a clean variable name. Let me use a different approach:
    // Reference them via season.exhausted.find pattern? No, SerializedDog code runs in VM with parent yields as globals.
    // The global names for SerializedDog parents are their displayName (cleaned) or storageId.
    // Actually looking at SerializedDog.ts, it maps by the dog's name property which for SerializedDog is the displayName.

    // Let me rewrite the lead dog to reference by displayName (which becomes the global variable name)
    leadCfg.theRun = `
const geo = GeocodingRetriever.results[0];

return {
    resolvedAddress: {
        displayName: geo.displayName,
        lat: geo.lat,
        lng: geo.lng,
        city: geo.address.city,
    },
    recommendation: ActivityRecommender,
    highlight: WikiHighlightPicker,
    transport: {
        stations: PublicTransportRetriever.stations.slice(0, 3).map(s => ({
            name: s.station.name,
            distance: s.station.distance,
            departures: s.departures.slice(0, 2).map(d => d.line + " -> " + d.direction),
        })),
    },
}
`;

    await nodesStore.save({
        id: leadVersionId,
        type: SerializedDog.name,
        lineageId: leadDogId,
        parentId: null,
        displayName: 'Smart Guide',
        serializedDogConfig: JSON.stringify(leadCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Smart Guide',
        description: '7-Wave Kette: Adresse → GPS → Wetter/Luft/Sonne → Aktivitaets-Empfehlung + Wiki-Highlight + OEPNV',
        emoji: '\uD83E\uDDED',
        dogIds: [
            leadDogId,
            BASE_DOG_PREFIX + 'QueryRetriever',
            BASE_DOG_PREFIX + 'GeocodingRetriever',
            BASE_DOG_PREFIX + 'WeatherRetriever',
            BASE_DOG_PREFIX + 'AirQualityRetriever',
            BASE_DOG_PREFIX + 'SunRetriever',
            BASE_DOG_PREFIX + 'PublicTransportRetriever',
            BASE_DOG_PREFIX + 'WikiNearbyRetriever',
            geoMimic.lineageId,
            weatherMimic.lineageId,
            airMimic.lineageId,
            sunMimic.lineageId,
            transportMimic.lineageId,
            wikiMimic.lineageId,
            recommenderDogId,
            highlightDogId,
        ],
        defaultQuery: { address: 'Koelner Dom' },
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

    console.log(`\u2705 Seeded Smart Guide Kennel (kennelId: ${kennelId})`);
}

/**
 * The address lookup kennel — a true dog chain where data flows through.
 *
 * User enters an address → GeocodingRetriever resolves to lat/lng →
 * that lat/lng feeds into Weather, AirQuality, Sun, Transport, Wiki.
 * The MimicDogs in the middle READ from GeocodingRetriever's yield,
 * not from QueryRetriever — real dependency-driven data flow.
 *
 * Wave execution:
 *   1: QueryRetriever (captures ?address=...)
 *   2: GeocodingMimic (maps address → GeocodingQuery)
 *   3: GeocodingRetriever (resolves address → lat/lng/displayName)
 *   4: Weather/Air/Sun/Transport/Wiki Mimics (read lat/lng FROM GeocodingRetriever)
 *   5: All 5 retrievers run in parallel
 *   6: Lead SerializedDog combines everything + resolved address
 */
