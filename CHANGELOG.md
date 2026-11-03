# Changelog

## 0.3.0 (2026-11-03)

Server cut: core and the base dogs live in their own repos (slopdogs-core, slopdogs-base-dogs) and are installed from their GitHub releases.

### Breaking
- `create_kennel` / `build_kennel` / import with an ID that already exists answer 409 `id_taken`; new versions go through `update_kennel`.
- Landing and maintained kennels (`slopdogs-landing`, `slopdogs-kennels`) and their ownerless dogs can only be changed by `SLOPDOGS_MAINTAINER_EMAILS`; without the variable nobody can.
- No `packages/` workspace any more: core (`@martinschmieschek/slopdogs-core`, entries `.`, `/runtime`, `/swaggrid`), typedefs and the 52 dog packages come as release tarballs.

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

### Changed
- Kennel pages under `/k/` run sandboxed with stricter headers.
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
