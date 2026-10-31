/**
 * Volle Base-Dog- und Pact-Registry für development/production.
 * Nur von fullRegistry.ts importieren — nicht in main.ts bündeln, damit Integration weniger Module lädt.
 */
import { QueryRetriever, BodyRetriever, WebSocketChannelRetriever, ChannelLiveSnippetRetriever } from '@martinschmieschek/slopdogs-core';
import {
    RandomRecipesRetriever,
    RandomEveryThingRetriever,
    CountryFlagBlackLab,
    DishFlagBlackLab,
    FoodPornRetriever,
} from '@martinschmieschek/slopdogs-dogs-demo';
import { TalkingDog, LayoutInputPact } from '@martinschmieschek/slopdogs-dogs-talking';
import { WarframeAlertsRetriever } from '@martinschmieschek/slopdogs-dogs-warframe';
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
} from '@martinschmieschek/slopdogs-dogs-geo';
import { HuePlaygroundRetriever, HueBridgeEnvRetriever, HueBridgeQueryPact } from '@martinschmieschek/slopdogs-dogs-hue';
import { PublicTransportRetriever, PublicTransportQueryPact } from '@martinschmieschek/slopdogs-dogs-public-transport';
import { WeatherRetriever, WeatherQueryPact } from '@martinschmieschek/slopdogs-dogs-weather';
import { AirQualityRetriever, AirQualityQueryPact } from '@martinschmieschek/slopdogs-dogs-air-quality';
import { GeocodingRetriever, GeocodingQueryPact, ElevationRetriever, ElevationQueryPact } from '@martinschmieschek/slopdogs-dogs-geocoding';
import { WikiNearbyRetriever, WikiNearbyQueryPact } from '@martinschmieschek/slopdogs-dogs-wikipedia';
import { SunRetriever, SunQueryPact } from '@martinschmieschek/slopdogs-dogs-sun';
import { SpeciesRetriever, BiodiversityQueryPact } from '@martinschmieschek/slopdogs-dogs-biodiversity';
import { BirdRetriever, BirdQueryPact } from '@martinschmieschek/slopdogs-dogs-birds';
import { PhenologyRetriever, PhenologyQueryPact } from '@martinschmieschek/slopdogs-dogs-phenology';
import { WebcamRetriever, WebcamQueryPact } from '@martinschmieschek/slopdogs-dogs-webcams';
import { RegionalNewsRetriever, RegionalNewsQueryPact } from '@martinschmieschek/slopdogs-dogs-regional-news';
import { TransitTripRetriever, TransitTripQueryPact } from '@martinschmieschek/slopdogs-dogs-transit-trips';
import { AstronomyRetriever, AstronomyQueryPact } from '@martinschmieschek/slopdogs-dogs-astronomy';
import { WaterRetriever, WaterQueryPact } from '@martinschmieschek/slopdogs-dogs-water';
import { HistoricalWeatherRetriever, HistoricalWeatherQueryPact } from '@martinschmieschek/slopdogs-dogs-historical-weather';
import { ChargingStationRetriever, ChargingQueryPact } from '@martinschmieschek/slopdogs-dogs-charging';
import { CurrencyRetriever, CurrencyQueryPact } from '@martinschmieschek/slopdogs-dogs-currency';
import { HolidayRetriever, HolidayQueryPact } from '@martinschmieschek/slopdogs-dogs-holidays';
import { WikiSearchRetriever, WikiSearchQueryPact } from '@martinschmieschek/slopdogs-dogs-wiki-search';
import { SeasonRetriever, SeasonQueryPact } from '@martinschmieschek/slopdogs-dogs-season';
import { IPGeoRetriever, IPGeoQueryPact } from '@martinschmieschek/slopdogs-dogs-ip-geo';
import { RandomFactRetriever, RandomFactQueryPact } from '@martinschmieschek/slopdogs-dogs-random-fact';
import { SpaceRetriever, SpaceQueryPact } from '@martinschmieschek/slopdogs-dogs-space';
import { OpenLibraryRetriever, OpenLibraryQueryPact } from '@martinschmieschek/slopdogs-dogs-open-library';
import { GitHubTrendingRetriever, GitHubTrendingQueryPact } from '@martinschmieschek/slopdogs-dogs-github-trending';
import { GeoPointPact } from '@martinschmieschek/slopdogs-geo-pact';
import {
    JokeRetriever,
    JokeQueryPact,
    DadJokeRetriever,
    DadJokeQueryPact,
    ChuckNorrisRetriever,
    ChuckNorrisQueryPact,
} from '@martinschmieschek/slopdogs-dogs-humor';
import {
    CatFactRetriever,
    CatFactQueryPact,
    FoxRetriever,
    FoxQueryPact,
    DuckRetriever,
    DuckQueryPact,
} from '@martinschmieschek/slopdogs-dogs-animals-random';
import { DictionaryRetriever, DatamuseRetriever, DatamuseQueryPact, WordQueryPact } from '@martinschmieschek/slopdogs-dogs-dictionary';
import {
    QuoteRetriever,
    QuoteQueryPact,
    GutenbergRetriever,
    GutenbergQueryPact,
    WikidataRetriever,
    WikidataQueryPact,
} from '@martinschmieschek/slopdogs-dogs-knowledge';
import {
    StarWarsRetriever,
    RickMortyRetriever,
    HarryPotterRetriever,
    GhibliRetriever,
    PopCultureQueryPact,
} from '@martinschmieschek/slopdogs-dogs-pop-culture';
import {
    MusicBrainzRetriever,
    MusicBrainzQueryPact,
    LyricsRetriever,
    LyricsQueryPact,
    RadioBrowserRetriever,
    RadioBrowserQueryPact,
} from '@martinschmieschek/slopdogs-dogs-music';
import {
    F1Retriever,
    F1QueryPact,
    SportsDBRetriever,
    SportsDbQueryPact,
    ChessRetriever,
    ChessQueryPact,
} from '@martinschmieschek/slopdogs-dogs-sports';
import {
    NpmRetriever,
    NpmQueryPact,
    StackExchangeRetriever,
    StackExchangeQueryPact,
    GitHubPublicRetriever,
    GitHubPublicQueryPact,
} from '@martinschmieschek/slopdogs-dogs-dev';
import {
    AirportRetriever,
    AirportQueryPact,
    GeoNamesRetriever,
    WikivoyageRetriever,
    WikivoyageQueryPact,
} from '@martinschmieschek/slopdogs-dogs-travel';
import {
    TriviaRetriever,
    TriviaQueryPact,
    BoredRetriever,
    BoredQueryPact,
    RandomUserRetriever,
    RandomUserQueryPact,
} from '@martinschmieschek/slopdogs-dogs-quiz';
import { BibleRetriever, BibleQueryPact, QuranRetriever, QuranQueryPact } from '@martinschmieschek/slopdogs-dogs-religion';
import { DiseaseRetriever, DiseaseQueryPact, OpenFdaRetriever, OpenFdaQueryPact } from '@martinschmieschek/slopdogs-dogs-health';
import { CocktailRetriever, CocktailQueryPact, MealRetriever, MealQueryPact } from '@martinschmieschek/slopdogs-dogs-cuisine';
import { WaybackRetriever, WaybackQueryPact } from '@martinschmieschek/slopdogs-dogs-web-archive';
import {
    DogCeoRetriever,
    DogCeoQueryPact,
    PicsumRetriever,
    PicsumQueryPact,
    NasaApodRetriever,
    NasaApodQueryPact,
} from '@martinschmieschek/slopdogs-dogs-images';
import { AgifyRetriever, NationalizeRetriever, GenderizeRetriever, NameQueryPact } from '@martinschmieschek/slopdogs-dogs-name-insights';
import {
    PokeApiRetriever,
    PokeApiQueryPact,
    DeckOfCardsRetriever,
    DeckOfCardsQueryPact,
    ScryfallRetriever,
    ScryfallQueryPact,
} from '@martinschmieschek/slopdogs-dogs-gaming';
import { LibreTranslateRetriever, LibreTranslateQueryPact } from '@martinschmieschek/slopdogs-dogs-translate';
import { TvMazeRetriever, TvMazeQueryPact } from '@martinschmieschek/slopdogs-dogs-tv';
import { HackerNewsRetriever, HackerNewsQueryPact, LemmyRetriever, LemmyQueryPact } from '@martinschmieschek/slopdogs-dogs-social';
import { CoinGeckoRetriever, CoinGeckoQueryPact } from '@martinschmieschek/slopdogs-dogs-crypto';

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
    LayoutInputPact,
    BloodhoundRouteQueryPact,
    BloodhoundIsochronePact,
    NearbyLandmarksPact,
    NearbyTracksPact,
    NearbyVegetationPact,
    NearbyFastRoadsPact,
    HueBridgeQueryPact,
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
    AstronomyQueryPact,
    WaterQueryPact,
    HistoricalWeatherQueryPact,
    ChargingQueryPact,
    NoiseQueryPact,
    ParkingQueryPact,
    PlaygroundQueryPact,
    DrinkingWaterQueryPact,
    OpenFoodQueryPact,
    CurrencyQueryPact,
    HolidayQueryPact,
    WikiSearchQueryPact,
    SeasonQueryPact,
    IPGeoQueryPact,
    RandomFactQueryPact,
    SpaceQueryPact,
    OpenLibraryQueryPact,
    GitHubTrendingQueryPact,
    GeoPointPact,
    JokeQueryPact,
    DadJokeQueryPact,
    ChuckNorrisQueryPact,
    CatFactQueryPact,
    FoxQueryPact,
    DuckQueryPact,
    WordQueryPact,
    DatamuseQueryPact,
    QuoteQueryPact,
    GutenbergQueryPact,
    WikidataQueryPact,
    PopCultureQueryPact,
    MusicBrainzQueryPact,
    LyricsQueryPact,
    RadioBrowserQueryPact,
    F1QueryPact,
    SportsDbQueryPact,
    ChessQueryPact,
    NpmQueryPact,
    StackExchangeQueryPact,
    GitHubPublicQueryPact,
    AirportQueryPact,
    WikivoyageQueryPact,
    TriviaQueryPact,
    BoredQueryPact,
    RandomUserQueryPact,
    BibleQueryPact,
    QuranQueryPact,
    DiseaseQueryPact,
    OpenFdaQueryPact,
    CocktailQueryPact,
    MealQueryPact,
    WaybackQueryPact,
    DogCeoQueryPact,
    PicsumQueryPact,
    NasaApodQueryPact,
    NameQueryPact,
    PokeApiQueryPact,
    DeckOfCardsQueryPact,
    ScryfallQueryPact,
    LibreTranslateQueryPact,
    TvMazeQueryPact,
    HackerNewsQueryPact,
    LemmyQueryPact,
    CoinGeckoQueryPact,
] as const;
