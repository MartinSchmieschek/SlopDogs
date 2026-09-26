import { randomUUID } from 'crypto';
import { IStore } from '../../store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@slopdogs/core';
import { kennelExists, saveKennelSeed, saveMimic } from '../seed-helpers';
export async function seedLocationDashboardKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'location-dashboard';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // We need 5 MimicDogs (one per Pact) + 1 SerializedDog (lead combiner)
    const mimics: Array<{ lineageId: string; versionId: string; displayName: string; imitates: string; theRun: string }> = [
        {
            lineageId: randomUUID(), versionId: randomUUID(),
            displayName: 'Dashboard Weather Mapper',
            imitates: 'WeatherQueryProvider',
            theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng }`,
        },
        {
            lineageId: randomUUID(), versionId: randomUUID(),
            displayName: 'Dashboard AirQuality Mapper',
            imitates: 'AirQualityQueryProvider',
            theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng }`,
        },
        {
            lineageId: randomUUID(), versionId: randomUUID(),
            displayName: 'Dashboard Sun Mapper',
            imitates: 'SunQueryProvider',
            theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng, days: "3" }`,
        },
        {
            lineageId: randomUUID(), versionId: randomUUID(),
            displayName: 'Dashboard Transport Mapper',
            imitates: 'PublicTransportQueryProvider',
            theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng, radius: "500", results: "5" }`,
        },
        {
            lineageId: randomUUID(), versionId: randomUUID(),
            displayName: 'Dashboard Wiki Mapper',
            imitates: 'WikiNearbyQueryProvider',
            theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng, radius: "500", limit: "5", lang: "de" }`,
        },
    ];

    // Save all MimicDogs
    for (const m of mimics) {
        const cfg: IMimicDogConfig = {
            id: m.versionId,
            lineageId: m.lineageId,
            parentId: null,
            displayName: m.displayName,
            imitates: m.imitates,
            parentsRequired: ['QueryRetriever'],
            parentsOptional: [],
            theRun: m.theRun,
        };
        await nodesStore.save({
            id: m.versionId,
            type: SerializedDog.name,
            lineageId: m.lineageId,
            parentId: null,
            displayName: m.displayName,
            serializedDogConfig: JSON.stringify(cfg),
            createdAt: new Date(),
        });
    }

    // Lead dog: SerializedDog that combines all retriever yields
    const leadVersionId = randomUUID();
    const leadDogId = randomUUID();

    const leadCfg = {
        id: leadVersionId,
        lineageId: leadDogId,
        parentId: null,
        displayName: 'Location Dashboard',
        parentsRequired: [
            'WeatherRetriever',
            'AirQualityRetriever',
            'SunRetriever',
            'PublicTransportRetriever',
            'WikiNearbyRetriever',
        ],
        parentsOptional: [],
        theRun: `
const weather = WeatherRetriever;
const air = AirQualityRetriever;
const sun = SunRetriever;
const transport = PublicTransportRetriever;
const wiki = WikiNearbyRetriever;

return {
    location: weather.location,
    weather: {
        temperature: weather.current.temperature,
        apparentTemperature: weather.current.apparentTemperature,
        description: weather.current.weatherDescription,
        humidity: weather.current.humidity,
        windSpeed: weather.current.windSpeed,
    },
    airQuality: {
        aqi: air.current.europeanAqi,
        description: air.current.aqiDescription,
        pm25: air.current.pm25,
        pm10: air.current.pm10,
        pollen: air.pollen,
    },
    sun: {
        sunrise: sun.today.sunrise,
        sunset: sun.today.sunset,
        daylightHours: sun.today.daylightHours,
        uvIndex: sun.today.uvIndexMax,
        uvRisk: sun.today.uvRisk,
    },
    transport: {
        stationCount: transport.stationCount,
        stations: transport.stations.map(s => ({
            name: s.station.name,
            distance: s.station.distance,
            modes: s.station.modes,
            nextDepartures: s.departures.slice(0, 3).map(d => ({
                line: d.line,
                mode: d.mode,
                direction: d.direction,
                when: d.when,
            })),
        })),
    },
    wikipedia: {
        articleCount: wiki.articleCount,
        articles: wiki.articles.map(a => ({
            title: a.title,
            distance: a.distance,
            extract: a.extract,
            url: a.articleUrl,
            thumbnail: a.thumbnailUrl,
        })),
    },
}
`,
    };

    await nodesStore.save({
        id: leadVersionId,
        type: SerializedDog.name,
        lineageId: leadDogId,
        parentId: null,
        displayName: 'Location Dashboard',
        serializedDogConfig: JSON.stringify(leadCfg),
        createdAt: new Date(),
    });

    // Kennel: lead first, then all base dogs, then all mimics
    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Location Dashboard',
        description: 'Alles auf einen Blick: Wetter, Luft, Sonne, OEPNV, Wikipedia — per GPS',
        emoji: '\uD83C\uDF0D',
        dogIds: [
            leadDogId,
            BASE_DOG_PREFIX + 'QueryRetriever',
            BASE_DOG_PREFIX + 'WeatherRetriever',
            BASE_DOG_PREFIX + 'AirQualityRetriever',
            BASE_DOG_PREFIX + 'SunRetriever',
            BASE_DOG_PREFIX + 'PublicTransportRetriever',
            BASE_DOG_PREFIX + 'WikiNearbyRetriever',
            ...mimics.map(m => m.lineageId),
        ],
        defaultQuery: { lat: '50.1109', lng: '8.6821' },
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

    console.log(`\u2705 Seeded Location Dashboard Kennel (kennelId: ${kennelId})`);
}

/**
 * Raises the sun kennel from the celestial void.
 */
