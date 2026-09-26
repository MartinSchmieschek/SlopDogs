/**
 * ~~~ THE PRISMA TILE FEATURE CACHE ~~~
 *
 * Atomarer Geo-Feature-Store auf Slippy-Map-Tiles (Multi-Zoom).
 *
 * Drei Modelle in cache.db:
 *  - GeoFeature: 1 Zeile pro (dogType, osmType, osmId) mit voller Geometrie + Payload.
 *  - FeatureTileMembership: Mapping-Tabelle (feature × zoom × tile × facet).
 *  - TileCoverage: (dogType, zoom, tile, facet, expiresAt) — "wir haben hier gefetcht".
 *
 * Ablauf pro Query:
 *  1. getCoveredFeatures(dogType, tiles, facets) laedt aktive Coverages +
 *     alle Features, deren Membership auf eine der angefragten Kombinationen passt.
 *     Der Dog bekommt {features, missing[]} zurueck.
 *  2. Dog fetcht die missing (tile, facet) per Overpass und ruft
 *     storeFetchResult(...) auf. Features werden per OSM-ID dedupliziert;
 *     Membership wird in *alle* Tiles gesetzt, die die Feature-BBox schneiden
 *     (groesseres Polygon → mehrere Tiles).
 *  3. prune() loescht expired Coverages, danach verwaiste Memberships und
 *     zuletzt Features ohne verbleibende Membership.
 *
 * In-flight dedup pro (dogType, zoom, tile, facet) wird NICHT hier gemacht —
 * dafuer ist das auf der Ebene der Overpass-Factory (PrismaCacheHandler.getOrFetch)
 * zustaendig, mit eigenem Key pro Tile+Facet.
 */

import type { PrismaClient } from '../store/generated/prisma-cache-client';
import {
    isRuntimeLogVerbose,
    tilesIntersectingBBox,
    tileKeyString,
    type ITileFeatureCache,
    type StoredGeoFeature,
    type TileCoverageResult,
    type TileFetchResult,
    type TileKey,
} from '@slopdogs/core';

interface CoverageRow {
    dogType: string;
    zoom: number;
    tileX: number;
    tileY: number;
    facet: string;
    fetchedAt: bigint;
    expiresAt: bigint;
}

interface FeatureRow {
    dogType: string;
    osmType: string;
    osmId: bigint;
    primaryKey: string | null;
    primaryValue: string | null;
    name: string | null;
    hasGeom: boolean;
    lat: number | null;
    lng: number | null;
    bboxMinLat: number | null;
    bboxMinLng: number | null;
    bboxMaxLat: number | null;
    bboxMaxLng: number | null;
    payload: string;
    updatedAt: bigint;
}

export class PrismaTileFeatureCache implements ITileFeatureCache {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async getCoveredFeatures(
        dogType: string,
        tiles: TileKey[],
        facets: string[],
    ): Promise<TileCoverageResult> {
        if (tiles.length === 0 || facets.length === 0) {
            return { features: [], missing: [] };
        }

        const now = BigInt(Date.now());

        // Alle Coverages fuer (dogType, zoom, tile, facet) in einem Schwung.
        // Wir filtern auf zoom-Gruppe(n) — typisch ist pro Query genau ein Zoom,
        // aber der Interface-Vertrag erlaubt theoretisch Mehrzoom.
        const zoomBuckets = new Map<number, TileKey[]>();
        for (const t of tiles) {
            const bucket = zoomBuckets.get(t.zoom) ?? [];
            bucket.push(t);
            zoomBuckets.set(t.zoom, bucket);
        }

        const activeCoverageKeys = new Set<string>(); // "zoom/x/y/facet"
        for (const [zoom, tilesInZoom] of zoomBuckets) {
            const rows = (await this.prisma.tileCoverage.findMany({
                where: {
                    dogType,
                    zoom,
                    facet: { in: facets },
                    expiresAt: { gt: now },
                    OR: tilesInZoom.map((t) => ({ tileX: t.x, tileY: t.y })),
                },
            })) as CoverageRow[];
            for (const r of rows) {
                activeCoverageKeys.add(`${r.zoom}/${r.tileX}/${r.tileY}/${r.facet}`);
            }
        }

        // Fehlende Kombinationen ermitteln.
        const missing: Array<{ tile: TileKey; facet: string }> = [];
        for (const t of tiles) {
            for (const f of facets) {
                if (!activeCoverageKeys.has(`${t.zoom}/${t.x}/${t.y}/${f}`)) {
                    missing.push({ tile: t, facet: f });
                }
            }
        }

        // Features fuer aktive Coverages holen: zweistufig via Prisma high-level
        // (dialektneutral fuer SQLite + PostgreSQL). OR-Listen werden gechunkt,
        // damit weder SQLite-Param-Limit noch PostgreSQL-Statement-Laenge stoeren.
        const features: StoredGeoFeature[] = [];
        if (activeCoverageKeys.size > 0) {
            const coverageConditions: Array<{
                zoom: number;
                tileX: number;
                tileY: number;
                facet: string;
            }> = [];
            for (const key of activeCoverageKeys) {
                const [z, x, y, ...facetRest] = key.split('/');
                coverageConditions.push({
                    zoom: Number(z),
                    tileX: Number(x),
                    tileY: Number(y),
                    facet: facetRest.join('/'),
                });
            }

            // 1) Memberships, die auf eine aktive Coverage matchen — gechunkt.
            const COVERAGE_CHUNK = 100;
            const refKeys = new Set<string>();
            const refs: Array<{ osmType: string; osmId: bigint }> = [];
            for (let i = 0; i < coverageConditions.length; i += COVERAGE_CHUNK) {
                const chunk = coverageConditions.slice(i, i + COVERAGE_CHUNK);
                const memRows = (await this.prisma.featureTileMembership.findMany({
                    where: { dogType, OR: chunk },
                    select: { osmType: true, osmId: true },
                })) as Array<{ osmType: string; osmId: bigint }>;
                for (const m of memRows) {
                    const k = `${m.osmType}:${m.osmId.toString()}`;
                    if (!refKeys.has(k)) {
                        refKeys.add(k);
                        refs.push({ osmType: m.osmType, osmId: m.osmId });
                    }
                }
            }

            // 2) Features fuer die deduplizierten Refs — auch gechunkt.
            const FEATURE_LOOKUP_CHUNK = 200;
            for (let i = 0; i < refs.length; i += FEATURE_LOOKUP_CHUNK) {
                const chunk = refs.slice(i, i + FEATURE_LOOKUP_CHUNK);
                const featureRows = (await this.prisma.geoFeature.findMany({
                    where: { dogType, OR: chunk },
                })) as FeatureRow[];
                for (const r of featureRows) {
                    features.push(this.rowToStored(r));
                }
            }
        }

        if (isRuntimeLogVerbose()) {
            console.log(
                `[TileFeatureCache] getCovered dogType=${dogType} tiles=${tiles.length} facets=${facets.length} → ${features.length} features, ${missing.length} missing`,
            );
        }

        return { features, missing };
    }

    async storeFetchResult(
        dogType: string,
        result: TileFetchResult,
        ttlMs: number,
    ): Promise<void> {
        const now = BigInt(Date.now());
        const expiresAt = BigInt(Date.now() + ttlMs);
        const fetchTile = result.tile;

        // Membership-Rows pro Feature berechnen (Feature-BBox x Facets → Tiles).
        interface MemRow {
            osmType: string;
            osmId: bigint;
            zoom: number;
            tileX: number;
            tileY: number;
            facet: string;
        }
        const memberships: MemRow[] = [];
        for (const f of result.features) {
            const osmId = BigInt(f.osmId);
            const membershipTiles: TileKey[] = [];
            if (
                f.hasGeom &&
                f.bboxMinLat != null &&
                f.bboxMinLng != null &&
                f.bboxMaxLat != null &&
                f.bboxMaxLng != null
            ) {
                membershipTiles.push(
                    ...tilesIntersectingBBox(
                        {
                            minLat: f.bboxMinLat,
                            minLng: f.bboxMinLng,
                            maxLat: f.bboxMaxLat,
                            maxLng: f.bboxMaxLng,
                        },
                        fetchTile.zoom,
                    ),
                );
            } else {
                membershipTiles.push(fetchTile);
            }
            for (const facet of f.facets) {
                for (const tile of membershipTiles) {
                    memberships.push({
                        osmType: f.osmType,
                        osmId,
                        zoom: tile.zoom,
                        tileX: tile.x,
                        tileY: tile.y,
                        facet,
                    });
                }
            }
        }

        // Dialektneutrale Bulk-Variante via Prisma high-level. Upsert-Semantik
        // bilden wir mit deleteMany + createMany ab (eine Loesch-, eine Schreib-
        // Round-Trip pro Chunk). skipDuplicates ist im SQLite-Client nicht typisiert,
        // darum: vor jedem createMany loeschen wir die zu ersetzenden Reihen explizit.
        // Chunk-Groessen so gewaehlt, dass die Param-Anzahl unter dem klassischen
        // SQLite-Limit (999) bleibt: 60 Features × 15 Spalten = 900, 120 Memberships
        // × 7 Spalten = 840. PostgreSQL traegt locker mehr — Untergrenze regiert.
        const FEATURE_CHUNK = 60;
        const MEM_CHUNK = 120;

        // Alles innerhalb einer Transaktion → atomar und ohne parallele Write-Lock-Konflikte.
        // Timeout generous: SQLite serialisiert Writes, PostgreSQL kann unter Last warten.
        await this.prisma.$transaction(async (tx) => {
            // 1. Features upsert: alte Reihen mit gleichem PK loeschen, dann createMany.
            for (let i = 0; i < result.features.length; i += FEATURE_CHUNK) {
                const chunk = result.features.slice(i, i + FEATURE_CHUNK);
                if (chunk.length === 0) continue;
                const refs = chunk.map((f) => ({
                    osmType: f.osmType,
                    osmId: BigInt(f.osmId),
                }));
                await tx.geoFeature.deleteMany({
                    where: { dogType, OR: refs },
                });
                await tx.geoFeature.createMany({
                    data: chunk.map((f) => ({
                        dogType,
                        osmType: f.osmType,
                        osmId: BigInt(f.osmId),
                        primaryKey: f.primaryKey,
                        primaryValue: f.primaryValue,
                        name: f.name,
                        hasGeom: f.hasGeom,
                        lat: f.lat,
                        lng: f.lng,
                        bboxMinLat: f.bboxMinLat,
                        bboxMinLng: f.bboxMinLng,
                        bboxMaxLat: f.bboxMaxLat,
                        bboxMaxLng: f.bboxMaxLng,
                        payload: f.payload,
                        updatedAt: now,
                    })),
                });
            }

            // 2. Memberships: vor dem Insert die alten Memberships fuer
            //    (Feature, refreshed-Facet) loeschen. Memberships fuer Facets,
            //    die in diesem Fetch nicht angefasst wurden, bleiben unberuehrt.
            if (result.features.length > 0 && result.facets.length > 0) {
                for (let i = 0; i < result.features.length; i += FEATURE_CHUNK) {
                    const refs = result.features.slice(i, i + FEATURE_CHUNK).map((f) => ({
                        osmType: f.osmType,
                        osmId: BigInt(f.osmId),
                    }));
                    await tx.featureTileMembership.deleteMany({
                        where: {
                            dogType,
                            facet: { in: result.facets },
                            OR: refs,
                        },
                    });
                }
            }
            for (let i = 0; i < memberships.length; i += MEM_CHUNK) {
                const chunk = memberships.slice(i, i + MEM_CHUNK);
                if (chunk.length === 0) continue;
                await tx.featureTileMembership.createMany({
                    data: chunk.map((m) => ({
                        dogType,
                        osmType: m.osmType,
                        osmId: m.osmId,
                        zoom: m.zoom,
                        tileX: m.tileX,
                        tileY: m.tileY,
                        facet: m.facet,
                    })),
                });
            }

            // 3. Coverage upsert: alte Reihen fuer (tile, facet)-Kombi loeschen,
            //    dann createMany (auch bei 0 Features — Negative-Cache).
            if (result.facets.length > 0) {
                await tx.tileCoverage.deleteMany({
                    where: {
                        dogType,
                        zoom: fetchTile.zoom,
                        tileX: fetchTile.x,
                        tileY: fetchTile.y,
                        facet: { in: result.facets },
                    },
                });
                await tx.tileCoverage.createMany({
                    data: result.facets.map((facet) => ({
                        dogType,
                        zoom: fetchTile.zoom,
                        tileX: fetchTile.x,
                        tileY: fetchTile.y,
                        facet,
                        fetchedAt: now,
                        expiresAt,
                    })),
                });
            }
        }, {
            maxWait: 60_000,
            timeout: 60_000,
        });

        if (isRuntimeLogVerbose()) {
            console.log(
                `[TileFeatureCache] stored dogType=${dogType} tile=${tileKeyString(fetchTile)} facets=[${result.facets.join(',')}] features=${result.features.length}`,
            );
        }
    }

    async invalidateDogType(dogType: string): Promise<void> {
        await this.prisma.tileCoverage.deleteMany({ where: { dogType } });
        await this.prisma.featureTileMembership.deleteMany({ where: { dogType } });
        await this.prisma.geoFeature.deleteMany({ where: { dogType } });
    }

    /**
     * Prune-Pipeline:
     *  a) Expired Coverages loeschen.
     *  b) Memberships, deren (dogType, zoom, tile, facet) keine aktive Coverage
     *     mehr hat, loeschen.
     *  c) Features ohne verbleibende Membership loeschen (Orphan-GC).
     */
    async prune(): Promise<{ coverages: number; memberships: number; features: number }> {
        const now = BigInt(Date.now());

        const expired = (await this.prisma.tileCoverage.findMany({
            where: { expiresAt: { lte: now } },
            select: {
                dogType: true,
                zoom: true,
                tileX: true,
                tileY: true,
                facet: true,
            },
        })) as Array<{
            dogType: string;
            zoom: number;
            tileX: number;
            tileY: number;
            facet: string;
        }>;

        let removedCoverages = 0;
        let removedMemberships = 0;
        if (expired.length > 0) {
            const covDelete = await this.prisma.tileCoverage.deleteMany({
                where: { expiresAt: { lte: now } },
            });
            removedCoverages = covDelete.count;

            // Memberships die auf die geloeschten Coverages matchen.
            // Chunked delete um IN-Listen handhabbar zu halten.
            const chunkSize = 50;
            for (let i = 0; i < expired.length; i += chunkSize) {
                const chunk = expired.slice(i, i + chunkSize);
                const memDelete = await this.prisma.featureTileMembership.deleteMany({
                    where: {
                        OR: chunk.map((e) => ({
                            dogType: e.dogType,
                            zoom: e.zoom,
                            tileX: e.tileX,
                            tileY: e.tileY,
                            facet: e.facet,
                        })),
                    },
                });
                removedMemberships += memDelete.count;
            }
        }

        // Orphan-Features: dogType + (osmType, osmId) ohne Membership-Eintrag.
        //
        // Frueher zog dieser Schritt BEIDE Tabellen vollstaendig in den Heap (alle
        // Membership-Referenzen in ein Set, danach alle Features) und bildete das Delta
        // in JS. Bei einem Prune-Intervall im Minutentakt war das der Dauer-Treiber der
        // RSS-Wasserlinie: jede Spitze nagelt sie fest, der Heap gibt sie nicht zurueck.
        // Jetzt macht die DB das Delta — ein Statement, nichts davon reist durch Node.
        //
        // Bezeichner in doppelten Anfuehrungszeichen: Postgres UND SQLite quoten so,
        // der Cache kann beides sein (siehe scripts/dbEnv.cjs). Das Delete-Ziel bleibt
        // unaliasiert und wird in der Unterabfrage voll qualifiziert — ein Alias auf dem
        // DELETE-Ziel ist nicht auf beiden Dialekten verlaesslich.
        const removedFeatures = await this.prisma.$executeRaw`
            DELETE FROM "GeoFeature"
            WHERE NOT EXISTS (
                SELECT 1 FROM "FeatureTileMembership" m
                WHERE m."dogType" = "GeoFeature"."dogType"
                  AND m."osmType" = "GeoFeature"."osmType"
                  AND m."osmId" = "GeoFeature"."osmId"
            )
        `;

        if (isRuntimeLogVerbose() && (removedCoverages + removedMemberships + removedFeatures) > 0) {
            console.log(
                `[TileFeatureCache] pruned coverages=${removedCoverages} memberships=${removedMemberships} features=${removedFeatures}`,
            );
        }

        return {
            coverages: removedCoverages,
            memberships: removedMemberships,
            features: removedFeatures,
        };
    }

    private rowToStored(r: FeatureRow): StoredGeoFeature {
        return {
            dogType: r.dogType,
            osmType: r.osmType,
            osmId: r.osmId.toString(),
            primaryKey: r.primaryKey,
            primaryValue: r.primaryValue,
            name: r.name,
            hasGeom: r.hasGeom,
            lat: r.lat,
            lng: r.lng,
            bboxMinLat: r.bboxMinLat,
            bboxMinLng: r.bboxMinLng,
            bboxMaxLat: r.bboxMaxLat,
            bboxMaxLng: r.bboxMaxLng,
            payload: r.payload,
            updatedAt: Number(r.updatedAt),
        };
    }
}
