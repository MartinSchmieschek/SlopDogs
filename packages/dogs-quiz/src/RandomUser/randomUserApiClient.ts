import type { RandomUserResult } from "./interfaces/randomUserTypes";

const RU_BASE = "https://randomuser.me/api/";

export async function getRandomUsers(
    results: number = 1,
    gender?: string,
    nat?: string,
    seed?: string,
): Promise<RandomUserResult> {
    const clamped = Math.max(1, Math.min(5000, Math.floor(results)));
    const params = new URLSearchParams({ results: String(clamped) });
    if (gender && (gender === "male" || gender === "female")) params.set("gender", gender);
    if (nat && nat.trim()) params.set("nat", nat.trim());
    if (seed && seed.trim()) params.set("seed", seed.trim());

    const url = `${RU_BASE}?${params.toString()}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
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
        throw new Error(`randomuser.me failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const body = await res.json() as { results: unknown[]; info?: unknown };
    return { results: body.results?.length ?? 0, data: body.results ?? [], info: body.info };
}
