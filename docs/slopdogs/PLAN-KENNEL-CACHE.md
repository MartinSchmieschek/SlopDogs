# Plan: Ergebnis-Cache fuer ganze Kennel-Laeufe

**Stand 2026-11-23 — Entwurf, nichts umgesetzt.** Grundlage: Code-Lesung auf `feature/server-schnitt` (`4cea224`) samt core 0.3.3 und Base-Dogs 0.3.0 aus `node_modules`. Offene Entscheidungen des 10-0 stehen unter „Entscheidungen“ (E1–E6); bis dahin gilt die jeweils markierte Empfehlung nicht als beschlossen.

Auftrag 10-0 (23.11.): „wie ermitteln wir, dass gecacht werden kann, wo setzen wir die Property, wie verhindern wir, dass ein Kennel laeuft, wenn er gecachte Daten nutzen kann, wo legen wir die Cache-Daten ab. Wenn cachebar: TTL 0 (kein Caching), TTL nach Einstellung oder TTL unendlich.“

**Achtung Zeilennummern:** Der Worktree traegt uncommittete Arbeit (Eigene Seiten, 04.11.: 34 geaenderte, 15 neue Dateien, darunter `KennelRunHandler.ts`, `KennelController.ts`, `PrismaStore.ts`, beide `schema*.prisma`, `mcp/tools/kennels.ts`). Alle Fundstellen hier gelten fuer diesen Arbeitsstand, nicht fuer `4cea224`. Der Cache-Umbau beruehrt dieselben Dateien — erst nach Commit der Eigenen Seiten beginnen.

Nebenbefund, separat erledigt: Sun-Dog-Cache in `slopdogs-base-dogs` (Branch `feature/sun-cache`, uncommittet, Tests 8/8).

---

## 1. Ausgangslage (gemessen am Code)

- **Kein Ergebnis-Cache.** Jeder Aufruf laeuft durch `KennelRunHandler.runKennel` (`api/routes/KennelRunHandler.ts:180-276`), die einzige Stelle mit `new KennelRun`. Gecacht wird nur, was Base-Dogs mit `setCacheHandler` nach aussen holen (`KennelRun.js:186`); `SerializedDog` und `MimicDog` haben keinen Cache-Zugang.
- **Einstiege:** `GET|POST /k/:id` (815-872), `GET|POST /api/kennels/:id/run|execute` (612-691), `/k/:id/openapi.json` (`KennelSwaggerHandler.ts:46-89`), MCP `run_kennel`, `execute_kennel`, `refresh_kennel_snapshot`, `build_kennel`-Erstlauf, Landing `/` und `/kennels` (`runLeadAsAnonymous`, 147-167). Landing und Kennel-Liste haben schon ein Ergebnis-Memo (`LandingPage.ts:259-278`, `KennelListPage.ts:181-220`) — Vorbild.
- **Dog-Versionen stehen vor dem Lauf fest:** die Factory wird genau einmal in `fillKennel` gerufen (`KennelRun.js:129`) und nimmt je Lineage die neueste Fassung (`KennelRunHandler.ts:453-489`). `KennelListPage.fingerprint()` (196-220) baut daraus schon heute `kennelHeadId|lineage:versionId,…` — wiederverwendbar.
- **Kennel-Version reicht als Schluessel nicht:** Dogs haengen per Lineage, ein Dog-Save aendert den Lauf ohne neue Kennel-Version; `heal()` schreibt `dogIds` ohne neue Version (`KennelController.ts:436-478`).
- **Query und Body erreichen Dogs nur ueber `QueryRetriever`/`BodyRetriever`.** `mergeQueryParams` (127-139) reicht alle `req.query`-Parameter durch und schreibt Schluessel und Werte klein.
- **Unbekannte Kennel-Felder ueberleben nicht:** feste Feldlisten in MCP-Schemas (`additionalProperties:false`), `KennelController` (create/save/heal/`hasContentChanged`) und `PrismaStore`; kein JSON-Sammelfeld.
- **`PrismaCacheHandler.set` kann kein Unendlich:** `BigInt(Date.now() + ttlMs)` wirft bei `Infinity` einen RangeError (`services/PrismaCacheHandler.ts:143`).
- **Nach Deserialisierung fehlen zwei WeakMap-Anhaenge:** `LeadOutcome` faellt auf `fromWaves` zurueck (ein `empty`-Lead sieht wie `not_run` aus), `KeyRunState.forResult` liefert `EMPTY_RUN`. Der Cache muss Lead-Status und das bereits gescrubbte Ergebnis selbst tragen.
- **Admission liegt vor dem Handler:** `HeavyRequestLimiter` ist Middleware (`createHttpApplication.ts:313-317`), ein Treffer im Handler belegt trotzdem einen Slot.

## 2. Wie ermitteln wir, ob ein Kennel cachebar ist

Zwei Stufen: **statisch beim Speichern** (bestimmt, welche TTL ueberhaupt angeboten wird) und **zur Laufzeit vor dem Ablegen** (letztes Tor — was der Lauf wirklich benutzt hat).

### 2.1 Klassen

| Klasse | Bedeutung | Erlaubte TTL | Ablage |
|---|---|---|---|
| `rein` | Ergebnis haengt nur an Code-Versionen, Query und Body | 0, N, unendlich | geteilt |
| `fluechtig` | holt Daten von aussen (`fetch`, Base-Dogs mit Upstream) oder liest die Uhr | 0, N | geteilt |
| `persoenlich` | liest `jsonStore` oder `keys.fetch`, Ergebnis je Nutzer verschieden | 0, N | je Nutzer |
| `live` | Lobby (`WebSocketChannelRetriever`, `ChannelLiveSnippetRetriever`), Zufall | nur 0 | — |

Die strengste Klasse eines Dogs im gefuellten Kennel bestimmt die Klasse des Kennels.

### 2.2 Statisch (beim `create/update/build_kennel`, Ergebnis im Save-Antwort und in `get_kennel`)

- **Eigene Dogs:** Analyse des `tsCode` ueber den TypeScript-Syntaxbaum (keine Regex): `fetch(` → fluechtig; `Date`/`Date.now` → fluechtig; `Math.random`, `crypto.randomUUID` → live; `jsonStore.*`, `keys.*` → persoenlich. Ergebnis je Dog-Version merken (aendert sich nur mit neuer Version).
- **Base-Dogs:** neues statisches Feld je Klasse in `slopdogs-base-dogs`, z. B. `static cacheClass = 'rein' | 'fluechtig' | 'persoenlich' | 'live'`. Fehlt es, gilt `fluechtig` (endliche TTL, nie unendlich). Bekannt: Zufall in demo (RandomEverthing, RandomRecipes), humor (DadJoke), knowledge (Quote), religion (Quran), talking (FragmentBase) → `live`; Lobby-Dogs in core → `live`.
- **Mimics:** wie eigene Dogs; ist der Pact unerfuellt und wuerde adoptiert, zaehlt der Adoptionskandidat (gleiche Logik wie `createMimicAdopter`).
- **Ergebnis mit Gruenden:** z. B. `{ klasse: 'fluechtig', gruende: ['WeatherRetriever: Upstream', 'dog 3f2…: fetch Zeile 12'] }`.

### 2.3 Zur Laufzeit (vor dem Ablegen, nicht vor dem Lauf)

- `jsonStore`- und `keys`-Buendel in einer Huelle, die Benutzung in `runState` vermerkt (die Fabrik laeuft fuer jeden Dog, deshalb die Methoden umhuellen, nicht die Fabrik).
- Abgelegt wird nur, wenn: Lead-Ausgang `ok` oder `empty`; kein `memoryPressure`, kein Timeout; keine neuen Mimics gespeichert oder geheilt (`persistNewMimics`); die Laufzeit-Benutzung passt zur statischen Klasse. Passt sie nicht (statische Analyse hat etwas uebersehen): nicht ablegen, Klasse fuer diese Fassung herabstufen, im naechsten `get_kennel` melden.
- Plain `fetch` laeuft im Worker und ist vom Host nicht beobachtbar — deshalb haengt `fluechtig` an der statischen Analyse, und `fetch` schliesst unendlich immer aus.

## 3. Wo setzen wir die Property

- **Feld am Kennel**, vom Besitzer gesetzt: `resultCacheTtl: 0 | <Sekunden> | "unendlich"`, Standard 0.
- **Pfad durch den Code** (jede Stelle hat feste Feldlisten): Prisma-Spalte in `store/prisma/schema.prisma` und `schema.postgres.prisma` samt Migration → `PrismaStore` save/load/format* → `KennelController` Interfaces, create/save/heal und `hasContentChanged` (Aenderung erzeugt neue Version, damit neuer Schluessel) → MCP-Schemas `create_kennel`/`update_kennel`/`build_kennel` → REST `PUT /api/kennels/:id` (keine Schema-Pruefung dort, nur ACL-Felder werden entfernt) → `get_kennel`-Projektion → Bundle-Export/-Import (`KennelBundleHandler.ts` export ~175, import ~396-399) → UI mit eigener Typ-Kopie (`ui-app/src/app/models/kennel-config.model.ts`, `utils/kennel-settings.ts`).
- **core-Typ:** `IKennelConfig` in core kennt das Feld nicht. Entweder core-Release mit dem Feld, oder serverseitig ueber das vorhandene `(config as any)`-Muster wie bei `lineageId`/`ownerId`. Empfehlung: core-Release, weil der Kennel-Vertrag dort steht.
- **Nur der Besitzer** setzt die TTL — Muster wie die Visibility-Sperre (`canManageAcl` in `ConfigRouteHandler.ts`, `visibilityChangeRefused` in `mcp/tools/kennels.ts`).
- **Pruefung beim Speichern:** angefragte TTL gegen die Klasse aus 2.2. Unerlaubt → Ablehnung mit Grund („unendlich nicht moeglich: WeatherRetriever holt Live-Daten; erlaubt 0 oder N Sekunden“). `get_kennel` und `build_kennel` zeigen `{ ttl, klasse, gruende, erlaubt }`.
- **Obergrenze N** per Env (`KENNEL_RESULT_CACHE_MAX_TTL_SEC`), siehe E5.

## 4. Wie verhindern wir den Lauf

Reihenfolge im Handler (`handlePublicGet/Post`, `handleExecute`, Landing):

1. Config laden, Zugriff pruefen (`accessOf`), `trustIfTrustedKennel` — unveraendert.
2. `resultCacheTtl` 0 → wie heute.
3. **Fingerabdruck:** Kennel-Version + `lineage:versionId` aller Dogs nach derselben Aufloesung wie die Factory (inkl. `mayRun`) + Base-Dog-Paketversionen (`dogVersionsOf`). Je Prozess kurz memoisiert, verworfen ueber `DogReferenceIndex.onChange`.
4. **Schluessel:** `kres:v1:<lineage>:<sha256(fingerabdruck)>:<scope>:<sha256(query)>:<sha256(body)>`. `scope` = `shared` oder `user:<id>` (persoenlich, private Kennels). Query und Body nur, wenn `QueryRetriever`/`BodyRetriever` im Kennel; Query sortiert und normalisiert wie `mergeQueryParams`.
5. **Treffer:** Ergebnis ausliefern ueber denselben Weg wie `sendLeadOutcome`/`sendResult` (Content-Type-Erkennung, Lobby-Form JSON vs. HTML, `SecurityHeaders.markKennelOutput`) — aus dem abgelegten Lead-Ergebnis, ohne `KennelRun`, ohne Worker.
6. **Fehlschlag:** wie `getOrFetch` — gleichzeitige Anfragen auf denselben Schluessel warten auf einen Lauf; danach Tore aus 2.3, dann ablegen.

**Welche Einstiege nutzen ihn:** `/k/` GET/POST, `/api/…/execute`, Landing und Kennel-Liste (ersetzt deren eigenes Memo spaeter). **Nicht:** `/api/…/run`, MCP `run_kennel`, `refresh_kennel_snapshot`, `build_kennel` — die wollen den echten Lauf mit Waves. `execute_kennel` siehe E4.

**Verworfene Alternative — Treffer innerhalb von `runKennel`:** wuerde alle Einstiege auf einmal erreichen, aber `/run`, `run_kennel` und Snapshots brauchen echte Waves, die der Cache nicht haelt; die MCP-Admission laege ohnehin davor. Deshalb Treffer vor `runKennel`, nur in den Wegen, die das Lead-Ergebnis ausliefern.

**Auffrischen durch den Besitzer:** `Cache-Control: no-cache` in der Anfrage des Besitzers (oder MCP-Parameter) erzwingt einen Lauf und ersetzt den Eintrag.

**Admission (spaeter):** Treffer belegen heute einen `HeavyRequestLimiter`-Slot. Eine Vorab-Pruefung vor dem Limiter fuer `/k/` lohnt erst, wenn Messungen Engpaesse zeigen (Phase 4).

## 5. Wo liegen die Cache-Daten

- **Abgelegt wird nur das Lead-Ergebnis**, nicht die Waves (5–20 MB je reichem Lauf laut `run_kennel`-Beschreibung): `{ leadStatus, leadResult (gescrubbt), contentKind, fingerabdruck, erzeugt, groesse }`. Groessengrenze je Eintrag (Vorschlag 2 MB, Env), darueber nicht ablegen.
- **Unendlich** heisst: gueltig bis sich der Fingerabdruck aendert. Physisch gleitender Ablauf (Vorschlag: 30 Tage ohne Treffer → weg), damit verwaiste Eintraege alter Fassungen nicht ewig liegen. Kein `Infinity` an `PrismaCacheHandler.set`.
- **Ort** siehe E1.
- **Eintraege je Kennel begrenzen** (Vorschlag 500, aelteste zuerst raus): bei Kennels mit `QueryRetriever` erzeugt jeder neue Query-Wert einen Eintrag, auch Cache-Brecher wie `?x=123`.

## 6. Was sonst noch dranhaengt

- **Statistik:** `callCounter.record` laeuft heute im `finally` des Laufs; ein Treffer muss ihn selbst rufen, mit Lead-Status aus dem Eintrag. `KennelCallDaily` braucht eine Spalte `cached` (Dog-Ebene hat sie schon). Dog-Zeilen bei Treffern nicht zaehlen.
- **Antwort-Header:** `X-SlopDogs-Cache: hit|miss|bypass`, `Age`. `Cache-Control: public, max-age=<rest>` nur fuer oeffentliche Kennels mit Ablage `shared`; sonst `private, no-cache`.
- **Mehrere Instanzen:** Korrektheit haengt nicht am Prozess-Memo, weil der Schluessel die Versionen aus der DB traegt; das Memo verkuerzt nur die Aufloesung. Bei mehreren Instanzen Memo-Dauer kurz halten (Sekunden).
- **Dog-ACL-Aenderungen:** `mayRun` liest die ACL des Lineage-Kopfs; ob jede ACL-Aenderung eine neue Dog-Version erzeugt, ist ungeprueft. Wenn nicht, gehoert die ACL in den Fingerabdruck.
- **Sicherheit:** `persoenlich` und private Kennels nie `shared`. Treffer nach Zugriffspruefung, nie davor. Gescrubbte Werte ablegen, nie Rohwerte.
- **Hinweis an Bauende:** `build_kennel` meldet die Klasse und ab Phase 4, wenn die Statistik zeigt, dass ein Kennel oft dasselbe liefert.

## 7. Phasen

| Phase | Inhalt | Abnahme |
|---|---|---|
| P0 Messen | Groesse der Lead-Ergebnisse je Kennel (DB-Kopie, lokaler Lauf); Aufrufe je Kennel aus `KennelCallDaily`; wie viele Kennels waeren `rein`/`fluechtig` | Zahlen in diesem Plan |
| P1 Klassifizierer | statische Analyse eigener Dogs, `cacheClass` in Base-Dogs (Release), Ausgabe in `get_kennel`/`build_kennel` — noch kein Cache | alle Seed-Kennels klassifiziert, Stichproben von Hand geprueft |
| P2 Property | Spalte, Store, Controller, MCP, REST, Pruefung beim Speichern | Setzen/Lesen/Ablehnen per MCP getestet, Version entsteht |
| P3 Cache | Fingerabdruck, Schluessel, Ablage, Treffer-Weg, Laufzeit-Tore, Statistik, Header | Treffer ohne Worker gemessen, Dog-Save invalidiert, persoenlich getrennt |
| P4 Ausbau | Admission vor Limiter, UI, Hinweis aus Statistik, Landing-Memo abloesen | nach Messung |

## Entscheidungen (offen, 10-0)

| # | Frage | Empfehlung |
|---|---|---|
| E1 | Ablage: vorhandene `CacheEntry`-Tabelle mit Praefix `kres:` oder eigene Tabelle `KennelResultCache(lineageId, key, value, expiresAt, lastHitAt, sizeBytes)` | eigene Tabelle — Loeschen je Kennel per Index, Groessen- und Treffer-Zaehlung, unendlich ohne Sentinel im fremden Handler |
| E2 | Bedeutung von unendlich | bis Fingerabdruck sich aendert, physisch 30 Tage gleitend ohne Treffer |
| E3 | `persoenlich` ueberhaupt cachen (je Nutzer) | ja, aber nur endliche TTL |
| E4 | `execute_kennel` (MCP) mit Cache | ja, mit Parameter zum Umgehen |
| E5 | Obergrenze fuer N | 7 Tage per Env, unendlich davon ausgenommen |
| E6 | Speicherform der Property | MCP/REST `resultCacheTtl: 0 \| Sekunden \| "unendlich"`, in der DB eine Int-Spalte plus Boolean `unendlich` (kein Sentinel-Wert) |
