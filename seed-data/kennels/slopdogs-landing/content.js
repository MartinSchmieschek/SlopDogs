// SlopDogs landing: content master. Pure data, no HTML. Skin C "Mixtape" renders this, the only look.
// Strings keep the literal placeholder <host>; the skin escapes and displays it as ‹host›, the server (GET /)
// and the page script put the real host in its place. The kennels under "already out there" are not
// written here: the page loads them from /api/landing (out.live), rankings and proven dogs, counted live.
return {
  meta: {
    title: 'SlopDogs',
    description: 'SlopDogs is an MCP runtime: your AI writes the code, SlopDogs runs it live at a public URL. No deploy, no servers.'
  },
  brand: { name: 'SlopDogs', wordmark: 'SlopDogs' },
  host: '<host>',
  // nav: `anchor` scrolls on this page, `href` leaves it. The rack (/kennels) is a real link everywhere it appears:
  // top bar (always, also on a phone), hero, under the charts, footer. Whoever sees the page finds the shelf.
  nav: [
    { label: 'Connect', anchor: 'how' },
    { label: 'Kennels', href: '/kennels' }
  ],
  // stage: shown only while the page carries data-stage="beta" (the server sets it from SLOPDOGS_STAGE, see skin_c.js).
  // The 90s promo sticker on a tape: "promo copy, not for resale". Here: integration beta, the tape may skip.
  stage: {
    beta: {
      chip: 'integration beta',
      chipShort: 'beta',
      stamp: { kicker: 'promo copy', title: 'Integration beta', line: 'the tape may skip' },
      text: 'The wiring is live and still being tuned. Accounts open with a beta key at sign-up: one key, one person.'
    }
  },
  verses: {
    lohk: { name: 'Lohk', lines: ['From brooding gulfs are we beheld', 'By that which bears no name.'] },
    oull: { name: 'Oull', lines: ['Through endless faces, countless forms,', 'a multitude unfolds.'] },
    khra: { name: 'Khra', lines: ['To cosmic forms from tangent planes', 'We end as we began.'] }
  },
  order: ['what', 'packs', 'faces', 'how', 'breakout', 'out'],
  hero: {
    kicker: 'mcp runtime',
    sign: 'SlopDogs',
    headline: 'Out of localhost.',
    lede: 'An MCP runtime for any AI. Your AI writes the code, SlopDogs runs it live at a public URL.',
    tagline: ['No deploy', 'no servers', 'just start'],
    local: { label: 'local net · 127.0.0.1', chip: 'your AI · writes' },
    rack: { label: 'Browse kennels', href: '/kennels' },
    verse: 'lohk'
  },
  what: {
    n: '01', label: 'what is it',
    headline: ['Your AI writes.', 'SlopDogs runs.'],
    lede: 'Dogs are small blocks of code your AI writes; a kennel is what it assembles from them. SlopDogs keeps the kennel running, live, at a public URL.',
    chain: [
      { kind: 'dog', label: 'dog' }, { kind: 'dog', label: 'dog' }, { kind: 'dog', label: 'dog' },
      { kind: 'kennel', label: 'kennel' },
      { kind: 'url', label: '/k/<name>' }
    ]
  },
  packs: {
    n: '02', label: 'base dogs',
    headline: "Don't write it. Plug it.",
    lede: 'Tested base dogs your AI plugs in. Every track is work it skips.',
    // Side A. name = track title, note = the work the AI does not write (at most 37 characters: one line at 375 px),
    // len = the running time column: how long a cached answer is kept (weather 15 min, geocoding 24 h, OSM tiles
    // 5 days) or where the track lives.
    modules: [
      { name: 'lobby', note: 'phones join by link. no socket server', len: 'core' },
      { name: 'url in', note: '?lat=&lng= land parsed. no form code', len: 'core' },
      { name: 'cache', note: 'heavy call once. runs again and again', len: 'built in' },
      { name: 'map', note: 'roads, stops, buildings, tile by tile', len: '5 days' },
      { name: 'weather', note: 'forecast at any point. units done', len: '15 min' },
      { name: 'geocode', note: 'address to point and back', len: '24 h' },
      { name: 'store', note: 'state per user. no schema, no db', len: 'global' },
      { name: 'keys', note: 'key lives on the host. never in code', len: 'global' }
    ],
    yours: { name: 'your dog', note: 'the one part your AI writes', len: 'bonus' },
    bars: [
      { label: 'write it', size: 'long' },
      { label: 'plug it', size: 'short' }
    ],
    footnote: '52 packs · 87 dogs in the repo'
  },
  faces: {
    n: '03', label: 'what can it do',
    headline: 'One URL. Three faces.',
    lede: 'Maps, lobbies, live data, reports. One address answers as a page, as an API with its Swagger, or as Markdown.',
    method: 'GET',
    url: 'https://<host>/k/rennkarte',
    example: 'rennkarte',
    items: [
      { key: 'page', label: 'page', short: 'page', suffix: '', line: 'text/html' },
      { key: 'api', label: 'api · swagger', short: 'api', suffix: '/docs', line: 'openapi · /k/rennkarte/docs' },
      { key: 'md', label: 'markdown', short: 'markdown', suffix: '', line: 'accept: text/markdown' }
    ],
    preview: {
      page: { title: 'Race Map' },
      api: {
        endpoints: [
          { method: 'GET', path: '/k/rennkarte', note: 'runners, positions, radar' },
          { method: 'POST', path: '/k/rennkarte', note: 'report a position' },
          { method: 'GET', path: '/k/rennkarte/docs', note: 'this document' }
        ]
      },
      md: {
        lines: [
          { mark: '#', text: 'Race Map' },
          { mark: '', text: 'Multiplayer hiking map with rain radar, wind field and a spoken distance to the other runners.' },
          { mark: '-', text: 'dogs: 17' }
        ]
      }
    },
    verse: 'oull'
  },
  how: {
    n: '04', label: 'how do I use it',
    headline: 'One line.',
    command: 'claude mcp add --transport http slopdogs https://<host>/mcp',
    commandHighlight: 'https://<host>/mcp',
    copy: { idle: 'copy', done: 'copied' },
    lede: 'Add it to any MCP client. Then ask your AI.',
    aside: 'If it misses, ask again.',
    verse: 'khra'
  },
  breakout: {
    n: '05', label: 'the breakout',
    headline: 'Nothing in between.',
    lede: 'Your AI writes the kennel and hands it over MCP. SlopDogs runs it and answers with an address.',
    stops: [
      { key: 'local', label: 'local · 127.0.0.1', value: 'your AI writes' },
      { key: 'mcp', label: 'mcp · http', value: '/mcp' },
      { key: 'public', label: 'slopdogs runs it · public', value: 'https://<host>/k/rennkarte', live: true }
    ],
    dead: { label: 'deploy', value: 'build · push · wait', note: 'never wired' },
    log: [
      { at: 0.02, who: 'agent', text: 'writes kennel rennkarte · 17 dogs' },
      { at: 0.5, who: 'mcp', text: 'kennel received' },
      { at: 0.74, who: 'slopdogs', text: 'running · deploy step: none' },
      { at: 0.985, who: 'live', text: 'https://<host>/k/rennkarte', live: true }
    ]
  },
  out: {
    n: '06', label: 'already out there',
    headline: 'Lit tonight.',
    lede: 'Written by an AI, run by SlopDogs, each one a public address. Counted live.',
    live: {
      api: '/api/landing',
      limit: 6,
      emoji: '🐕',
      dogHref: '/kennels?q=',
      sizes: ['wide', 'big', 'small', 'mid', 'small', 'strip'],
      lists: [
        { key: 'topByCalls30d', kind: 'kennel', label: 'most called · 30 days', empty: 'No kennel has been called yet.' },
        { key: 'topByRating', kind: 'kennel', label: 'top rated', empty: 'No stars given yet.' },
        { key: 'provenDogs', kind: 'dog', label: 'proven dogs', empty: 'No dog has earned the badge yet.' }
      ],
      words: { calls: 'calls', call: 'call', reuse: 'kennels', reuseOne: 'kennel', proven: 'proven dog' },
      states: {
        loading: 'Tuning in…',
        waking: 'Waking the pack. A cold start can take up to two minutes.',
        empty: 'Nothing on the charts yet. Run a kennel and it lands here.',
        error: "Can't reach the pack right now.",
        retry: 'Again'
      }
    },
    more: { label: 'All kennels', href: '/kennels' }
  },
  footer: {
    line: 'SlopDogs',
    command: 'claude mcp add … slopdogs',
    commandAnchor: 'how',
    rack: { label: 'all kennels', href: '/kennels' },
    tag: 'Open all night',
    verse: 'lohk'
  }
};
