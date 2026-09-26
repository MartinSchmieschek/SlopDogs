/**
 * Schlanke Base-Dog- und Pact-Registry für NODE_ENV=production und integration (weniger RAM/Imports).
 * Lädt nur Pakete, die Seeds + StartupTest + die DB-Kennel-Abdeckung brauchen.
 * Lokal unter NODE_ENV=development wird stattdessen fullRegistry geladen.
 * @see server-registries/fullRegistry.ts für die volle Liste.
 */
import { QueryRetriever, BodyRetriever, WebSocketChannelRetriever, ChannelLiveSnippetRetriever } from '@slopdogs/core';
import {
    RandomRecipesRetriever,
    RandomEveryThingRetriever,
    CountryFlagBlackLab,
    DishFlagBlackLab,
} from '@slopdogs/dogs-demo';
import { TalkingDog, LayoutInputPact } from '@slopdogs/dogs-talking';
import { WarframeAlertsRetriever } from '@slopdogs/dogs-warframe';
import {
    BloodhoundIsochroneRetriever,
    OsmLandmarksRetriever,
    BloodhoundIsochronePact,
    NearbyLandmarksPact,
    TrailRetriever,
    TrailQueryPact,
} from '@slopdogs/dogs-geo';
import { PublicTransportRetriever, PublicTransportQueryPact } from '@slopdogs/dogs-public-transport';
import { WeatherRetriever, WeatherQueryPact } from '@slopdogs/dogs-weather';
import { AirQualityRetriever, AirQualityQueryPact } from '@slopdogs/dogs-air-quality';
import { GeocodingRetriever, GeocodingQueryPact, ElevationRetriever, ElevationQueryPact } from '@slopdogs/dogs-geocoding';
import { WikiNearbyRetriever, WikiNearbyQueryPact } from '@slopdogs/dogs-wikipedia';
import { SunRetriever, SunQueryPact } from '@slopdogs/dogs-sun';
import { SpeciesRetriever, BiodiversityQueryPact } from '@slopdogs/dogs-biodiversity';
import { BirdRetriever, BirdQueryPact } from '@slopdogs/dogs-birds';
import { PhenologyRetriever, PhenologyQueryPact } from '@slopdogs/dogs-phenology';
import { WebcamRetriever, WebcamQueryPact } from '@slopdogs/dogs-webcams';
import { RegionalNewsRetriever, RegionalNewsQueryPact } from '@slopdogs/dogs-regional-news';
import { TransitTripRetriever, TransitTripQueryPact } from '@slopdogs/dogs-transit-trips';

export const allBaseDogClasses = [
    TalkingDog,
    RandomRecipesRetriever,
    CountryFlagBlackLab,
    DishFlagBlackLab,
    RandomEveryThingRetriever,
    QueryRetriever,
    BodyRetriever,
    WarframeAlertsRetriever,
    BloodhoundIsochroneRetriever,
    OsmLandmarksRetriever,
    PublicTransportRetriever,
    WeatherRetriever,
    AirQualityRetriever,
    GeocodingRetriever,
    WikiNearbyRetriever,
    SunRetriever,
    SpeciesRetriever,
    BirdRetriever,
    PhenologyRetriever,
    WebcamRetriever,
    RegionalNewsRetriever,
    TransitTripRetriever,
    ElevationRetriever,
    TrailRetriever,
    WebSocketChannelRetriever,
    ChannelLiveSnippetRetriever,
] as const;

export const allPacts = [
    LayoutInputPact,
    BloodhoundIsochronePact,
    NearbyLandmarksPact,
    PublicTransportQueryPact,
    WeatherQueryPact,
    AirQualityQueryPact,
    GeocodingQueryPact,
    WikiNearbyQueryPact,
    SunQueryPact,
    BiodiversityQueryPact,
    BirdQueryPact,
    PhenologyQueryPact,
    WebcamQueryPact,
    RegionalNewsQueryPact,
    TransitTripQueryPact,
    ElevationQueryPact,
    TrailQueryPact,
] as const;

/** Registrierte Kurznamen (constructor.name) — z. B. Abgleich mit `BASE_DOG_PREFIX + '…'` in seed-data. */
export const SLIM_DEPLOY_BASE_DOG_NAMES: readonly string[] = [
    ...allBaseDogClasses.map((C) => C.name),
    ...allPacts.map((C) => C.name),
] as const;

/** @deprecated Alias — nutze `SLIM_DEPLOY_BASE_DOG_NAMES`. */
export const INTEGRATION_BASE_DOG_NAMES = SLIM_DEPLOY_BASE_DOG_NAMES;
