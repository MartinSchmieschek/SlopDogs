# Backlog

Prioritized technical debt and release topics (as of: code review / release check).

---

## High

- [ ] **Build & Deploy — ungeprüft:** Bisher **kein** systematischer Nachweis, dass das Projekt **end-to-end** **baubar und deploybar** ist: z. B. frischer Clone → `npm ci` → `npm run build` + `npm run ui:build` → `start:prod` mit echter `DATABASE_URL`, Angular-Assets ausgeliefert, Health/Smoke gegen API. Im Repo gibt es **keine** GitHub-Actions-Workflow-Datei — lokal: `npm test` / `npm run typecheck` / `npm run build`; **kein** Deploy-Job, **kein** Container-Image, **kein** Smoke-Test auf einer Zielumgebung.
- [ ] **Packaging:** Dogs as **installable npm packages** (`npm install …`), not only inside the monorepo — including **Core Dogs** and **Kennel Runner** as separately publishable packages (versioning, `exports`, peer deps as needed).
- [ ] **Kennel Runner vs. API:** The **Kennel Runner** itself **without an HTTP/API surface** (runtime/execution only); for REST/OpenAPI use a **wrapper** (thin API layer / separate package or service) that invokes the runner.

---

## Medium

- [ ] **UI — Node löschen / SerializedDog:** DELETE `/api/nodes/:id` — IDs mit Sonderzeichen müssen URL-encoded sein (Client-seitig erledigt); bei weiteren Fehlern Backend-Logs (Prisma) prüfen.
- [ ] **UI — Scope:** Die Oberfläche soll faktisch nur **Kennel-Liste** (`/kennels`) und **Node-Viewer** (`/kennels/:id`) benötigen; weitere Routen nur falls nötig oder zusammenlegen.
- [ ] **UI — Kennel bearbeiten:** Die Seite **Kennel bearbeiten** (`/kennels/:id/edit`) mit separaten **Kennel-Properties** ist überflüssig, wenn **alles im Node-Viewer** (Graph, Side-Panel, Query/Body, ggf. eingebettete Kennel-Metadaten) erledigt werden kann — Edit-Route reduzieren oder in den Viewer integrieren.
- [ ] **UI — SerializedDog Default-Tab:** Im Edit-Fenster (Node-Side-Panel) soll bei **SerializedDogs** die **Code-Ansicht** standardmäktiv aktiv sein *(bereits umgesetzt: `getDefaultPanelSection` → `code`, wenn `codeTs` gesetzt; bei Bedarf noch speziell für reinen Node-Viewer testen/verdichten).*
- [ ] **Mimics — default parameters:** Mimics need sensible **defaults** for parameters; ideally these come from the **Pact** (contract as single source of truth: define defaults there or generate from it).
- [ ] **OpenAPI/Swagger — GET vs. POST:** **GET and POST** often appear side by side; **POST** is redundant when the default body is effectively **`{}`** and adds no semantics — adjust generation/annotations so only the needed method is documented (or POST only when the body is actually used).
- [ ] **OpenAPI/Swagger — nur Lead-Dog:** Die generierte Spec gibt **mehr** her, als für den **öffentlichen Kennel-Vertrag** nötig — maßgeblich ist nur der **Lead** (erster Eintrag in `dogIds`); Pfade/Schemas aus **Nicht-Lead-Dogs** sollten die Swagger-Ausgabe nicht unnötig aufblähen (Spec auf Lead-Yield bzw. dokumentierte öffentliche Oberfläche fokussieren; siehe [`@slopdogs/swaggrid`](packages/swaggrid/src/grimoire.ts)).
- [ ] **Kennel versioning:** Same versioning model as **Serialized Dogs** for **Kennels** too (versions per save, history, load older states — analogous to dog versions).
- [ ] **Serialized Dog — rename:** A serialized dog must support **renaming** (display name / identifier as needed) without breaking references where the model allows — UI + persistence + contract updates as required.
- [ ] **History — parent / branch from past:** Version history should be modeled with an explicit **parent** (or equivalent lineage) so users can **navigate backward** in time and **start a new line** from any historical version (fork-style continuation, not only linear “latest”).
- [ ] **Tag/release workflow** (align SemVer with root version; UI `ui-app` is at `0.0.0`); optional release job building UI.
- [ ] **UI — Auto-Run after Code-Save:** After a successful save, automatically reload Waves so the result is visible immediately. Side Panel fires `saved` → Waves Viewer reacts with `loadWaves()`. Wiring exists — only the auto-trigger is missing instead of the manual click. Bonus: visual feedback in the graph showing which dog just updated.
- [ ] **UI — Keyboard Shortcuts:** `Ctrl+S` → save in Dog Editor (`saveCode()` in Side Panel), `Ctrl+Enter` → reload Waves (`loadWaves()` in Viewer), `Escape` → close Side Panel. Monaco already intercepts `Ctrl+S` — needs forwarding to the save flow. `Ctrl+Enter` via global `@HostListener` in WavesViewerComponent.
- [ ] **UI — Diff-View between Versions:** Side-by-side diff of two dog versions. Monaco has `createDiffEditor()` built in — select two versions (e.g. current + one from Timeline), diff editor opens. Red/green shows what was removed/added.

---

## Low / cleanup

- [ ] **Dependencies:** `fs` (`0.0.1-security`) — whether needed; `vm2` — briefly note risk/roadmap (see README *Dependency notes*).
- [ ] Run **`npm audit`** before releases.
- [ ] **Optional:** `CONTRIBUTING.md`, `SECURITY.md` for a public repo.
- [ ] **UI — Body-Editor as Monaco:** Replace plain textarea in Waves Viewer params panel with a small Monaco JSON editor (`automaticLayout: true`, `vs-dark`, validation). Consistent with rest of app.
- [ ] **UI — Execution-Time & Logs per Dog:** Show how long each dog took. Surface console output per dog.
- [ ] **UI — Dog-Status color coding in Graph:** Error = red, OK = green, Pending = grey.
- [ ] **UI — HTML-Preview Fullscreen:** Pop-out button for the iframe so TalkingDog layouts can be tested at full size.
- [ ] **UI — Query/Body Presets:** Save and quickly switch between different param sets ("Recipe Test", "Biography Test").
- [ ] **UI — WebSocket Live-Updates:** Stream Waves during execution instead of returning everything at the end.
- [ ] **UI — Dog search/filter in Toolbar:** Toolbar becomes cluttered with many dogs — add search/filter.
- [ ] **UI — Toast-Notifications:** Elegant toasts for Save/Error/Success instead of inline errors.

---

## Refactoring — Code Review (2026-03)

Findings from a full code review against current standards.

### Critical

- [ ] **Security — replace `vm2`:** `vm2` is deprecated with known sandbox escapes. [`SerializedDog.ts`](packages/core/src/dogs/SerializedDog.ts) executes user code with access to `fetch`/`console` — exfiltration possible. Replace with `isolated-vm` or Node.js Worker Threads.
- [ ] **Testing — from 0 % to meaningful coverage:** No unit or integration tests in the project. `angular.json` has `skipTests: true`. Set up test framework (Vitest/Jest), cover critical paths first (SeasonRunner, Store, API routes).
- [ ] **Bug — `throw Error` instead of `throw this.result`:** [`abstractHuntingDog.ts:307`](packages/core/src/core/entities/abstractHuntingDog.ts) — throws the Error constructor, not the stored error.
- [ ] **Bug — loop escape in SeasonRunner:** [`harverster.ts:155`](packages/core/src/harverster.ts) — `i = this.maxWaves` inside an `async` callback does not break the `for` loop as intended.
- [ ] **API — no authentication:** All endpoints are publicly accessible — no API key, JWT, or session protection.

### High

- [ ] **TypeScript — enable strict flags:** `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` all disabled. `"declaration": false` — package consumers get no type hints. Eliminate 40+ `as any` casts.
- [ ] **Linting & formatting:** No ESLint, Prettier, or pre-commit hooks (Husky/lint-staged). Set up for consistent code style.
- [ ] **Structured logging:** 6760+ `console.log()` calls shipping to production. Replace with a logger (`pino`, `winston`) using log levels.
- [ ] **API — HTTP status codes & validation:** All client errors return `500` instead of `4xx` ([`ConfigRouteHandler.ts`](api/routes/ConfigRouteHandler.ts)). No `req.body` validation — introduce schema validation (Zod or Joi).
- [ ] **Store — type detection:** [`PrismaStore.ts`](store/PrismaStore.ts) detects entity type by field presence instead of an explicit `type` column — brittle. ID generation via `Date.now()` has no uniqueness guarantee.
- [ ] **CI/CD — set up pipeline:** No `.github/workflows/` present. Minimum: lint → typecheck → test → build as a GitHub Action.

### Medium

- [ ] **Fix filename typo:** [`harverster.ts`](packages/core/src/harverster.ts) → `harvester.ts`.
- [ ] **Dependency injection:** Hardcoded singletons in `main.ts`. Introduce a DI container (`tsyringe`, `inversify`) for better testability.
- [ ] **Performance — O(n²) dependency lookups:** [`SerializedDog.ts`](packages/core/src/dogs/SerializedDog.ts) linearly searches `season.exhausted` per dependency. Use a Map-based lookup or cache.
- [ ] **Simplify proxy tracking:** 117 lines of nested Proxy factories in [`abstractHuntingDog.ts:179–294`](packages/core/src/core/entities/abstractHuntingDog.ts). Array mutations (`.push()`, `.splice()`) bypass tracking.
- [ ] **Abstract JSON serialization:** Manual `JSON.parse`/`JSON.stringify` scattered everywhere — introduce a central transformer/serializer layer.
- [ ] **Store — double DB hit per save:** Version calculation + subsequent fetch in [`Controller.ts`](api/Controller.ts) — merge into a single transaction.
- [ ] **Angular — feature modules & lazy loading:** All components in one folder, no module separation, no lazy loading. Type `declare const monaco: any`.
- [ ] **Variable naming:** Replace creative names like `dogsWithBeesInthePants` with domain-clear identifiers.
- [ ] **Error casting in SerializedDog:** [`SerializedDog.ts`](packages/core/src/dogs/SerializedDog.ts) returns `"Error: " + err.message` cast as type `T` — type violation. Introduce proper error handling.
- [ ] **Remove legacy `/save` route:** Duplicate functionality with `/api/nodes`. Define deprecation path or remove directly.
- [ ] **Harden CORS:** Dev mode allows all `localhost` origins. No rate limiting configured.

---

## Done

- [x] **Body `{}` / Kennel-Run (2026-03):** Leeres JSON-Objekt `{}` war bei `run`/`execute` fälschlich wie „kein Body“ behandelt (`Object.keys(body).length` bzw. `raw !== '{}'`). Behoben: Client sendet POST mit `{}`; Server nutzt bei POST den Request-Body inkl. leerem Objekt; öffentliches `POST /:kennelId` ebenso; Node-DELETE-URLs mit `encodeURIComponent`; Side-Panel zeigt Löschfehler.
- [x] **UI — Kennel-Antwort im Node-Viewer:** Button **Antwort (Server)** öffnet den **öffentlichen** Endpunkt `GET http://localhost:3000/k/:id` (Lead-Yield), z. B. `/k/default-kennel`; Query-Parameter aus dem Panel werden angehängt. (Nicht `/api/kennels/.../run`.)
- [x] **API-Routen — `/api/`-Konsistenz geklärt (P3):** Zielbild steht: **Ware** (Lead-Antwort, Docs, Spec) lebt unter `/k/:id`, `/k/:id/docs`, `/k/:id/openapi.json`; die **Steuer-API** (CRUD, Run/Execute, Versions, Export/Import) bleibt unter `/api/kennels/:id/...`. Zwei Namensräume bleiben absichtlich getrennt (Produkt-URL vs. Werkstatt) statt Zusammenlegung unter `/api/v1`; README/ARCHITECTURE aktualisiert, Quelle der Wahrheit ist `api/routes/routeTable.ts`.
- [x] **License in `package.json`:** Root and `packages/core` set to `MIT`, aligned with [LICENSE](LICENSE).
- [x] **`package.json` metadata:** `description`, `repository` (origin `MartinSchmieschek/SlopDogs`), `engines.node` (`>=18.19.0`), `main` → `main.ts`, `private` as boolean.
- [x] **`ARCHITECTURE.md`:** Section *Deployment — where the lodge meets the wild* (ports, env, DB, static UI; README vibe).
- [x] **Production:** Build pipeline (`npm run build` → `dist/`), `start` / `start:prod`, `postinstall` builds `packages/core`; README documents dev vs. production.
- [x] **Prisma seed:** `prisma.seed` → `ts-node seed.ts`; CLI entry in `seed.ts` when run as main module.
- [x] **`.gitignore`:** `store/prisma/*.db`, `dist/`; removed obsolete `/mbdhEnrichShit`.
- [x] **`npm test`:** runs `typecheck` (core + app) until unit tests exist.
- [x] **`CHANGELOG.md`:** initial [Keep a Changelog](https://keepachangelog.com/) scaffold; tags/releases still manual.
