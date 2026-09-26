import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, geoBucketKey } from "@slopdogs/core";
import { ChargingQueryPact, type ChargingQuery } from "./pacts";

const DEFAULT_RADIUS_KM = 5;
const MAX_RADIUS_KM = 50;

export interface ChargingConnection {
    type: string;
    powerKW: number;
    quantity: number;
}

export interface ChargingStation {
    lat: number;
    lng: number;
    name: string;
    address: string;
    distance: number;
    connections: ChargingConnection[];
    operator?: string;
    isOperational: boolean;
    isFree: boolean;
    usageCost?: string;
}

export interface ChargingResult {
    center: { lat: number; lng: number };
    radiusKm: number;
    stations: ChargingStation[];
    counts: { total: number; operational: number; free: number };
}

function clampRadius(parsed: number): number {
    if (isNaN(parsed) || parsed < 1) return DEFAULT_RADIUS_KM;
    return Math.min(Math.round(parsed), MAX_RADIUS_KM);
}

interface OCMConnection {
    ConnectionType?: { Title?: string };
    PowerKW?: number;
    Quantity?: number;
}

interface OCMEntry {
    AddressInfo?: {
        Latitude?: number;
        Longitude?: number;
        Title?: string;
        AddressLine1?: string;
        Town?: string;
        Distance?: number;
    };
    Connections?: OCMConnection[];
    OperatorInfo?: { Title?: string };
    StatusType?: { IsOperational?: boolean };
    UsageCost?: string;
}

export class ChargingStationRetriever extends Dog<ChargingResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return ChargingStationRetriever.name;
    }

    get description(): string {
        return "Finds nearby EV charging stations via the Open Charge Map API.";
    }

    get icon(): string | undefined {
        return "\u26A1";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [ChargingQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<ChargingResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(ChargingQueryPact, d));
        const query = (queryDog?.collected as ChargingQuery | undefined) ?? ({} as ChargingQuery);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusKm = clampRadius(parseFloat(query.radius ?? ""));

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error("ChargingStationRetriever: Missing required query params (lat, lng)");
        }

        const key = geoBucketKey("charging", lat, lng, radiusKm * 1000);

        const fetchStations = async (): Promise<ChargingResult> => {
            const url =
                `https://api.openchargemap.io/v3/poi?output=json` +
                `&latitude=${lat}&longitude=${lng}` +
                `&distance=${radiusKm}&distanceunit=KM` +
                `&maxresults=100&compact=true&verbose=false`;

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 20000);

            let res: Response;
            try {
                res = await fetch(url, {
                    method: "GET",
                    headers: { "User-Agent": "SlopDogs/ChargingStationRetriever" },
                    signal: controller.signal,
                });
            } finally {
                clearTimeout(timer);
            }

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(
                    `ChargingStationRetriever: HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`
                );
            }

            const raw: OCMEntry[] = await res.json() as OCMEntry[];

            const stations: ChargingStation[] = raw
                .filter(e => e.AddressInfo?.Latitude != null && e.AddressInfo?.Longitude != null)
                .map(e => {
                    const addr = e.AddressInfo!;
                    const connections: ChargingConnection[] = (e.Connections ?? []).map(c => ({
                        type: c.ConnectionType?.Title ?? "Unknown",
                        powerKW: c.PowerKW ?? 0,
                        quantity: c.Quantity ?? 1,
                    }));

                    const addressParts = [addr.AddressLine1, addr.Town].filter(Boolean);

                    return {
                        lat: addr.Latitude!,
                        lng: addr.Longitude!,
                        name: addr.Title ?? "Unknown Station",
                        address: addressParts.join(", ") || "Unknown",
                        distance: addr.Distance ?? 0,
                        connections,
                        operator: e.OperatorInfo?.Title,
                        isOperational: e.StatusType?.IsOperational ?? true,
                        isFree: (e.UsageCost ?? "").toLowerCase().includes("free") ||
                                (e.UsageCost ?? "").toLowerCase().includes("kostenlos"),
                        usageCost: e.UsageCost || undefined,
                    };
                });

            const operational = stations.filter(s => s.isOperational).length;
            const free = stations.filter(s => s.isFree).length;

            return {
                center: { lat, lng },
                radiusKm,
                stations,
                counts: { total: stations.length, operational, free },
            };
        };

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 30 * 60_000, fetchStations);
        }
        return fetchStations();
    };
}
