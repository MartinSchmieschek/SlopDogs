**Your AI writes the code. SlopDogs runs it live at a public URL.**
SlopDogs is an MCP runtime. Your AI (Claude, Cursor, ChatGPT, any MCP client) builds a small app and hands it over. SlopDogs runs it on the server and answers with a link. No deploy, no server, no build step.
    claude mcp add --transport http slopdogs https://slopdogs.onrender.com/mcp (currently restricted by Beta keys)
Then ask your AI for what you want: a map, a multiplayer lobby, a live dashboard, a report. It comes back with an address anyone can open, on a phone or a TV.
## In one minute
- **Dog**: a small block of TypeScript that does one job: fetch, transform or render. It runs sandboxed on the server, async, and reads its parent dogs' output as globals.
- **Base dogs**: tested dogs that ship with the platform: lobby (phones join by link, no socket server), URL params, cache, maps, weather, geocoding, per-user storage, API keys. Your AI plugs them in instead of writing them.
- **Kennel**: a set of dogs that together form one app. Every kennel lives at `/k/<id>`.
- **Lead dog**: the first dog in a kennel. Its output is the response.
- **Waves**: dogs run in waves, ordered by their dependencies. SlopDogs works out the order.
- **Pacts and Mimics**: a dog can ask for a data shape instead of a specific dog. A Mimic is a small adapter that delivers that shape. If one is missing, SlopDogs puts in a placeholder that says exactly what it needs.
## See it running
Every link below is a kennel: Wiched by user, written by an AI, run by SlopDogs, live after minutes.
**Phones as controllers, the TV as the screen**
- [Gun Deck](https://slopdogs.onrender.com/k/gundeck): a pirate cannon crew. Each phone does one drill step with its own gesture.
- [Geschichtenbühne](https://slopdogs.onrender.com/k/geschichten-buehne): animated places for storytelling. The TV shows the stage, the phone triggers scenes.
**Reports**
- [Testbericht: Antwortzeiten](https://slopdogs.onrender.com/k/testbericht-antwortzeiten?channelId=wvbr3kbn1c): a measured report with chart, method and limits, written and published as a kennel.
**Live together**
- [Pizza-Ofen Scope](https://slopdogs.onrender.com/k/pizza-ofen-scope): a shared oven timer with an oscilloscope and sound.
- [Void Storm Vote](https://slopdogs.onrender.com/k/voidStorms-vote): a group vote with a live ranking, fed by live game data.
**Maps and live data**
- [Rennkarte](https://slopdogs.onrender.com/k/rennkarte): a multiplayer hiking map with rain radar, wind field and spoken distance to the other runners.
- [Puls der Erde](https://slopdogs.onrender.com/k/earth-pulse?q=Berlin): everything about one place, including weather, sun, air, species, landmarks, news and transit, on one map. Change `?q=` to any city.
**The same kennel as an API**
- [Address Lookup](https://slopdogs.onrender.com/k/address-lookup?address=Brandenburger+Tor%2C+Berlin): an address in, then coordinates, weather, air, sun, transit and Wikipedia out, as JSON.
- [Void Storms JSON](https://slopdogs.onrender.com/k/voidStormsJson) and its generated [Swagger](https://slopdogs.onrender.com/k/voidStormsJson/docs).
**Just for show**
- [David vs. Goliath](https://slopdogs.onrender.com/k/david-vs-goliath-kampf): an animated 3D battle.
## What you get
**One URL, three faces.** Depending on what the lead dog returns, `/k/<id>` answers as:
- a **page** (`text/html`)
- a **document** (`text/markdown`)
- an **API** (JSON), with Swagger at `/k/<id>/docs` generated from the real output
And around it:
- **Everything is versioned.** Every save of a dog or kennel is a new version. Nothing is overwritten.
- **Access per kennel and dog**: private, run-only or public; share with editors, readers or runners.
- **Keys stay on the server.** API keys are stored encrypted and inserted at request time, never in code.
- **Caching** built in, so heavy calls run once.
- **Export/import**: copy a whole kennel as JSON between instances.
## Run it locally
    npm install
    npm run dev
API on `:3000`, UI on `:4300`.
---
*What follows is the lore, then the full reference.*

# SlopDogs

> From brooding gulfs the pack descends,
> through tangled endpoints, severed threads.
> They drag back what the void intends --
> you sort the living from the dead.

A data aggregation platform. Dogs hunt data. You breed them, chain them in Kennels, and send them out in Waves. They tear through APIs, gnaw on request bodies, stalk the forgotten corners of the web, and haul everything back -- raw, bleeding, yours.

---

## The Pack

### Dogs

Every dog is a hunter. Two breeds walk these grounds:

**BaseDogs** -- Ancient breeds. They ship with the platform and know their purpose without instruction. Fetch recipes, parse query params, extract request bodies, raid random APIs. New breeds manifest as classes. No configuration. No ceremony. They simply are.

**SerializedDogs** -- Your creations. TypeScript inscribed into the database, awakened at runtime in a VM sandbox. Full `async/await`, access to parent dogs' yields as globals, automatic IntelliSense whispering what data lies in reach. Every save breeds a new version. No ancestor is ever erased. The tree keeps branching.

### Kennels

A Kennel is a covenant. It binds:
- Which dogs to unleash (`dogIds` -- both BaseDogs and SerializedDogs). **The first entry is the [lead dog](#lead-dog)** -- public URLs return that dog's yield. Wave scheduling obeys the dependency graph alone -- see [Waves](#waves) and [Pacts](#pacts).
- Default query parameters -- scent markers for the hunt
- Default body data -- provisions, fed to BodyRetriever
- Name and description

### Lead Dog

The **first** entry in `dogIds` is the **lead**. When the hunt is over and the pack returns, only one voice speaks: the lead's yield is what `GET /k/:id` and `GET /api/kennels/:id/execute` return.

**Lead response shape (string yields):** If the lead returns a **string**, the server picks a content type before JSON:

- **HTML** — `text/html` when the string looks like HTML (e.g. starts with `<html`, `<!DOCTYPE`, or tag-like `<`…`</`).
- **Markdown** — `text/markdown` when it is **not** treated as HTML and either the first line is an ATX heading (`#` … `######` plus space) or the document starts with YAML **frontmatter** (`---` … `---`).
- **Anything else** (objects, arrays, numbers, booleans, or strings that match neither rule) — `application/json` (objects and arrays as JSON; primitive strings are JSON-encoded).

Who runs when -- that is decided by the dependency graph. Waves, Pacts, required parents -- the graph commands the order. The lead has no authority there. The lead answers only one question: **whose catch becomes the response.** Every other dog in the Kennel exists to feed the chain that ends at the lead.

### The lead is a compositor

When a Kennel pulls from **two or more sources**, the lead **must be a compositor** — not a worker. Its only job is composition: take pre-processed entity yields, glue them together, return.

```
Wave 1 (Hunters):       WeatherRetriever, SunRetriever, BirdRetriever     ← raw fetch
Wave 2 (Entity dogs):   WeatherData, SunData, BirdData                    ← per-domain normalization
Wave 3 (Compositor):    NaturBundle  (= the lead)                         ← merge + format
```

**Rules — non-negotiable for non-trivial Kennels:**

2. **Hunters fetch, entity dogs normalize, the compositor composes.** No mixing.
4. **A fat lead is a code smell.** If the lead is more than ~30 lines, split it.
5. **Provide the user a detailed info well formated for its need** be playful with the final composition and aware that some dogs can fail.
6. **Split data from ui** good data can lead to bad ui experience, good ui is nothing without data. be playful test whats possible and create ui that combines kennel.

##may be deprecated?
**Why:** Reuse (entity dogs work in many Kennels), debuggability (failures localize per entity), versioning sanity (renderer evolves separately from data logic), multi-consumer (some clients want only weather, not the full bundle), HTML safety (the renderer is the only place that touches `<script>`).
##

If the Kennel has only one source, the lead may be the renderer directly — but the moment a second source enters, refactor to the compositor pattern.

> *Vome — order does not negotiate.*

### Waves

Dogs don't run at once. They go out in waves:
- **Wave 1** -- Dogs with no dependencies. First into the dark.
- **Wave 2** -- Dogs that depend on Wave 1's catch. They follow the trails left behind.
- **Wave N** -- Until every dog has run and nothing stirs.

The engine calculates wave order from the dependency graph. The scheduler decides; there is no separate rulebook.

> *Vome — To cosmic madness laws submit, though stalwart minds entreat.*

### Dependencies

Dogs can depend on other dogs' catches:
- **Required** -- Must run first. The dog won't move without this data.
- **Optional** -- Used if available, ignored if not. The dog adapts to what the void provides.

Referenced by ID: `base:QueryRetriever` for BaseDogs, `my-dog-v1` or `my-dog` (latest version) for SerializedDogs.

### Pacts

A Pact is a sworn agreement between dogs. Instead of requiring a specific Dog class, a Dog can require a Pact -- a pledge that defines *what data shape* is needed, not *who provides it*. The graph may twist; the Pact stays fixed.

```typescript
const LayoutInputPact = createPact<ILayoutInput>('LayoutInputProvider', {
  fromSourceType: 'ILayoutInput',
});
```

Pacts are created with `createPact<T>(name)` or with `{ fromSourceType: 'YourInterfaceOrTypeName' }` so the editor/VM types are derived from TypeScript sources at startup (see `TypeDefBuilder.registerPacts`). They produce a valid Dog class marked with `__isPact: true`. They cannot run on their own -- they exist purely to declare what must be.

> *Jahu — Corporeal laws are unwrit, as suns and love retreat.*

### MimicDog

A MimicDog is a SerializedDog that *imitates* a Pact. It sits between raw data sources and consumers, transforming data into the shape the Pact demands.

- Inherits from SerializedDog -- has `parentsRequired`, `parentsOptional`, custom `theRun` code
- Config field `imitates: string` names the Pact it fulfills
- Property `imitatesClasses` returns the resolved Pact class(es)
- The Wave system treats it as if it *were* that Pact
- Cascadable: one MimicDog can depend on another -- forming chains through the dark

### Auto-Mimic

When a Dog requires a Pact that no one in the Kennel fulfills, the system closes the gap in two passes: first it tries to **adopt** a saved Mimic from the kennel's own memory; only if that fails does it **conjure** a fresh placeholder from the void. Either way, the final Mimic is then **healed back into `dogIds`** so the kennel remembers it forever.

> *From brooding gulfs are we beheld*  
> *By that which bears no name.*

Core rule: **Who requires via a Pact accepts Mimics. Who requires a real class demands the real Dog.**

*(Loader verse **Lohk** — [`ui-app/src/app/data/requiem-loading.ts`](ui-app/src/app/data/requiem-loading.ts).)*

#### The adoption dance — lineage-aware Mimic reuse

Auto-mimicking is no longer a blind "conjure a fresh placeholder on every unmet Pact" — the runner walks a four-step liturgy before anything new is born. See [`api/routes/KennelRunHandler.ts`](api/routes/KennelRunHandler.ts) (`createMimicAdopter`, `persistNewMimics`) and [`packages/core/src/KennelRun.ts`](packages/core/src/KennelRun.ts) (`autoMimic`).

1. **Collect the kennel's memory.** On every run, `createMimicAdopter` fetches **all historical versions** of the kennel and harvests every non-base `dogId` it ever carried into a set of "remembered lineages". Even dogs the UI dropped from a later `PUT` remain in memory — nothing is ever truly forgotten.
2. **Scan the deep for candidates.** For each unmet Pact, the adopter queries `findLatestVersionsByType(MimicDog.name)` and keeps only rows whose `serializedDogConfig.imitates === <PactName>`.
3. **Pick a winner.** Candidates whose `lineageId` lives in the kennel's memory win first; tie-break by newest `createdAt`. If no remembered candidate exists, the newest overall match wins. If no candidate exists at all, adoption fails and we fall through to step 4.
4. **Fresh conjuring as last resort.** Only when adoption returns `null` does `KennelRun.autoMimic` forge a fresh `auto-mimic-<PactName>` placeholder whose `theRun` throws `"MimicDog for '<PactName>' needs user code"`.

After the season runs, **`persistNewMimics`** closes the loop: every Mimic in `exhausted` is either *already* persisted (adopted, has a `lineageId`) or freshly minted (no `lineageId`). Fresh mimics are saved to the store with a new version + lineage GUID; adopted mimics keep their existing lineage. **Both cases** trigger `kennelsController.heal(configId, { dogIds: [...old, ...addedLineageIds] })` — the kennel's own `dogIds` grow to include the mimic's `lineageId`, and the in-memory `config.dogIds` is kept in sync so the `/run` response already reflects the heal.

The net effect: **the first run teaches the kennel what it needs**, and every subsequent run loads those mimics directly from `dogIds` via `createSerializedDogFactory` — no adoption, no conjuring. If a client later PUTs a new kennel version that drops the mimic lineageIds, the adopter resurrects them from history on the next run and heals them back.

#### Placeholder runtime — why the throw doesn't crash the run

The fresh placeholder's `theRun` is literally `throw new Error("MimicDog for '<PactName>' needs user code")`. It **does throw** on every run -- this is intentional, not a sleeping clause. Two things keep the rest of the pack alive:

1. **The SeasonRunner brands, it does not abort.** [`harverster.ts → letOut`](packages/core/src/harverster.ts) wraps every dog in a `try/catch`. On throw, the dog is marked with `__error`, pushed into `season.exhausted` like any other returnee, and `dog.collected` stays `undefined`. The pack carries on.
2. **The downstream BaseDog still sees the Pact as "fulfilled".** `matchesParent` checks `imitatesClasses` -- and the placeholder Mimic carries the Pact class regardless of whether `theRun` threw or returned. So `areRequiredParentsReady` flips `true`, the BaseDog runs in the next wave, calls `season.exhausted.find(d => matchesParent(<Pact>, d))`, reads `queryDog?.collected` -- gets `undefined` -- and falls back to whatever default its `yieldCollectorFactory` defines (typically `?? ({} as <PactType>)`).

What happens after that fallback is the BaseDog's own contract. Some BaseDogs survive cleanly on an empty query (e.g. they have sensible defaults); others throw immediately ("Missing required query params"). Either way, the **placeholder Mimic itself shows up in snapshots as `hasError: true`** with the placeholder error message -- a clear TODO marker, not a runtime catastrophe.

Once you (or a UI user, or an MCP client) overwrites `theRun` via `POST /save`, the Mimic stops throwing, returns a real value, and the BaseDog gets the data shape the Pact promised. The lineage stays stable -- editing only bumps the version.

**Authoring a Mimic from the placeholder:**

The Mimic's job is to read from whatever raw source is in the kennel (usually `QueryRetriever` or `BodyRetriever`) and return the Pact's interface. Inspect the consuming dog's Pact type via `get_snapshot_dog_typedef`, then `POST /save?id=<mimic-versionId>` with the full `serializedDogConfig` (always preserve `imitates`!):

```jsonc
{
  "displayName": "weather-query-transformer",
  "tsCode": "return { lat: QueryRetriever.lat, lng: QueryRetriever.lng, time: QueryRetriever.time };",
  "serializedDogConfig": {
    "imitates": "WeatherQueryProvider",
    "parentsRequired": ["base:QueryRetriever"]
  }
}
```

Drop `imitates` and the Mimic loses its Pact binding -- the BaseDog will conjure a fresh placeholder again on the next run. Drop `parentsRequired` and your `theRun` has no globals to read from. Keep both.

#### Factory dedup — MimicDog wins on type upgrade

`createSerializedDogFactory` in [`api/routes/KennelRunHandler.ts`](api/routes/KennelRunHandler.ts) now fetches both `SerializedDog` and `MimicDog` rows for the requested IDs in parallel, then **deduplicates by `lineageId`**. When the same logical dog exists as both types (because someone saved an `imitates` field onto a formerly-serialized dog), the most recent `createdAt` wins — MimicDog upgrades survive, older SerializedDog incarnations are dropped silently. The factory also sniffs `config.imitates` on construction: if the field is a non-empty string, a `MimicDog` is instantiated; otherwise a `SerializedDog`.

#### What Mimics reveal during a run

When you run a Kennel (`/api/kennels/:id/run`), Mimics appear in the Waves response and tell you exactly **what a dog really needs**:

| Field | What it tells you |
|-------|-------------------|
| `mimic: true` | This node is a shapeshifter, not a real dog. |
| `name` | The Pact it imitates — the **data contract** the consuming dog requires (e.g. `NearbyLandmarksPact`). |
| `displayName` | Fresh placeholders are prefixed `auto-mimic-` (e.g. `auto-mimic-NearbyLandmarksPact`). Adopted mimics keep whatever `displayName` they were saved with. |
| `error` | Fresh placeholders return `"MimicDog for '<PactName>' needs user code"` — the placeholder code throws on purpose. Adopted mimics with productive `theRun` return real data instead. |
| `serializedDogConfig.theRun` | The TypeScript code the mimic will run — either the throwing placeholder or the adopted working code. Replace it (or save a new version) to teach the mimic its voice. |
| `serializedDogConfig.imitates` | The Pact name this mimic is bound to. **Never drop this field on save** — it's the mimic's shape. |
| `serializedDogConfig.lineageId` | Set for adopted mimics and for fresh mimics after the first run (via `persistNewMimics`). The stable identity across all versions. |
| `editable: true` | You can open the Mimic in the editor and write the code that fulfills the Pact. |
| `deletable: false` | Auto-mimics cannot be deleted — remove the consuming dog or add a real dog that fulfills the Pact instead. |

> *Oull — From endless faces, countless forms, a multitude unfolds.*

**Reading Mimics as a blueprint:** Every unfilled mimic is a gap in the pipeline. Its `name` tells you which Pact is unfulfilled, and the Pact's TypeScript type (visible in the editor's IntelliSense) tells you the exact data shape the consuming dog expects. Write `theRun` code that returns that shape, `POST /save?id=<mimic-versionId>` with the full `serializedDogConfig` (keep `imitates`!), and the mimic becomes a real transformer on the next run.

**Persistence (summary):**
- **First run of a new kennel** — fresh mimics are conjured, saved to the store with brand-new `lineageId`s, and healed into `config.dogIds`. The in-memory config is mutated on the spot so the response already shows the healed `dogIds`.
- **Subsequent runs** — the factory loads the mimics directly by `lineageId`; no adoption, no heal.
- **Kennel version drop** — if a later PUT removes mimic lineages from `dogIds`, the adopter pulls them back from kennel-version history and heals them in again.
- **Manual mimic edit** — editing a mimic's `theRun` via `POST /save` bumps its version but keeps the `lineageId`. The next run loads the new version through normal lineage resolution. The `imitates` binding must be preserved in the saved config.

### Status Tracking — Mission, Notes, Flow Annotations

A Kennel is rarely built in one breath. Pacts fall short, Mimics need voice, parents need to be re-wired, the lead is half-finished. To track what state a Kennel is in — what it's supposed to do, where it sticks, what still needs work — every Kennel carries three optional **status fields**. These are NOT runtime configuration; they don't change how the pack hunts. They are the kennel master's notebook, persisted with the Kennel.

| Field | Type | Purpose |
|-------|------|---------|
| `task` | string | The Kennel's mission. What should this pack accomplish? Free-form, Markdown-friendly — a paragraph, a bullet list, a TODO. The big picture. |
| `nodes[]` | `Array<{ id, x?, y?, comment? }>` | Per-dog annotations. `id` is the kennel-`dogIds` entry (lineageId, version-id, or `base:Name`). `x/y` are Wave-View layout coordinates (optional). `comment` is a note: "running clean", "needs Mimic code", "TODO renderer". |
| `edges[]` | `Array<{ fromId, toId, comment? }>` | Per-transition annotations. `fromId → toId` are kennel-`dogIds` entries. `comment` describes the data flow: "passes lat/lng", "stuck — Mimic returns wrong shape", "raw OSM features". |

**What this is for:**
- **Mission briefing** — `task` tells the next person (or the next session) what the Kennel is supposed to do. Survives kennel re-loads, version branches, hand-overs.
- **Workflow status** — `nodes[].comment` and `edges[].comment` are status markers: where the pipeline runs cleanly, where it's stuck, what's still TODO. Update them as you build.
- **Layout memory** — `nodes[].x/y` persist where dogs sit on the Wave-View canvas; drag a node, save, and it stays where you put it on the next visit.

**Persistence rules:**
- All three fields are optional. Old Kennels without them keep working unchanged.
- `PUT /api/kennels/:id` with `{task}`, `{nodes}`, or `{edges}` merges into the existing Kennel — passing one field doesn't wipe the others.
- The Kennel bundle export (`/api/kennels/:id/export`) carries the three fields; import round-trips them (dogId references in `nodes[].id` and `edges[].fromId/toId` are remapped along with `dogIds`).
- These behaviours are pinned by the startup test suite — see [Startup tests](#startup-tests). Six tests cover persistence, partial-update merge semantics, text mutation (add/change/remove), per-dog comment mutations across multi-node arrays, per-edge comment mutations, and versioning (incl. no-op-detection). Every backend boot re-verifies them.

**Fully versioned — every text-note has a history:**

The status fields ride the same versioning rail as `dogIds`. Every `PUT` that changes `task`, a `nodes[].comment`, a `nodes[].x/y`, or an `edges[].comment` forges a **new Kennel version** with a fresh `id` and a `parentId` pointing back. The previous version stays in the deep — nothing is overwritten, nothing is lost.

| Endpoint | Returns |
|----------|---------|
| `GET /api/kennels/:id/versions` | Full version list. Each entry's `config` carries the **complete `task`, `nodes`, `edges` snapshot** as it was at that save — not just a diff. |
| `GET /api/kennels/<version-guid>` | The exact historical Kennel config — `task`, `nodes`, `edges` frozen at that incarnation. |
| `GET /api/kennels/:id/run?version=<guid>` | Re-runs the Kennel under the historical config — see what the pack was supposed to do *back then*. |

Editing notes therefore costs nothing — wrong comment, stale TODO, mis-spelled mission? Just `PUT` the corrected version; the old text lives on in the version timeline and the Wave-Viewer lets you click any past incarnation to inspect it.

> *Khra — To cosmic forms from tangent planes, we end as we began.* The pack's memory is the Kennel's memory; every note ever written is one branch back.

**Where they show up:**
- `GET /api/kennels/:id` — full Kennel config including `task`, `nodes`, `edges`.
- `GET /api/kennels/:id/run` — same fields, embedded in `kennelConfig` alongside the Waves.
- `GET /k/:id` (the **public** Lead-Yield endpoint) — does **NOT** include them. The public endpoint stays content-type-honest (HTML stays HTML, JSON stays JSON). Status tracking is for the kennel master, not for downstream consumers.

> *Ris — In luminous space blackened stars, they gaze, accuse, deny.* The comments are the gaze; they accuse the broken edges and bless the working ones.

### Data Pipelines

Mimics act as transformers between raw-data Dogs and consumers:

```
Wave 1: [RandomRecipesRetriever, RandomEverythingRetriever]  →  raw data
Wave 2: [MimicDog (honors: LayoutInputProvider)]              →  normalized ILayoutInput
Wave 3: [TalkingDog (trusts: LayoutInputProvider)]            →  rendered HTML
```

---

## What It Does

**Custom TypeScript execution** -- Write hunting logic in TypeScript. It runs in a Node.js VM with access to parent results as globals. Sandboxed. Async. Dangerous enough to be useful.

```typescript
const recipes = await fetch('https://api.example.com/recipes');
const filtered = recipes.filter(r => r.rating > 4);
return { topRecipes: filtered, count: filtered.length };
```

**Dog versioning** -- Every SerializedDog carries four identity fields:

| Field | Type | Purpose |
|-------|------|---------|
| `id` | GUID | Unique identifier of **this specific version**. Every save produces a new one. |
| `lineageId` | GUID | Stable identifier binding **all versions** of the same logical dog. Created once when the dog is first bred. Never changes across saves. |
| `parentId` | GUID \| null | Points to the previous version's `id`. Forms a tree -- not a flat list. Branching is possible: two versions can share the same `parentId`. |
| `displayName` | string | Human-readable name. Changeable at any time via `PATCH /api/nodes/:id/rename` -- the rename propagates across all versions sharing the `lineageId`. |

Example lineage:

```
Create "my-parser"   → id: aaa, lineageId: LLL, parentId: null,  displayName: "my-parser"
Save (edit code)     → id: bbb, lineageId: LLL, parentId: aaa,   displayName: "my-parser"
Save again           → id: ccc, lineageId: LLL, parentId: bbb,   displayName: "my-parser"
Branch off bbb       → id: ddd, lineageId: LLL, parentId: bbb,   displayName: "my-parser"
```

> *Khra — To cosmic forms from tangent planes, we end as we began.*

**Resolving a dog reference** -- When a Kennel's `dogIds` entry points to a SerializedDog, the store resolves it in order:
1. **Exact `id` match** -- pinned to a specific version (useful for reproducibility).
2. **`lineageId` match** -- returns the newest version by `createdAt` (the default "latest" behavior).
3. **`displayName` fallback** -- matched by name if neither ID hits.

In `dogIds`, BaseDogs are prefixed (`base:QueryRetriever`), SerializedDogs are referenced by `lineageId` (latest) or by exact `id` (pinned version).

**Kennel versioning** -- Every Kennel carries a stable **lineageId** (the name you chose) and a chain of **versionIds** (GUIDs). Each save creates a new version with a `parentId` pointing back. The full history is navigable -- branch off, revert, compare. The Kennel remembers its past lives.

**Kennel export & import** -- `GET /api/kennels/:id/export` returns a **bundle** (format `bundleVersion: 2`): current Kennel config plus transitively collected SerializedDogs and MimicDogs; `base:` dog IDs stay as references. `POST /api/kennels/import` mints **new** GUIDs for serialized dogs and creates a **single** fresh Kennel version (no version history from the source). **Optional body field** `importTarget: { "kennelId": string, "name": string }` — when both strings are set, the imported Kennel uses that id and display name. If you omit it, the server **suggests** an id and name (collision-safe; see `suggestKennelImportTarget` in `@slopdogs/core`). All `base:` refs in the bundle must exist on the target server or import fails with 400. **In the browser UI** (Kennel list on `:4300`), the same workflow is copy-and-paste: **Export** in a row's `⋯` menu copies that bundle JSON to the clipboard; the **Import** button pastes bundle JSON from the clipboard and imports it. See [Kennel list copy and paste](#kennel-list-copy-and-paste). Copy and paste across instances or between UI, terminal, and other tools.

**Caching** -- Two-tier memory so dogs don't repeat themselves:
- **KV cache** (`CacheHandler`) -- TTL-based key-value store with in-flight request deduplication plus negative-caching for 429/504 to break provider retry storms.
- **Tile feature cache** (`PrismaTileFeatureCache`) -- Atomarer Geo-Feature-Store auf Slippy-Map-Tiles (Multi-Zoom). Features werden per OSM-ID dedupliziert; Coverage ist pro (dog-type, zoom, tile, facet) getrennt. Fehlende Tiles × Facets werden gezielt nachgeladen, bestehende aus der DB bedient. Polygone über Tile-Grenzen werden im Volltext zurückgegeben.

Dogs opt in by implementing `ICacheable` (simple KV) or `ITileCacheable` (geo-aware tile feature cache). The cache is injected at runtime -- dogs that don't implement the interface are unaffected. *Khra* -- what was fetched once defies time.

**Read tracking** -- Every property access between dogs is logged. Which dog read what, from whom, in which wave. Full data-flow traceability across the pack.

**Public endpoints** -- Every Kennel gets a URL. `GET /k/my-kennel` runs the pack and returns the lead dog's result. Pass query params or POST a body -- the dogs pick it up.

**Swagger** -- `/k/:id/docs` runs the Kennel once and builds a live OpenAPI spec from the lead dog's actual yield — not a hand-written schema. `/k/:id/openapi.json` serves the raw spec. Swagger UI lets you try endpoints on the spot. The old `/api/kennels/:id/docs` and `/api/kennels/:id/swagger.json` answer 308 -> `/k/:id/docs` / `/k/:id/openapi.json`.

**Inline Kennel params** -- Edit query parameters and body data directly from the Waves Viewer. Change it, reload, see the result. Save it when it's right.

**HTML and Markdown in the UI** -- When the lead returns HTML, the result view can show a sandboxed iframe preview; toggle between preview and raw source. When the lead returns Markdown (same detection rules as the server), the editor uses Markdown highlighting and an Auto/Raw toggle. JSON and other structured yields still appear as formatted JSON in Monaco.

---

## Authentication & Access Control

SlopDogs ships with optional Google SSO + OAuth 2.1 + an ACL-based permission model.

### Toggle

| `MCP_AUTH_REQUIRED` | Behavior |
|---|---|
| `false` (or unset) | Development only. Every request is super-user, all entities visible, no login required. |
| `true` | Production/integration mode. Anonymous sees public entities and can run run-only ones. Mutations require login + rights. |

Super-user mode exists only in development. In `production`/`integration` (`NODE_ENV`), the server refuses to start unless `MCP_AUTH_REQUIRED=true` — it exits with code 78 and logs `[boot] MCP_AUTH_REQUIRED must be true in production/integration`. Dev logs once, `[boot] superuser mode (MCP_AUTH_REQUIRED unset)`.

### Identity

- **Google SSO** via `GET /auth/google/login` → cookie session for the browser UI.
- **Personal Access Tokens** at `GET /auth/tokens` (HTML page). Long-lived JWTs for MCP clients, Custom GPT API-keys, scripts. The same three routes also answer JSON to `Accept: application/json` (`{ ok, tokens }` / `{ ok, token }`) — the `/account?tab=tokens` screen uses this.
- **Full OAuth 2.1 Authorization Server** at `/auth/authorize`, `/auth/token`, `/auth/register`. Discovery via `GET /.well-known/oauth-authorization-server` — for clients that auto-configure (Cursor, Claude.ai Connectors, Custom GPTs with OAuth).

### Stage and closed beta

One switch, `SLOPDOGS_STAGE`. With `SLOPDOGS_STAGE=beta`:

- **The landing shows the beta sticker.** The server fills the placeholder `‹stage›` in `<html data-stage="…">` with the stage — for the kennel output and for the static fallback alike; the sticker only shows under `data-stage="beta"`.
- **Beta keys become mandatory — only with login on** (`MCP_AUTH_REQUIRED=true`). Every Google account has to be unlocked once: a new one when it signs up, an existing one at its next sign-in, never again after that. One key unlocks exactly one account; keys don't expire, they end by being redeemed or revoked. Only the SHA-256 hash is stored (table `BetaKey` in the auth DB). A key comes in through the field on `/login` or the key page the Google callback shows (`403`, "closed beta") — it rides along as `/auth/google/login?betaKey=…` and is redeemed together with the account, in one transaction: two sign-ins with one key make one account.
- **Locally without login** the sticker shows and nobody needs a key.

`BETA_ADMIN_EMAILS` (comma-separated) manage keys and sign in without one — in production too; locally the super-user does it. In the app: `/account?tab=beta` (create — the key is shown once —, list masked with open / redeemed by whom and when / revoked, revoke). Over REST:

| Method | Path | |
|---|---|---|
| `GET` | `/api/beta` | `{stage, keysRequired, admin}` — for everyone |
| `GET` | `/api/beta/keys` | Masked list (last four characters, state, `usedBy`, `usedAt`) — admins |
| `POST` | `/api/beta/keys` | `{note?}` -> `201 {code, key}`; `code` is the key in plain text, shown this once — admins |
| `DELETE` | `/api/beta/keys/:id` | Revoke an open key; a redeemed one stays redeemed — admins |

### Visibility & Ownership

Rights are a strict ladder: **NONE < RUN < READ < EDIT < OWN**. COPY is not a right of its own — it equals READ; the only real copy protection is keeping something run-only.

- **RUN** — run the kennel / use the dog as a parent; see the lead result or that dog's output. No code, no config/defaults/task/layout, no versions.
- **READ** — + code, config, defaults, task, layout, versions, export, `GET /api/nodes/:id` (and `/versions`), snapshot code/vmContext.
- **EDIT** — + new version, rename, delete, change dog references.
- **OWN** — + manage the ACL, change visibility, transfer ownership, freeze/unfreeze.

Both Kennels and SerializedDogs carry:

- **`visibility`** — `"public"` (anyone reads + runs), `"run-only"` (anyone runs it and sees it listed; reading is restricted to owner/editors/viewers), or `"private"` (owner/editors/viewers read, runners run). New entities always default to `"private"`, even under super-user.
- **`ownerId`** — the creator's `User.id`. OWN.
- **`editors[]`** — EDIT.
- **`viewers[]`** — READ (the UI/MCP call this role "reader"; "viewer" still works as an alias).
- **`runners[]`** — RUN without READ ("run without read").

The highest right any of these grants wins. `myRights: {run, read, edit, own, frozen, locked}` (`locked`: `landing`, `frozen` or null) is attached to `GET /api/kennels/:id`, `GET /api/nodes/:id`, and every entry of `GET /api/nodes` and `GET /api/kennels`.

**Special rules:**
- Legacy/community entities (`ownerId = null`) are **community-editable** — any logged-in user reads + edits. OWN (ACL management, freeze) belongs to the super-user only; nobody can claim ownership of a community entity through `grant_access`.
- Hunters (BaseDogs) are project-wide infrastructure — no per-user ACL.
- **Cascade respects manual visibility:** when a kennel goes public, its own SerializedDogs cascade to public — **but only nodes whose `visibility` is still `NULL`** (never explicitly set). A node you manually set to `run-only`, `public` or `private` is never overwritten by a kennel cascade. Other-user-owned nodes stay where they are.
- **Frozen:** the owner (super-user for community entities) can freeze an entity. While frozen, no mutation succeeds for anyone, owner included — no edit, rename, delete, new version, or ACL change — until unfrozen. Runs, reads, exports and copies keep working; freezing never creates a new version.
- **Referencing a foreign dog** in a kennel (`create_kennel`/`update_kennel`/`PUT /api/kennels/:id`) requires at least RUN on it. A dog you may run but not read can only be pinned to a version GUID, never referenced by lineage — otherwise the call fails with `pin_required`. That keeps its author from slipping new code under a kennel that depends on it.

### ACL tools

Available via MCP (`POST /mcp`), via the OpenAPI mirror (`POST /actions/<tool>`), or directly via REST — see the API Kennels table below.

- `grant_access(entity_type, id, user, role)` — `role ∈ "editor" | "reader" (alias "viewer") | "runner" | "owner"`. `"owner"` transfers ownership.
- `revoke_access(entity_type, id, user, role)` — remove from `editors[]`, `viewers[]` or `runners[]`.
- `release_ownership(entity_type, id)` — set `ownerId = null`, hand the entity back to community-edit mode. Editors/viewers/runners stay intact. Only the current owner (or super-user) can release; refused while frozen.
- `list_collaborators(entity_type, id)` — owner + editors + viewers + runners + `frozen`, resolved with email and name. Only for those who can read the entity; emails are shown only to the owner and editors.
- `freeze_entity(entity_type, id)` / `unfreeze_entity(entity_type, id)` — owner only (super-user for community entities).

`user` accepts an email or a `User.id` GUID. Only the owner may manage the ACL or change visibility — editors may mutate content but not the ACL.

`grant_access` returns informative `action` codes for redundant requests:
- `already_owner` / `already_editor` / `already_viewer` / `already_runner` — user is already in that role.
- `runner_added` / `viewer_added` / `editor_added` — the role was newly granted.
- `redundant_owner_is_runner` / `redundant_editor_is_runner` / `redundant_viewer_is_runner` — the user's existing role already covers what `runner` would grant.
- On `revoke_access`: `..._removed` / `not_present`.

`"Only the owner may manage access"` and `"Only the owner may change visibility"` are refusals, not bugs; a frozen entity answers `"... is frozen — unfreeze it first"`.

### Endpoint reference

```
GET  /auth/me                         Browser session check
GET  /auth/google/login                Start Google flow (?returnTo=…)
GET  /auth/google/callback             Google OAuth callback
POST /auth/logout                      Clear session

GET  /auth/tokens                      HTML — manage Personal Access Tokens; JSON with Accept: application/json
POST /auth/tokens                      Create new PAT (returned once); JSON with Accept: application/json
POST /auth/tokens/:jti/revoke          Revoke a PAT; JSON with Accept: application/json

GET  /auth/authorize                   OAuth 2.1 authorization endpoint
POST /auth/authorize                   Consent submit
POST /auth/token                       Token + refresh
POST /auth/revoke                      Token revocation
POST /auth/register                    Dynamic Client Registration (RFC 7591)

GET  /.well-known/oauth-authorization-server   OAuth metadata
GET  /.well-known/oauth-protected-resource     MCP protected-resource metadata
```

### Tone for AI clients

The MCP server returns **Spuren rules + a pointer to the full guide** as the `instructions` field at initialization (`mcp/spuren-brief.ts`); the complete skill lives in resource `slopdogs://skill` (`mcp/skill.md`). For Custom GPTs and Vertex agents, `GET /actions/gpt-template` returns a ready-to-paste config block with the full skill text.

---

## API

### Kennels

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/kennels` | Survey all Kennels — every entry carries `stats` {calls, rating}; `?q=`, `?mine=1`, `?sort=name|createdAt|updatedAt|calls|calls30d|rating|failures30d&dir=desc`, `?minStars=4`, `?minCalls=20`, `?usage=top|never_used|never_worked|failing|dormant`, `?limit=&offset=` |
| `GET` | `/api/kennels/:id` | Load a Kennel's covenant |
| `POST` | `/api/kennels` | Forge a new Kennel |
| `PUT` | `/api/kennels/:id` | Rewrite the covenant |
| `DELETE` | `/api/kennels/:id` | Dissolve the pack — the kennel id (lineage) takes every version, a version GUID exactly that one; answers `{ok, scope, lineageId, deleted}`, errors as codes (`not_found`, `forbidden`, `frozen`, `locked_landing`, `delete_failed`) |
| `GET/POST` | `/api/kennels/:id/run` | Unleash the hunt, return Waves + config |
| `GET/POST` | `/api/kennels/:id/execute` | Unleash the hunt, return the lead's yield |
| `GET` | `/api/kennels/:id/versions` | List all versions of a Kennel's lineage |
| `GET` | `/api/kennels/:id/rating` | Stars: `{avg, count, score, histogram, mine}` (run right needed; `mine` null when anonymous or unrated) |
| `PUT` | `/api/kennels/:id/rating` | Rate 1-5 (`{ "stars": 4 }`) — logged in, not the owner, not an editor |
| `DELETE` | `/api/kennels/:id/rating` | Take your rating back (idempotent) |
| `GET` | `/api/kennels/:id/acl` | Read visibility, owner, editors/viewers/runners, `myRights` (owner/editor only) |
| `PUT` | `/api/kennels/:id/acl` | Set visibility and editors/viewers/runners (owner only) |
| `POST` | `/api/kennels/:id/acl/transfer` | Transfer ownership (owner only) |
| `POST` | `/api/kennels/:id/freeze` | Freeze — block mutation for everyone, owner included |
| `POST` | `/api/kennels/:id/unfreeze` | Unfreeze |
| `GET` | `/api/kennels/:id/export` | Export Kennel bundle (dogs + history) as JSON |
| `POST` | `/api/kennels/import` | Import a Kennel bundle (auto-renames on collision) |
| `GET` | `/k/:id/openapi.json` | Xata -- the Kennel's truth as OpenAPI spec (was `/api/kennels/:id/swagger.json`, now 308) |
| `GET` | `/k/:id/docs` | Swagger UI — generated from the run (was `/api/kennels/:id/docs`, now 308) |

`PUT /api/kennels/:id` no longer takes `ownerId`/`editors`/`viewers`/`runners`/`frozen` — rights move only through `/acl`, `/acl/transfer`, `/freeze` and `/unfreeze`.

### Dogs (Nodes)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/nodes` | List all dogs (BaseDogs + SerializedDogs) — every entry carries `stats` {calls, reuse, proven}; `?sort=proven|calls30d|reuse|failures30d|name&dir=desc`, `?proven=1` (badge only), `?usage=` (as for kennels), `?minReliability=0.8`, `?q=`, `?limit=&offset=` |
| `GET` | `/api/nodes?kennelId=xxx` | List dogs **not yet** in that Kennel (toolbar: what can be added) |
| `GET` | `/api/nodes/:id` | Load a specific dog or version |
| `GET` | `/api/nodes/:id/versions` | List all versions of a dog's lineage |
| `GET` | `/api/nodes/:id/usage` | Where the dog runs: kennels (crew or transitive, only those you may run; the rest as `hiddenKennels`), `dependents`, `dependencies`, `byOwner` — `:id` is a lineageId, version GUID or `base:X` |
| `GET` | `/api/nodes/:id/acl` | Read visibility, owner, editors/viewers/runners, `myRights` (owner/editor only) |
| `PUT` | `/api/nodes/:id/acl` | Set visibility and editors/viewers/runners (owner only) |
| `POST` | `/api/nodes/:id/acl/transfer` | Transfer ownership (owner only) |
| `POST` | `/api/nodes/:id/freeze` | Freeze — block mutation for everyone, owner included |
| `POST` | `/api/nodes/:id/unfreeze` | Unfreeze |
| `POST` | `/api/nodes` | Breed a new SerializedDog |
| `POST` | `/save?id=:id` | Save code + parents (breeds new version) |
| `PUT` | `/api/nodes/:id` | Update a dog (creates new version, keeps lineage) |
| `PATCH` | `/api/nodes/:id/rename` | Rename a dog across all versions (`{ "displayName": "new-name" }`) |
| `DELETE` | `/api/nodes/:id` | Put a dog down — lineageId: every version, version GUID: that one (MCP `delete_node`); same answer and codes as for kennels |

`PUT /api/nodes/:id` no longer takes `ownerId`/`editors`/`viewers`/`runners`/`frozen` — rights move only through `/acl`, `/acl/transfer`, `/freeze` and `/unfreeze`.

### Keys (user key store)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/keys` | Your keys, masked: `{alias, last4, allowedDomains, kennelGrants, quotaPerDay, createdAt, lastUsedAt}` — never the value |
| `POST` | `/api/keys` | Create or replace `{alias, secret, allowedDomains[], kennelGrants?, quotaPerDay?}`; `400 invalid_alias\|invalid_secret\|invalid_domains\|quota_required`, `403 no_identity` (super-user without user), `503 keystore_disabled` (no `KEYSTORE_MASTER_KEY_V1`) |
| `DELETE` | `/api/keys/:alias` | Delete one of yours; foreign and unknown both answer `404` |

Login required. Keys are AES-256-GCM encrypted in the auth database and never returned; dogs use them through `keys.fetch(url, opts)` with `{{key:<alias>}}` — substituted on the server, only to the key's `allowedDomains` (https, no private networks, no redirects), with the keys of whoever runs the kennel. `kennelGrants` (opt-in, needs `quotaPerDay`) lets runs of your own listed kennels use the key for any runner. A database reset deletes the key store. MCP: `set_key`, `list_keys`, `delete_key` — no `get_key`. The `/account?tab=keys` screen manages these.

### Public

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET/POST` | `/k/:id` | Run Kennel, return lead dog's yield |

### Meta

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/readme` | Project README as rendered HTML |
| `GET` | `/api/landing` | The landing's two rankings `{generatedAt, windowDays, topByCalls30d, topByRating}` plus `provenDogs` (dogs with the proven badge, by score) — only what an anonymous visitor may run; `?limit=` (default 10, max 50); 60 s memo, `ETag` |

Calls: every kennel run is counted once, per day (UTC) and source; `stats.calls.ranked`/`ranked30d` count only real use (`/k/:id`, `/api/kennels/:id/execute`, MCP `execute_kennel`), `leadFailed` the runs whose lead errored (`leadFailed30d` in the last 30 days); a dog run fails when it ends in error, timeout or oom (`stats.calls.failures`, `failures30d`). Usage filter (`?usage=`, MCP `list_kennels`/`list_nodes` `usage`), applied after the rights filter and combinable with `q`/`search` and `sort`: `top` = called at least once, most calls first unless `sort` is given; `never_used` = 0 calls; `never_worked` = called, every run failed; `failing` = a failed run in the last 30 days; `dormant` = called before, 0 calls in the last 30 days. Counts live in memory and are flushed every `KENNEL_CALL_FLUSH_MS` (30 s) in one transaction. Stars: 1-5 per user and kennel; `score` is a Bayes average `(5·m + sum) / (5 + count)` with `m` the mean over all ratings — it ranks; `avg` is the raw mean.

---

## Landing

`/` is a kennel: the lead output of one of the kennels listed in `LANDING_KENNEL_IDS` (comma-separated), or, behind them, of the seeded `slopdogs-landing` — one content dog, the Mixtape skin and a lead, no look switcher. The same page is reachable as a kennel at `/k/slopdogs-landing`.

- **Rotation:** each visit picks one listed kennel uniformly at random; `?landing=<id>` forces one **from the list** (other ids are ignored). A listed kennel that is missing, not public, throws or yields no HTML is skipped for the memo window. `slopdogs-landing` takes over when the list is empty or none of the listed kennels runs. The old single `LANDING_KENNEL_ID` is still read as a one-entry alias (with a log line).
- **Locked while listed:** every kennel in `LANDING_KENNEL_IDS` is read-only for everyone — owner and super-user included — as long as it is listed: `myRights {edit: false, own: false, locked: 'landing'}`; `PUT`, rename, `DELETE`, `/acl`, `/freeze`, `/unfreeze` and the MCP mutations answer `403 {"error":"locked_landing"}`. Runs, stars, reading and copying keep working. `slopdogs-landing` is only locked when it is listed itself.
- **Source:** `seed-data/kennels/slopdogs-landing/` (content, skin C, lead) — seeded at boot when the kennel is missing (public, community-owned). Changes in the repo reach an existing instance only after the kennel is removed (the seed never overwrites). The former skins a, b and d are archived under `docs/slopdogs/landing/archive/`.
- **No run per visit:** `GET /` serves the lead output from an HTML memo per kennel (`LANDING_HTML_MEMO_MS`, default 300000). When the window is over, the visitor gets the remembered page at once and the kennel runs again in the background. The run counts with source `landing` — in `total`, never in `ranked`/`ranked30d`. `HEAD /` never runs the kennel.
- **Fallback:** if the kennel is missing or its run fails, `/` serves `public/landing/index.html` — the Mixtape page rendered from the same sources at build time (`node scripts/build-landing.cjs`, part of `npm run build`). The page is never empty, not even on a cold start.
- **Host:** the page shows `‹host›` where the address goes; `/` puts in the host of `MCP_BASE_URL` (else the request's host), the page script does the same from `location` on any other address.
- **Headers:** `Content-Type: text/html; charset=utf-8`, `Cache-Control: public, max-age=300` (`no-cache` while more than one kennel rotates), `X-Landing-Source: kennel|fallback`, `X-Landing-Kennel: <id>`, no cookie. Like every text response, the page goes out brotli- or gzip-compressed when the client accepts it (`HTTP_COMPRESSION=0` turns that off). `/robots.txt` lives in `public/landing/`.
- **Fonts:** self-hosted Latin subsets under `/static/landing/*.woff2` (OFL, `public/landing/OFL.txt`); no font CDN.

"Already out there" loads `GET /api/landing?limit=6` — the only request of the page — and renders `topByCalls30d`, `topByRating` and `provenDogs` (links: kennel `url`, dogs to `/kennels?q=<name>`; numbers en-US, `ranked30d` shown, total in the tooltip, no stars when `avg` is null). States on `#sd-live[data-state]`:

| State | When | Page |
|---|---|---|
| `loading` | fetch running, under 2.5 s | placeholder cards, no numbers |
| `waking` | over 2.5 s without an answer | cold-start note (`aria-live="polite"`), fetch goes on |
| `data` | 200, at least one list filled | the lists; an empty list shows its own line |
| `empty` | 200, all lists empty | one honest line, no numbers |
| `error` | 4xx, or network/5xx after 150 s (backoff 2 s, 5 s, 10 s, then every 15 s) | message and an "Again" button |

---

## Startup tests

On every boot, `main.ts` runs [`StartupTest.runAllTests`](StartupTest.ts) — a self-check against the freshly initialised stores, controllers and BaseDogs map. Failures are logged and surface in the boot console; pass lines are summarised at the end. The suite covers Store / Controller plumbing, BaseDog availability, Pact / Mimic resolution, auto-mimic adoption, kennel export / import round-trip, the tile feature cache, and the **Kennel status-tracking contract** for `task`, `nodes` and `edges`:

| Test | What it pins |
|------|--------------|
| `KennelConfig: Status-Tracking Persistence` | Create → save with `task` + `nodes` + `edges` → reload — all fields, positions and comments survive verbatim. |
| `KennelConfig: Status-Tracking Merge` | Partial saves (`{task}` only, `{nodes}` only) leave untouched fields intact — guards the merge semantics in `KennelController.save`. |
| `KennelConfig: Status-Tracking Text-Aenderungen` | Mutating an existing `task` / `node.comment` / `edge.comment` updates the latest version while older versions keep the old text; clearing `task` with `""` doesn't wipe other fields. |
| `KennelConfig: Node-Comment Mutationen` | Multi-node arrays: change one comment, drop one (keep position), add a fresh node, remove an old one — verified against current state **and** version history. |
| `KennelConfig: Edge-Comment Mutationen` | Multi-edge arrays: same shape as node mutations, including removing an edge entirely and adding a feedback edge later. |
| `KennelConfig: Status-Tracking Versioning` | Three text edits → three new versions, newest-first, each with its own snapshot. Identical no-op save produces **no** phantom version. Historical version-GUID fetches return the frozen text. |

If a status-tracking save ever stops behaving as documented, the boot console flags exactly which guarantee broke before any kennel work begins.

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Express.js, TypeScript, Node.js VM |
| Databases | **Four** physically-separate Prisma schemas, each with its own `*_DATABASE_URL`: `DATABASE_URL` (kennels + nodes), `CACHE_DATABASE_URL` (run-cache), `JSON_STORAGE_DATABASE_URL` (fachliche JSON-Ablage), `AUTH_DATABASE_URL` (User, OAuthClient, AccessToken, RefreshToken, AuthorizationCode). SQLite for local dev; PostgreSQL for **integration** and production. |
| Auth | Google SSO via `openid-client`, OAuth 2.1 AS via `jose` (HS256 JWTs), browser session via `express-session` |
| Frontend | Angular 18, Monaco Editor, vis-network |
| Core | `slopdogs` package (local, in `packages/core`) |

---

## Getting Started

Copy [`.env.example`](.env.example) to `.env` and fill in secrets (API keys, Hue bridge user, and so on) on your machine. Never commit `.env`. The file is grouped (required / operations and limits / features / integrations / development / internal) and names for every variable its purpose, default, phase and what happens without it; the same list lives in code (`server-app/startupEnvCheck.ts`), and the server prints one `[env] missing …` line per missing required variable at start (stricter for `NODE_ENV=integration|production`).

```bash
npm install
npm run dev
```

Backend wakes on `:3000`, UI (dev) on `:4300`. Open the UI. The lodge is warm.

### App routes

The Angular app (`SPA_ROUTES` in `api/routes/routeTable.ts`; Express serves `index.html` for each):

| Route | Screen |
|---|---|
| `/kennels` | Kennel list (side A): `?q=`, `?sort=`, `?dir=`, `?mine=1`, `?new=1` |
| `/kennels/:id` | Kennel page: canvas, inspector (`?panel=brief\|versions\|rating\|stats`), run |
| `/kennels/:id/edit` | The same page with the settings drawer open — name, access, freeze, dog order, defaults (there is no separate edit page) |
| `/dogs` | Dog browser (side B): `?q=&sort=&group=&pack=&owner=`; `?dog=<lineageId>` opens the preview — a dog is never a page of its own |
| `/account` | Profile, personal tokens, keys: `?tab=profile\|tokens\|keys` |
| `/login` | One button, one verse: `?returnTo=` (a path on this site) |

Keys in the app: `?` shows them all; `/` search; `Esc` closes the top panel; on the kennel page `Ctrl/⌘+Enter` runs and `Ctrl/⌘+S` saves the open editor. Leaving with unsaved changes asks first.

### Default Kennel seed: server run and UI

**Server-side:** On every startup, `main.ts` calls **`runSeeds()`** ([`seed.ts`](seed.ts)) against the Prisma store. If the database is still empty of those rows, the seed creates **`seed-serialized-1-v1`** (the LayoutInput Mimic) and a **`KennelConfig`** with id **`default-kennel`** — see `dogIds` there (serialized dog first as **lead**, then all registered BaseDogs). Nothing special-cases that Kennel at runtime: **`GET /api/kennels/default-kennel/run`** (waves + config), **`GET /k/default-kennel`** (public **lead** yield only), and **`POST /k/default-kennel`** with a body all go through the same **`KennelRunHandler` → `KennelRun`** path as any other Kennel (load config from DB → fill kennel → run waves).

**UI:** With **`npm run dev`**, the Angular app is proxied to the API. Open **`http://localhost:4300`**, choose **Default Kennel** from the list, or go straight to **`http://localhost:4300/kennels/default-kennel`**. The kennel page loads that Kennel run (canvas + inspector); **⏵ Run** re-runs it. **Open /k/default-kennel** opens the raw public response in a new tab so you can compare browser vs UI.

### Kennel list copy and paste

On the **Kennel list** (`http://localhost:4300/kennels`):

| Action | Where | What it does |
|--------|--------|----------------|
| **Paste / import** | **Import** button in the toolbar | Reads the system clipboard. If the text is valid Kennel bundle JSON (same shape as `GET /api/kennels/:id/export`), calls **`POST /api/kennels/import`** and reloads the list. |
| **Copy / export** | **Export** in a Kennel row's `⋯` menu | Fetches the bundle via **`GET /api/kennels/:id/export`** and copies pretty-printed JSON to the clipboard (falls back to a file download if the clipboard is unavailable). |

Use this to move Kennels between environments, share bundles in chat or tickets, or round-trip with `curl` / file saves without retyping IDs.

Manual seed (e.g. after resetting the DB): `npx prisma db seed` (same [`seed.ts`](seed.ts); set `DATABASE_URL` like for `prisma:sync`).

Backend only:

```bash
npm run prisma:sync
npm start
```

### Build & emit -- where the .js lands

The root `tsconfig.json` is **typecheck-only** (`noEmit: true`). It exists for editor IntelliSense, `tsc --noEmit`, and ts-node. **It must never emit** -- a stray `npx tsc` at the repo root would otherwise drop `.js` next to every `.ts`, and ts-node / Node module resolution prefers those `.js` over the actual source. You then debug ghosts.

The real build runs through dedicated configs that write into `dist/` only:

| Script | Config | Output |
|--------|--------|--------|
| `npm run build` | root [`tsconfig.build.json`](tsconfig.build.json) | `./dist` (main.ts + api/services/store/mcp) |
| `npm run build:core` | [`packages/core/tsconfig.json`](packages/core/tsconfig.json) | `packages/core/dist` |
| `npm run build:dogs-<x>` | `packages/dogs-<x>/tsconfig.json` | `packages/dogs-<x>/dist` |

If you ever see a `.js` file inside `packages/*/src/`, `api/`, `mcp/`, `services/`, or `store/` -- delete it. `.gitignore` blocks them from being committed; the root `noEmit: true` prevents new ones from being created. Build output lives in `dist/` and `packages/*/dist/` only.

### Integration mode (pre-release staging)

**Integration mode** (`NODE_ENV=integration`) is a **staging profile** added for the stretch between local dev and a full production deploy: exercise the app against **external databases** (PostgreSQL for the main store and the HTTP cache — see [`.env.integration.example`](.env.integration.example)) and run with the **built Angular UI only** (no `ng serve`; Express serves `ui-app/dist/.../browser` from the same port as the API).

Typical flow: configure `.env.integration` with your hosted URLs, run `npm run prisma:sync:integration` to align schemas, build the backend with **`npm run build:prod`**, the frontend with **`npm run ui:build:integration`** (injects `PUBLIC_API_BASE_URL` using `NODE_ENV=integration`), then start locally with **`npm run start:integration`** (runs `main.ts` via ts-node). On a host that serves **compiled** output only (e.g. **Render**), use **Build Command** **`npm run render:integration:build`** (runs `npm install`, then `build:prod`, then `ui:build:integration`) and **Start Command** **`npm run start:integration:dist`** — it runs `dist/main.js` with `NODE_ENV=integration`. Use this as a **pre-release** checkpoint before going fully online.

**Production** and **integration** both load the **reduced Base-Dog registry** (`server-registries/slimDeployRegistry.ts`); only **`NODE_ENV=development`** uses the full set (`fullRegistry.ts`). On slim profiles, startup **fails fast** if any **latest** Kennel row in the DB references a `base:…` dog that is not registered — so RAM stays minimal without silently breaking existing kennels. After adding seed kennels that reference new `BASE_DOG_PREFIX + '…'` names, extend that slim registry (or keep **`npm run check:integration-dogs`** green — it scans `seed-data/**/*.ts` against `SLIM_DEPLOY_BASE_DOG_NAMES`).

### Quick Hunt

```bash
# Forge a Kennel
curl -X POST http://localhost:3000/api/kennels \
  -H "Content-Type: application/json" \
  -d '{"id": "my-kennel", "name": "First Hunt", "dogIds": ["base:RandomRecipesRetriever"]}'

# Unleash it
curl http://localhost:3000/k/my-kennel
```

Or skip the terminal -- the [UI](ui-app/README.md) does all of this with a few clicks.

---

## Creating a new BaseDog Package

Every BaseDog lives in its own package under `packages/`. Follow these steps to add a new one.

### 1. Scaffold the package

```bash
mkdir -p packages/dogs-mydog/src
```

Create three files:

**`packages/dogs-mydog/package.json`**
```json
{
  "name": "@slopdogs/dogs-mydog",
  "version": "0.1.0-alpha.1",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "private": true,
  "dependencies": { "@slopdogs/core": "file:../core" },
  "peerDependencies": { "@slopdogs/core": "0.1.0-alpha.1" },
  "scripts": { "build": "tsc" },
  "devDependencies": { "typescript": "^5.0.0" }
}
```

**`packages/dogs-mydog/tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "es2016", "module": "commonjs", "lib": ["ES2020"],
    "strict": true, "esModuleInterop": true, "skipLibCheck": true,
    "moduleResolution": "node", "declaration": true,
    "outDir": "./dist", "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**`packages/dogs-mydog/src/index.ts`** — barrel export for all public symbols.

### 2. Define a Pact (if the Dog needs input)

A Pact declares _what data shape_ the Dog requires, without specifying _who provides it_. At runtime, a MimicDog or another Dog fulfills it.

```typescript
import { createPact } from "@slopdogs/core";

export interface MyDogQuery {
    someParam: string;
}

export const MyDogQueryPact = createPact<MyDogQuery>(
    "MyDogQueryProvider",
    { fromSourceType: "MyDogQuery" }
);
```

### 3. Write the Dog class

Extend `Dog<YieldType>` and implement:

| Member | Purpose |
|---|---|
| `get name()` | Return `MyRetriever.name` (the class name) |
| `get icon()` | Return a **string** (usually one emoji) for the UI — same pattern as other `packages/dogs-*` retrievers; there is no central icon map. |
| `get required()` | Pact/Dog classes that must run before this Dog |
| `get optional()` | Pact/Dog classes that are used if present |
| `yieldCollectorFactory` | Async function that does the actual work |

```typescript
import { Dog, IHuntingDog, IHuntingSeason } from "@slopdogs/core";
import { MyDogQueryPact, type MyDogQuery } from "./pacts";

export class MyRetriever extends Dog<MyResult> {
    get name() { return MyRetriever.name; }
    get icon() { return "🔮"; }
    get required() { return [MyDogQueryPact]; }
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return []; }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<MyResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(MyDogQueryPact, d));
        const query = (queryDog?.collected as MyDogQuery | undefined) ?? ({} as MyDogQuery);
        // ... fetch data, transform, return
    };
}
```

### 4. Register in the platform

**`main.ts`** — two touches: register the class and any Pacts it introduces (same pattern as existing dogs at the bottom of the file):
```typescript
import { MyRetriever, MyDogQueryPact } from '@slopdogs/dogs-mydog';
// add to allBaseDogClasses array:
const allBaseDogClasses = [ ..., MyRetriever ];
// add Pact to allPacts array:
const allPacts = [ ..., MyDogQueryPact ];
```

*(Geo-related dogs that use shared coordinate types also wire `GeoPointPact` from `@slopdogs/geo-pact` in `allPacts` if your package needs it — copy a similar dog from `dogs-geo`.)*

### 5. Wire up the build

**Root `tsconfig.json`** — add path mapping:
```json
"@slopdogs/dogs-mydog": ["packages/dogs-mydog/src/index.ts"]
```

**Root `package.json`** — add dependency, build script, and typecheck:
```json
"dependencies": { "@slopdogs/dogs-mydog": "file:packages/dogs-mydog" }
"scripts": {
  "build:dogs-mydog": "cd packages/dogs-mydog && npx tsc",
  "build:dogs": "... && npm run build:dogs-mydog",
  "typecheck:dogs": "... && cd ../dogs-mydog && npx tsc --noEmit"
}
```

Then run `npm install` so the symlink in `node_modules/@slopdogs/dogs-mydog` is created.

### 6. Seed a Kennel (optional)

In `seed.ts`, create a MimicDog that maps `QueryRetriever` params to your Pact, then a `KennelConfig` with `dogIds`:

```typescript
dogIds: [
    BASE_DOG_PREFIX + 'MyRetriever',       // lead dog (1st = public response)
    BASE_DOG_PREFIX + 'QueryRetriever',     // captures ?param=value from URL
    mimicDogId,                              // MimicDog that fulfills MyDogQueryPact
],
defaultQuery: { someParam: 'defaultValue' },
```

The MimicDog's `theRun` maps QueryRetriever fields to your Pact interface:
```typescript
theRun: `return { someParam: QueryRetriever.someparam }`
// Note: QueryRetriever lowercases all keys
```

### 7. Verify

```bash
npm run build:dogs-mydog          # compiles the package
npx tsc --noEmit -p tsconfig.build.json  # typechecks the whole project
npm start                         # server starts, seed runs, kennel is callable
curl http://localhost:3000/k/my-kennel?someParam=test
```

---

## Development

### Startup Tests

The app runs a test suite on every boot -- store ops, controller CRUD, BaseDog availability, TypeDefBuilder, SerializedDog execution. All must pass before the server starts listening. *Ris* -- in luminous space blackened stars; they gaze, accuse, deny.

### Seeds

See [Default Kennel seed](#default-kennel-seed-server-run-and-ui) under *Getting Started*. Example Kennels and SerializedDogs are inserted when the DB has no matching seed rows yet.

### Project Structure

```
main.ts                       Entry point, dog registration, pact registration
seed.ts                       Database seeds (dogs + kennels)
api/
  Controller.ts               Generic CRUD controller with versioning
  KennelController.ts         Kennel-specific controller
  AbstractController.ts       Base class for all controllers
  routes/
    ConfigRouteHandler.ts     REST routes + /save endpoint
    KennelRunHandler.ts       Run/execute/public endpoints
    KennelBundleHandler.ts    Export/import Kennel bundles
    KennelSwaggerHandler.ts   Swagger/OpenAPI spec generation
  utils/
    versioning.ts             Version ID extraction and generation
store/
  IStore.ts                   Store interface
  PrismaStore.ts              Prisma/SQLite implementation
  prisma/schema.prisma        Database schema
services/
  WavesConverter.ts           Converts execution results to Wave format
  TypeDefBuilder.ts           Generates TypeScript definitions for VM context
  CompilerCache.ts            Caches compiled TypeScript
  swaggridAdapter.ts          Maps Kennel runs to @slopdogs/swaggrid
  CacheHandler.ts             KV cache with TTL and in-flight deduplication
  AreaCacheStrategy.ts        Geographic area cache (Haversine containment)
packages/
  core/                       slopdogs library (Dog, Kennel, Wave engine, Pacts, cache, WebSocket channel retrievers, JSON storage, kennel import helpers)
  geo-pact/                   Shared GeoPoint pact for coordinate-shaped inputs
  swaggrid/                   OpenAPI generation (castGrimoire) — no domain deps
  dogs-*/                     One npm package per BaseDog domain (many — see root package.json `build:dogs-*` scripts)
  ...                         (demo, geo, weather, warframe, etc. — same pattern: retriever + optional pacts + `get icon()`)
ui-app/                       Angular frontend (see ui-app/README.md)
```

---

## License

[MIT](LICENSE) — Copyright (c) 2026 Martin.

> *Netra — Carrion hordes trill their profane accord with eldritch plans.*
> The hunt goes on in the repository.
