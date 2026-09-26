# Changelog

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
