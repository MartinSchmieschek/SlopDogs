/**
 * Volle Base-Dog- und Pact-Registry für development/production.
 * Nur von fullRegistry.ts importieren — nicht in main.ts bündeln, damit Integration weniger Module lädt.
 */
import { QueryRetriever, BodyRetriever, WebSocketChannelRetriever, ChannelLiveSnippetRetriever } from '@slopdogs/core';
import {
    RandomRecipesRetriever,
    RandomEveryThingRetriever,
    CountryFlagBlackLab,
    DishFlagBlackLab,
    FoodPornRetriever,
} from '@slopdogs/dogs-demo';
import { TalkingDog, LayoutInputPact } from '@slopdogs/dogs-talking';
import { WarframeAlertsRetriever } from '@slopdogs/dogs-warframe';
import {
    BloodhoundRouteRetriever,
    BloodhoundIsochroneRetriever,
    OsmLandmarksRetriever,
    OsmTracksRetriever,
    OsmVegetationRetriever,
    OsmFastRoadsRetriever,
    BloodhoundRouteQueryPact,
    BloodhoundIsochronePact,
    NearbyLandmarksPact,
    NearbyTracksPact,
    NearbyVegetationPact,
    NearbyFastRoadsPact,
    DrinkingWaterRetriever,
    DrinkingWaterQueryPact,
    OpenFoodRetriever,
    OpenFoodQueryPact,
    NoiseRetriever,
    NoiseQueryPact,
    PlaygroundRetriever,
    PlaygroundQueryPact,
    ParkingRetriever,
    ParkingQueryPact,
    TrailRetriever,
    TrailQueryPact,
} from '@slopdogs/dogs-geo';
import { HuePlaygroundRetriever, HueBridgeEnvRetriever, HueBridgeQueryPact } from '@slopdogs/dogs-hue';
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
import { AstronomyRetriever, AstronomyQueryPact } from '@slopdogs/dogs-astronomy';
import { WaterRetriever, WaterQueryPact } from '@slopdogs/dogs-water';
import { HistoricalWeatherRetriever, HistoricalWeatherQueryPact } from '@slopdogs/dogs-historical-weather';
import { ChargingStationRetriever, ChargingQueryPact } from '@slopdogs/dogs-charging';
import { CurrencyRetriever, CurrencyQueryPact } from '@slopdogs/dogs-currency';
import { HolidayRetriever, HolidayQueryPact } from '@slopdogs/dogs-holidays';
import { WikiSearchRetriever, WikiSearchQueryPact } from '@slopdogs/dogs-wiki-search';
import { SeasonRetriever, SeasonQueryPact } from '@slopdogs/dogs-season';
import { IPGeoRetriever, IPGeoQueryPact } from '@slopdogs/dogs-ip-geo';
import { RandomFactRetriever, RandomFactQueryPact } from '@slopdogs/dogs-random-fact';
import { SpaceRetriever, SpaceQueryPact } from '@slopdogs/dogs-space';
import { OpenLibraryRetriever, OpenLibraryQueryPact } from '@slopdogs/dogs-open-library';
import { GitHubTrendingRetriever, GitHubTrendingQueryPact } from '@slopdogs/dogs-github-trending';
import { GeoPointPact } from '@slopdogs/geo-pact';
import {
    JokeRetriever, JokeQueryPact,
    DadJokeRetriever, DadJokeQueryPact,
    ChuckNorrisRetriever, ChuckNorrisQueryPact,
} from '@slopdogs/dogs-humor';
import {
    CatFactRetriever, CatFactQueryPact,
    FoxRetriever, FoxQueryPact,
    DuckRetriever, DuckQueryPact,
} from '@slopdogs/dogs-animals-random';
import {
    DictionaryRetriever,
    DatamuseRetriever, DatamuseQueryPact,
    WordQueryPact,
} from '@slopdogs/dogs-dictionary';
import {
    QuoteRetriever, QuoteQueryPact,
    GutenbergRetriever, GutenbergQueryPact,
    WikidataRetriever, WikidataQueryPact,
} from '@slopdogs/dogs-knowledge';
import {
    StarWarsRetriever, RickMortyRetriever, HarryPotterRetriever, GhibliRetriever,
    PopCultureQueryPact,
} from '@slopdogs/dogs-pop-culture';
import {
    MusicBrainzRetriever, MusicBrainzQueryPact,
    LyricsRetriever, LyricsQueryPact,
    RadioBrowserRetriever, RadioBrowserQueryPact,
} from '@slopdogs/dogs-music';
import {
    F1Retriever, F1QueryPact,
    SportsDBRetriever, SportsDbQueryPact,
    ChessRetriever, ChessQueryPact,
} from '@slopdogs/dogs-sports';
import {
    NpmRetriever, NpmQueryPact,
    StackExchangeRetriever, StackExchangeQueryPact,
    GitHubPublicRetriever, GitHubPublicQueryPact,
} from '@slopdogs/dogs-dev';
import {
    AirportRetriever, AirportQueryPact,
    GeoNamesRetriever,
    WikivoyageRetriever, WikivoyageQueryPact,
} from '@slopdogs/dogs-travel';
import {
    TriviaRetriever, TriviaQueryPact,
    BoredRetriever, BoredQueryPact,
    RandomUserRetriever, RandomUserQueryPact,
} from '@slopdogs/dogs-quiz';
import {
    BibleRetriever, BibleQueryPact,
    QuranRetriever, QuranQueryPact,
} from '@slopdogs/dogs-religion';
import {
    DiseaseRetriever, DiseaseQueryPact,
    OpenFdaRetriever, OpenFdaQueryPact,
} from '@slopdogs/dogs-health';
import {
    CocktailRetriever, CocktailQueryPact,
    MealRetriever, MealQueryPact,
} from '@slopdogs/dogs-cuisine';
import {
    WaybackRetriever, WaybackQueryPact,
} from '@slopdogs/dogs-web-archive';
import {
    DogCeoRetriever, DogCeoQueryPact,
    PicsumRetriever, PicsumQueryPact,
    NasaApodRetriever, NasaApodQueryPact,
} from '@slopdogs/dogs-images';
import {
    AgifyRetriever,
    NationalizeRetriever,
    GenderizeRetriever,
    NameQueryPact,
} from '@slopdogs/dogs-name-insights';
import {
    PokeApiRetriever, PokeApiQueryPact,
    DeckOfCardsRetriever, DeckOfCardsQueryPact,
    ScryfallRetriever, ScryfallQueryPact,
} from '@slopdogs/dogs-gaming';
import {
    LibreTranslateRetriever, LibreTranslateQueryPact,
} from '@slopdogs/dogs-translate';
import {
    TvMazeRetriever, TvMazeQueryPact,
} from '@slopdogs/dogs-tv';
import {
    HackerNewsRetriever, HackerNewsQueryPact,
    LemmyRetriever, LemmyQueryPact,
} from '@slopdogs/dogs-social';
import {
    CoinGeckoRetriever, CoinGeckoQueryPact,
} from '@slopdogs/dogs-crypto';

export const allBaseDogClasses = [
    TalkingDog,
    RandomRecipesRetriever,
    CountryFlagBlackLab,
    DishFlagBlackLab,
    RandomEveryThingRetriever,
    FoodPornRetriever,
    QueryRetriever,
    BodyRetriever,
    WarframeAlertsRetriever,
    BloodhoundRouteRetriever,
    BloodhoundIsochroneRetriever,
    OsmLandmarksRetriever,
    OsmTracksRetriever,
    OsmVegetationRetriever,
    OsmFastRoadsRetriever,
    HueBridgeEnvRetriever,
    HuePlaygroundRetriever,
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
    AstronomyRetriever,
    WaterRetriever,
    HistoricalWeatherRetriever,
    ChargingStationRetriever,
    NoiseRetriever,
    ParkingRetriever,
    PlaygroundRetriever,
    DrinkingWaterRetriever,
    OpenFoodRetriever,
    CurrencyRetriever,
    HolidayRetriever,
    WikiSearchRetriever,
    SeasonRetriever,
    IPGeoRetriever,
    RandomFactRetriever,
    SpaceRetriever,
    OpenLibraryRetriever,
    GitHubTrendingRetriever,
    WebSocketChannelRetriever,
    ChannelLiveSnippetRetriever,
    JokeRetriever,
    DadJokeRetriever,
    ChuckNorrisRetriever,
    CatFactRetriever,
    FoxRetriever,
    DuckRetriever,
    DictionaryRetriever,
    DatamuseRetriever,
    QuoteRetriever,
    GutenbergRetriever,
    WikidataRetriever,
    StarWarsRetriever,
    RickMortyRetriever,
    HarryPotterRetriever,
    GhibliRetriever,
    MusicBrainzRetriever,
    LyricsRetriever,
    RadioBrowserRetriever,
    F1Retriever,
    SportsDBRetriever,
    ChessRetriever,
    NpmRetriever,
    StackExchangeRetriever,
    GitHubPublicRetriever,
    AirportRetriever,
    GeoNamesRetriever,
    WikivoyageRetriever,
    TriviaRetriever,
    BoredRetriever,
    RandomUserRetriever,
    BibleRetriever,
    QuranRetriever,
    DiseaseRetriever,
    OpenFdaRetriever,
    CocktailRetriever,
    MealRetriever,
    WaybackRetriever,
    DogCeoRetriever,
    PicsumRetriever,
    NasaApodRetriever,
    AgifyRetriever,
    NationalizeRetriever,
    GenderizeRetriever,
    PokeApiRetriever,
    DeckOfCardsRetriever,
    ScryfallRetriever,
    LibreTranslateRetriever,
    TvMazeRetriever,
    HackerNewsRetriever,
    LemmyRetriever,
    CoinGeckoRetriever,
] as const;

export const allPacts = [
    LayoutInputPact, BloodhoundRouteQueryPact, BloodhoundIsochronePact, NearbyLandmarksPact, NearbyTracksPact, NearbyVegetationPact, NearbyFastRoadsPact, HueBridgeQueryPact, PublicTransportQueryPact, WeatherQueryPact, AirQualityQueryPact, GeocodingQueryPact, WikiNearbyQueryPact, SunQueryPact, BiodiversityQueryPact, BirdQueryPact, PhenologyQueryPact, WebcamQueryPact, RegionalNewsQueryPact, TransitTripQueryPact, ElevationQueryPact, TrailQueryPact, AstronomyQueryPact, WaterQueryPact, HistoricalWeatherQueryPact, ChargingQueryPact, NoiseQueryPact, ParkingQueryPact, PlaygroundQueryPact, DrinkingWaterQueryPact, OpenFoodQueryPact, CurrencyQueryPact, HolidayQueryPact, WikiSearchQueryPact, SeasonQueryPact, IPGeoQueryPact, RandomFactQueryPact, SpaceQueryPact, OpenLibraryQueryPact, GitHubTrendingQueryPact, GeoPointPact, JokeQueryPact, DadJokeQueryPact, ChuckNorrisQueryPact, CatFactQueryPact, FoxQueryPact, DuckQueryPact, WordQueryPact, DatamuseQueryPact, QuoteQueryPact, GutenbergQueryPact, WikidataQueryPact, PopCultureQueryPact, MusicBrainzQueryPact, LyricsQueryPact, RadioBrowserQueryPact, F1QueryPact, SportsDbQueryPact, ChessQueryPact, NpmQueryPact, StackExchangeQueryPact, GitHubPublicQueryPact, AirportQueryPact, WikivoyageQueryPact, TriviaQueryPact, BoredQueryPact, RandomUserQueryPact, BibleQueryPact, QuranQueryPact, DiseaseQueryPact, OpenFdaQueryPact, CocktailQueryPact, MealQueryPact, WaybackQueryPact, DogCeoQueryPact, PicsumQueryPact, NasaApodQueryPact, NameQueryPact, PokeApiQueryPact, DeckOfCardsQueryPact, ScryfallQueryPact, LibreTranslateQueryPact, TvMazeQueryPact, HackerNewsQueryPact, LemmyQueryPact, CoinGeckoQueryPact,
] as const;
