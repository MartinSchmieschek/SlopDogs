import { randomUUID } from 'crypto';
import { IStore } from '../../store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@slopdogs/core';
import { kennelExists, saveKennelSeed, saveMimic } from '../seed-helpers';
export async function seedNaturkundlerKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'naturkundler';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // --- Wave 2: Bird Query Mimic ---
    const birdMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...birdMimic,
        displayName: 'NK: GPS → Bird Query',
        imitates: 'BirdQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng, radius: QueryRetriever.radius || "10", back: QueryRetriever.back || "14" }`,
    });

    // --- Wave 2: Biodiversity Query Mimic ---
    const bioMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...bioMimic,
        displayName: 'NK: GPS → Biodiversity Query',
        imitates: 'BiodiversityQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng, radius: QueryRetriever.radius || "10", taxon: QueryRetriever.taxon || undefined, months: QueryRetriever.months || undefined }`,
    });

    // --- Wave 2: Phenology Query Mimic ---
    const phenoMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...phenoMimic,
        displayName: 'NK: GPS → Phenology Query',
        imitates: 'PhenologyQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng, date: QueryRetriever.date || undefined }`,
    });

    // --- Wave 4: Lead dog — combines nature data ---
    const leadVersionId = randomUUID();
    const leadDogId = randomUUID();

    const leadCfg = {
        id: leadVersionId,
        lineageId: leadDogId,
        parentId: null,
        displayName: 'Naturkundler',
        parentsRequired: ['SpeciesRetriever', 'PhenologyRetriever'],
        parentsOptional: ['BirdRetriever'],
        theRun: `
const species = SpeciesRetriever;
const pheno = PhenologyRetriever;

const result = {
    biodiversity: {
        observationCount: species.observations.length,
        observations: species.observations.slice(0, 20).map(o => ({
            name: o.speciesName,
            scientificName: o.scientificName,
            taxon: o.iconicTaxon,
            photo: o.photoUrl,
            date: o.observedOn,
            place: o.placeGuess,
            lat: o.location ? o.location.lat : null,
            lng: o.location ? o.location.lng : null,
        })),
    },
    phenology: {
        phase: pheno.currentPhase,
        date: pheno.date,
        hemisphere: pheno.hemisphere,
        info: pheno.seasonalInfo,
        upcoming: pheno.upcomingPhase,
    },
};

if (typeof BirdRetriever !== 'undefined') {
    const birds = BirdRetriever;
    result.birds = {
        totalSpecies: birds.totalSpecies,
        recentCount: birds.recentObservations.length,
        notableCount: birds.notableObservations.length,
        recentObservations: birds.recentObservations.slice(0, 15).map(o => ({
            name: o.commonName,
            scientificName: o.scientificName,
            count: o.count,
            location: o.location,
            date: o.observationDate,
            isNotable: o.isNotable,
        })),
        notableObservations: birds.notableObservations.slice(0, 10).map(o => ({
            name: o.commonName,
            scientificName: o.scientificName,
            count: o.count,
            location: o.location,
            date: o.observationDate,
        })),
    };
}

return result
`,
    };

    await nodesStore.save({
        id: leadVersionId,
        type: SerializedDog.name,
        lineageId: leadDogId,
        parentId: null,
        displayName: 'Naturkundler',
        serializedDogConfig: JSON.stringify(leadCfg),
        createdAt: new Date(),
    });

    // Wave 5: NaturRenderer (lead — renders HTML)
    const rendererVersionId = randomUUID();
    const rendererDogId = randomUUID();
    const rendererCfg = {
        id: rendererVersionId, lineageId: rendererDogId, parentId: null,
        displayName: 'NaturRenderer',
        parentsRequired: [leadDogId, 'QueryRetriever'],
        parentsOptional: [],
        theRun: NATUR_RENDERER_CODE,
    };
    await nodesStore.save({ id: rendererVersionId, type: SerializedDog.name, lineageId: rendererDogId, parentId: null, displayName: 'NaturRenderer', serializedDogConfig: JSON.stringify(rendererCfg), createdAt: new Date() });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Naturkundler',
        description: 'Voegel, Arten, Bluehphasen — Natur-Dashboard per GPS',
        emoji: '\uD83E\uDD89',
        dogIds: [
            rendererDogId,
            leadDogId,
            BASE_DOG_PREFIX + 'QueryRetriever',
            BASE_DOG_PREFIX + 'BirdRetriever',
            BASE_DOG_PREFIX + 'SpeciesRetriever',
            BASE_DOG_PREFIX + 'PhenologyRetriever',
            birdMimic.lineageId,
            bioMimic.lineageId,
            phenoMimic.lineageId,
        ],
        defaultQuery: { lat: '50.1109', lng: '8.6821', radius: '10' },
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

    console.log(`\u2705 Seeded Naturkundler Kennel (kennelId: ${kennelId})`);
}

const NATUR_RENDERER_CODE = `
var d = Naturkundler;
var lat = parseFloat(QueryRetriever.lat);
var lng = parseFloat(QueryRetriever.lng);
var bio = d.biodiversity || {};
var ph = d.phenology || {};
var birds = d.birds || null;
var scriptEnd = '<' + '/script>';

var speciesJS = '';
(bio.observations || []).forEach(function(o) {
  if (o.lat && o.lng) {
    speciesJS += 'L.circleMarker(['+o.lat+','+o.lng+'],{radius:6,fillColor:"#16a34a",color:"#fff",weight:1,fillOpacity:0.85}).addTo(map).bindPopup("<b>'+(o.name||o.scientificName||'?').replace(/'/g,'')+'</b><br><i>'+(o.scientificName||'')+'</i><br>'+(o.taxon||'')+'");';
  }
});

var speciesCards = '';
(bio.observations || []).forEach(function(o) {
  speciesCards += '<div class="spc">';
  if (o.photo) speciesCards += '<img src="'+o.photo+'" onerror="this.style.display=\\'none\\'" loading="lazy"/>';
  speciesCards += '<div class="si"><strong>'+(o.name||o.scientificName||'?')+'</strong><span>'+(o.taxon||'')+'</span>';
  if (o.place) speciesCards += '<span class="pl">'+o.place+'</span>';
  speciesCards += '</div></div>';
});

var plantsHtml = '';
((ph.phase||{}).typicalBloom||(ph.phase||{}).indicatorPlants||[]).forEach(function(p) { plantsHtml += '<span class="tg tg-g">'+p+'</span>'; });
var faunaHtml = '';
((ph.phase||{}).typicalFauna||[]).forEach(function(f) { faunaHtml += '<span class="tg tg-a">'+f+'</span>'; });

var birdCards = '';
if (birds) {
  (birds.recentObservations||[]).forEach(function(b) {
    birdCards += '<div class="bc"><strong>'+b.name+'</strong><span>'+b.scientificName+'</span>';
    if (b.count) birdCards += '<span class="cnt">'+b.count+'x</span>';
    birdCards += '<span class="loc">'+b.location+' · '+b.date+'</span></div>';
  });
}

var h = '<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>';
h += '<title>Naturkundler</title>';
h += '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>';
h += '<'+'script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js">'+scriptEnd;
h += '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,serif;background:#f5f7f0;color:#333}';
h += '#map{width:100%;height:45vh;min-height:260px}';
h += '.ct{max-width:680px;margin:0 auto;padding:12px 14px 40px}';
h += '.sec{margin-bottom:32px} .sec-t{font-size:1.15rem;color:#1a1a1a;margin-bottom:8px;border-bottom:2px solid #d4e0c8;padding-bottom:5px}';
h += '.sr{display:flex;gap:10px;overflow-x:auto;padding:6px 0;-webkit-overflow-scrolling:touch} .sr::-webkit-scrollbar{height:3px} .sr::-webkit-scrollbar-thumb{background:#ccc;border-radius:2px}';
h += '.spc{flex:0 0 150px;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #d4e0c8} .spc img{width:100%;height:100px;object-fit:cover}';
h += '.si{padding:8px} .si strong{display:block;font-size:0.8rem;color:#1a1a1a} .si span{display:block;font-size:0.68rem;color:#888} .si .pl{color:#16a34a;font-size:0.65rem;margin-top:2px}';
h += '.tg{display:inline-block;padding:3px 10px;border-radius:14px;font-size:0.72rem;margin:2px;font-family:system-ui,sans-serif} .tg-g{background:#dcfce7;color:#166534} .tg-a{background:#fef3c7;color:#92400e}';
h += '.bc{background:#fff;border-radius:8px;padding:8px 10px;border:1px solid #d4e0c8;margin-bottom:6px} .bc strong{font-size:0.85rem;color:#1a1a1a;display:block} .bc span{font-size:0.7rem;color:#888;display:block} .bc .cnt{color:#16a34a;font-weight:600} .bc .loc{font-size:0.65rem;color:#bbb}';
h += '.pr{font-size:0.95rem;line-height:1.7;color:#555} .pr strong{color:#1a1a1a}';
h += '.sb{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2000;display:flex;gap:4px;background:rgba(245,247,240,0.95);padding:6px 10px;border-radius:22px;border:1px solid #d4e0c8;backdrop-filter:blur(10px);box-shadow:0 2px 10px rgba(0,0,0,0.05);width:calc(100% - 20px);max-width:340px}';
h += '.sb input{background:transparent;border:none;color:#333;font-size:0.85rem;flex:1;min-width:0;outline:none} .sb button{background:#16a34a;color:#fff;border:none;padding:5px 12px;border-radius:16px;cursor:pointer;font-size:0.75rem}';
h += '</style></head><body>';
h += '<div class="sb"><input id="lat" placeholder="Lat" value="'+lat+'" style="width:70px"/><input id="lng" placeholder="Lng" value="'+lng+'" style="width:70px"/><button id="go">Suchen</button></div>';
h += '<div id="map"></div>';
h += '<div class="ct">';

// Phenology
var phaseName = (ph.phase||{}).name || (ph.phase||{}).nameEn || 'Jahreszeit';
h += '<div class="sec"><div class="sec-t">🌸 '+phaseName+'</div>';
h += '<div class="pr"><strong>'+phaseName+'</strong>';
h += (ph.info ? ' — '+ph.info : '') + '</div>';
h += '<div style="margin-top:6px">'+plantsHtml+'</div>'+faunaHtml+'</div>';

// Species
h += '<div class="sec"><div class="sec-t">🦎 '+(bio.observationCount||bio.observations?.length||0)+' Artbeobachtungen</div>';
h += '<div class="sr">'+speciesCards+'</div></div>';

// Birds
if (birds) {
  h += '<div class="sec"><div class="sec-t">🐦 '+(birds.totalSpecies||0)+' Vogelarten';
  if (birds.notableCount) h += ' <span style="color:#ea580c;font-size:0.8rem">('+birds.notableCount+' selten)</span>';
  h += '</div>' + birdCards + '</div>';
}

h += '</div>';
h += '<'+'script>';
h += 'var map=L.map("map",{zoomControl:true,attributionControl:false}).setView(['+lat+','+lng+'],12);';
h += 'L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);';
h += speciesJS;
h += 'document.getElementById("go").addEventListener("click",function(){var u=new URL(window.location);u.searchParams.set("lat",document.getElementById("lat").value);u.searchParams.set("lng",document.getElementById("lng").value);window.location=u.toString()});';
h += scriptEnd+'</body></html>';
return h;
`;

/**
 * Raises the elevation kennel — a single hound that fetches meters above sea level.
 *
 * Wave 1: QueryRetriever (captures ?lat=...&lng=...)
 * Wave 2: Elevation Query Mimic (maps query params → ElevationQuery)
 * Wave 3: ElevationRetriever (fetches elevation from Open-Meteo)
 */
export async function seedElevationKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'elevation-kennel';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Elevation Query Mapper',
        imitates: 'ElevationQueryProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng }`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Elevation Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Elevation',
        description: 'Elevation: meters above sea level from GPS (Open-Meteo)',
        emoji: '\u26F0\uFE0F',
        dogIds: [
            BASE_DOG_PREFIX + 'ElevationRetriever',
            BASE_DOG_PREFIX + 'QueryRetriever',
            mimicDogId,
        ],
        defaultQuery: { lat: '47.3769,47.3800,47.3850,47.3900', lng: '8.5417,8.5500,8.5600,8.5700' },
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

    console.log(`\u2705 Seeded Elevation Kennel (kennelId: ${kennelId})`);
}

/**
 * Raises the trail-scout kennel — hiking trails and cycling routes on a Leaflet map,
 * enriched with elevation data. Data/Renderer separation.
 *
 * Wave 1: QueryRetriever
 * Wave 2: Trail Query Mimic + Elevation Query Mimic
 * Wave 3: TrailRetriever + ElevationRetriever (parallel)
 * Wave 4: TrailScoutData (combines trails + elevation into JSON)
 * Wave 5: TrailScoutRenderer (lead — renders HTML with Leaflet map)
 */
export async function seedTrailScoutKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'trail-scout';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // --- Wave 2: Trail Query Mimic ---
    const trailMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...trailMimic,
        displayName: 'TS: GPS → Trail Query',
        imitates: 'TrailQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng, radius: QueryRetriever.radius || "3000", type: QueryRetriever.type || "both" }`,
    });

    // --- Wave 2: Elevation Query Mimic ---
    const elevMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...elevMimic,
        displayName: 'TS: GPS → Elevation Query',
        imitates: 'ElevationQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng }`,
    });

    // --- Wave 4: Data dog — combines trails + elevation into clean JSON ---
    const dataVersionId = randomUUID();
    const dataDogId = randomUUID();
    const dataCfg = {
        id: dataVersionId,
        lineageId: dataDogId,
        parentId: null,
        displayName: 'TrailScoutData',
        parentsRequired: ['TrailRetriever', 'ElevationRetriever'],
        parentsOptional: [],
        theRun: `
var trails = TrailRetriever;
var elev = ElevationRetriever;
// TrailRetriever ships helper functions on its yield — use them so relations
// (hiking/bicycle routes) get resolved into polylines, not just ways.
var toPolylines = typeof trails.toPolylines === "function"
    ? trails.toPolylines
    : function(t) { return t && t.segments && t.segments.length ? t.segments : (t && t.coordinates && t.coordinates.length >= 2 ? [t.coordinates] : []); };

function project(t) {
    return {
        id: t.id,
        name: t.name || null,
        surface: t.surface || null,
        distance: t.distance || null,
        osmType: t.type,
        segments: toPolylines(t),
        tags: t.tags,
    };
}

var hikingTrails = trails.trails.filter(function(t) { return t.trailType === "hiking"; }).map(project);
var cyclingTrails = trails.trails.filter(function(t) { return t.trailType === "bicycle"; }).map(project);
// Drop entries that ended up without drawable geometry.
hikingTrails = hikingTrails.filter(function(t) { return t.segments && t.segments.length > 0; });
cyclingTrails = cyclingTrails.filter(function(t) { return t.segments && t.segments.length > 0; });

return {
    center: trails.center,
    elevation: elev.elevation,
    radiusM: trails.radiusM,
    trailType: trails.trailType,
    summary: {
        totalTrails: hikingTrails.length + cyclingTrails.length,
        hikingCount: hikingTrails.length,
        cyclingCount: cyclingTrails.length,
        elevationM: elev.elevation,
    },
    hiking: hikingTrails.slice(0, 30),
    cycling: cyclingTrails.slice(0, 30),
};
`,
    };
    await nodesStore.save({
        id: dataVersionId, type: SerializedDog.name, lineageId: dataDogId,
        parentId: null, displayName: 'TrailScoutData',
        serializedDogConfig: JSON.stringify(dataCfg), createdAt: new Date(),
    });

    // --- Wave 5: Renderer — reads TrailScoutData, builds HTML with Leaflet map ---
    const rendererVersionId = randomUUID();
    const rendererDogId = randomUUID();
    const rendererCfg = {
        id: rendererVersionId,
        lineageId: rendererDogId,
        parentId: null,
        displayName: 'TrailScoutRenderer',
        parentsRequired: [dataDogId],
        parentsOptional: [],
        theRun: `
var data = TrailScoutData;
var lat = data.center.lat;
var lng = data.center.lng;
var elev = data.elevation;
var hiking = data.hiking || [];
var cycling = data.cycling || [];
var summary = data.summary;
var SE = "<" + "/script>";
var SS = "<" + "script>";

var html = "";
html += "<!DOCTYPE html><html><head><meta charset='utf-8'/>";
html += "<meta name='viewport' content='width=device-width,initial-scale=1.0'/>";
html += "<title>Trail Scout</title>";
html += "<link rel='stylesheet' href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'/>";
html += "<style>";
html += "*{margin:0;padding:0;box-sizing:border-box}";
html += "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#1a1a2e;color:#e0e0e0}";
html += "#map{width:100%;height:60vh}";
html += ".panel{padding:16px 20px;background:#16213e}";
html += ".panel h1{font-size:1.4em;margin-bottom:8px;color:#e94560}";
html += ".stats{display:flex;gap:16px;flex-wrap:wrap;margin:10px 0}";
html += ".stat{background:#0f3460;padding:10px 16px;border-radius:8px;min-width:110px}";
html += ".stat .v{font-size:1.5em;font-weight:bold}.stat .l{font-size:.8em;color:#aaa;margin-top:2px}";
html += ".legend{display:flex;gap:16px;margin:8px 0;font-size:.85em}";
html += ".legend .hk::before,.legend .bk::before{content:'';display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:middle}";
html += ".legend .hk::before{background:#2ecc71}.legend .bk::before{background:#3498db}";
html += ".tl{padding:12px 20px;max-height:35vh;overflow-y:auto}";
html += ".tl h2{font-size:1.1em;margin:10px 0 6px}";
html += ".ti{background:#0f3460;margin:4px 0;padding:8px 12px;border-radius:6px;font-size:.9em;cursor:pointer;transition:background .2s;display:flex;justify-content:space-between;align-items:center}";
html += ".ti:hover{background:#1a4a8a}.ti .n{flex:1}.ti .m{color:#aaa;font-size:.8em}";
html += ".hc{border-left:4px solid #2ecc71}.cc{border-left:4px solid #3498db}";
html += "</style></head><body>";

html += "<div id='map'></div>";
html += "<div class='panel'>";
html += "<h1>Trail Scout</h1>";
html += "<div class='legend'><span class='hk'>Hiking</span><span class='bk'>Cycling</span></div>";
html += "<div class='stats'>";
html += "<div class='stat'><div class='v'>" + elev + " m</div><div class='l'>Hoehe</div></div>";
html += "<div class='stat'><div class='v'>" + summary.totalTrails + "</div><div class='l'>Wege gesamt</div></div>";
    html += "<div class='stat'><div class='v'>" + summary.hikingCount + "</div><div class='l'>Hiking trails</div></div>";
html += "<div class='stat'><div class='v'>" + summary.cyclingCount + "</div><div class='l'>Cycling routes</div></div>";
html += "<div class='stat'><div class='v'>" + (data.radiusM / 1000).toFixed(1) + " km</div><div class='l'>Radius</div></div>";
html += "</div></div>";

html += "<div class='tl'>";
if (hiking.length > 0) {
    html += "<h2>Hiking trails</h2>";
    for (var i = 0; i < hiking.length; i++) {
        var t = hiking[i];
        var tn = t.name || "(unbenannt)";
        var tm = [];
        if (t.surface) tm.push(t.surface);
        if (t.distance) tm.push(t.distance);
        html += "<div class='ti hc' data-idx='h" + i + "'><span class='n'>" + tn + "</span>";
        if (tm.length) html += "<span class='m'>" + tm.join(" &middot; ") + "</span>";
        html += "</div>";
    }
}
if (cycling.length > 0) {
    html += "<h2>Cycling routes</h2>";
    for (var j = 0; j < cycling.length; j++) {
        var c = cycling[j];
        var cn = c.name || "(unbenannt)";
        var cm = [];
        if (c.surface) cm.push(c.surface);
        if (c.distance) cm.push(c.distance);
        html += "<div class='ti cc' data-idx='c" + j + "'><span class='n'>" + cn + "</span>";
        if (cm.length) html += "<span class='m'>" + cm.join(" &middot; ") + "</span>";
        html += "</div>";
    }
}
if (!hiking.length && !cycling.length) {
    html += "<p style='color:#aaa;padding:20px 0;'>Keine Wege im Umkreis gefunden.</p>";
}
html += "</div>";

var trailsJson = JSON.stringify({ hiking: hiking, cycling: cycling });

html += SS;
html += "var LS=document.createElement('script');";
html += "LS.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';";
html += "LS.onload=function(){";
html += "var map=L.map('map').setView([" + lat + "," + lng + "],14);";
html += "L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OSM',maxZoom:19}).addTo(map);";
html += "L.circle([" + lat + "," + lng + "],{radius:" + data.radiusM + ",color:'#e94560',fillColor:'#e94560',fillOpacity:0.05,weight:1,dashArray:'5,5'}).addTo(map);";
html += "L.marker([" + lat + "," + lng + "]).addTo(map).bindPopup('<b>" + elev + " m</b><br/>Standort');";
html += "var td=" + trailsJson + ";";
html += "var layers={};";
html += "function addT(arr,col,pfx){";
html += "for(var i=0;i<arr.length;i++){";
html += "var t=arr[i];var segs=t.segments||[];";
html += "if(!segs.length)continue;";
html += "var group=L.featureGroup();";
html += "for(var s=0;s<segs.length;s++){";
html += "var seg=segs[s];if(!seg||seg.length<2)continue;";
html += "var ll=seg.map(function(c){return[c.lat,c.lng];});";
html += "L.polyline(ll,{color:col,weight:3,opacity:0.8}).addTo(group);";
html += "}";
html += "if(!group.getLayers().length)continue;";
html += "group.addTo(map);";
html += "var nm=t.name||'(unbenannt)';var pp='<b>'+nm+'</b>';";
html += "if(t.surface)pp+='<br/>Belag: '+t.surface;";
html += "if(t.distance)pp+='<br/>Distanz: '+t.distance;";
html += "group.bindPopup(pp);layers[pfx+i]=group;";
html += "}}";
html += "addT(td.hiking,'#2ecc71','h');addT(td.cycling,'#3498db','c');";
html += "document.querySelectorAll('.ti').forEach(function(el){";
html += "el.addEventListener('click',function(){";
html += "var idx=this.getAttribute('data-idx');var ly=layers[idx];";
html += "if(ly){map.fitBounds(ly.getBounds(),{padding:[30,30]});ly.openPopup();}";
html += "});});";
html += "};document.head.appendChild(LS);";
html += SE;
html += "</body></html>";
return html;
`,
    };
    await nodesStore.save({
        id: rendererVersionId, type: SerializedDog.name, lineageId: rendererDogId,
        parentId: null, displayName: 'TrailScoutRenderer',
        serializedDogConfig: JSON.stringify(rendererCfg), createdAt: new Date(),
    });

    // Kennel: Renderer als Anfuehrer (erste dogId), dann Data, dann BaseDogs + Mimics
    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Trail Scout',
        description: 'Hiking and cycling trails on the map with elevation — OSM + Open-Meteo',
        emoji: '\uD83E\uDDB6',
        dogIds: [
            rendererDogId,
            dataDogId,
            BASE_DOG_PREFIX + 'QueryRetriever',
            BASE_DOG_PREFIX + 'TrailRetriever',
            BASE_DOG_PREFIX + 'ElevationRetriever',
            trailMimic.lineageId,
            elevMimic.lineageId,
        ],
        defaultQuery: { lat: '47.3769', lng: '8.5417', radius: '3000', type: 'both' },
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

    console.log(`\u2705 Seeded Trail Scout Kennel (kennelId: ${kennelId})`);
}
