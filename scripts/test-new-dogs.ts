/**
 * Smoke-Test fuer alle neuen Hunde.
 * Ruft die low-level API-Clients direkt auf — keine Kennel-Infrastruktur noetig.
 * Run: npx ts-node -r tsconfig-paths/register scripts/test-new-dogs.ts
 */
export {};

type TestResult = { name: string; ok: boolean; summary?: string; error?: string };

async function run<T>(name: string, fn: () => Promise<T>, summarize: (v: T) => string): Promise<TestResult> {
    const started = Date.now();
    try {
        const v = await fn();
        return { name, ok: true, summary: `${summarize(v)} (${Date.now() - started}ms)` };
    } catch (e: any) {
        return { name, ok: false, error: `${e?.message ?? e} (${Date.now() - started}ms)` };
    }
}

async function main() {
    const results: TestResult[] = [];

    // --- Humor ---
    const { getJoke } = await import('@slopdogs/dogs-humor');
    results.push(await run('Joke', () => getJoke('Programming', 'en', 'nsfw,religious,political,racist,sexist,explicit'), r => `[${r.type}] ${r.joke.slice(0, 80)}`));

    const { getDadJoke } = await import('@slopdogs/dogs-humor');
    results.push(await run('DadJoke', () => getDadJoke(), r => r.joke.slice(0, 80)));

    const { getChuckNorris } = await import('@slopdogs/dogs-humor');
    results.push(await run('ChuckNorris', () => getChuckNorris(), r => r.joke.slice(0, 80)));

    // --- Animals-Random ---
    const { getCatFact } = await import('@slopdogs/dogs-animals-random');
    results.push(await run('CatFact', () => getCatFact(), r => r.fact.slice(0, 80)));

    const { getRandomFox } = await import('@slopdogs/dogs-animals-random');
    results.push(await run('Fox', () => getRandomFox(), r => r.imageUrl));

    const { getRandomDuck } = await import('@slopdogs/dogs-animals-random');
    results.push(await run('Duck', () => getRandomDuck(), r => `${r.mediaType}: ${r.mediaUrl}`));

    // --- Dictionary ---
    const { getDictionaryEntry } = await import('@slopdogs/dogs-dictionary');
    results.push(await run('Dictionary', () => getDictionaryEntry('hound', 'en'), r => `${r.word}: ${r.meanings[0]?.definitions[0]?.definition?.slice(0, 60) ?? '?'}`));

    const { getDatamuseWords } = await import('@slopdogs/dogs-dictionary');
    results.push(await run('Datamuse', () => getDatamuseWords('sky', 'rhy', 5), r => `rhymes for "${r.word}": ${r.words.slice(0, 5).map(w => w.word).join(', ')}`));

    // --- Knowledge ---
    const { getRandomQuote } = await import('@slopdogs/dogs-knowledge');
    results.push(await run('Quote', () => getRandomQuote(undefined, undefined, 40, 200), r => `"${r.quote.slice(0, 60)}..." — ${r.author}`));

    const { searchGutenberg } = await import('@slopdogs/dogs-knowledge');
    results.push(await run('Gutenberg', () => searchGutenberg('shakespeare', 'en'), r => `${r.count} Treffer, erster: "${r.books[0]?.title ?? '?'}"`));

    const { queryWikidata } = await import('@slopdogs/dogs-knowledge');
    results.push(await run('Wikidata', () => queryWikidata(undefined, 'Douglas Adams', undefined, 'en', 3), r => `${r.hits?.length ?? 0} hits, first: ${r.hits?.[0]?.label ?? '?'}`));

    // --- Pop-Culture ---
    const { popCultureFetch } = await import('@slopdogs/dogs-pop-culture');
    results.push(await run('StarWars (swapi)', () => popCultureFetch<any>('https://swapi.dev/api/people/1/'), r => `${r.name} — ${r.birth_year}`));
    results.push(await run('RickMorty', () => popCultureFetch<any>('https://rickandmortyapi.com/api/character/1'), r => `${r.name} (${r.species})`));
    results.push(await run('HarryPotter', () => popCultureFetch<any[]>('https://hp-api.onrender.com/api/characters/house/gryffindor'), r => `Gryffindor: ${r.length} chars, first: ${r[0]?.name ?? '?'}`));
    results.push(await run('Ghibli', () => popCultureFetch<any[]>('https://ghibliapi.vercel.app/films'), r => `${r.length} Filme, erster: "${r[0]?.title ?? '?'}"`));

    // --- Music ---
    const { queryMusicBrainz } = await import('@slopdogs/dogs-music');
    results.push(await run('MusicBrainz', () => queryMusicBrainz('artist', undefined, 'Radiohead', 3), r => `${r.mode}: ${JSON.stringify(r.data).slice(0, 80)}`));

    const { getLyrics } = await import('@slopdogs/dogs-music');
    results.push(await run('Lyrics', () => getLyrics('Radiohead', 'Creep'), r => `${r.lyrics.length} chars, first line: "${r.lyrics.split('\n')[0] ?? '?'}"`));

    const { queryRadioBrowser } = await import('@slopdogs/dogs-music');
    results.push(await run('RadioBrowser', () => queryRadioBrowser('bycountry', 'germany', 5), r => `${r.count} Sender, erster: "${r.stations[0]?.name ?? '?'}"`));

    // --- Sports ---
    const { getF1 } = await import('@slopdogs/dogs-sports');
    results.push(await run('F1', () => getF1('current', undefined, 'races', 5), r => `total=${r.total}, data keys: ${Object.keys((r.data as any) ?? {}).slice(0, 5).join(',')}`));

    const { querySportsDb } = await import('@slopdogs/dogs-sports');
    results.push(await run('SportsDB', () => querySportsDb('searchteams', 'arsenal'), r => `endpoint=${r.endpoint}, result: ${JSON.stringify(r.data).slice(0, 80)}`));

    const { queryChess } = await import('@slopdogs/dogs-sports');
    results.push(await run('Chess (puzzle daily)', () => queryChess('puzzleDaily'), r => `endpoint=${r.endpoint}, data: ${JSON.stringify(r.data).slice(0, 80)}`));

    // --- Dev ---
    const { queryNpm } = await import('@slopdogs/dogs-dev');
    results.push(await run('Npm', () => queryNpm('express', 'both', 'last-week'), r => `latest=${r.meta?.latest}, downloads(last-week)=${r.downloads?.downloads}`));

    const { queryStackExchange } = await import('@slopdogs/dogs-dev');
    results.push(await run('StackExchange', () => queryStackExchange('stackoverflow', 'questions', undefined, 'typescript', 'hot', 3, 1), r => `${r.items.length} questions`));

    const { queryGitHubPublic } = await import('@slopdogs/dogs-dev');
    results.push(await run('GitHubPublic', () => queryGitHubPublic('repo', undefined, 'microsoft/TypeScript'), r => `mode=${r.mode}, rl=${r.rateLimitRemaining}`));

    // --- Travel ---
    const { fetchAirportIndex, resolveAirport } = await import('@slopdogs/dogs-travel');
    results.push(await run('Airport (FRA)', async () => {
        const idx = await fetchAirportIndex();
        return resolveAirport(idx, 'FRA');
    }, r => `${r.airport.name} (${r.airport.city}, ${r.airport.country})`));

    const { getNearbyPlaces } = await import('@slopdogs/dogs-travel');
    results.push(await run('GeoNames (demo-user)', () => getNearbyPlaces(50.1109, 8.6821, 10, 5), r => `${r.entries.length} places, first: "${r.entries[0]?.name ?? '?'}"`));

    const { getWikivoyageSnippet } = await import('@slopdogs/dogs-travel');
    results.push(await run('Wikivoyage', () => getWikivoyageSnippet('Berlin', 'en'), r => `title=${r.title}, extract len=${r.extract?.length ?? 0}`));

    // --- Quiz ---
    const { getTrivia } = await import('@slopdogs/dogs-quiz');
    results.push(await run('Trivia', () => getTrivia(3), r => `${r.questions.length} questions, first: "${r.questions[0]?.question?.slice(0, 60) ?? '?'}"`));

    const { getBoredActivity } = await import('@slopdogs/dogs-quiz');
    results.push(await run('Bored', () => getBoredActivity(), r => `${r.type}: ${r.activity}`));

    const { getRandomUsers } = await import('@slopdogs/dogs-quiz');
    results.push(await run('RandomUser', () => getRandomUsers(2, 'female', 'de'), r => `${r.results} users`));

    // --- Religion ---
    const { getBibleReference } = await import('@slopdogs/dogs-religion');
    results.push(await run('Bible', () => getBibleReference('John 3:16', 'web'), r => `${r.reference}: "${r.text.slice(0, 60)}..."`));

    const { queryQuran } = await import('@slopdogs/dogs-religion');
    results.push(await run('Quran (ayah 2:255)', () => queryQuran('ayah', '2:255', 'en.sahih'), r => `edition=${r.edition}, data: ${JSON.stringify(r.data).slice(0, 80)}`));

    // --- Health ---
    const { queryDisease } = await import('@slopdogs/dogs-health');
    results.push(await run('Disease (COVID all)', () => queryDisease('covid-19', 'all'), r => `data: ${JSON.stringify(r.data).slice(0, 120)}`));

    const { queryOpenFda } = await import('@slopdogs/dogs-health');
    results.push(await run('OpenFDA', () => queryOpenFda('drug/event', 'patient.drug.medicinalproduct:aspirin', 1), r => `total=${r.total}, results=${r.results.length}`));

    // --- Cuisine ---
    const { queryCocktail } = await import('@slopdogs/dogs-cuisine');
    results.push(await run('Cocktail (random)', () => queryCocktail('random'), r => `${r.count} drinks, first: "${(r.items[0] as any)?.strDrink ?? '?'}"`));

    const { queryMeal } = await import('@slopdogs/dogs-cuisine');
    results.push(await run('Meal (search=pasta)', () => queryMeal('search', 'pasta'), r => `${r.count} meals, first: "${(r.items[0] as any)?.strMeal ?? '?'}"`));

    // --- Web-Archive ---
    const { getWaybackSnapshot } = await import('@slopdogs/dogs-web-archive');
    results.push(await run('Wayback', () => getWaybackSnapshot('https://www.anthropic.com', '20200101'), r => `found=${r.found}, snapshot=${r.snapshot?.url}`));

    // --- Summary ---
    console.log('\n========== TEST RESULTS ==========\n');
    let passed = 0;
    let failed = 0;
    for (const r of results) {
        if (r.ok) {
            passed++;
            console.log(`  [OK]   ${r.name.padEnd(25)}  ${r.summary ?? ''}`);
        } else {
            failed++;
            console.log(`  [FAIL] ${r.name.padEnd(25)}  ${r.error ?? ''}`);
        }
    }
    console.log(`\n${passed}/${results.length} passed, ${failed} failed.\n`);
    if (failed > 0) process.exitCode = 1;
}

main().catch(e => {
    console.error('Fatal:', e);
    process.exit(1);
});
