import type { LibreTranslateApiResponse, LibreTranslateResult } from "./interfaces/libreTranslateTypes";

/**
 * LibreTranslate: Open-Source-Uebersetzer. libretranslate.com verlangt mittlerweile
 * einen API-Key. Wir nutzen die oeffentliche Community-Instanz translate.fedilab.app
 * bzw. lassen ueber LIBRETRANSLATE_URL (ENV) eine andere Instanz setzen.
 * Fallback-Reihenfolge: ENV -> Fedilab -> Terraprint -> Argos.
 */
const DEFAULT_INSTANCES = [
    "https://translate.fedilab.app",
    "https://translate.terraprint.co",
    "https://translate.argosopentech.com",
];

function instances(): string[] {
    const env = process.env.LIBRETRANSLATE_URL?.trim();
    return env ? [env, ...DEFAULT_INSTANCES] : DEFAULT_INSTANCES;
}

async function tryInstance(base: string, text: string, source: string, target: string): Promise<LibreTranslateResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res: Response;
    try {
        res = await fetch(`${base.replace(/\/$/, "")}/translate`, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)",
            },
            body: JSON.stringify({ q: text, source, target, format: "text" }),
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`libretranslate ${base} failed: ${res.status} ${res.statusText} ${t.slice(0, 200)}`);
    }
    const data = await res.json() as LibreTranslateApiResponse;
    if (data.error) {
        throw new Error(`libretranslate ${base} error: ${data.error}`);
    }
    return {
        source,
        target,
        originalText: text,
        translatedText: data.translatedText ?? "",
        detectedLanguage: data.detectedLanguage?.language,
        detectedConfidence: data.detectedLanguage?.confidence,
        instance: base,
    };
}

export async function translateText(text: string, source: string = "auto", target: string = "en"): Promise<LibreTranslateResult> {
    if (!text || !text.trim()) {
        throw new Error("LibreTranslateRetriever: 'text' is required");
    }
    const attempts: string[] = [];
    for (const base of instances()) {
        try {
            return await tryInstance(base, text.trim(), source, target);
        } catch (e: any) {
            attempts.push(`${base}: ${e?.message ?? e}`);
        }
    }
    throw new Error(`LibreTranslate: all community instances failed:\n  ${attempts.join("\n  ")}`);
}
