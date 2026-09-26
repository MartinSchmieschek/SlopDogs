/**
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *  Arr, here be the Director — captain of all light-commanding rites!
 *  "Its heralds are the stars it fells, the sky and Earth aflame."
 *  This vessel holds the snapshot cache and methods to bend the Bridge
 *  to our will. Write-operations sail forth to the Hue-Bridge (side effects
 *  from the deep); upon success, the local cache be patched in kind.
 *
 *  **Rate-Limit Buffer:** All Bridge calls (refresh, setOn, ...) run in
 *  a serial queue, matey. After each completed step, a pause follows
 *  (`HUE_INTER_COMMAND_DELAY_MS`, default 120 ms) lest we anger the
 *  eldritch HTTP-429 guardian of the abyss.
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */
import { api } from "node-hue-api";
import type { HuePlaygroundLightEntry } from "./types";
import { fetchHueBridgeSnapshot } from "./hueSnapshot";
import { wrapHueApiError } from "./hueBridgeErrors";

/** Arr, the Bridge-Client conjured lazily from the node-hue-api depths. */
type HueApiClient = Awaited<ReturnType<ReturnType<typeof api.createLocal>["connect"]>>;

/** Parse the inter-command delay from the environment's murky waters. */
function parseInterCommandDelayMs(): number {
    const raw = process.env.HUE_INTER_COMMAND_DELAY_MS;
    if (raw === undefined || raw === "") {
        return 120;
    }
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) && n >= 0 ? n : 120;
}

/**
 * Arr, the Director — captain of all light-commanding rites aboard the Hue-Bridge!
 * Through endless faces countless forms, this eldritch helmsman holds the snapshot
 * cache and bends the lanterns to the crew's will. From brooding gulfs, it queues
 * commands one by one, lest the Bridge's rate-limit guardian rise from the deep.
 */
export class HuePlaygroundDirector {
    /** The current lantern cache — updated after every plunder (refresh/set*). */
    lights: HuePlaygroundLightEntry[];

    private _api: HueApiClient | null = null;

    /** Pause in ms after each completed Hue call, before the next in the queue stirs. */
    private readonly interCommandDelayMs: number;

    /** FIFO: waiting Hue operations; only one sails at a time through the void. */
    private queueTail: Promise<void> = Promise.resolve();

    /**
     * Summon the Director from the void, binding it to a Bridge and its lanterns.
     * Arr, corporeal laws unwritten decree that ye must provide anchor coordinates!
     * @param bridgeHost - The IP or hostname of the Hue-Bridge, dredged from the abyss.
     * @param bridgeUser - The eldritch API username token issued by the Bridge itself.
     * @param lights - The initial manifest of lanterns plundered from the Bridge's depths.
     */
    constructor(
        readonly bridgeHost: string,
        private readonly bridgeUser: string,
        lights: HuePlaygroundLightEntry[]
    ) {
        this.lights = [...lights];
        this.interCommandDelayMs = parseInterCommandDelayMs();
    }

    /**
     * Enqueue `fn` after the current queue — to cosmic madness laws submit,
     * though stalwart minds entreat. After completion, pause, then the next job rises.
     */
    private enqueueHue<T>(fn: () => Promise<T>): Promise<T> {
        const run = this.queueTail.then(() => fn());
        this.queueTail = run.then(
            async () => {
                if (this.interCommandDelayMs > 0) {
                    await new Promise<void>((r) => setTimeout(r, this.interCommandDelayMs));
                }
            },
            () => undefined
        );
        return run;
    }

    /** Only bridgeHost + lights — no credentials, no methods. Safe fer JSON/API, matey. */
    toJSON(): { bridgeHost: string; lights: HuePlaygroundLightEntry[] } {
        return { bridgeHost: this.bridgeHost, lights: this.lights };
    }

    /** Conjure the API client from the deep; callers (setOn/setState/...) wrap their own errors. */
    private async ensureApi(): Promise<HueApiClient> {
        if (!this._api) {
            this._api = await api.createLocal(this.bridgeHost.trim()).connect(this.bridgeUser.trim());
        }
        return this._api;
    }

    /** Reload all lanterns from the Bridge; overwrites `lights` — the old cache sinks into the abyss. */
    async refresh(): Promise<void> {
        const snap = await fetchHueBridgeSnapshot(this.bridgeHost, this.bridgeUser);
        this.lights = [...snap.lights];
    }

    /** Find a lantern by its id; peer into the roiling manifest of light. */
    getById(id: number | string): HuePlaygroundLightEntry | undefined {
        const s = String(id);
        return this.lights.find((l) => String(l.id) === s);
    }

    /** Search by name substring — in luminous space blackened stars, they gaze, accuse, deny. */
    findByName(nameSubstring: string): HuePlaygroundLightEntry | undefined {
        const lower = nameSubstring.toLowerCase();
        return this.lights.find((l) => l.name.toLowerCase().includes(lower));
    }

    /**
     * Switch a lantern on or off — arr, command the light to defy or embrace the void!
     */
    async setOn(id: number | string, on: boolean): Promise<void> {
        return this.enqueueHue(async () => {
            try {
                const hueApi = await this.ensureApi();
                await hueApi.lights.setLightState(id, { on });
                this.patchLocal(id, { on, ...(on ? {} : { bri: null }) });
            } catch (e: unknown) {
                throw wrapHueApiError(e, `HuePlaygroundDirector.setOn(${id})`, this.bridgeHost);
            }
        });
    }

    /**
     * Set brightness 1-254 (Hue scale). Turns the lantern on — ye cannot
     * illuminate what the abyss has already swallowed, so we force it alight.
     */
    async setBrightness(id: number | string, bri: number): Promise<void> {
        return this.enqueueHue(async () => {
            try {
                const clamped = Math.min(254, Math.max(1, Math.round(bri)));
                const hueApi = await this.ensureApi();
                await hueApi.lights.setLightState(id, { on: true, bri: clamped });
                this.patchLocal(id, { on: true, bri: clamped });
            } catch (e: unknown) {
                throw wrapHueApiError(e, `HuePlaygroundDirector.setBrightness(${id})`, this.bridgeHost);
            }
        });
    }

    /** Toggle the current state — invert it like the void inverts all reason, matey. If unknown, we refresh from the deep first. */
    async toggle(id: number | string): Promise<void> {
        let current = this.getById(id);
        if (!current) {
            await this.refresh();
            current = this.getById(id);
        }
        if (!current) {
            throw new Error(`HuePlaygroundDirector: no lantern with id ${id} — lost to the abyss!`);
        }
        await this.setOn(id, !current.on);
    }

    /**
     * Freely set Hue light-state fields (e.g. just `on`, or `on` + `bri`).
     * Carrion hordes trill their profane accord with eldritch plans —
     * and so too do we impose our will upon these cursed lanterns.
     */
    async setState(
        id: number | string,
        state: { on?: boolean; bri?: number }
    ): Promise<void> {
        return this.enqueueHue(async () => {
            try {
                const hueApi = await this.ensureApi();
                const body: Record<string, unknown> = {};
                if (state.on !== undefined) body.on = state.on;
                if (state.bri !== undefined) {
                    body.bri = Math.min(254, Math.max(1, Math.round(state.bri)));
                }
                await hueApi.lights.setLightState(id, body);
                const patch: Partial<Pick<HuePlaygroundLightEntry, "on" | "bri">> = {};
                if (state.on !== undefined) patch.on = state.on;
                if (state.bri !== undefined) patch.bri = state.bri;
                if (state.on === false) patch.bri = null;
                this.patchLocal(id, patch);
            } catch (e: unknown) {
                throw wrapHueApiError(e, `HuePlaygroundDirector.setState(${id})`, this.bridgeHost);
            }
        });
    }

    /** Patch the local cache — to cosmic forms from tangent planes, we end as we began. */
    private patchLocal(
        id: number | string,
        patch: Partial<Pick<HuePlaygroundLightEntry, "on" | "bri">>
    ): void {
        const s = String(id);
        const idx = this.lights.findIndex((l) => String(l.id) === s);
        if (idx < 0) {
            return;
        }
        this.lights[idx] = { ...this.lights[idx], ...patch };
    }
}
