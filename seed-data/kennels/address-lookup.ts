import { randomUUID } from 'crypto';
import { IStore } from '../../store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@slopdogs/core';
import { kennelExists, saveKennelSeed, saveMimic } from '../seed-helpers';
export async function seedAddressLookupKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'address-lookup';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // --- Wave 2: Geocoding MimicDog (reads from QueryRetriever) ---
    const geoMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...geoMimic,
        displayName: 'Address → GeocodingQuery',
        imitates: 'GeocodingQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { address: QueryRetriever.address, limit: "1" }`,
    });

    // --- Wave 4: Mimics that read FROM GeocodingRetriever's yield ---
    const weatherMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...weatherMimic,
        displayName: 'Geocoded GPS → WeatherQuery',
        imitates: 'WeatherQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `
const loc = GeocodingRetriever.results[0];
return { lat: String(loc.lat), lng: String(loc.lng) }
`,
    });

    const airMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...airMimic,
        displayName: 'Geocoded GPS → AirQualityQuery',
        imitates: 'AirQualityQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `
const loc = GeocodingRetriever.results[0];
return { lat: String(loc.lat), lng: String(loc.lng) }
`,
    });

    const sunMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...sunMimic,
        displayName: 'Geocoded GPS → SunQuery',
        imitates: 'SunQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `
const loc = GeocodingRetriever.results[0];
return { lat: String(loc.lat), lng: String(loc.lng), days: "3" }
`,
    });

    const transportMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...transportMimic,
        displayName: 'Geocoded GPS → TransportQuery',
        imitates: 'PublicTransportQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `
const loc = GeocodingRetriever.results[0];
return { lat: String(loc.lat), lng: String(loc.lng), radius: "500", results: "5" }
`,
    });

    const wikiMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...wikiMimic,
        displayName: 'Geocoded GPS → WikiQuery',
        imitates: 'WikiNearbyQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `
const loc = GeocodingRetriever.results[0];
return { lat: String(loc.lat), lng: String(loc.lng), radius: "500", limit: "5", lang: "de" }
`,
    });

    // --- Wave 6: Lead dog — combines geocoding result + all data ---
    const leadVersionId = randomUUID();
    const leadDogId = randomUUID();

    const leadCfg = {
        id: leadVersionId,
        lineageId: leadDogId,
        parentId: null,
        displayName: 'Address Lookup Dashboard',
        parentsRequired: [
            'GeocodingRetriever',
            'WeatherRetriever',
            'AirQualityRetriever',
            'SunRetriever',
            'PublicTransportRetriever',
            'WikiNearbyRetriever',
        ],
        parentsOptional: [],
        theRun: `
const geo = GeocodingRetriever.results[0];
const weather = WeatherRetriever;
const air = AirQualityRetriever;
const sun = SunRetriever;
const transport = PublicTransportRetriever;
const wiki = WikiNearbyRetriever;

return {
    resolvedAddress: {
        displayName: geo.displayName,
        lat: geo.lat,
        lng: geo.lng,
        street: geo.address.street,
        city: geo.address.city,
        postcode: geo.address.postcode,
        country: geo.address.country,
    },
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
                line: d.line, mode: d.mode, direction: d.direction, when: d.when,
            })),
        })),
    },
    wikipedia: {
        articleCount: wiki.articleCount,
        articles: wiki.articles.map(a => ({
            title: a.title, distance: a.distance, extract: a.extract,
            url: a.articleUrl, thumbnail: a.thumbnailUrl,
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
        displayName: 'Address Lookup Dashboard',
        serializedDogConfig: JSON.stringify(leadCfg),
        createdAt: new Date(),
    });

    // Kennel config
    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Address Lookup',
        description: 'Adresse eingeben → GPS aufloesen → Wetter, Luft, Sonne, OEPNV, Wikipedia',
        emoji: '\uD83D\uDD0D',
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
        ],
        defaultQuery: { address: 'Brandenburger Tor, Berlin' },
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

    console.log(`\u2705 Seeded Address Lookup Kennel (kennelId: ${kennelId})`);
}
