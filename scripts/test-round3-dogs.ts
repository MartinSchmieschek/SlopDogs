/**
 * Smoke-Test fuer Runde-3-Hunde.
 * Run: npx ts-node -r tsconfig-paths/register scripts/test-round3-dogs.ts
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

    // --- Images ---
    const { getDogImages, queryPicsum, getNasaApod } = await import('@slopdogs/dogs-images');
    results.push(await run('DogCeo', () => getDogImages(undefined, undefined, 2), r => `${r.count} images, first: ${r.images[0]}`));
    results.push(await run('Picsum list', () => queryPicsum('list', 400, 300, undefined, undefined, 1, 3), r => `${r.items?.length ?? 0} photos, first id=${r.items?.[0]?.id}`));
    results.push(await run('Picsum randomUrl', () => queryPicsum('randomUrl', 400, 300, 'SlopDogs'), r => `url=${r.url}`));
    results.push(await run('NasaApod', () => getNasaApod(), r => `${r.date}: "${r.title}" (${r.mediaType})`));

    // --- Name-Insights ---
    const { getAgify, getNationalize, getGenderize } = await import('@slopdogs/dogs-name-insights');
    results.push(await run('Agify (martin,DE)', () => getAgify('martin', 'DE'), r => `age=${r.age}, samples=${r.sampleCount}`));
    results.push(await run('Nationalize (martin)', () => getNationalize('martin'), r => `top: ${r.topCountry?.country_id}@${(r.topCountry?.probability ?? 0).toFixed(2)}`));
    results.push(await run('Genderize (sasha)', () => getGenderize('sasha'), r => `${r.gender}@${r.probability.toFixed(2)} (${r.sampleCount} samples)`));

    // --- Gaming ---
    const { queryPokeApi, queryDeckOfCards, queryScryfall } = await import('@slopdogs/dogs-gaming');
    results.push(await run('PokeApi (ditto)', () => queryPokeApi('pokemon', 'ditto'), r => `mode=${r.mode}, id=ditto, keys: ${Object.keys(r.data as any ?? {}).slice(0, 6).join(',')}`));
    results.push(await run('PokeApi (list types)', () => queryPokeApi('type', undefined, true, 5), r => `list, count=${(r.data as any)?.count}`));
    results.push(await run('DeckOfCards new+draw', async () => {
        const { queryDeckOfCards: q } = await import('@slopdogs/dogs-gaming');
        const deck = await q('newShuffled', undefined, 1);
        const drawn = await q('draw', deck.deckId, 1, 3);
        return { deckId: deck.deckId, drew: drawn.cards?.length ?? 0, remaining: drawn.remaining };
    }, r => `deck=${r.deckId.slice(0, 8)}, drew=${r.drew}, remaining=${r.remaining}`));
    results.push(await run('Scryfall named (Black Lotus)', () => queryScryfall('named', 'Black Lotus', 'exact'), r => `mode=${r.mode}, name=${(r.data as any)?.name}, set=${(r.data as any)?.set}`));
    results.push(await run('Scryfall random', () => queryScryfall('random'), r => `random card: ${(r.data as any)?.name}`));

    // --- Translate ---
    const { translateText } = await import('@slopdogs/dogs-translate');
    results.push(await run('LibreTranslate', () => translateText('Hello, world!', 'en', 'de'), r => `"${r.translatedText}" (via ${r.instance})`));

    // --- TV ---
    const { queryTvMaze } = await import('@slopdogs/dogs-tv');
    results.push(await run('TvMaze search', () => queryTvMaze('search', 'breaking bad'), r => `${(r.data as any[])?.length ?? 0} results`));
    results.push(await run('TvMaze singleSearch', () => queryTvMaze('singleSearch', 'breaking bad'), r => `${(r.data as any)?.name} (${(r.data as any)?.premiered})`));
    results.push(await run('TvMaze schedule US', () => queryTvMaze('schedule', 'US'), r => `${(r.data as any[])?.length ?? 0} episodes today`));

    // --- Social ---
    const { queryHackerNews } = await import('@slopdogs/dogs-social');
    results.push(await run('HN top 3 (hydrated)', () => queryHackerNews('top', undefined, 3, true), r => `totalIds=${r.totalIds}, items=${r.items?.length}, first: "${r.items?.[0]?.title?.slice(0, 60) ?? '?'}"`));
    results.push(await run('HN item', async () => {
        const list = await queryHackerNews('top', undefined, 1, false);
        const id = list.items?.[0]?.id;
        if (!id) throw new Error('no top id');
        return queryHackerNews('item', String(id));
    }, r => `item ${r.item?.id}: "${r.item?.title?.slice(0, 60) ?? '?'}"`));

    const { queryLemmy } = await import('@slopdogs/dogs-social');
    results.push(await run('Lemmy postList (lemmy.world)', () => queryLemmy('lemmy.world', 'postList', undefined, undefined, 'Hot', 'Local', 3, 1), r => `posts: ${((r.data as any)?.posts ?? []).length}, first: "${(r.data as any)?.posts?.[0]?.post?.name?.slice(0, 60) ?? '?'}"`));
    results.push(await run('Lemmy site info (beehaw.org)', () => queryLemmy('beehaw.org', 'site'), r => `site: ${(r.data as any)?.site_view?.site?.name ?? '?'}`));

    // --- Crypto ---
    const { queryCoinGecko } = await import('@slopdogs/dogs-crypto');
    results.push(await run('CoinGecko price btc+eth', () => queryCoinGecko('price', 'bitcoin,ethereum', 'usd,eur'), r => `btc.usd=${(r.data as any)?.bitcoin?.usd}, eth.eur=${(r.data as any)?.ethereum?.eur}`));
    results.push(await run('CoinGecko trending', () => queryCoinGecko('trending'), r => `${((r.data as any)?.coins ?? []).length} trending coins`));
    results.push(await run('CoinGecko coin(bitcoin)', () => queryCoinGecko('coin', 'bitcoin'), r => `name=${(r.data as any)?.name}, symbol=${(r.data as any)?.symbol}, rank=${(r.data as any)?.market_cap_rank}`));

    // --- Summary ---
    console.log('\n========== TEST RESULTS (Runde 3) ==========\n');
    let passed = 0;
    let failed = 0;
    for (const r of results) {
        if (r.ok) { passed++; console.log(`  [OK]   ${r.name.padEnd(32)}  ${r.summary ?? ''}`); }
        else { failed++; console.log(`  [FAIL] ${r.name.padEnd(32)}  ${r.error ?? ''}`); }
    }
    console.log(`\n${passed}/${results.length} passed, ${failed} failed.\n`);
    if (failed > 0) process.exitCode = 1;
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
