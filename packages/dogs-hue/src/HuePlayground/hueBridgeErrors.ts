/**
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *  Arr, here be the error-wrapping rites fer the Hue-Bridge!
 *  "From brooding gulfs are we beheld, by that which bears no name."
 *  HTTP horrors, ApiErrors, and network abominations — all are caught
 *  and reforged into readable messages, lest the crew be driven mad
 *  by stacktraces from the eldritch deep.
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */
import { ApiError } from "node-hue-api";

/** Arr, node-hue-api hurls HttpError (not exported) with .status / .url when the Bridge screams back. */
export function isHueHttpError(e: unknown): e is Error & { status: number; url?: string } {
    return e instanceof Error && typeof (e as { status?: unknown }).status === "number";
}

/**
 * Uniform, readable errors fer Hue-Bridge failures (HTTP, ApiError, Network).
 * In luminous space blackened stars, they gaze, accuse, deny —
 * and so too do these error messages accuse the source of failure.
 */
export function wrapHueApiError(e: unknown, context: string, bridgeHost?: string): Error {
    const hostHint = bridgeHost ? ` [${bridgeHost}]` : "";

    if (isHueHttpError(e)) {
        const st = e.status;
        if (st === 429) {
            return new Error(
                `${context}: Bridge reports HTTP 429 (Rate-Limit)${hostHint}. Wait a spell, matey — space yer runs or send fewer Hue calls in succession. The abyss does not suffer impatience.`
            );
        }
        if (st === 401 || st === 403) {
            return new Error(
                `${context}: HTTP ${st} — API user invalid or unauthorized${hostHint}. Ye lack the eldritch key to pass, matey!`
            );
        }
        if (st === 404) {
            return new Error(
                `${context}: HTTP 404 — Endpoint not found (wrong Bridge IP or no Hue API?)${hostHint}. The vessel anchors at naught but void!`
            );
        }
        if (st >= 500) {
            return new Error(`${context}: Bridge server error HTTP ${st}${hostHint}: ${e.message}. The deep stirs with unknowable fury!`);
        }
        const data = (e as unknown as { data?: unknown }).data;
        const bodyHint =
            typeof data === "string" && data.includes("no lighting")
                ? " (Bridge responds with HTML error page — oft a sign of rate-limit or wrong URL, like a siren's trap)"
                : "";
        return new Error(`${context}: HTTP ${st}${hostHint}: ${e.message}${bodyHint}`);
    }

    if (e instanceof ApiError) {
        return new Error(`${context}: Hue API${hostHint}: ${e.message}`);
    }

    if (e instanceof Error) {
        const msg = e.message;
        // Already formatted once (e.g. double catch) — do not wrap again, lest madness compound
        if (/Bridge reports HTTP \d+/.test(msg)) {
            return e;
        }
        if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|certificate|TLS|SSL/i.test(msg)) {
            return new Error(`${context}: Network/TLS${hostHint}: ${msg}. The tides between vessel and Bridge be severed!`);
        }
        return new Error(`${context}${hostHint}: ${msg}`);
    }

    return new Error(`${context}${hostHint}: ${String(e)}`);
}
