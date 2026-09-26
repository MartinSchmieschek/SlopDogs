import type { TriviaApiResponse, TriviaResult } from "./interfaces/triviaTypes";

const TRIVIA_BASE = "https://opentdb.com/api.php";

export async function getTrivia(
    amount: number = 10,
    category?: number,
    difficulty?: string,
    type?: string,
): Promise<TriviaResult> {
    const clampedAmount = Math.max(1, Math.min(50, Math.floor(amount)));
    const params = new URLSearchParams({ amount: String(clampedAmount), encode: "url3986" });
    if (category && category > 0) params.set("category", String(Math.floor(category)));
    if (difficulty && difficulty.trim()) params.set("difficulty", difficulty.trim());
    if (type && (type === "multiple" || type === "boolean")) params.set("type", type);

    const url = `${TRIVIA_BASE}?${params.toString()}`;

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
        throw new Error(`opentdb failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const data = await res.json() as TriviaApiResponse;
    if (data.response_code !== 0) {
        throw new Error(`opentdb response_code=${data.response_code}`);
    }
    // URL-decode because we asked for encode=url3986
    const decoded = data.results.map(q => ({
        ...q,
        category: decodeURIComponent(q.category),
        question: decodeURIComponent(q.question),
        correct_answer: decodeURIComponent(q.correct_answer),
        incorrect_answers: q.incorrect_answers.map(a => decodeURIComponent(a)),
        difficulty: decodeURIComponent(q.difficulty),
    })) as TriviaApiResponse["results"];
    return { amount: clampedAmount, questions: decoded };
}
