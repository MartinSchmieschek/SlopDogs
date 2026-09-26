import { randomUUID } from 'crypto';
import { IStore } from '../../store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@slopdogs/core';
import { kennelExists, saveKennelSeed, saveMimic } from '../seed-helpers';
import { EARTH_PULSE_DATA_CODE, EARTH_PULSE_RENDERER_CODE } from '../earth-pulse-code';

export async function seedEarthPulseKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'earth-pulse';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const gpsTheRun = `var g = GeocodingRetriever; var loc = (g.results || [])[0] || {}; return { lat: String(loc.lat), lng: String(loc.lng) }`;

    // --- Wave 2: Geocoding Mimic ---
    const geoMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...geoMimic,
        displayName: 'EP: q → Geocoding',
        imitates: 'GeocodingQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { address: QueryRetriever.q || QueryRetriever.address || "Berlin" }`,
    });

    // --- Wave 2: News Mimic (reads from QueryRetriever) ---
    const newsMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...newsMimic,
        displayName: 'EP: q → News',
        imitates: 'RegionalNewsQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { query: QueryRetriever.q || "Berlin" }`,
    });

    // --- Wave 4: GPS Mimics (all read from GeocodingRetriever) ---
    const weatherMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, { ...weatherMimic, displayName: 'EP: GPS → Weather', imitates: 'WeatherQueryProvider', parentsRequired: ['GeocodingRetriever'], theRun: gpsTheRun });

    const sunMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, { ...sunMimic, displayName: 'EP: GPS → Sun', imitates: 'SunQueryProvider', parentsRequired: ['GeocodingRetriever'], theRun: gpsTheRun });

    const airMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, { ...airMimic, displayName: 'EP: GPS → Air', imitates: 'AirQualityQueryProvider', parentsRequired: ['GeocodingRetriever'], theRun: gpsTheRun });

    const bioMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, { ...bioMimic, displayName: 'EP: GPS → Species', imitates: 'BiodiversityQueryProvider', parentsRequired: ['GeocodingRetriever'], theRun: gpsTheRun });

    const phenoMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, { ...phenoMimic, displayName: 'EP: GPS → Phenology', imitates: 'PhenologyQueryProvider', parentsRequired: ['GeocodingRetriever'], theRun: gpsTheRun });

    const landmarkMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, { ...landmarkMimic, displayName: 'EP: GPS → Landmarks', imitates: 'NearbyLandmarksQueryProvider', parentsRequired: ['GeocodingRetriever'], theRun: gpsTheRun });

    const transitMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, { ...transitMimic, displayName: 'EP: GPS → Transit', imitates: 'TransitTripQueryProvider', parentsRequired: ['GeocodingRetriever'], theRun: `var g = GeocodingRetriever; var loc = (g.results || [])[0] || {}; return { lat: String(loc.lat), lng: String(loc.lng), radius: "2000" }` });

    // --- Wave 6: PulsData (combines all retriever yields) ---
    const pulsDataVersionId = randomUUID();
    const pulsDataDogId = randomUUID();
    const pulsDataCfg = {
        id: pulsDataVersionId, lineageId: pulsDataDogId, parentId: null,
        displayName: 'Pulsdata',
        parentsRequired: ['WeatherRetriever', 'SunRetriever', 'AirQualityRetriever', 'SpeciesRetriever', 'PhenologyRetriever', 'OsmLandmarksRetriever', 'RegionalNewsRetriever', 'GeocodingRetriever', 'TransitTripRetriever'],
        parentsOptional: [],
        theRun: EARTH_PULSE_DATA_CODE,
    };
    await nodesStore.save({ id: pulsDataVersionId, type: SerializedDog.name, lineageId: pulsDataDogId, parentId: null, displayName: 'Pulsdata', serializedDogConfig: JSON.stringify(pulsDataCfg), createdAt: new Date() });

    // --- Wave 7: PulsRenderer (lead — generates HTML) ---
    const rendererVersionId = randomUUID();
    const rendererDogId = randomUUID();
    const rendererCfg = {
        id: rendererVersionId, lineageId: rendererDogId, parentId: null,
        displayName: 'PulsRenderer',
        parentsRequired: [pulsDataDogId],
        parentsOptional: [],
        theRun: EARTH_PULSE_RENDERER_CODE,
    };
    await nodesStore.save({ id: rendererVersionId, type: SerializedDog.name, lineageId: rendererDogId, parentId: null, displayName: 'PulsRenderer', serializedDogConfig: JSON.stringify(rendererCfg), createdAt: new Date() });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Puls der Erde',
        description: 'Alles ueber einen Ort: Wetter, Sonne, Luft, Arten, Phaenologie, Landmarks, News, OEPNV — als interaktive Karte',
        emoji: '\uD83C\uDF0D',
        dogIds: [
            rendererDogId,
            pulsDataDogId,
            BASE_DOG_PREFIX + 'QueryRetriever',
            BASE_DOG_PREFIX + 'GeocodingRetriever',
            BASE_DOG_PREFIX + 'WeatherRetriever',
            BASE_DOG_PREFIX + 'SunRetriever',
            BASE_DOG_PREFIX + 'AirQualityRetriever',
            BASE_DOG_PREFIX + 'SpeciesRetriever',
            BASE_DOG_PREFIX + 'PhenologyRetriever',
            BASE_DOG_PREFIX + 'OsmLandmarksRetriever',
            BASE_DOG_PREFIX + 'RegionalNewsRetriever',
            BASE_DOG_PREFIX + 'TransitTripRetriever',
            geoMimic.lineageId,
            newsMimic.lineageId,
            weatherMimic.lineageId,
            sunMimic.lineageId,
            airMimic.lineageId,
            bioMimic.lineageId,
            phenoMimic.lineageId,
            landmarkMimic.lineageId,
            transitMimic.lineageId,
        ],
        defaultQuery: { q: 'Berlin' },
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

    console.log(`\u2705 Seeded Earth Pulse Kennel (kennelId: ${kennelId})`);
}
