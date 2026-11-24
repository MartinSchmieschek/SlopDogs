// Klasse der Base-Dogs (PLAN-KENNEL-CACHE 2.2, D5): ein Base-Dog-Paket darf seine Klasse als statisches Feld
// `cacheClass` tragen; fehlt es, gilt die Ausweichtabelle des Servers. Unbekannte Base-Dogs sind `fluechtig` —
// sie holen in der Regel von aussen, und eine zu strenge Klasse kostet nur Cache, keine Korrektheit.
import { isCacheClass, type CacheClass } from './CacheClass';

/** Die Klasse eines Base-Dogs und woher sie stammt. */
export interface BaseDogCacheClass {
    klasse: CacheClass;
    /** `cacheClass` (Paket), `Ausweichtabelle`, `Ausweichtabelle (Standard)` oder `unbekannter Base-Dog`. */
    detail: string;
}

type BaseDogClass = (new () => unknown) & { cacheClass?: unknown; __isPact?: boolean };

export class BaseDogCacheClasses {
    /**
     * Die Ausweichtabelle (D5), bis die Pakete `cacheClass` tragen. Nicht gelistet: `fluechtig`.
     * live: Lobby/Kanal, und die Zufallsquellen ohne eigenen Cache (jeder Aufruf ein anderes Ergebnis).
     * rein: reine Eingabe (Query/Body) und reine Rechner/Darsteller ohne Abruf.
     */
    static readonly FALLBACK: ReadonlyMap<string, CacheClass> = new Map<string, CacheClass>([
        ['WebSocketChannelRetriever', 'live'],
        ['ChannelLiveSnippetRetriever', 'live'],
        ['JokeRetriever', 'live'],
        ['DadJokeRetriever', 'live'],
        ['ChuckNorrisRetriever', 'live'],
        ['CatFactRetriever', 'live'],
        ['FoxRetriever', 'live'],
        ['DuckRetriever', 'live'],
        ['QuoteRetriever', 'live'],
        ['RandomFactRetriever', 'live'],
        ['TriviaRetriever', 'live'],
        ['BoredRetriever', 'live'],
        ['DogCeoRetriever', 'live'],
        ['DeckOfCardsRetriever', 'live'],
        ['RandomEveryThingRetriever', 'live'],
        ['RandomRecipesRetriever', 'live'],
        ['QuranRetriever', 'live'],
        ['HuePlaygroundRetriever', 'live'],
        ['QueryRetriever', 'rein'],
        ['BodyRetriever', 'rein'],
        ['CountryFlagBlackLab', 'rein'],
        ['DishFlagBlackLab', 'rein'],
        ['TalkingDog', 'rein'],
    ]);

    private readonly requiredByName = new Map<string, string[]>();

    constructor(private readonly baseDogsMap: Map<string, new () => unknown>) {}

    has(name: string): boolean {
        return this.baseDogsMap.has(name);
    }

    classOf(name: string): BaseDogCacheClass {
        const cls = this.baseDogsMap.get(name) as BaseDogClass | undefined;
        if (!cls) return { klasse: 'fluechtig', detail: 'unbekannter Base-Dog' };
        if (isCacheClass(cls.cacheClass)) return { klasse: cls.cacheClass, detail: 'cacheClass' };
        const fallback = BaseDogCacheClasses.FALLBACK.get(name);
        return fallback ? { klasse: fallback, detail: 'Ausweichtabelle' } : { klasse: 'fluechtig', detail: 'Ausweichtabelle (Standard)' };
    }

    /**
     * Die Base-Dogs, die mit `names` im gefuellten Kennel stehen: autoMimic ergaenzt jeden Pflicht-Elternteil,
     * der kein Pact ist, aus der Klassen-Registry — transitiv, Reihenfolge stabil (Eingabe zuerst).
     */
    expand(names: Iterable<string>): string[] {
        const out: string[] = [];
        const seen = new Set<string>();
        const queue = [...names];
        while (queue.length > 0) {
            const name = queue.shift()!;
            if (seen.has(name)) continue;
            seen.add(name);
            out.push(name);
            queue.push(...this.requiredOf(name));
        }
        return out;
    }

    /** Die Pflicht-Eltern eines Base-Dogs, die als Base-Dog ergaenzt werden (keine Pacts), je Name gemerkt. */
    requiredOf(name: string): string[] {
        const known = this.requiredByName.get(name);
        if (known) return known;
        const required = this.readRequired(name);
        this.requiredByName.set(name, required);
        return required;
    }

    private readRequired(name: string): string[] {
        const cls = this.baseDogsMap.get(name);
        if (!cls) return [];
        let instance: { required?: unknown };
        try {
            instance = new cls() as { required?: unknown };
        } catch {
            return [];
        }
        if (!Array.isArray(instance.required)) return [];
        const names: string[] = [];
        for (const dep of instance.required as BaseDogClass[]) {
            if (typeof dep !== 'function' || dep.__isPact === true) continue;
            const registered = [...this.baseDogsMap.entries()].find(([, c]) => c === dep)?.[0] ?? dep.name;
            if (this.baseDogsMap.has(registered)) names.push(registered);
        }
        return names;
    }
}
