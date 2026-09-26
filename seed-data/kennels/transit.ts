import { randomUUID } from 'crypto';
import { IStore } from '../../store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@slopdogs/core';
import { kennelExists, saveKennelSeed, saveMimic } from '../seed-helpers';
export async function seedPublicTransportKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'public-transport-kennel';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return; // Already seeded, disturb it not

    // Forge the MimicDog that maps query params to PublicTransportQuery
    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'DB GPS Query Mapper',
        imitates: 'PublicTransportQueryProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `
return {
    lat: QueryRetriever.lat,
    lng: QueryRetriever.lng,
    radius: QueryRetriever.distance || QueryRetriever.radius || "1000",
    results: QueryRetriever.results || "8"
}
`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'DB GPS Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    // Raise the kennel: PublicTransportRetriever as lead, plus QueryRetriever and the MimicDog
    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Public Transport Nearby',
        description: 'OEPNV: Haltestellen und Abfahrten in der Naehe (Bus, Tram, U-Bahn, S-Bahn, Zug)',
        emoji: '\uD83D\uDE82',
        dogIds: [
            BASE_DOG_PREFIX + 'PublicTransportRetriever',
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

    console.log(`\u2705 Seeded DB Nearby Kennel (kennelId: ${kennelId}, mimicDogId: ${mimicDogId})`);
}

export async function seedTransitScoutKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'transit-scout';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Transit Trip Query Mapper',
        imitates: 'TransitTripQueryProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `
return {
    lat: QueryRetriever.lat,
    lng: QueryRetriever.lng,
    radius: QueryRetriever.distance || QueryRetriever.radius || "1000",
    stations: QueryRetriever.stations || "5",
    line: QueryRetriever.line || undefined,
    limit: QueryRetriever.results || QueryRetriever.limit || "10"
}
`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Transit Trip Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Transit Scout',
        description: 'Komplette Bus- und Bahn-Trips in der Naehe — Stationen, Linien, Fahrplaene via MOTIS',
        emoji: '\uD83D\uDE8C',
        dogIds: [
            BASE_DOG_PREFIX + 'TransitTripRetriever',
            BASE_DOG_PREFIX + 'QueryRetriever',
            mimicDogId,
        ],
        defaultQuery: { lat: '50.1109', lng: '8.6821', distance: '3000', results: '50' },
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

    // Wave 4: TransitRenderer (lead — renders HTML with Leaflet map + trip cards)
    const rendererVersionId = randomUUID();
    const rendererDogId = randomUUID();
    const rendererCfg = {
        id: rendererVersionId, lineageId: rendererDogId, parentId: null,
        displayName: 'TransitRenderer',
        parentsRequired: ['TransitTripRetriever', 'QueryRetriever'],
        parentsOptional: [],
        theRun: TRANSIT_RENDERER_CODE,
    };
    await nodesStore.save({ id: rendererVersionId, type: SerializedDog.name, lineageId: rendererDogId, parentId: null, displayName: 'TransitRenderer', serializedDogConfig: JSON.stringify(rendererCfg), createdAt: new Date() });

    // Update kennelConfig to use renderer as lead
    kennelConfig.dogIds = [rendererDogId, ...kennelConfig.dogIds];

    await saveKennelSeed(kennelsStore, kennelConfig.id, {
        name: kennelConfig.name,
        description: kennelConfig.description,
        emoji: kennelConfig.emoji,
        dogIds: kennelConfig.dogIds,
        defaultQuery: kennelConfig.defaultQuery,
        defaultBody: undefined,
    });

    console.log(`\u2705 Seeded Transit Scout Kennel (kennelId: ${kennelId})`);
}

/**
 * Wie transit-scout (MOTIS: Trips/Haltestellen), aber nur JSON — kein HTML-Lead.
 * Query: lat, lng, distance, results (→ limit), optional stations, line.
 */

export async function seedTransitScoutJsonKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'transit-scout-json';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Transit Trip JSON Query Mapper',
        imitates: 'TransitTripQueryProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `
return {
    lat: QueryRetriever.lat,
    lng: QueryRetriever.lng,
    radius: QueryRetriever.distance || QueryRetriever.radius || "3000",
    stations: QueryRetriever.stations || "5",
    line: QueryRetriever.line || undefined,
    limit: QueryRetriever.results || QueryRetriever.limit || "50"
}
`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Transit Trip JSON Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Transit Scout (JSON)',
        description: 'OEPNV-Trips (MOTIS) als JSON — gleiche Parameter wie transit-scout, ohne Karte',
        emoji: '\uD83D\uDCE6',
        dogIds: [
            BASE_DOG_PREFIX + 'TransitTripRetriever',
            BASE_DOG_PREFIX + 'QueryRetriever',
            mimicDogId,
        ],
        defaultQuery: { lat: '50.1109', lng: '8.6821', distance: '3000', results: '50' },
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

    console.log(`\u2705 Seeded Transit Scout JSON Kennel (kennelId: ${kennelId})`);
}

const TRANSIT_RENDERER_CODE = `
var tr = TransitTripRetriever;
var lat = parseFloat(QueryRetriever.lat);
var lng = parseFloat(QueryRetriever.lng);
var trips = (tr.trips || []);
var lineColors = ['#e11d48','#2563eb','#16a34a','#9333ea','#ea580c','#0891b2','#c026d3','#4f46e5','#059669','#d97706','#7c3aed','#0d9488'];
var scriptEnd = '<' + '/script>';

var transitJS = '';
var cards = '';
trips.forEach(function(trip, i) {
  var color = lineColors[i % lineColors.length];
  var stops = trip.stops || [];
  var coords = '';
  stops.forEach(function(s, j) { if (s.lat && s.lng) { if (j > 0) coords += ','; coords += '['+s.lat+','+s.lng+']'; } });
  if (coords) {
    transitJS += 'L.polyline(['+coords+'],{color:"'+color+'",weight:4,opacity:0.8}).addTo(map);';
    stops.forEach(function(s) {
      if (s.lat && s.lng) {
        transitJS += 'L.circleMarker(['+s.lat+','+s.lng+'],{radius:4,fillColor:"'+color+'",color:"#fff",weight:1,fillOpacity:0.9}).addTo(map).bindPopup("<b>'+(s.name||'').replace(/'/g,'')+'</b>");';
      }
    });
  }
  var depStr = stops[0] && (stops[0].departure||stops[0].scheduledDeparture) ? new Date(stops[0].departure||stops[0].scheduledDeparture).toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}) : '?';
  var arrStr = stops.length && (stops[stops.length-1].arrival||stops[stops.length-1].scheduledArrival) ? new Date(stops[stops.length-1].arrival||stops[stops.length-1].scheduledArrival).toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}) : '?';
  var first = (stops[0]||{}).name||'';
  var last = (stops[stops.length-1]||{}).name||'';
  var dur = null;
  if (stops[0] && stops[stops.length-1]) {
    var d1 = stops[0].departure||stops[0].scheduledDeparture;
    var d2 = stops[stops.length-1].arrival||stops[stops.length-1].scheduledArrival;
    if (d1&&d2) dur = Math.round((new Date(d2)-new Date(d1))/60000);
  }
  cards += '<div class="tc"><div class="tc-h"><span class="tc-l" style="background:'+color+'">'+(trip.lineName||'?')+'</span><span class="tc-m">'+(trip.mode||'')+'</span>';
  if (dur) cards += '<span class="tc-d">'+dur+' min</span>';
  cards += '</div><div class="tc-dir">'+(trip.headsign||last)+'</div>';
  cards += '<div class="tc-r">'+first+' <span style="color:#888">→</span> '+last+'</div>';
  cards += '<div class="tc-t">'+depStr+' → '+arrStr+'</div>';
  cards += '<div class="tc-s">'+stops.length+' Halte</div></div>';
});

var h = '<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>';
h += '<title>Transit Scout</title>';
h += '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>';
h += '<'+'script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js">'+scriptEnd;
h += '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#fafaf8;color:#333}';
h += '#map{width:100%;height:50vh;min-height:280px}';
h += '.ct{max-width:680px;margin:0 auto;padding:12px 14px 40px}';
h += '.hd{font-size:1.5rem;font-weight:700;margin:16px 0 8px;color:#1a1a1a} .hd span{font-size:0.85rem;color:#888;font-weight:400}';
h += '.tc{background:#fff;border-radius:10px;padding:10px 12px;border:1px solid #e5e5e0;margin-bottom:8px}';
h += '.tc-h{display:flex;align-items:center;gap:8px} .tc-l{color:#fff;font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:4px} .tc-m{font-size:0.68rem;color:#999;text-transform:uppercase} .tc-d{font-size:0.72rem;color:#1a1a1a;font-weight:600;margin-left:auto}';
h += '.tc-dir{font-size:0.9rem;font-weight:600;color:#1a1a1a;margin-top:4px} .tc-r{font-size:0.82rem;color:#555;margin-top:2px} .tc-t{font-size:0.75rem;color:#888;margin-top:2px} .tc-s{font-size:0.65rem;color:#bbb;margin-top:2px}';
h += '.sb{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2000;display:flex;gap:4px;background:rgba(255,255,255,0.95);padding:6px 10px;border-radius:22px;border:1px solid #ddd;backdrop-filter:blur(10px);box-shadow:0 2px 10px rgba(0,0,0,0.07);width:calc(100% - 20px);max-width:400px}';
h += '.sb input{background:transparent;border:none;color:#333;font-size:0.85rem;flex:1;min-width:0;outline:none} .sb button{background:#2563eb;color:#fff;border:none;padding:5px 12px;border-radius:16px;cursor:pointer;font-size:0.75rem}';
h += '</style></head><body>';
h += '<div class="sb"><input id="lat" placeholder="Lat" value="'+lat+'" style="width:70px"/><input id="lng" placeholder="Lng" value="'+lng+'" style="width:70px"/><button id="go">Suchen</button></div>';
h += '<div id="map"></div>';
h += '<div class="ct"><div class="hd">🚌 '+trips.length+' Linien <span>in der Nähe</span></div>';
h += cards;
h += '</div>';
h += '<'+'script>';
h += 'var map=L.map("map",{zoomControl:true,attributionControl:false}).setView(['+lat+','+lng+'],14);';
h += 'L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);';
h += 'L.marker(['+lat+','+lng+']).addTo(map);';
h += transitJS;
h += 'document.getElementById("go").addEventListener("click",function(){var u=new URL(window.location);u.searchParams.set("lat",document.getElementById("lat").value);u.searchParams.set("lng",document.getElementById("lng").value);window.location=u.toString()});';
h += scriptEnd + '</body></html>';
return h;
`;

/**
 * Raises the naturkundler kennel — a gathering of nature dogs.
 * Birds, species, phenology — all three sniff the same GPS coordinates,
 * a SerializedDog lead combines their catches.
 *
 * Wave 1: QueryRetriever (captures ?lat=...&lng=...&radius=...)
 * Wave 2: Bird/Biodiversity/Phenology Query Mimics (map params → respective Pacts)
 * Wave 3: BirdRetriever + SpeciesRetriever + PhenologyRetriever (parallel)
 * Wave 4: Naturkundler Lead (combines all yields)
 */
