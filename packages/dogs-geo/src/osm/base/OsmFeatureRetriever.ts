/**
 * ~~~ OSM FEATURE RETRIEVER — gemeinsame Basis fuer alle Overpass-Dogs ~~~
 *
 * Tile-basierter Feature-Cache (Slippy-Map-Tiles, Multi-Zoom). Subklassen
 * deklarieren nur noch ihren Layer, ihre Facets und ihre Overpass-Filter —
 * die gesamte Tile-/Fetch-/Cache-Mechanik lebt hier.
 *
 * Flow pro Query:
 *
 *   1. parseQuery(season)  → center, radius, facets[]
 *   2. zoom = pickZoomForRadius(radius); tiles = tilesTouching(...)
 *   3. tileCache.getCoveredFeatures(layer, tiles, facets)
 *        → {features (cached), missing[(tile,facet)]}
 *   4. missing gruppiert nach tile: PRO TILE eine Overpass-Query ueber die
 *      Union aller missing Facets, begrenzt auf tileBBox(zoom,x,y).
 *   5. Fetch-Result: Subklasse klassifiziert jedes Element nach Facet(s);
 *      tileCache.storeFetchResult(...) persistiert Features + Membership.
 *   6. Merge (cached + fresh) dedup'd per OSM-Id, radius-filtern,
 *      mapElements(features, q) ins Result-Shape ueberfuehren, postProcess.
 *
 * Features ohne ableitbare Geometrie landen nur unter der Fetch-Tile —
 * ihre Membership folgt semantisch dem Ort, an dem wir sie abgeholt haben.
 */

import {
    Dog,
    IHuntingDog,
    IHuntingSeason,
    type ITileCacheable,
    type ITileFeatureCache,
    type StoredGeoFeature,
    type FeatureUpsert,
    type TileKey,
    GEO_CACHE_TTL_OSM_MS,
    pickZoomForRadius,
    tilesTouching,
    tileBBox,
    tileKeyString,
    featureInRadius,
} from "@slopdogs/core";
import {
    fetchOverpassElementsWithFallback,
    overpassSettingsHeader,
    overpassElementRepresentativePoint,
    type OverpassRawElement,
} from "./overpassMirrorChain";

export interface OsmQueryBase {
    lat: number;
    lng: number;
    radiusM: number;
    /** Welche Facets der Caller will. Leer → Single-Facet "default". */
    facets?: string[];
    /**
     * Subklassen-spezifische Post-Filter, die nicht im Cache-Key landen
     * (z.B. cuisine bei Food). Die Basis ignoriert das Feld — Subklassen
     * werten es in `mapElements` aus, nachdem der Pool gefuellt wurde.
     */
    postFilter?: Record<string, unknown>;
}

/** Minimal-Shape fuer alle Subklassen-Results. */
export interface OsmBaseResult {
    center: { lat: number; lng: number };
    radiusM: number;
}

/** Default-Facet wenn eine Subklasse keine Facet-Dimension hat. */
export const DEFAULT_FACET = 'default';

export abstract class OsmFeatureRetriever<
    TResult extends OsmBaseResult,
    TQueryPact extends new (...args: any[]) => IHuntingDog<unknown>,
> extends Dog<TResult> implements ITileCacheable {
    private tileFeatureCache?: ITileFeatureCache;

    setTileFeatureCache(cache: ITileFeatureCache): void {
        this.tileFeatureCache = cache;
    }

    // ------- Deklarative Pflicht-Hooks der Subklasse -------

    /** Layer-Name — Cache-Partitionierungs-Prefix (dogType im Tile-Cache). */
    protected abstract readonly layer: string;
    protected abstract readonly defaultRadiusM: number;
    protected abstract readonly maxRadiusM: number;
    protected readonly minRadiusM: number = 50;

    protected abstract parseQuery(season: IHuntingSeason): OsmQueryBase;

    /**
     * Baut den `(...)` -Overpass-Body-Block FUER EINE TILE-BBOX und eine
     * Menge von Facets. Die Subklasse filtert per bbox (`[bbox:s,w,n,e]`)
     * und kombiniert die Facet-Filter mit ODER.
     *
     * Die Basis haengt den Settings-Header und das out-Statement an.
     */
    protected abstract buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string;

    /**
     * Subklasse gibt alle Facets zurueck, denen dieses Element zugeordnet
     * werden soll — eine Teilmenge von `fetchedFacets`. Leer → Element ignorieren.
     */
    protected abstract classifyElementFacets(
        el: OverpassRawElement,
        fetchedFacets: string[],
    ): string[];

    /**
     * Subklasse baut ihr spezifisches Result aus den finalen, gefilterten Features.
     * Die Features sind bereits radius- und facet-gefiltert.
     */
    protected abstract mapElements(
        elements: OverpassRawElement[],
        q: OsmQueryBase,
    ): TResult;

    /** Optional: anderes `out`-Statement. Default `out geom;` — Geometrie mitnehmen. */
    protected readonly outStatement: string = "out geom;";

    /** Optional: TTL ueberschreiben (Default: 5 Tage). */
    protected readonly ttlMs: number = GEO_CACHE_TTL_OSM_MS;

    /**
     * Optional: Helper-Funktionen ans Ergebnis haengen. Wird auf jedem Rueckgabepfad
     * aufgerufen — Consumer sieht immer ein vollstaendiges Objekt.
     */
    protected postProcess(result: TResult, _q: OsmQueryBase): TResult {
        return result;
    }

    /**
     * Optional: Feature-Identitaet fuer den Store. Die Subklasse kann das Haupt-Tag
     * explizit waehlen; Default: erstes kanonisches Tag aus `tags` (highway, amenity,
     * natural, leisure, tourism, historic, landuse, man_made, route).
     */
    protected extractFeatureIdentity(el: OverpassRawElement): {
        primaryKey: string | null;
        primaryValue: string | null;
        name: string | null;
    } {
        const tags = el.tags ?? {};
        const prefOrder = [
            'highway', 'amenity', 'natural', 'leisure', 'tourism',
            'historic', 'landuse', 'man_made', 'route', 'building', 'shop',
        ];
        for (const k of prefOrder) {
            if (tags[k]) return { primaryKey: k, primaryValue: tags[k]!, name: tags.name ?? null };
        }
        const anyKey = Object.keys(tags).find((k) => !['name', 'note', 'source'].includes(k));
        return {
            primaryKey: anyKey ?? null,
            primaryValue: anyKey ? tags[anyKey] ?? null : null,
            name: tags.name ?? null,
        };
    }

    // ------- Standard Dog-Metadata -------

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [this.queryPactClass];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    get icon(): string | undefined {
        return undefined;
    }

    protected abstract readonly queryPactClass: TQueryPact;

    // ------- Helpers fuer Subklassen -------

    protected clampRadius(parsed: number): number {
        if (Number.isNaN(parsed) || parsed < 1) return this.defaultRadiusM;
        return Math.min(Math.max(Math.round(parsed), this.minRadiusM), this.maxRadiusM);
    }

    protected assembleOverpassQuery(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const body = this.buildOverpassBodyForTile(bbox, facets);
        return `${overpassSettingsHeader()}\n(\n${body}\n);\n${this.outStatement}`;
    }

    // ------- Der eine Yield-Collector den alle Subklassen teilen -------

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<TResult> => {
        const q = this.parseQuery(season);

        if (Number.isNaN(q.lat) || Number.isNaN(q.lng)) {
            throw new Error(`${this.name}: Missing required query params (lat, lng)`);
        }

        const facets = q.facets && q.facets.length > 0 ? [...q.facets].sort() : [DEFAULT_FACET];
        const zoom = pickZoomForRadius(q.radiusM);
        const tiles = tilesTouching(q.lat, q.lng, q.radiusM, zoom);

        // Ohne Tile-Cache: klassischer direkter Fetch pro Tile × Facets, kein Caching.
        if (!this.tileFeatureCache) {
            const freshRaw = await this.fetchAllTiles(tiles, facets);
            return this.postProcess(this.mapElements(freshRaw, q), q);
        }

        // 1. Was haben wir schon, was fehlt?
        const { features: cachedFeatures, missing } =
            await this.tileFeatureCache.getCoveredFeatures(this.layer, tiles, facets);

        // 2. Missing pro Tile gruppieren — pro Tile EINE Overpass-Query ueber alle fehlenden Facets.
        const tileMissing = new Map<string, { tile: TileKey; facets: Set<string> }>();
        for (const m of missing) {
            const key = tileKeyString(m.tile);
            const entry = tileMissing.get(key) ?? { tile: m.tile, facets: new Set() };
            entry.facets.add(m.facet);
            tileMissing.set(key, entry);
        }

        // 3. Alle fehlenden Tiles parallel fetchen (Rate-Limit lebt im Mirror-Chain).
        const freshByKey = new Map<string, StoredGeoFeature>();
        const freshRawElements: OverpassRawElement[] = [];

        await Promise.all(
            Array.from(tileMissing.values()).map(async ({ tile, facets: missingFacets }) => {
                const fetchedFacets = Array.from(missingFacets).sort();
                const bbox = tileBBox(tile);
                const overpassQuery = this.assembleOverpassQuery(bbox, fetchedFacets);
                const rawElements = await fetchOverpassElementsWithFallback(
                    overpassQuery,
                    this.name,
                );

                const upserts: FeatureUpsert[] = [];
                for (const el of rawElements) {
                    const elFacets = this.classifyElementFacets(el, fetchedFacets);
                    if (elFacets.length === 0) continue;
                    const upsert = this.elementToUpsert(el, elFacets);
                    upserts.push(upsert);
                    freshRawElements.push(el);
                    // Inline in den Merge-Pool — wir wollen keinen zweiten DB-Read.
                    const storedLike: StoredGeoFeature = upsertToStored(this.layer, upsert);
                    freshByKey.set(`${storedLike.osmType}:${storedLike.osmId}`, storedLike);
                }

                await this.tileFeatureCache!.storeFetchResult(
                    this.layer,
                    { tile, facets: fetchedFacets, features: upserts },
                    this.ttlMs,
                );
            }),
        );

        // 4. Merge cached + fresh (fresh gewinnt bei Dedup).
        const allByKey = new Map<string, StoredGeoFeature>();
        for (const f of cachedFeatures) allByKey.set(`${f.osmType}:${f.osmId}`, f);
        for (const [k, f] of freshByKey) allByKey.set(k, f);

        // 5. Radius-Filter.
        const matching: StoredGeoFeature[] = [];
        for (const f of allByKey.values()) {
            if (featureInRadius(f, { lat: q.lat, lng: q.lng }, q.radiusM)) {
                matching.push(f);
            }
        }

        // 6. mapElements erwartet OverpassRawElement[] — Payload zurueck parsen.
        //    Fresh-Elements haben wir noch roh, cached muessen wir deserialisieren.
        const rawByKey = new Map<string, OverpassRawElement>();
        for (const el of freshRawElements) {
            const k = `${el.type}:${el.id}`;
            rawByKey.set(k, el);
        }
        const finalRaw: OverpassRawElement[] = [];
        for (const f of matching) {
            const k = `${f.osmType}:${f.osmId}`;
            const cached = rawByKey.get(k);
            if (cached) {
                finalRaw.push(cached);
            } else {
                try {
                    const parsed = JSON.parse(f.payload) as OverpassRawElement;
                    finalRaw.push(parsed);
                } catch {
                    // Korrupt — ueberspringen
                }
            }
        }

        const result = this.mapElements(finalRaw, q);
        return this.postProcess(result, q);
    };

    /** Fallback-Pfad ohne Tile-Cache — nur fuer Dev/Test. */
    private async fetchAllTiles(
        tiles: TileKey[],
        facets: string[],
    ): Promise<OverpassRawElement[]> {
        const all: OverpassRawElement[] = [];
        for (const tile of tiles) {
            const bbox = tileBBox(tile);
            const overpassQuery = this.assembleOverpassQuery(bbox, facets);
            const raw = await fetchOverpassElementsWithFallback(overpassQuery, this.name);
            all.push(...raw);
        }
        return all;
    }

    /** Konvertiert ein Overpass-Raw-Element in einen FeatureUpsert. */
    private elementToUpsert(
        el: OverpassRawElement,
        facets: string[],
    ): FeatureUpsert {
        const ident = this.extractFeatureIdentity(el);
        const point = overpassElementRepresentativePoint(el);
        const bbox = deriveBBoxFromElement(el);
        const hasGeom = bbox !== null || point !== null;

        return {
            osmType: el.type,
            osmId: String(el.id),
            primaryKey: ident.primaryKey,
            primaryValue: ident.primaryValue,
            name: ident.name,
            hasGeom,
            lat: point?.lat ?? null,
            lng: point?.lng ?? null,
            bboxMinLat: bbox?.minLat ?? null,
            bboxMinLng: bbox?.minLng ?? null,
            bboxMaxLat: bbox?.maxLat ?? null,
            bboxMaxLng: bbox?.maxLng ?? null,
            payload: JSON.stringify(el),
            facets,
        };
    }
}

/** FeatureUpsert → StoredGeoFeature-Shape fuer den Inline-Merge-Pool. */
function upsertToStored(dogType: string, u: FeatureUpsert): StoredGeoFeature {
    return {
        dogType,
        osmType: u.osmType,
        osmId: u.osmId,
        primaryKey: u.primaryKey,
        primaryValue: u.primaryValue,
        name: u.name,
        hasGeom: u.hasGeom,
        lat: u.lat,
        lng: u.lng,
        bboxMinLat: u.bboxMinLat,
        bboxMinLng: u.bboxMinLng,
        bboxMaxLat: u.bboxMaxLat,
        bboxMaxLng: u.bboxMaxLng,
        payload: u.payload,
        updatedAt: Date.now(),
    };
}

/** Leitet eine BBox aus einem Overpass-Element ab, wenn Geometrie praesent ist. */
function deriveBBoxFromElement(el: OverpassRawElement): {
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
} | null {
    const points: Array<{ lat: number; lng: number }> = [];
    if (el.lat != null && el.lon != null) points.push({ lat: el.lat, lng: el.lon });
    if (el.center) points.push({ lat: el.center.lat, lng: el.center.lon });
    if (Array.isArray(el.geometry)) {
        for (const p of el.geometry) points.push({ lat: p.lat, lng: p.lon });
    }
    if (Array.isArray(el.members)) {
        for (const m of el.members) {
            if (Array.isArray(m.geometry)) {
                for (const p of m.geometry) points.push({ lat: p.lat, lng: p.lon });
            }
        }
    }
    if (points.length === 0) return null;
    let minLat = points[0].lat, maxLat = points[0].lat;
    let minLng = points[0].lng, maxLng = points[0].lng;
    for (const p of points) {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
    }
    return { minLat, minLng, maxLat, maxLng };
}
