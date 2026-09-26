// DogReuseAdvisor — "wiederverwenden wenn gefunden und toll" (10-0, Feature-Runde nach dem lokalen Test).
// build_kennel legt frische Dogs an; heisst einer davon so oder beschreibt sich so wie ein bestehender
// BEWAEHRTER Dog, den der Aufrufer ausfuehren darf, bekommt die Antwort einen Hinweis mit dessen lineageId.
// Rein beratend: nichts wird blockiert, nichts ersetzt. Die Aehnlichkeit ist bewusst schlicht und
// deterministisch (Woerter statt Einbettungen) — ein Hinweis zu wenig ist billiger als ein falscher.
import type { DogStats } from './DogStatsService';

/** Ein frisch gebauter Dog aus diesem build_kennel-Aufruf. */
export interface BuiltDog {
    displayName: string;
    lineageId: string;
    description?: string | null;
}

/** Ein bestehender Dog, den der Aufrufer ausfuehren darf — mit `stats` (DogStatsService.attach). */
export interface ReuseCandidate {
    id: string;
    lineageId?: string;
    displayName?: string | null;
    name?: string | null;
    description?: string | null;
    /** Nur ausfuehrbar, nicht lesbar (P3.5): referenziert wird er ueber seine Versions-GUID (`id`). */
    runOnly?: boolean;
    stats?: Pick<DogStats, 'proven'> & Partial<DogStats>;
}

export type ReuseReason = 'same-name' | 'similar-name' | 'similar-description';

export interface ReuseHint {
    /** displayName des neuen Dogs. */
    dog: string;
    lineageId: string;
    reason: ReuseReason;
    /** 1 bei gleichem Namen, sonst die Wort-Ueberdeckung (Jaccard, 0..1, zwei Nachkommastellen). */
    similarity: number;
    suggestion: {
        /** lineageId des bewaehrten Dogs (Base-Dogs: `base:<Klasse>`) — so wird er referenziert. */
        lineageId: string;
        /** Nur bei run-only-Dogs: die Versions-GUID, an die ein fremder run-only-Dog gepinnt wird. */
        versionId?: string;
        displayName: string;
        description: string | null;
        proven: { score: number; badge: boolean; reliability: number };
    };
    message: string;
}

/** Woerter, die in Namen und Beschreibungen nichts unterscheiden. */
const STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'into', 'this', 'that', 'one', 'its', 'are', 'was', 'per', 'via', 'als',
    'der', 'die', 'das', 'und', 'mit', 'fuer', 'von', 'aus', 'ein', 'eine', 'einen', 'dem', 'den', 'des',
    'dog', 'returns', 'return', 'yields', 'yield', 'data', 'liefert',
]);

export class DogReuseAdvisor {
    /** Ab dieser Wort-Ueberdeckung gilt ein Name als "sehr aehnlich". */
    static readonly NAME_SIMILARITY = 0.6;
    /** Ab dieser Wort-Ueberdeckung gilt eine Beschreibung als "sehr aehnlich" (bei mindestens 3 Woertern je Seite). */
    static readonly DESCRIPTION_SIMILARITY = 0.6;
    static readonly MIN_DESCRIPTION_WORDS = 3;

    /**
     * Je neuem Dog hoechstens ein Hinweis: der bewaehrte Kandidat mit dem staerksten Grund (gleicher Name vor
     * aehnlichem Namen vor aehnlicher Beschreibung), bei Gleichstand der hoehere proven-Score. Kandidaten ohne
     * Abzeichen (`stats.proven.badge`) und die neuen Dogs selbst zaehlen nicht.
     */
    hintsFor(built: BuiltDog[], candidates: ReuseCandidate[]): ReuseHint[] {
        const fresh = new Set(built.map((b) => b.lineageId));
        const proven = candidates.filter((c) => c.stats?.proven?.badge === true && !fresh.has(DogReuseAdvisor.keyOf(c)));
        const hints: ReuseHint[] = [];
        for (const dog of built) {
            let best: { candidate: ReuseCandidate; reason: ReuseReason; similarity: number } | null = null;
            for (const candidate of proven) {
                const match = DogReuseAdvisor.match(dog, candidate);
                if (!match) continue;
                if (!best || DogReuseAdvisor.stronger(match, candidate, best)) best = { candidate, ...match };
            }
            if (best) hints.push(DogReuseAdvisor.hintOf(dog, best.candidate, best.reason, best.similarity));
        }
        return hints;
    }

    /** Warum `dog` wie `candidate` aussieht — oder null. */
    static match(dog: BuiltDog, candidate: ReuseCandidate): { reason: ReuseReason; similarity: number } | null {
        const a = DogReuseAdvisor.words(dog.displayName, false);
        const b = DogReuseAdvisor.words(DogReuseAdvisor.nameOf(candidate), false);
        if (a.length > 0 && a.join(' ') === b.join(' ')) return { reason: 'same-name', similarity: 1 };
        const names = DogReuseAdvisor.jaccard(a, b);
        if (Math.min(a.length, b.length) >= 2 && names >= DogReuseAdvisor.NAME_SIMILARITY) {
            return { reason: 'similar-name', similarity: DogReuseAdvisor.round(names) };
        }
        const da = DogReuseAdvisor.words(dog.description ?? '', true);
        const db = DogReuseAdvisor.words(candidate.description ?? '', true);
        if (Math.min(da.length, db.length) < DogReuseAdvisor.MIN_DESCRIPTION_WORDS) return null;
        const texts = DogReuseAdvisor.jaccard(da, db);
        return texts >= DogReuseAdvisor.DESCRIPTION_SIMILARITY ? { reason: 'similar-description', similarity: DogReuseAdvisor.round(texts) } : null;
    }

    /**
     * Woerter eines Namens oder Textes: CamelCase und Ziffern trennen, klein, ohne Satzzeichen; fuer Texte ohne
     * Fuellwoerter und ohne Woerter unter 3 Zeichen. Namen behalten die Reihenfolge (gleicher Name = gleiche Folge).
     */
    static words(text: string, isDescription: boolean): string[] {
        const split = String(text ?? '')
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
            .toLowerCase()
            .split(/[^a-z0-9äöüß]+/)
            .filter(Boolean);
        if (!isDescription) return split;
        return [...new Set(split.filter((w) => w.length >= 3 && !STOP_WORDS.has(w)))];
    }

    private static jaccard(a: string[], b: string[]): number {
        const x = new Set(a);
        const y = new Set(b);
        if (x.size === 0 || y.size === 0) return 0;
        let common = 0;
        for (const w of x) if (y.has(w)) common += 1;
        return common / (x.size + y.size - common);
    }

    private static readonly RANK: Record<ReuseReason, number> = { 'same-name': 3, 'similar-name': 2, 'similar-description': 1 };

    private static stronger(
        match: { reason: ReuseReason; similarity: number },
        candidate: ReuseCandidate,
        best: { candidate: ReuseCandidate; reason: ReuseReason; similarity: number },
    ): boolean {
        const rank = DogReuseAdvisor.RANK[match.reason] - DogReuseAdvisor.RANK[best.reason];
        if (rank !== 0) return rank > 0;
        if (match.similarity !== best.similarity) return match.similarity > best.similarity;
        return (candidate.stats?.proven?.score ?? 0) > (best.candidate.stats?.proven?.score ?? 0);
    }

    private static hintOf(dog: BuiltDog, candidate: ReuseCandidate, reason: ReuseReason, similarity: number): ReuseHint {
        const lineageId = DogReuseAdvisor.keyOf(candidate);
        const displayName = DogReuseAdvisor.nameOf(candidate);
        const proven = candidate.stats!.proven;
        const why = reason === 'same-name' ? 'has the same name as'
            : reason === 'similar-name' ? 'has a name very close to' : 'describes itself like';
        const ref = candidate.runOnly ? candidate.id : lineageId;
        const how = candidate.runOnly
            ? `reference its version ${candidate.id} (run-only: you may run it, not read it) in parentsRequired or extraDogIds`
            : `reference ${lineageId} in parentsRequired or extraDogIds`;
        return {
            dog: dog.displayName,
            lineageId: dog.lineageId,
            reason,
            similarity,
            suggestion: {
                lineageId,
                displayName,
                ...(candidate.runOnly ? { versionId: candidate.id } : {}),
                description: candidate.description ?? null,
                proven: { score: proven.score, badge: proven.badge, reliability: proven.reliability },
            },
            message: `"${dog.displayName}" ${why} the proven dog "${displayName}" (${ref}, proven ${proven.score}, reliability ${proven.reliability}). `
                + `If it does the same job, reuse it — ${how} — and write only what is missing. Nothing was blocked.`,
        };
    }

    /** Der Referenz-Schluessel: lineageId, sonst die id (Base-Dogs tragen `base:<Klasse>`). */
    private static keyOf(c: ReuseCandidate): string {
        return c.lineageId || c.id;
    }

    private static nameOf(c: ReuseCandidate): string {
        return String(c.displayName ?? c.name ?? c.id);
    }

    private static round(x: number): number {
        return Math.round(x * 100) / 100;
    }
}
