import { randomUUID } from 'crypto';
import { IStore } from '../../store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@slopdogs/core';
import { kennelExists, saveKennelSeed, saveMimic } from '../seed-helpers';
export async function seedSunKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'sun-kennel';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Sun Query Mapper',
        imitates: 'SunQueryProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng, days: QueryRetriever.days || "7" }`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Sun Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Sun',
        description: 'Sonne: Aufgang, Untergang, Taglaenge, UV-Index per GPS',
        emoji: '\u2600\uFE0F',
        dogIds: [
            BASE_DOG_PREFIX + 'SunRetriever',
            BASE_DOG_PREFIX + 'QueryRetriever',
            mimicDogId,
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

    console.log(`\u2705 Seeded Sun Kennel (kennelId: ${kennelId})`);
}

/**
 * Raises the Wikipedia Nearby kennel from the encyclopaedic void.
 */
export async function seedWikiNearbyKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'wiki-nearby-kennel';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Wiki Nearby Query Mapper',
        imitates: 'WikiNearbyQueryProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `
return {
    lat: QueryRetriever.lat,
    lng: QueryRetriever.lng,
    radius: QueryRetriever.radius || "500",
    limit: QueryRetriever.limit || "10",
    lang: QueryRetriever.lang || "de"
}
`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Wiki Nearby Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Wikipedia Nearby',
        description: 'Wikipedia: Artikel ueber Orte und Sehenswuerdigkeiten in der Naehe',
        emoji: '\uD83D\uDCDA',
        dogIds: [
            BASE_DOG_PREFIX + 'WikiNearbyRetriever',
            BASE_DOG_PREFIX + 'QueryRetriever',
            mimicDogId,
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

    console.log(`\u2705 Seeded Wiki Nearby Kennel (kennelId: ${kennelId})`);
}

/**
 * Raises the geocoding kennel from the map-void.
 * Supports both forward (address -> GPS) and reverse (GPS -> address) via query params.
 */
export async function seedGeocodingKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'geocoding-kennel';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Geocoding Query Mapper',
        imitates: 'GeocodingQueryProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `
return {
    address: QueryRetriever.address || undefined,
    lat: QueryRetriever.lat || undefined,
    lng: QueryRetriever.lng || undefined,
    limit: QueryRetriever.limit || "5"
}
`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Geocoding Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Geocoding',
        description: 'Geocoding: Adresse zu GPS oder GPS zu Adresse (Nominatim/OSM)',
        emoji: '\uD83D\uDCCD',
        dogIds: [
            BASE_DOG_PREFIX + 'GeocodingRetriever',
            BASE_DOG_PREFIX + 'QueryRetriever',
            mimicDogId,
        ],
        defaultQuery: { address: 'Hauptwache, Frankfurt am Main' },
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

    console.log(`\u2705 Seeded Geocoding Kennel (kennelId: ${kennelId})`);
}

/**
 * Isochrone (OpenRouteService): Erreichbarkeit als Polygon vom Mittelpunkt aus.
 * Query: lat, lng, range (Sekunden, Standard 900), optional profile (z. B. foot-walking).
 */
export async function seedIsochroneKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'isochrone-kennel';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Isochrone Query Mapper',
        imitates: 'BloodhoundIsochroneProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `
return {
    lat: QueryRetriever.lat,
    lng: QueryRetriever.lng,
    range: QueryRetriever.range || "900"
}
`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Isochrone Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Isochrone',
        description: 'Erreichbarkeit (Isochrone) vom Punkt aus — OpenRouteService, Profil z. B. zu Fuss oder Rad',
        emoji: '\u23F1\uFE0F',
        dogIds: [
            BASE_DOG_PREFIX + 'BloodhoundIsochroneRetriever',
            BASE_DOG_PREFIX + 'QueryRetriever',
            mimicDogId,
        ],
        defaultQuery: { lat: '50.1109', lng: '8.6821', range: '900' },
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

    console.log(`\u2705 Seeded Isochrone Kennel (kennelId: ${kennelId})`);
}

/**
 * Raises the air quality kennel from the breathing void.
 */
export async function seedAirQualityKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'air-quality-kennel';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'AirQuality Query Mapper',
        imitates: 'AirQualityQueryProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng }`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'AirQuality Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Air Quality',
        description: 'Luftqualitaet: Feinstaub, Ozon, NO2, Pollenflug per GPS',
        emoji: '\uD83C\uDF2B\uFE0F',
        dogIds: [
            BASE_DOG_PREFIX + 'AirQualityRetriever',
            BASE_DOG_PREFIX + 'QueryRetriever',
            mimicDogId,
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

    console.log(`\u2705 Seeded Air Quality Kennel (kennelId: ${kennelId})`);
}

/**
 * Raises the weather kennel from the sky-void — a gathering place
 * for hounds that sniff out atmospheric conditions near GPS coordinates.
 */
export async function seedWeatherKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'weather-kennel';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // Forge the MimicDog that maps query params to WeatherQuery
    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Weather Query Mapper',
        imitates: 'WeatherQueryProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `
return {
    lat: QueryRetriever.lat,
    lng: QueryRetriever.lng,
    time: QueryRetriever.time || undefined,
    date: QueryRetriever.date || undefined
}
`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Weather Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Weather',
        description: 'Wetter: Aktuelle Bedingungen und Vorhersage per GPS',
        emoji: '\u26C5',
        dogIds: [
            BASE_DOG_PREFIX + 'WeatherRetriever',
            BASE_DOG_PREFIX + 'QueryRetriever',
            mimicDogId,
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

    console.log(`\u2705 Seeded Weather Kennel (kennelId: ${kennelId}, mimicDogId: ${mimicDogId})`);
}

/**
 * Raises the wind-map kennel — a wind grid rendered on a Leaflet map.
 * Fetches wind data from Open-Meteo (no API key needed) for a grid of points
 * around the given GPS coordinate, renders an interactive HTML map with arrows.
 *
 * Wave 1: QueryRetriever
 * Wave 2: WindGridFetcher (SerializedDog — fetches Open-Meteo wind for a grid)
 * Wave 3: WindMapRenderer (lead — renders HTML with Leaflet)
 */
export async function seedWindMapKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'wind-map';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // Wave 2: WindGridFetcher
    const fetcherVersionId = randomUUID();
    const fetcherDogId = randomUUID();
    const fetcherCfg = {
        id: fetcherVersionId, lineageId: fetcherDogId, parentId: null,
        displayName: 'WindGridFetcher',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `
var lat = parseFloat(QueryRetriever.lat);
var lng = parseFloat(QueryRetriever.lng);
var spread = parseFloat(QueryRetriever.spread || "0.3");
var steps = parseInt(QueryRetriever.steps || "4");
var points = [];
for (var dy = -steps/2; dy <= steps/2; dy++) {
  for (var dx = -steps/2; dx <= steps/2; dx++) {
    points.push({ lat: +(lat + dy * spread / steps).toFixed(4), lng: +(lng + dx * spread / steps).toFixed(4) });
  }
}
var lats = points.map(function(p){return p.lat}).join(',');
var lngs = points.map(function(p){return p.lng}).join(',');
var url = 'https://api.open-meteo.com/v1/forecast?latitude='+lats+'&longitude='+lngs+'&current=windspeed_10m,winddirection_10m,windgusts_10m,temperature_2m,weathercode&timezone=auto';
var res = await fetch(url);
var data = await res.json();
var results = (Array.isArray(data) ? data : [data]).map(function(d,i) {
  var c = d.current || {};
  return { lat: points[i].lat, lng: points[i].lng, speed: c.windspeed_10m||0, direction: c.winddirection_10m||0, gusts: c.windgusts_10m||0, temp: c.temperature_2m, code: c.weathercode };
});
return { center: {lat:lat, lng:lng}, points: results };
`,
    };
    await nodesStore.save({ id: fetcherVersionId, type: SerializedDog.name, lineageId: fetcherDogId, parentId: null, displayName: 'WindGridFetcher', serializedDogConfig: JSON.stringify(fetcherCfg), createdAt: new Date() });

    // Wave 3: WindMapRenderer (lead)
    const rendererVersionId = randomUUID();
    const rendererDogId = randomUUID();
    const rendererCfg = {
        id: rendererVersionId, lineageId: rendererDogId, parentId: null,
        displayName: 'WindMapRenderer',
        parentsRequired: [fetcherDogId],
        parentsOptional: [],
        theRun: WIND_MAP_RENDERER_CODE,
    };
    await nodesStore.save({ id: rendererVersionId, type: SerializedDog.name, lineageId: rendererDogId, parentId: null, displayName: 'WindMapRenderer', serializedDogConfig: JSON.stringify(rendererCfg), createdAt: new Date() });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Wind Map',
        description: 'Wind-Grid auf Leaflet-Karte — Open-Meteo Windgeschwindigkeit, Richtung, Boeen',
        emoji: '\uD83C\uDF2C\uFE0F',
        dogIds: [
            rendererDogId,
            fetcherDogId,
            BASE_DOG_PREFIX + 'QueryRetriever',
        ],
        defaultQuery: { lat: '54.5997', lng: '9.5142' },
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

    console.log(`\u2705 Seeded Wind Map Kennel (kennelId: ${kennelId})`);
}

const WIND_MAP_RENDERER_CODE = `
var d = Windgridfetcher;
var pts = d.points || [];
var c = d.center || {lat:50,lng:8};
var scriptEnd = '<' + '/script>';

var arrowsJS = '';
pts.forEach(function(wp) {
  var sz = 20 + Math.min(wp.speed, 60) * 0.6;
  var i = Math.min(wp.speed / 50, 1);
  var cr = Math.round(30 + 200*i); var cg = Math.round(120*(1-i)); var cb = Math.round(180*(1-i));
  var col = 'rgb('+cr+','+cg+','+cb+')';
  arrowsJS += 'L.marker(['+wp.lat+','+wp.lng+'],{icon:L.divIcon({className:\\'\\',html:\\'<div style="transform:rotate('+wp.direction+'deg);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="'+sz+'" height="'+sz+'" fill="'+col+'" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4))"><path d="M12 2L8 12h3v8h2v-8h3z"/></svg></div>\\',iconSize:['+sz+','+sz+'],iconAnchor:['+(sz/2)+','+(sz/2)+']})}).addTo(map).bindPopup("<b>'+wp.speed+' km/h</b><br>Richtung: '+wp.direction+'°<br>Böen: '+wp.gusts+' km/h<br>Temp: '+(wp.temp!=null?wp.temp+'°':'?')+'");';
});

var avgWind = 0; var maxGusts = 0; var avgDir = 0; var cnt = 0;
pts.forEach(function(wp) { avgWind += wp.speed; avgDir += wp.direction; cnt++; if(wp.gusts>maxGusts)maxGusts=wp.gusts; });
if (cnt>0) { avgWind=(avgWind/cnt).toFixed(1); avgDir=Math.round(avgDir/cnt); }
var dirNames=['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSW','SW','WSW','W','WNW','NW','NNW'];
var dirName=dirNames[Math.round(avgDir/22.5)%16]||'';

var h = '<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>';
h += '<title>Wind Map</title>';
h += '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>';
h += '<'+'script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js">'+scriptEnd;
h += '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#1a1a2e;color:#eee}';
h += '#map{width:100%;height:70vh;min-height:300px}';
h += '.info{max-width:600px;margin:0 auto;padding:16px}';
h += '.card{background:#16213e;border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid #0f3460}';
h += '.big{font-size:2.5rem;font-weight:700;line-height:1} .sub{color:#8899aa;font-size:0.85rem;margin-top:4px}';
h += '.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px} .gc{text-align:center} .gc-v{font-size:1.3rem;font-weight:700} .gc-l{font-size:0.65rem;color:#8899aa;text-transform:uppercase}';
h += '.sb{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2000;display:flex;gap:4px;background:rgba(22,33,62,0.95);padding:6px 10px;border-radius:22px;border:1px solid #0f3460;backdrop-filter:blur(10px);width:calc(100% - 20px);max-width:340px}';
h += '.sb input{background:transparent;border:none;color:#eee;font-size:0.85rem;flex:1;min-width:0;outline:none} .sb button{background:#e94560;color:#fff;border:none;padding:5px 12px;border-radius:16px;cursor:pointer;font-size:0.75rem}';
h += '</style></head><body>';
h += '<div class="sb"><input id="lat" placeholder="Lat" value="'+c.lat+'" style="width:80px"/><input id="lng" placeholder="Lng" value="'+c.lng+'" style="width:80px"/><button id="go">Wind</button></div>';
h += '<div id="map"></div>';
h += '<div class="info"><div class="card"><div class="big">'+avgWind+' km/h <span style="font-size:1rem;color:#8899aa">'+dirName+'</span></div>';
h += '<div class="sub">Durchschnitt aus '+cnt+' Messpunkten</div>';
h += '<div class="grid"><div class="gc"><div class="gc-v">'+maxGusts+'</div><div class="gc-l">Max Böen km/h</div></div>';
h += '<div class="gc"><div class="gc-v">'+avgDir+'°</div><div class="gc-l">Ø Richtung</div></div>';
h += '<div class="gc"><div class="gc-v">'+cnt+'</div><div class="gc-l">Messpunkte</div></div></div></div></div>';
h += '<'+'script>';
h += 'var map=L.map("map",{zoomControl:true,attributionControl:false}).setView(['+c.lat+','+c.lng+'],11);';
h += 'L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:19}).addTo(map);';
h += arrowsJS;
h += 'document.getElementById("go").addEventListener("click",function(){var u=new URL(window.location);u.searchParams.set("lat",document.getElementById("lat").value);u.searchParams.set("lng",document.getElementById("lng").value);window.location=u.toString()});';
h += scriptEnd + '</body></html>';
return h;
`;

/**
 * Raises the transit-scout kennel — sniffing out complete trip data
 * from nearby transit stations via MOTIS.
 *
 * Wave 1: QueryRetriever (captures ?lat=...&lng=...&distance=...&results=...)
 * Wave 2: Transit Trip Query Mimic (maps query params → TransitTripQuery)
 * Wave 3: TransitTripRetriever (fetches station trips from MOTIS)
 */
