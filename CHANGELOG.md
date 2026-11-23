# Changelog

## 0.3.3 (2026-11-23)

### Added
- `RainRadarRetriever` (dogs-rain-radar 0.4.0): DWD precipitation radar (RV composite via Bright Sky) as a 1 km grid around a point, analysis to +120 min in 5-min steps, mm/h. Fixed tiles are fetched once per radar run and shared by all callers. Registered in both registries.
- MCP instructions and skill: a cost section. Base dogs are cheap and cache for everyone, own dogs cost a sandbox per wave, every kennel run counts against the caller's quota, so bundle what a consumer needs into one kennel of base dogs, mimics and a lean lead.

### Changed
- `slopdogs-openmeteo` 0.4.1: the budget weight follows the Open-Meteo server formula (`max(1, …)` applies to the product, per location).

## 0.3.2 (2026-11-23)

### Changed
- Open-Meteo dogs 0.4.0 on the shared cell store (`slopdogs-openmeteo` 0.4.0): one cache entry per 1 km cell and API holds every variable fetched there, each with its own freshness; concurrent requests of one wave are batched into a single upstream call; forecasts always span 7 days and dogs slice. Measured with a mocked upstream: the energy forecast (solar, humidity, snow) costs 1.6 weighted calls instead of 3.0, all ten forecast dogs at one cell 5.7 instead of 10.2.
- Forecast dogs accept `days` 1–7 (was up to 16); larger values are clamped.
- A per-process budget guard stays below the free Open-Meteo quota and serves stored values with `stale: true` when the budget is spent or the upstream returns 429/5xx.

## 0.3.1 (2026-11-23)

### Added
- `HumidityRetriever` (dogs-humidity 0.3.0): hourly temperature, relative humidity, dew point, wet-bulb temperature and vapour pressure deficit with daily means; Open-Meteo, cached 30 min per 1 km cell. Registered in both registries.

## 0.3.0 (2026-11-23)

Server cut: core and the base dogs live in their own repos (slopdogs-core, slopdogs-base-dogs) and are installed from their GitHub releases.

### Breaking
- `create_kennel` / `build_kennel` / import with an ID that already exists answer 409 `id_taken`; new versions go through `update_kennel`.
- Landing and maintained kennels (`slopdogs-landing`, `slopdogs-kennels`) and their ownerless dogs can only be changed by `SLOPDOGS_MAINTAINER_EMAILS`, and only they create a kennel under one of these ids; without the variable nobody can.
- No `packages/` workspace any more: core (`@martinschmieschek/slopdogs-core`, entries `.`, `/runtime`, `/swaggrid`), typedefs and the 58 dog packages come as release tarballs.

### Added
- `GET /api/health`: version, commit, core/typedefs/dog versions, mode; same block in the MCP `health_check`. Landing, kennel list and Angular list show a version line.
- Kennel list as its own kennel `slopdogs-kennels` (served on `/kennels`, ETag, Angular list as fallback).
- Seed kennels are created only when missing; reseed via `--reseed`, `npm run start:local:reseed` / `dev:reseed` or `SLOPDOGS_RESEED=<mark>` (once per mark).
- Deleting a seed kennel checks dog usage: unused dogs go with it, used ones stay; preview `GET /api/kennels/:id/delete-preview`, `delete_kennel` with `dryRun`.
- `npm run update:dogs` lifts pinned core/dog releases to the newest.
- Favorites per user; row click opens `/k/`, edit only via the row menu.
- Auth-free local mode for a home network (`build:local`, `start:local`, systemd example).
- Lobby ticket for WebSocket channels in dev/local.
- CI: GitHub Actions with `npm ci`, `npm test`, `test:startup`; ESLint and Prettier.
- Own pages per user: signed in, any kennel you can see becomes your landing (`/`) and your kennel list (`/kennels`) — in `/account` (profile), via `GET`/`PUT /api/my-pages` or the MCP tools `get_my_pages`/`set_my_pages`. `/` and `/kennels` redirect you to `/k/<id>`; `GET /api/kennel-list` says `source: user|default`. New store table `UserPage` (needs the schema push; without the table the feature stays off and everything else runs).
- Open-Meteo dogs from slopdogs-base-dogs 0.3.0: `SolarRadiationRetriever`, `SolarRadiationHistoryRetriever`, `SatelliteRadiationRetriever` (dogs-solar), `WindProfileRetriever` (dogs-wind), `SoilRetriever`, `EvapotranspirationRetriever` (dogs-soil), `SnowRetriever` (dogs-snow), `ThunderstormRetriever` (dogs-storm), each with its query pact. They share the helper package `openmeteo`, cache per 1 km cell and name their source "Open-Meteo.com (CC BY 4.0)".

### Changed
- `/` and `/kennels` send `Vary: Cookie`; answers to signed-in visitors go out with `Cache-Control: private, no-cache`.
- Kennel pages under `/k/` run sandboxed with stricter headers.
- Base dogs sun, weather, water and air-quality 0.3.1: sun caches its Open-Meteo request (1 h); weather, water and air-quality share cache cells of 1 km instead of 200 m.
- One Prisma client when the parts share the store database.
- StartupTests reduced to a minimal set; dog packages test themselves.
- express 5.3.0, dependencies updated (`npm audit --omit=dev`: 0), `@xmldom/xmldom` pinned to 0.8.15 via overrides.

## 0.2.0-beta.0 (2026-05-16)

Major refactor: MCP snapshot cache, sandboxed SerializedDog VM, jsonStore as VM capability.

### Added
- MCP snapshot cache (in-memory, LRU, per-kennelLineageId) and 28 granular inspection tools (refresh, wait, get summary, per-dog drill, dataflow, graph, lead-dependency-path, find).
- `list_nodes`: pagination + search + type filter.
- `list_kennels` / `get_kennel`: lean projection (no payload bloat).
- 5 new kennel detail tools: get_kennel_default_body / _default_query / _task / _layout / _versions.
- 2 new node tools: get_node / get_node_schema.
- SerializedDog code is TypeScript -- transpiled at runtime via sucrase.
- SerializedDog execution is sandboxed in a worker_threads.Worker with timeout (default 10s, override via env or per kennel).
- VM-global capabilities registry: `jsonStore.get/set/delete/has/list/snapshot` always-on (tenant-scoped per user.id).
- RPC bridge for parent contributions and globals -- methods round-trip via postMessage with whitelist.
- Stale-snapshot detection: tools return {stale:true, ...} when kennelVersion drifted.
- MCP rate limit: 120 req/min per identity (env DATADOGS_MCP_RATE_LIMIT).
- mcp/skill.md served as MCP resource.

### Changed
- VM normalizes displayName -> JS identifier with PascalCase preserved.
- hasContentChanged() now normalizes null/undefined/empty -- no more phantom versions.
- create_node / create_kennel / update_kennel return lean shape (no input echo).
- run_kennel description warns about payload size.
- SerializedDog errors propagate as real dog.error (not result string).

### Removed
- JsonStorageRetriever class -- replaced by `jsonStore` VM-global capability. No backwards compat -- list it as parent no longer works.
- 462 stale .js build artifacts in packages/*/src/ (ts-node module-cache fix).

### Fixed
- Phantom version on no-op save (W3-2).
- Console spam in harverster + parseEntity (gated behind isRuntimeLogVerbose).

## 0.1.0-alpha.3 (prior)
Initial alpha release.
