import type { DiseaseResult } from "./interfaces/diseaseTypes";

const DISEASE_BASE = "https://disease.sh/v3";

const COVID_SCOPES: Record<string, (c?: string) => string> = {
    all: () => "covid-19/all",
    countries: () => "covid-19/countries",
    country: (c) => `covid-19/countries/${encodeURIComponent(c ?? "")}`,
};
const INFLUENZA_SCOPES: Record<string, () => string> = {
    all: () => "influenza/all",
    countries: () => "influenza/countries",
};
const EBOLA_SCOPES: Record<string, () => string> = {
    all: () => "ebola/all",
    countries: () => "ebola/countries",
};

async function diseaseFetch<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res: Response;
    try {
        res = await fetch(url, {
            headers: { "Accept": "application/json", "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)" },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`disease.sh failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function queryDisease(
    disease: string = "covid-19",
    scope: string = "all",
    country?: string,
): Promise<DiseaseResult> {
    const d = disease.toLowerCase();
    const s = scope.toLowerCase();

    let path: string | undefined;
    if (d === "covid-19" || d === "covid") {
        const builder = COVID_SCOPES[s];
        if (!builder) throw new Error(`DiseaseRetriever: invalid scope "${scope}" for covid-19 (expected: all, countries, country)`);
        if (s === "country" && !country?.trim()) throw new Error("DiseaseRetriever: scope=country requires 'country'");
        path = builder(country?.trim());
    } else if (d === "influenza") {
        const builder = INFLUENZA_SCOPES[s];
        if (!builder) throw new Error(`DiseaseRetriever: invalid scope "${scope}" for influenza (expected: all, countries)`);
        path = builder();
    } else if (d === "ebola") {
        const builder = EBOLA_SCOPES[s];
        if (!builder) throw new Error(`DiseaseRetriever: invalid scope "${scope}" for ebola (expected: all, countries)`);
        path = builder();
    } else {
        throw new Error(`DiseaseRetriever: unknown disease "${disease}" (expected: covid-19, influenza, ebola)`);
    }

    const data = await diseaseFetch<unknown>(`${DISEASE_BASE}/${path}`);
    return { disease: d === "covid" ? "covid-19" : d, scope: s, country: country?.trim(), data };
}
