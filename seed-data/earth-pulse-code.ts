/** Earth Pulse — PulsData / PulsRenderer VM strings (split from seed). */
// --- Earth Pulse: PulsData theRun code ---
export const EARTH_PULSE_DATA_CODE = `
var w = WeatherRetriever || {};
var s = SunRetriever || {};
var a = AirQualityRetriever || {};
var sp = SpeciesRetriever || {};
var ph = PhenologyRetriever || {};
var lm = OsmLandmarksRetriever || {};
var news = RegionalNewsRetriever || {};
var geo = GeocodingRetriever || {};
var transit = TransitTripRetriever || {};

var loc = (geo.results || [])[0] || {};
var addr = loc.address || {};
var cur = w.current || {};
var today = s.today || {};
var air = a.current || {};
var lat = loc.lat || 50.11;
var lng = loc.lng || 8.68;

var spread = 0.15;
var windPoints = [
  { lat: +(lat + spread).toFixed(4), lng: +(lng - spread).toFixed(4), label: 'NW' },
  { lat: +(lat + spread).toFixed(4), lng: +(lng + spread).toFixed(4), label: 'NE' },
  { lat: +(lat - spread).toFixed(4), lng: +(lng - spread).toFixed(4), label: 'SW' },
  { lat: +(lat - spread).toFixed(4), lng: +(lng + spread).toFixed(4), label: 'SE' }
];
var windResults = await Promise.all(windPoints.map(async function(p) {
  try {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + p.lat + '&longitude=' + p.lng + '&current=windspeed_10m,winddirection_10m,windgusts_10m&timezone=auto';
    var res = await fetch(url);
    var data = await res.json();
    return { lat: p.lat, lng: p.lng, label: p.label, speed: data.current?.windspeed_10m || 0, direction: data.current?.winddirection_10m || 0, gusts: data.current?.windgusts_10m || 0 };
  } catch(e) { return { lat: p.lat, lng: p.lng, label: p.label, speed: 0, direction: 0, gusts: 0, error: true }; }
}));

var topSpecies = (sp.observations || []).slice(0, 15).map(function(o) {
  return { name: o.speciesName || o.scientificName, taxon: o.iconicTaxon, photo: o.photoUrl, lat: (o.location && o.location.lat) || 0, lng: (o.location && o.location.lng) || 0 };
});

var landmarks = (lm.elements || []).slice(0, 25).map(function(e) {
  return { name: e.name || e.tags?.name || 'Unbenannt', lat: e.lat, lng: e.lng, type: e.tags?.tourism || e.tags?.historic || e.tags?.amenity || 'landmark', desc: e.tags?.description?.substring(0, 200) };
});

var trips = (transit.trips || []).map(function(t) {
  var stops = t.stops || [];
  var first = stops[0] || {};
  var last = stops[stops.length - 1] || {};
  var depTime = first.departure || first.scheduledDeparture;
  var arrTime = last.arrival || last.scheduledArrival;
  var durationMin = null;
  if (depTime && arrTime) {
    durationMin = Math.round((new Date(arrTime).getTime() - new Date(depTime).getTime()) / 60000);
  }
  return {
    line: t.lineName, headsign: t.headsign, mode: t.mode,
    firstStop: first.name, lastStop: last.name,
    departure: depTime, arrival: arrTime, durationMin: durationMin,
    stops: stops.map(function(s) { return { name: s.name, lat: s.lat, lng: s.lng }; })
  };
});

return {
  location: { name: addr.city || loc.displayName || 'Unbekannt', display: loc.displayName || '', state: addr.state, country: addr.country, lat: lat, lng: lng },
  weather: { temp: cur.temperature, feels: cur.apparentTemperature, humidity: cur.humidity, wind: cur.windSpeed, windDir: cur.windDirection, code: cur.weatherCode, desc: cur.weatherDescription },
  windGrid: windResults,
  sun: { rise: today.sunrise, set: today.sunset, daylight: today.daylightHours, uv: today.uvIndexMax, uvRisk: today.uvRisk },
  air: { aqi: air.europeanAqi, desc: air.aqiDescription, pm25: air.pm25, pm10: air.pm10, ozone: air.ozone },
  species: { total: sp.totalResults || 0, top: topSpecies },
  phenology: { phase: (ph.currentPhase||{}).name, phaseEn: (ph.currentPhase||{}).nameEn, plants: (ph.currentPhase||{}).typicalBloom || [], fauna: (ph.currentPhase||{}).typicalFauna || [] },
  landmarks: { total: (lm.elements || []).length, top: landmarks },
  news: { total: news.totalItems || 0, items: (news.items || []).slice(0, 8).map(function(n) { return { title: n.title, link: n.link, date: n.pubDate, source: n.source }; }) },
  transit: { totalTrips: transit.totalTrips || 0, totalStops: transit.totalStops || 0, trips: trips },
  meta: { fetchedAt: new Date().toISOString() }
};
`;

// --- Earth Pulse: PulsRenderer theRun code ---
// This renders the full interactive HTML dashboard with Leaflet map, wind arrows,
// species cards, transit routes, phenology, news, and a search bar.
export const EARTH_PULSE_RENDERER_CODE = `
var d = Pulsdata;
var loc = d.location || {};
var w = d.weather || {};
var sun = d.sun || {};
var air = d.air || {};
var sp = d.species || {};
var ph = d.phenology || {};
var lm = d.landmarks || {};
var nw = d.news || {};
var tr = d.transit || {};
var wg = d.windGrid || [];
var lat = loc.lat || 50.11;
var lng = loc.lng || 8.68;

var weatherIcons = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'};
var wIcon = weatherIcons[w.code] || '🌍';
var aqiColor = (air.aqi||0) < 20 ? '#16a34a' : (air.aqi||0) < 40 ? '#65a30d' : (air.aqi||0) < 60 ? '#ca8a04' : (air.aqi||0) < 80 ? '#ea580c' : '#dc2626';
var uvColor = (sun.uv||0) < 3 ? '#16a34a' : (sun.uv||0) < 6 ? '#ca8a04' : (sun.uv||0) < 8 ? '#ea580c' : '#dc2626';
var lineColors = ['#e11d48','#2563eb','#16a34a','#9333ea','#ea580c','#0891b2','#c026d3','#4f46e5','#059669','#d97706','#7c3aed','#0d9488'];

var avgWind = 0; var avgDir = 0; var wCount = 0; var maxGusts = 0;
wg.forEach(function(wp) { if (!wp.error) { avgWind += wp.speed; avgDir += wp.direction; wCount++; if(wp.gusts>maxGusts)maxGusts=wp.gusts; } });
if (wCount > 0) { avgWind = (avgWind / wCount).toFixed(1); avgDir = Math.round(avgDir / wCount); }
var dirNames = ['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSW','SW','WSW','W','WNW','NW','NNW'];
var dirName = dirNames[Math.round(avgDir / 22.5) % 16] || '';

var windArrowsJS = '';
wg.forEach(function(wp) {
  if (wp.error) {
    windArrowsJS += 'L.marker([' + wp.lat + ',' + wp.lng + '],{icon:L.divIcon({className:\\'\\',html:\\'<div style="color:#999;font-size:16px;">✕</div>\\',iconSize:[20,20],iconAnchor:[10,10]})}).addTo(map);';
  } else {
    var sz = 18 + Math.min(wp.speed, 60) * 0.5;
    var intensity = Math.min(wp.speed / 50, 1);
    var cr = Math.round(30 + 200 * intensity);
    var cg = Math.round(120 * (1 - intensity));
    var cb = Math.round(180 * (1 - intensity));
    var col = 'rgb(' + cr + ',' + cg + ',' + cb + ')';
    windArrowsJS += 'L.marker([' + wp.lat + ',' + wp.lng + '],{icon:L.divIcon({className:\\'\\',html:\\'<div style="transform:rotate(' + wp.direction + 'deg);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="' + sz + '" height="' + sz + '" fill="' + col + '" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4));"><path d="M12 2L8 12h3v8h2v-8h3z"/></svg></div>\\',iconSize:[' + sz + ',' + sz + '],iconAnchor:[' + (sz/2) + ',' + (sz/2) + ']})}).addTo(map).bindPopup("<b>' + wp.speed + ' km/h</b><br>Richtung: ' + wp.direction + '°<br>Böen: ' + wp.gusts + ' km/h");';
  }
});

var transitJS = '';
var transitCards = '';
(tr.trips || []).forEach(function(trip, i) {
  var color = lineColors[i % lineColors.length];
  var stops = trip.stops || [];
  var coords = '';
  stops.forEach(function(s, j) { if (s.lat && s.lng) { if (j > 0) coords += ','; coords += '[' + s.lat + ',' + s.lng + ']'; } });
  if (coords) {
    transitJS += 'L.polyline([' + coords + '],{color:"' + color + '",weight:3,opacity:0.7}).addTo(map);';
    var last = stops[stops.length - 1];
    if (last && last.lat && last.lng) {
      var label = (last.name || '').replace(/'/g, '').substring(0, 25);
      transitJS += 'L.marker([' + last.lat + ',' + last.lng + '],{icon:L.divIcon({className:\\'\\',html:\\'<div style="background:' + color + ';color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;white-space:nowrap;font-family:system-ui,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,0.3);">' + (trip.line||'') + ' ' + label + '</div>\\',iconAnchor:[-4,8]})}).addTo(map);';
    }
  }
  var depStr = trip.departure ? new Date(trip.departure).toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}) : '?';
  var arrStr = trip.arrival ? new Date(trip.arrival).toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}) : '?';
  var durStr = trip.durationMin ? trip.durationMin + ' min' : '';
  transitCards += '<div class="tc"><div class="tc-head"><span class="tc-line" style="background:' + color + ';">' + (trip.line||'?') + '</span><span class="tc-mode">' + (trip.mode||'') + '</span>';
  if (durStr) transitCards += '<span class="tc-dur">' + durStr + '</span>';
  transitCards += '</div>';
  transitCards += '<div class="tc-route">' + (trip.firstStop||'') + ' <span class="tc-arr">→</span> ' + (trip.lastStop||'') + '</div>';
  transitCards += '<div class="tc-times">' + depStr + ' → ' + arrStr + '</div></div>';
});

var speciesJS = ''; (sp.top || []).forEach(function(s) { if (s.lat && s.lng) { speciesJS += 'L.circleMarker([' + s.lat + ',' + s.lng + '],{radius:5,fillColor:"#16a34a",color:"#fff",weight:1,fillOpacity:0.8}).addTo(map).bindPopup("<b>' + (s.name||'?').replace(/'/g,'') + '</b><br>' + (s.taxon||'') + '");'; } });
var landmarkJS = ''; (lm.top || []).slice(0, 15).forEach(function(l) { if (l.lat && l.lng) { landmarkJS += 'L.circleMarker([' + l.lat + ',' + l.lng + '],{radius:4,fillColor:"#ca8a04",color:"#fff",weight:1,fillOpacity:0.8}).addTo(map).bindPopup("<b>' + (l.name||'?').replace(/'/g,'') + '</b><br>' + (l.type||'') + '");'; } });

var speciesCards = ''; (sp.top || []).forEach(function(s) {
  speciesCards += '<div class="spc">'; if (s.photo) speciesCards += '<img src="' + s.photo + '" onerror="this.style.display=\\'none\\'" loading="lazy"/>';
  speciesCards += '<div class="spc-i"><strong>' + (s.name||'?') + '</strong><span>' + (s.taxon||'') + '</span></div></div>';
});
var landmarkCards = ''; (lm.top || []).slice(0, 12).forEach(function(l) {
  landmarkCards += '<div class="lmc"><div class="lm-t">' + (l.type||'') + '</div><div class="lm-n">' + (l.name||'?') + '</div>';
  if (l.desc) landmarkCards += '<div class="lm-d">' + l.desc + '</div>'; landmarkCards += '</div>';
});
var plantsHtml = ''; (ph.plants || []).forEach(function(p) { plantsHtml += '<span class="tg tg-g">' + p + '</span>'; });
var faunaHtml = ''; (ph.fauna || []).forEach(function(f) { faunaHtml += '<span class="tg tg-a">' + f + '</span>'; });
var newsHtml = ''; (nw.items || []).forEach(function(n) {
  newsHtml += '<a href="' + (n.link||'#') + '" target="_blank" class="ni"><div class="ni-t">' + (n.title||'?') + '</div><div class="ni-m">' + (n.source||'') + ' · ' + (n.date||'') + '</div></a>';
});

var scriptEnd = '<' + '/script>';
var h = '';
h += '<!DOCTYPE html><html><head><meta charset="utf-8"/>';
h += '<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>';
h += '<title>' + (loc.name||'Ort') + ' — Puls der Erde</title>';
h += '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>';
h += '<' + 'script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js">' + scriptEnd;
h += '<style>';
h += '*{margin:0;padding:0;box-sizing:border-box;}';
h += 'body{font-family:Georgia,"Times New Roman",serif;background:#fafaf8;color:#333;-webkit-text-size-adjust:100%;}';
h += '.hero{position:relative;height:55vh;min-height:340px;} #hm{width:100%;height:100%;}';
h += '.ho{position:absolute;bottom:0;left:0;right:0;z-index:1000;padding:16px;background:rgba(250,250,248,0.92);backdrop-filter:blur(4px);}';
h += '.ho-t{font-size:clamp(1.6rem,5vw,3rem);font-weight:700;color:#1a1a1a;line-height:1.1;} .ho-s{font-size:0.85rem;color:#777;margin-top:3px;font-style:italic;}';
h += '.ct{max-width:680px;margin:0 auto;padding:12px 14px 60px;} @media(min-width:560px){.ct{padding:16px 24px 60px;}}';
h += '.sec{margin-bottom:40px;} .sec-t{font-size:1.2rem;color:#1a1a1a;margin-bottom:10px;border-bottom:2px solid #e5e5e0;padding-bottom:6px;}';
h += '.wx-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;} @media(max-width:400px){.wx-row{grid-template-columns:1fr;}}';
h += '.wx-card{background:#fff;border-radius:12px;padding:14px;border:1px solid #e5e5e0;}';
h += '.wx-big{font-size:2.4rem;font-weight:700;color:#1a1a1a;font-family:system-ui,sans-serif;line-height:1;}';
h += '.wx-sub{font-size:0.82rem;color:#666;margin-top:3px;} .wx-detail{font-size:0.78rem;color:#888;margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;} .wx-detail span{white-space:nowrap;}';
h += '.fg{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;} @media(min-width:560px){.fg{grid-template-columns:repeat(4,1fr);}}';
h += '.fc{background:#fff;border-radius:10px;padding:12px;border:1px solid #e5e5e0;} .fc-v{font-size:1.4rem;font-weight:700;color:#1a1a1a;font-family:system-ui,sans-serif;} .fc-l{font-size:0.68rem;color:#999;margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;}';
h += '.pr{font-size:0.95rem;line-height:1.7;color:#555;} .pr strong{color:#1a1a1a;}';
h += '.sr{display:flex;gap:10px;overflow-x:auto;padding:6px 0;-webkit-overflow-scrolling:touch;} .sr::-webkit-scrollbar{height:3px;} .sr::-webkit-scrollbar-thumb{background:#ccc;border-radius:2px;}';
h += '.spc{flex:0 0 130px;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e5e0;} .spc img{width:100%;height:90px;object-fit:cover;}';
h += '.spc-i{padding:7px;} .spc-i strong{display:block;font-size:0.78rem;color:#1a1a1a;} .spc-i span{font-size:0.68rem;color:#999;}';
h += '.lmc{background:#fff;border-radius:10px;padding:10px;border:1px solid #e5e5e0;} .lm-t{font-size:0.62rem;color:#999;text-transform:uppercase;letter-spacing:1px;} .lm-n{font-size:0.88rem;color:#1a1a1a;font-weight:600;margin-top:1px;} .lm-d{font-size:0.78rem;color:#777;margin-top:3px;line-height:1.4;}';
h += '.tg{display:inline-block;padding:3px 10px;border-radius:14px;font-size:0.72rem;margin:2px;font-family:system-ui,sans-serif;} .tg-g{background:#dcfce7;color:#166534;} .tg-a{background:#fef3c7;color:#92400e;}';
h += '.tc{background:#fff;border-radius:10px;padding:10px 12px;border:1px solid #e5e5e0;margin-bottom:8px;} .tc-head{display:flex;align-items:center;gap:8px;} .tc-line{color:#fff;font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:4px;font-family:system-ui,sans-serif;} .tc-mode{font-size:0.68rem;color:#999;text-transform:uppercase;} .tc-dur{font-size:0.72rem;color:#1a1a1a;font-weight:600;font-family:system-ui,sans-serif;margin-left:auto;} .tc-route{font-size:0.85rem;color:#333;margin-top:5px;line-height:1.3;} .tc-arr{color:#bbb;} .tc-times{font-size:0.75rem;color:#888;margin-top:2px;font-family:system-ui,sans-serif;}';
h += '.ni{display:block;padding:10px 0;border-bottom:1px solid #eee;text-decoration:none;} .ni-t{color:#2563eb;font-size:0.88rem;line-height:1.4;} .ni:hover .ni-t{color:#1d4ed8;} .ni-m{color:#aaa;font-size:0.68rem;margin-top:3px;}';
h += '.aqi{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;font-size:0.95rem;font-weight:700;font-family:system-ui,sans-serif;color:#fff;}';
h += '.sb{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2000;display:flex;gap:4px;background:rgba(255,255,255,0.95);padding:6px 10px;border-radius:22px;border:1px solid #ddd;backdrop-filter:blur(10px);box-shadow:0 2px 10px rgba(0,0,0,0.07);width:calc(100% - 20px);max-width:340px;}';
h += '.sb input{background:transparent;border:none;color:#333;font-size:0.85rem;flex:1;min-width:0;outline:none;font-family:system-ui,sans-serif;} .sb button{background:#2563eb;color:#fff;border:none;padding:5px 12px;border-radius:16px;cursor:pointer;font-size:0.75rem;white-space:nowrap;} .sb button:hover{background:#1d4ed8;}';
h += '</style></head><body>';

h += '<div class="sb"><input id="q" placeholder="Ort eingeben..." /><button id="go">Erkunden</button></div>';
h += '<div class="hero"><div id="hm"></div><div class="ho"><div class="ho-t">' + (loc.name||'?') + '</div><div class="ho-s">' + (loc.display||'') + '</div></div></div>';
h += '<div class="ct">';

h += '<div class="sec"><div class="sec-t">Wetter & Tageslicht</div><div class="wx-row">';
h += '<div class="wx-card"><div style="display:flex;align-items:center;gap:8px;"><span style="font-size:1.8rem;">' + wIcon + '</span><div class="wx-big">' + (w.temp||'?') + '°</div></div>';
h += '<div class="wx-sub">' + (w.desc||'') + ', gefühlt ' + (w.feels||'?') + '°</div>';
h += '<div class="wx-detail"><span style="display:flex;align-items:center;gap:3px;"><span style="transform:rotate(' + (w.windDir||0) + 'deg);display:inline-block;"><svg viewBox="0 0 24 24" width="14" height="14" fill="#2563eb"><path d="M12 2L8 12h3v8h2v-8h3z"/></svg></span>' + (avgWind||w.wind||'?') + ' km/h ' + dirName + '</span>';
h += '<span>Böen ' + maxGusts + '</span><span>💧 ' + (w.humidity||'?') + '%</span></div></div>';
h += '<div class="wx-card"><div style="display:flex;align-items:center;gap:8px;"><div class="wx-big">' + (sun.daylight||'?') + 'h</div><span style="font-size:0.9rem;color:#888;">Tageslicht</span></div>';
h += '<div class="wx-sub">🌅 ' + ((sun.rise||'?').split('T')[1]||'?') + '  🌇 ' + ((sun.set||'?').split('T')[1]||'?') + '</div>';
h += '<div class="wx-detail"><span style="color:' + uvColor + ';font-weight:600;">UV ' + (sun.uv||'?') + '</span><span>' + (sun.uvRisk||'') + '</span>';
h += '<span><span class="aqi" style="background:' + aqiColor + ';width:24px;height:24px;font-size:0.65rem;">' + (air.aqi||'?') + '</span> ' + (air.desc||'') + '</span></div></div></div></div>';

h += '<div class="sec"><div class="sec-t">🌸 ' + (ph.phase||'Jahreszeit') + '</div>';
h += '<div class="pr" style="margin-bottom:8px;"><strong>' + (ph.phase||'?') + '</strong>';
if(ph.plants&&ph.plants.length) h += ' — ' + ph.plants.slice(0,3).join(', ') + ' blühen.';
if(ph.fauna&&ph.fauna.length) h += ' ' + ph.fauna.slice(0,2).join(' und ') + '.';
h += '</div><div style="margin-bottom:4px;">' + plantsHtml + '</div>' + faunaHtml + '</div>';

h += '<div class="sec"><div class="sec-t">🦎 ' + (sp.total||0).toLocaleString() + ' Artbeobachtungen</div><div class="sr">' + speciesCards + '</div></div>';
if(tr.trips && tr.trips.length) { h += '<div class="sec"><div class="sec-t">🚌 ' + tr.trips.length + ' Linien</div>' + transitCards + '</div>'; }
h += '<div class="sec"><div class="sec-t">🏛️ ' + (lm.total||0) + ' Orte</div><div class="fg">' + landmarkCards + '</div></div>';
if(nw.items && nw.items.length > 0) { h += '<div class="sec"><div class="sec-t">📰 Aktuelles</div>' + newsHtml + '</div>'; }
h += '<div style="color:#bbb;font-size:0.68rem;text-align:center;padding:28px 0;border-top:1px solid #eee;">🌍 Puls der Erde</div>';
h += '</div>';

h += '<' + 'script>';
h += 'var map=L.map("hm",{zoomControl:true,attributionControl:false}).setView([' + lat + ',' + lng + '],13);';
h += 'L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19}).addTo(map);';
h += 'L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",{maxZoom:19,pane:"overlayPane"}).addTo(map);';
h += windArrowsJS + transitJS + speciesJS + landmarkJS;
h += 'var qI=document.getElementById("q");qI.value="' + (loc.name||'') + '";';
h += 'function doSearch(){var u=new URL(window.location);u.searchParams.set("q",qI.value);window.location=u.toString();}';
h += 'document.getElementById("go").addEventListener("click",doSearch);';
h += 'qI.addEventListener("keydown",function(e){if(e.key==="Enter")doSearch();});';
h += scriptEnd;
h += '</body></html>';
return h;
`;
