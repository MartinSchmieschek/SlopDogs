# @slopdogs/geo-pact

Einheitlicher Vertrag fuer Geo-Koordinaten in SlopDogs.

## Warum

Vorher hatten Geo-Hunde widerspruechliche Schemas: `lat`/`lng`, `lat`/`lon`,
`latitude`/`longitude`, `startlat`/`startlng`, `radius` vs `distance`.
Dieser Pakt vereinheitlicht alles.

## Drei Schemas

```ts
interface GeoPoint { lat: number; lng: number }
interface GeoArea  extends GeoPoint { radius: number }   // radius in Metern
interface GeoRoute { start: GeoPoint; end: GeoPoint; waypoints?: GeoPoint[] }
```

## Drei Pacts

- `GeoPointPact` — Hunde, die nur eine Position brauchen (Wetter, Sun, AirQuality, ...)
- `GeoAreaPact`  — Hunde, die Position + Radius brauchen (OSM, Wikipedia, Birds, ...)
- `GeoRoutePact` — Hunde, die Routen brauchen (Bloodhound Routing)

## Parser

```ts
import { parseGeoPoint, parseGeoArea, parseGeoRoute } from "@slopdogs/geo-pact";

const point = parseGeoPoint(QueryRetriever);                 // wirft, wenn ungueltig
const area  = parseGeoArea(QueryRetriever, /* default */ 1000);
const route = parseGeoRoute(QueryRetriever);                 // start/end Pflicht
```

## Regeln

- Felder heissen IMMER `lat` und `lng`. Niemals `latitude`, `longitude`, `lon`.
- Outputs der Hunde MUESSEN ebenfalls `lat`/`lng` verwenden.
- Radius ist IMMER in Metern und heisst `radius` (nicht `distance`).
- Routen werden als Objekt `{ start, end, waypoints? }` modelliert,
  niemals als getrennte `startlat`/`startlng`/`endlat`/`endlng`-Felder.
