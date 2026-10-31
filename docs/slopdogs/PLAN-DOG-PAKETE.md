# Plan: Standards, core und Base-Dogs als eigene Repos und Pakete, UI-Anpassungen, lokaler Modus

Stand 2026-10-31 (Fassungen 2026-10-05, 2026-10-09). Auftraege 10-0: „das Bauen und Bekommen der Base-Dogs aus dem Projekt rausnehmen und einzeln machen, damit die nur importiert werden" (05.10.), „wie wir dieses Projekt aufraeumen koennen, damit es den Standards entspricht — verbinde das mit dem Plan fuer das Auslagern der Base-Dogs und des core" (09.10.), dazu am 31.10.: Bau ueber Git, StartupTests auf ein Minimum, zwei UI-Aenderungen, ein auth-freier lokaler Modus, Base-Dogs in Unterordnern statt eigener Repos, runtime in core.

Grundlage: Boreal-Bestand 31.10. auf main `8a746db` (Gegenprobe: alle alten Zahlen auf `ee68ce8` reproduziert), Amar-Spuren 31.10. zu Git-Bau, UI und lokalem Modus. Lesart wie in `PLAN.md`: **gezaehlt** = grep/Skript/Syntaxbaum im Repo, **gemessen** = Lauf, **ungemessen** = offen. Zeilenangaben gelten fuer `8a746db`.

## Warum alles ein Plan ist

Was vor dem Schnitt nicht einheitlich ist, muss danach in jedem Repo einzeln nachgezogen werden. Pruefregeln, Formatierung, tsconfig-Basis und Paket-Hygiene kommen deshalb **im Monorepo** und **vor** dem Schnitt. Was core nach aussen zeigt, wird mit dem Schnitt zum Vertrag aller Dog-Pakete — Luecken darin werden vorher geschlossen. UI-Spur und lokaler Modus haengen nicht am Schnitt, sie laufen nach P0 parallel.

## Vorbedingung

**Erfuellt.** Der OOM-Fix ist seit 2026-10-09 in main: PR #17 (`f2c87e8`) und PR #18 (`8a746db`), 25 Dateien, +2383/−164. Die alte Konfliktkarte entfaellt. Der Worktree `SlopDogs-oom` haelt nur aeltere Entwuerfe davon.

## Entscheidungen des 10-0

| # | Frage | Entscheidung |
|---|---|---|
| E1 | Schnitt | **Revidiert 31.10.: drei Repos.** `MartinSchmieschek/SlopDogs` (Server), `MartinSchmieschek/slopdogs-core` (core samt runtime, ein Paket im Repo-Wurzelverzeichnis), `MartinSchmieschek/slopdogs-base-dogs` (alle Dog-Pakete inkl. `geo-pact` und `dogs-demo` in Unterordnern, jedes mit eigenem Build, eigener Version, eigenem Release). Ersetzt E1 vom 05.10. („jedes Paket ein Repo", 54 Repos). |
| E2 | Versionen | Feste Versionsnummern statt `latest`. |
| E3 | Registry | **GitHub Packages.** Render bezieht ueber die Registry. |
| E4 | Updates | Gepinnt, ein Bot oeffnet je Release einen PR und merged ihn automatisch, wenn die Pruefung gruen ist. |
| E5 | Scope | `@martinschmieschek/*`, keine Organisation. Paketname = `@martinschmieschek/slopdogs-<heutiger Name>` (z. B. `slopdogs-core`, `slopdogs-dogs-weather`). |
| E6 | Bau ueber Git (31.10.) | **Beide Wege:** jedes Paket in GitHub Packages **und** per Git installier- und baubar. Ein Tag-Workflow erledigt beides in einem Lauf. |
| E7 | StartupTests (31.10.) | **Auf ein Minimum begrenzen** (P0.1). Ersetzt O2. |
| E8 | Branch `fix/client-ip-fair-queue` (31.10.) | **Bleibt liegen, nicht Teil des Plans.** |
| E9 | UI (31.10.) | Favoriten je Nutzer; Klick auf einen Eintrag der Kennel-Liste oeffnet immer `/k/<ref>`, Bearbeiten nur ueber das Menue des Eintrags (Spur U). |
| E10 | Lokaler Modus (31.10.) | **Auth-frei auf einem Pi im Heimnetz, wie eine Hue-Steuerung; jeder im lokalen Netz darf ihn nutzen.** Kein Dev-Modus (Spur L). |

Daraus folgt zwingend:

- **F1 — Genau eine Instanz** von core, `geo-pact` und `dogs-demo`. Sie sind in abhaengigen Paketen `peerDependencies`. Gruende: `instanceof Dog` (`SerializedDog.ts:1019-1021`) und Parent-Matching ueber Klassen-Identitaet (`abstractHuntingDog.ts:118-124`); `dogs-demo` und `geo-pact` sind selbst Parents (`TalkingDog.ts:11`, `GeoNamesRetriever.ts:36`). core haelt Singletons (`DogWorkerGate.ts:281`, Capability-Registry `SerializedDog.ts:81/89`) — eine zweite Kopie verdoppelt still den Slot-Deckel, und `jsonStore`/`keys` fehlen ihr.
- **F2 — Ohne CI kein Auto-Merge.** Es gibt kein `.github/` (gezaehlt; `BACKLOG.md:69`).
- **F3 — Ohne Pruefung mit Exit-Code keine CI.** StartupTest laeuft nur im gestarteten Server, nach dem Referenzindex-Rebuild (`main.ts:273`), faengt Fehler ab (`createHttpApplication.ts:315-319`) und liefert keinen Exit-Code. `npm test` (gemessen 41,6 s, Exit 0) prueft Typen, Seed-Abdeckung und Doku-Pfade, keinen der 156 StartupTests.
- **F4 — npm installiert nicht aus einem Unterordner eines Git-Repos.** Fuer `slopdogs-base-dogs` heisst „ueber Git" deshalb: der Tag-Workflow baut auf GitHub und haengt den fertigen Tarball an den Release; installiert wird die Tarball-URL. `slopdogs-core` liegt im Repo-Wurzelverzeichnis und laesst sich direkt vom Tag installieren, `prepare` baut.

## Bestand 31.10. (Boreal, gezaehlt wenn nicht anders vermerkt)

| Bereich | Befund |
|---|---|
| CI | kein `.github/` |
| Lint/Format | kein ESLint, kein Prettier; `.editorconfig` nur in `ui-app/`; 15 `eslint-disable`-Kommentare ohne Linter |
| Tests | `StartupTest.ts` 8832 Zeilen, 156 Tests, ohne Exit-Code; seit 85a1be2 **dynamisch** geladen (`createHttpApplication.ts:313`), Produktion laedt die Suite nicht mehr; Speicherersparnis ungemessen |
| Typecheck | `typecheck:dogs` deckt 17 von 51 Dog-Paketen (`package.json:95`); der Server-Typecheck erreicht 458 von 467 Paket-Quelldateien — 9 unerreichte = Kandidaten fuer toten Code |
| tsconfig | 54 Paket-tsconfigs: 53 identisch ohne Basis, `dogs-talking` weicht ab (`lib dom`); `composite` in 0; Root `target es2016` (`tsconfig.json:14`) bei `engines node>=18.19` |
| Build | 51 handgeschriebene `build:dogs-*` (`package.json:21-71`) als serielle Kette (`:72-73`); Render baut alle Pakete zweimal (`postinstall` + `build:prod`, `package.json:93`) per `npm install`, nicht `npm ci`; 458 JS-Dateien unter `dist/packages` sind tote Ausgabe (Amar) |
| Paket-Selbststaendigkeit | `prepare` scheitert in 48 von 52 Paketen, wenn jedes allein gebaut wird — `@types/node` kam still aus dem Root; mit `@types/node` als devDependency 52 von 52 gruen (gemessen, Amar 31.10., Kopien im Scratchpad). core hat kein `build`-Skript und kein `files` (`packages/core/package.json:26-28`) |
| `any` | 1455 in 209 Dateien: Server 591, StartupTest 414, Dog-Pakete 252, core 109, ui-app 37, scripts 48, seed-data 4; in exportierten core-Typen 33, davon 15 echte Luecken |
| Abhaengigkeiten | im Root ungenutzt (0 Importe): `vm2`, `nodemon`, `pg`, `swagger-ui-express` + `@types` (`package.json:165-180`), npm-Platzhalter `fs`, `node-hue-api` (gehoert nur nach `dogs-hue`); core deklariert `typescript` und `vm2`, importiert sie nicht (`packages/core/package.json:33-35`); `sucrase` benutzt (`scripts/build-landing.cjs:11`), im Root nicht deklariert; `workspaces` und `file:`-Abhaengigkeiten doppelt (Amar) |
| Datenbank | 4 PrismaClients mit je eigenem Pool, 8 Schemas |
| Muell | `.tmp-check.json`, `.tmp-mimic.json` getrackt |
| Node auf Render | steht nirgends im Repo (kein `.nvmrc`, kein `render.yaml`) — ungemessen |
| Env-Katalog | `ENV_CATALOG` (`server-app/startupEnvCheck.ts:80ff`, 105 Eintraege): es fehlen 7 — 3× `WATCHPOST*`, 3× `MEMORY_LOG_*`, `SLOPDOGS_MEMLOG`; in beiden `.env`-Beispielen fehlen 4 (`MEMORY_LOG_*`, `SLOPDOGS_MEMLOG`). Der Katalog-Test prueft nur Katalog → Beispiele (`StartupTest.ts:6953`), deshalb faellt die Luecke nicht auf |

**core-Oberflaeche:** 109 Exporte (66 Werte, 43 Typen). Dog-Pakete nutzen 22, nur der Server 54 (davon 10 nur StartupTest), niemand ausserhalb core 33 (die „29" der Fassung vom 09.10. war nicht reproduzierbar; tragend ist die geschlossene Aufteilung 22 + 54 + 33). Keine Tiefenpfad-Importe; der Subpfad-Export `./kennelImportTarget` hat keinen Nutzer (`packages/core/package.json:12`). Was die Dogs brauchen: 14 Dateien, 1218 von 5372 Zeilen, ohne Node-Builtins. Von den Plattform-Dogs importiert ein Dog-Paket nur `FetchBaseDog` (dogs-warframe); `QueryRetriever` haengt nur am Server (0 Importe in Dog-Paketen). Der OOM-Fix hat in core nur Laufzeit-Dateien geaendert (`DogWorkerGate.ts`, `SerializedDog.ts`, `index.ts`), keine der 14 Vertragsdateien.

**Speicher:** Die Auslagerung bringt keinen (Base-Dogs im slim-Satz rund 2,7 MB Heap ueber core hinaus, gemessen 05.10., Node 22.16). Sie bringt Bauzeit, getrennte Releases und einen pruefbaren Vertrag.

## Die Kopplungen, die vor dem Schnitt geloest sein muessen

1. **Typen kommen aus dem Quelltext.** `CompilerCache.computeForBuild` (`services/CompilerCache.ts:667-721`) uebergeht jede `.d.ts` (`:675`). 101 Pacts haengen an `fromSourceType` (98 in 49 Dog-Paketen, 3 in geo-pact). Ein Paket mit `files:["dist"]` liefert 0 von 101 Pact-Typen und 148 von 295 Klassen-Typen, der Boot bricht in `main.ts:221` (Amar, gezaehlt). `src` mitzuliefern hilft nicht von selbst → P2.1 ist Pflicht.
2. **Ein Dog ist nur ein Name, ohne Version.** `base:<Klasse>` in DB-Kennels, `imitates` in MimicDogs, Parents von SerializedDogs (`SerializedDog.ts:1047-1058`), Stats (`services/dogStatsKey.ts:16`). Fehlt ein Name, bricht der Boot-Waechter (`server-app/slimRegistryKennelCoverage.ts:71-74`, Aufruf `main.ts:225`).
3. **Paketerkennung am Pfad.** `BaseDogPacks` erkennt Pakete an `/packages/<name>/` (`services/BaseDogPacks.ts:11`); unter `node_modules` wird `pack` fuer alle Dogs `null` → P2.5 ist Pflicht.
4. **Genau eine Instanz** (F1).

Nebenkopplungen: Dog-Env-Variablen stehen handgepflegt im Server (`server-app/startupEnvCheck.ts:457-532`, 19 Eintraege); dev loest alle Pakete per `tsconfig.json`-paths auf `src` auf (`tsconfig.json:31-86`).

## Phasen

Jede Phase endet mit einem lauffaehigen Server, gemessen, nicht behauptet. P0 bis P2 laufen im Monorepo und taugen auch dann, wenn der Schnitt spaeter verschoben wird.

### P0 — Sicherheitsnetz

1. **StartupTest auf ein Minimum, als eigener Lauf mit Exit-Code** (E7, F3).
   - **Minimum-Satz, 6 Tests, 309 Zeilen** — erkennt einen kaputten Boot, einen kaputten Kennel-Lauf und eine kaputte Zugriffspruefung; kein `listen`, kein Kindprozess, kein externes Netz (Boreal 7.1): `testBaseDogsAvailability` (`StartupTest.ts:1293`), `testRouteTableMatchesExpressStack` (`:2860`), `testRunnerSeesOutputNotCode` (`:4714`), `testLeadFailureIsNot200` (`:2317`), `testPrivateKennelHiddenFromAnon` (`:4583`), `testRightsMatrix` (`:4405`). Der Boot-Waechter (`main.ts:225`) laeuft im Runner-Boot mit; kein eigener Test noetig.
   - **Runner** `npm run test:startup`: zieht den Server ohne `listen` hoch (SQLite `file:./dev.db`), wartet auf den Referenzindex, laesst den Satz laufen, ruft `cleanupTestData` (`:447`) und endet bei Fehlern mit 1.
   - **Der Rest geht:** 11 B-Tests, die nur core-Mechanik pruefen (`testCreatePact`, `testMimicDogImitatesPact`, `testMatchesParentRecognizesMimic`, 5× `testFillKennel*`, `testRunSeasonWithMimicConsumerRuns`, `testLobbyFollowsInvitation`, `testAutoCreatedBodyRetrieverCarriesBody`) werden in P4 Paket-Tests in `slopdogs-core`; `testTalkingDogAllDependenciesResolved` und die Dog-Anteile von `testBaseDogsAvailability`/`testPactFromSourceType` werden Paket-Tests in `slopdogs-base-dogs`. Alle uebrigen werden geloescht — zuerst die zwei, die Live-Daten aendern: `testLandingSeedIdempotent` (`:7893`, baut den echten Landing-Kennel neu) und `testTileFeatureCache` (`:8595`, schreibt in die live `cache.db`). Damit entfallen auch die zwei bekannt roten (P6 U7, P4c T10) und die 6 Tests, die einen lauschenden Server brauchen.
   - **Folge fuer core:** 10 Exporte importiert heute nur StartupTest (Boreal 5); nach dem Abbau haben sie keinen Nutzer mehr und fallen in P2.2.
2. **Server-CI** `.github/workflows/ci.yml` **(parallel)**: `npm ci`, `npm test`, `npm run test:startup`. Node-Version aus einer neuen `.nvmrc`, die dieselbe Version wie Render festlegt (vorher im Render-Dashboard ablesen).
3. **Typecheck aller 51 Dog-Pakete** statt 17 (`package.json:95`); die 9 unerreichten Paketdateien pruefen: toter Code raus, sonst in den Typecheck.
4. **Einmal bauen statt zweimal** (`scripts/postinstall-run.cjs:5`, `scripts/run-build.cjs:8`), Render auf `npm ci`; tote Ausgabe unter `dist/packages` raeumen.
5. **Muell und Abhaengigkeiten (parallel):** `.tmp-*.json` raus und in `.gitignore`; ungenutzte Root-Deps und core-Deps (`typescript`, `vm2`) entfernen; `sucrase` im Root deklarieren; jedes Paket bekommt `@types/node` als devDependency (Abnahme: 52 von 52 bauen allein).

**Abnahme P0:** CI gruen auf einem Test-PR; `test:startup` endet bei einem absichtlich gebrochenen Test mit 1; Render-Build-Log zeigt die Paket-Kette einmal (Bauzeit vorher/nachher aus dem Log); Produktions-RSS nach Boot vorher/nachher (Werkzeug liegt in main: `health_check` mit `maxRssMb`, cgroup, VmHWM; Boot-Phasen-Zeilen `main.ts:90/203/262/292`).

### P1 — Standards im Monorepo

1. **tsconfig-Basis (parallel):** `tsconfig.base.json` mit `strict`, gemeinsamem `target` (Vorschlag ES2022, passend zur Node-Version aus P0.2), `declaration`, `composite`; alle 54 Paket-tsconfigs erben davon (Abweichung `dogs-talking` begruenden oder entfernen).
2. **`tsc -b` mit `references`** statt der 51 `build:dogs-*`-Skripte (`package.json:72-73`).
3. **ESLint (flat config, typescript-eslint) und Prettier**, Regeln zuerst mit einer Ausgangsliste, die den Bestand duldet und nur neue Verstoesse meldet. Danach **ein** reiner Formatierungs-Commit, eingetragen in `.git-blame-ignore-revs`. Lint und Format laufen in der CI mit. Der Formatierungs-Commit faellt nicht in laufende Arbeit an Spur U oder L.
4. **Ein PrismaClient statt vier** fuer den Single-DB-Betrieb, die Mehr-DB-Konfiguration bleibt als Option. Speicher vorher/nachher messen.
5. **Env-Katalog nachziehen:** die 7 fehlenden Eintraege in `ENV_CATALOG`, die 4 fehlenden in beide `.env`-Beispiele; der Katalog-Test prueft kuenftig auch Code → Katalog.

**Abnahme P1:** CI gruen mit Lint/Format; `tsc -b` baut alle Pakete; `test:startup` gruen; lokaler Start aus `dist` mit `NODE_ENV=integration`.

**Stand 31.10. — P1 umgesetzt** (`4edb501`..`7a61d2d` auf `feature/dog-pakete`, nicht gepusht). Gemessen: `npm test` 0 inkl. lint und format:check, `test:startup` 22/22, `build:prod` und `build:local` 0, `start:local` 27/27 im Abnahmeskript; Paketbau aus leeren `dist` 93,7 s -> 7,8 s; RSS nach Boot (`start:local`, je 3-4 Laeufe) vier SQLite-Dateien 178-179 MB -> 169-173 MB, eine Datei 158-165 MB. Abweichungen:
- **Start aus `dist` mit `NODE_ENV=integration` nicht gemessen:** integration verlangt Postgres (`scripts/dbEnv.cjs`, schon vor P1 so), ein lokales Postgres mit Zugangsdaten fehlt. Der Single-DB-Pfad gegen Postgres ist nur per Regelprobe belegt; die erste echte Messung ist der naechste Render-Deploy (Boot-Zeile `[db] ein Prisma-Client ...`).
- **Pool:** im Single-DB-Fall ein Pool statt vier. Ohne `DB_CONNECTION_LIMIT` bekommt er 4 je Teil auf derselben URL, also 16 wie vorher die vier Pools zusammen; die Render-Env muss sich nicht aendern. Neu ist, dass Geo-Laeufe, Auth und Store aus demselben Topf schoepfen.
- Mehr-Datei-SQLite (dev, Pi) bekommt beim naechsten Sync 12 leere Zusatztabellen in der Store-Datei.
- `ui-app` ist aus ESLint/Prettier ausgenommen (eigene Angular-Toolchain, spaeter angular-eslint). ESLint duldet 1172 Treffer per Bulk-Suppression, 1061 davon `no-explicit-any`.

### P2 — Kopplungen loesen und core-Vertrag schaerfen

1. **Typen je Paket (Pflicht, Kopplung 1).** Werkzeug `@martinschmieschek/slopdogs-typedefs` (CLI, devDependency der Dog-Pakete) erzeugt beim Paket-Build `dist/type-defs.json` mit den Pact- und Klassen-Typen **dieses** Pakets — dieselbe Logik wie `computeForBuild`, auf das Paket begrenzt. Der Server-Build mischt die `type-defs.json` aller installierten Pakete plus die eigenen Server-Typen. Das Werkzeug liegt im core-Repo und wird mit core veroeffentlicht.
   **Abnahme:** gemischte Datei enthaelt dieselben 101 Pact-Typen und 295 Klassen-Typen wie heute (Schluessel und Inhalt gegen den heutigen `dist/type-defs.json`).
2. **core-Oberflaeche schaerfen:** die 33 Exporte ohne Nutzer, die 10 nach P0.1 verwaisten und den Subpfad-Export `./kennelImportTarget` entfernen; die 15 echten `any`-Luecken in exportierten core-Typen schliessen.
3. **Vertrag und Laufzeit in einem Paket, zwei Einstiege** (O1 revidiert, siehe unten): `@martinschmieschek/slopdogs-core` = Vertrag (`Dog`, `createPact`, Typen und Interfaces, `FetchBaseDog`, Cache-/Geo-Helfer — die 22 von Dog-Paketen genutzten Exporte samt ihrer 14 Dateien); `@martinschmieschek/slopdogs-core/runtime` = Laufzeit (`SerializedDog` mit Sandbox, `DogWorkerGate` mit Speicher-Waechter, `MimicDog`, `QueryRetriever`, `BodyRetriever`, `WebSocketChannelRetriever` + `ChannelLiveSnippetRetriever` + `IChannelHub`, `KennelRun`, `kennelPaths`, `kennelImportTarget`, Capability-Registry `jsonStore`/`keys`). Dog-Pakete importieren nur den Haupteinstieg, nur der Server nutzt `/runtime`. Pruefbar per Typecheck und gleicher Node-Liste.
4. **peerDependencies** fuer core, geo-pact, dogs-demo (F1); `PLAN.md:10` und `README.md:704` anpassen.
5. **Versionsspur (Pflicht, Kopplung 3).** Jeder Base-Dog kennt seine Paket-Version; sichtbar in `GET /api/nodes`, MCP `list_nodes`/`get_node` und im Lauf-Ergebnis/Snapshot (`dogVersions`). `BaseDogPacks` liest den Paketnamen aus der naechsten `package.json`, nicht aus dem Pfad.
6. **Vertragsoberflaeche je Paket.** Der Paket-Build erzeugt `dist/surface.json` (Klassen, Pacts, Hash je Pact-Typ); entfernt/umbenannt/geaendert ohne Major-Sprung = Release scheitert. Bei core gilt die Pruefung nur fuer den Haupteinstieg: Ein Laufzeit-Fix aendert den Vertrag nicht und ist ein Patch, den die Dogs ueber ihren Peer-Bereich ohne eigenes Release annehmen.
7. **Env-Variablen aus den Paketen.** Jedes Paket exportiert seine Env-Variablen als Metadaten; `startupEnvCheck` liest sie statt der Handliste (`startupEnvCheck.ts:457-532`).
8. **Paket-Hygiene fuer den Git-Weg (E6):** jedes Paket bekommt `build`, `prepare`, `files` (`dist` inkl. `type-defs.json` und `surface.json`) und baut allein aus einem frischen Klon; core bekommt `build` und `files` (heute fehlen beide).
9. **Umbenennen auf den Ziel-Scope (E5)**, solange alles in einem Repo liegt: `@slopdogs/<name>` -> `@martinschmieschek/slopdogs-<name>` in allen `package.json`, Imports, `tsconfig.json`-paths und Doku. Mechanisch, per Typecheck pruefbar. Die DB ist nicht betroffen (sie referenziert Klassen- und Pact-Namen, keine Paketnamen).

Die 13 unregistrierten OSM-Retriever in `dogs-geo` bleiben, bis der 10-0 ueber sie entscheidet.

**Abnahme P2:** `tsc -b` Server + alle Pakete, CI gruen, `test:startup` gruen, gleiche Node-Liste (Anzahl und Namen aus `GET /api/nodes`); `npm pack` jedes Pakets aus einem frischen Klon enthaelt `type-defs.json`.

**Stand 31.10. — P2 umgesetzt** (`3b113c6` Umbenennung, `cb199e7` Rest, auf `feature/dog-pakete`, nicht gepusht; von Lotus nachgemessen). Gemessen nach `npm ci` aus leerem `dist`: `npm test` 0, `test:startup` 22/22, `build:prod` 0, `build:local` 0, `start:local` 27/27 im Abnahmeskript, `GET /api/nodes` 162 Eintraege, davon 97 Base-Dogs, Namen und `pack` gleich wie vorher. Je Stueck:
- **P2.9:** 620 Stellen in 318 Dateien per Skript, Lock per `npm install`; `pack` bleibt der Kurzname (`dogs-weather`), Paketnamen stehen in keiner DB-Tabelle und in keinem Stats-Schluessel (gezaehlt).
- **P2.3/P2.2:** Haupteinstieg 23 Exporte (die 22 plus `DogEnvVar` aus P2.7), `/runtime` 46; entfernt 41 (die 33 plus 8 der 10 verwaisten), behalten `MemoryProbe` (Typ von `DogWorkerGate.setMemoryProbe`, Minimum-Satz nutzt ihn) und `ChannelState` (Ergebnistyp von `WebSocketChannelRetriever`); Subpfad `./kennelImportTarget` weg. `any` in core-Deklarationen 15 -> 0, ESLint-Ausgangsliste 1172 -> 1154. Der Haupteinstieg laedt 11 Dateien, 0 davon Laufzeit; eine Klasse `Dog`, ein `DogWorkerGate.shared`, eine Capability-Registry ueber beide Einstiege (8/8 Proben). Dog-Pakete sperrt ESLint fuer `/runtime` (Probe: Exit 1).
- **P2.1:** `packages/typedefs` (CLI `slopdogs-typedefs`), dieselbe Extraktion fuer Server und Paket-Build. Gemischt 101 Pact-Typen, 301 Klassen-Typen. Gegen die alte Datei: Pacts 0 Abweichungen; 27 Klassen-Inhalte und 1 neue Klasse, alle aus P2.2 (`any` -> `unknown`/`ISerializedDogConfig`, 21) und P2.5 (neue Felder an `BaseDogInfo`, `BaseDogPacks`, neue Klasse `PackageJsonLookup`). Gegen den alten Gesamt-Algorithmus auf demselben Baum: 0 Abweichungen bis auf `TypeDefExtractor` (Werkzeugklasse, wird nicht gemischt).
- **P2.6:** `dist/surface.json` in 54 Paketen; Probe `dogs-weather`: Pact-Typ geaendert -> Exit 1 bei `0.2.0-beta.0` und `0.2.1`, Exit 0 bei `0.3.0`; Export entfernt -> Exit 1.
- **P2.4:** core als Peer in 52 Paketen, `geo-pact` in 2, `dogs-demo` in 1, jeweils `^0.2.0-beta.0` plus `file:`-devDependency.
- **P2.8:** 55 von 55 Paketen allein gebaut und gepackt (Kopie ohne Root, Abhaengigkeiten als Tarballs der zuvor allein gebauten Pakete); 54 Tarballs mit `type-defs.json` und `surface.json`, beide inhaltsgleich mit dem Monorepo-Build; `typedefs` traegt CLI und tsconfig-Basis.
- **P2.5:** 97/97 Base-Dogs mit `packageName`/`packageVersion` in `GET /api/nodes`, 183/183 Base-Dogs und Pacts in `list_nodes`, `get_node` ebenso; `dogVersions` im API-Lauf, in `run_kennel` und im Snapshot-Kopf (nur mit Leserecht). `npm run check:dog-packs` belegt die Erkennung unter `node_modules`.
- **P2.7:** 19 Eintraege aus 10 Paketen (`<paket>/env`), Katalog 117 = 117 mit gleichem Inhalt, 11 Eintraege in Paket-Reihenfolge; `check-env-catalog` prueft zusaetzlich je Paket in beide Richtungen.

Abweichungen: Die tsconfig-Basis liegt im Typ-Werkzeug (`@martinschmieschek/slopdogs-typedefs/tsconfig.base.json`), sonst baut kein Paket ohne Root; die Projekt-Referenzen stehen in je einer `tsconfig.monorepo.json`, weil `references` auf `../core` den Allein-Bau mit TS6053 abbricht. `prepare` tut im Monorepo nichts: npm startet `prepare` aller Workspaces parallel und ohne Reihenfolge, der Bau scheiterte (gemessen). Env-Metadaten kommen ueber den Einstieg `<paket>/env` statt ueber den Haupteinstieg, damit die schlanke Registry beim Boot keine weiteren Dogs laedt.

Folgen fuer P3/P4: P3.1 ("kein Konfigurationspaket") gilt mit Einschraenkung — die tsconfig-Basis reist mit `slopdogs-typedefs`, ESLint/Prettier bleiben Kopien. `prepare` muss nach dem Schnitt bauen, wenn das Paket allein liegt (heute ueberspringt es im Monorepo); faellt das weg, baut die Git-Installation nichts. Fehlt einem Paket `dist/env.js` oder `dist/type-defs.json`, scheitern Start bzw. `build:prod` laut. Dog-Code im Editor sieht `simpleVmContext`, `getVmContextContributions` und das Index-Feld von `IUpdateInput` jetzt als `unknown`.

### P3 — Veroeffentlichung vorbereiten

1. **Konfiguration je Paket-Repo:** `slopdogs-base-dogs` traegt eine gemeinsame tsconfig-Basis, ESLint- und Prettier-Konfiguration fuer alle Unterordner; `slopdogs-core` traegt dieselbe Konfiguration als Kopie. Kein eigenes Konfigurationspaket — zwei Repos rechtfertigen es nicht.
2. **Versionen und Tags:** `slopdogs-core` taggt `v<version>`. `slopdogs-base-dogs` versioniert jedes Paket einzeln mit Changesets und taggt `<paket>@<version>`; nur geaenderte Pakete bekommen ein Release.
3. **Tag-Workflow** je Paket-Repo: bauen, `test`, Surface-Pruefung, nach GitHub Packages veroeffentlichen und den Tarball (`npm pack`) an den GitHub-Release haengen (E6, F4).
4. **Git-Weg pruefen:** core per `github:MartinSchmieschek/slopdogs-core#v<version>` (`prepare` baut), ein Dog-Paket per Tarball-URL des Releases. Bauzeit und Ergebnis an einem Testpaket messen, bevor geschnitten wird. Wer Pakete per Git installiert, muss fuer core, geo-pact und dogs-demo genau dieselbe Spezifikation nennen wie seine Abhaengigen — sonst entsteht eine zweite Kopie und das Parent-Matching schlaegt still fehl (F1); das steht im README.
5. **Render:** `.npmrc` mit `@martinschmieschek:registry=https://npm.pkg.github.com` und `//npm.pkg.github.com/:_authToken=${NPM_TOKEN}`; Render-Env `NPM_TOKEN` (nur `read:packages`).

### P4 — Schnitt

1. **`slopdogs-core`** per `git subtree split` aus `packages/core` (Historie bleibt); dazu `slopdogs-typedefs`; die 11 core-Mechanik-Tests aus P0.1 als Paket-Tests.
2. **`slopdogs-base-dogs`** aus `packages/dogs-*`, `packages/geo-pact`, `packages/dogs-demo` per `git filter-repo` (Historie bleibt, core ausgeschlossen); die Dog-Tests aus P0.1 als Paket-Tests. swaggrid ist kein Dog-Paket (OpenAPI-Generator) und bleibt im Server-Repo.
3. Erste Veroeffentlichung aller Pakete mit derselben Version (`0.3.0`), danach unabhaengig.
4. Server: `packages/dogs-*`, `packages/core`, `packages/geo-pact`, `packages/dogs-demo` weg; Abhaengigkeiten mit **exakten** Versionen plus Lockfile. Wer an einem Dog arbeitet, verlinkt das Paket-Repo lokal (`npm link`, Anleitung im README).
5. **Abnahme P4:** Render-Deploy aus Paketen, Boot-Waechter gruen, gleiche Node-Liste wie vorher, CI gruen in allen drei Repos.

**Stand 31.10. — P3 vorbereitet, P4 lokal geprobt** (auf `feature/dog-pakete`, nicht committet; Probe unter `C:\tmp\sd-split`, ohne Remote, ohne Registry). Gebaut:
- `repo-templates/` (`_shared/`, `slopdogs-core/`, `slopdogs-base-dogs/`): was die Paket-Repos zusaetzlich zur geschnittenen Quelle brauchen — Wurzel-`package.json` (base-dogs: private, Workspaces `packages/*`, `prepare` baut alle), ESLint-Konfiguration als Kopie (`eslint.config.template.mjs`, im Ziel `eslint.config.mjs`), `.prettierignore`, `.changeset/` (base-dogs je Paket, Tag `<paket>@<version>`; core Ein-Paket-Repo, Tag `v<version>`, typedefs zieht `npm run version-packages` nach), `ci.yml` und `release.yml`, `.npmrc` (nur Scope, kein Token), README, Paket-Tests, `scripts/surface-check.cjs`. `.prettierrc.json`, `.nvmrc` und die gefilterte ESLint-Ausgangsliste kommen beim Schnitt aus der Server-Wurzel. `publishConfig.registry` setzt der Schnitt in jedes Paket.
- `scripts/split-repos.cjs core|base-dogs|all|server` (P4.1, P4.2, P4.4). Arbeitet immer an einem Klon unter `<ziel>/.split-work-*`, committet nur in den neuen Repos, setzt kein Remote.
- `prepare` aller 55 Pakete: baut, ausser ein Elternordner hat eine `package.json` mit `workspaces` (statt bisher: `../../tsconfig.packages.json` vorhanden).

Gemessen (Probe 17:40-17:53, Logs `scratchpad/p3/final/`):
- **core:** `subtree split` 24,1 s + typedefs 16,5 s, 18 Commits; `npm ci` 7,1 s, `prepare` baut (Lage „allein"); Paket-Tests 12/12 (die 11 core-Mechanik-Tests, Lobby mit zwei Belegungen), lint 0, format 0; `npx changeset tag` legt `v0.3.0` an. `dist/type-defs.json` gleich dem Monorepo, `surface.json` gleich bis auf `version`.
- **core per Git-Tag** (`git+file:///…#v0.3.0` in leerem Projekt): 14,8 s, `prepare` baut im Klon, Haupteinstieg und `/runtime` laden.
- **base-dogs:** `filter-branch` 38,2 s (git-filter-repo nicht installiert), 52 Pakete, 9 Commits; `npm ci` 19,0 s — 52 Workspace-`prepare` gelaufen, 0 davon bauen, die Wurzel baut alle 52 in 10,1 s (Lage „Workspace"); Paket-Tests 6/6, lint 0, format 0; `changeset tag` 52 Tags; `type-defs.json` 52/52 und `surface.json` 52/52 gleich dem Monorepo (ohne `version`). Surface-Pruefung gegen die gepackten 0.3.0: 53/53 vertraeglich; entfernte Klasse -> Exit 1.
- **Server im Paket-Betrieb** (Kopie, core per Git-Tag, 53 Pakete + typedefs als Tarballs): 54 Pakete entfernt, 65 tsconfig-Pfade weniger, ESLint-Ausgangsliste 221 -> 73 Dateien; `npm ci` 73,7 s gegen 94,7 s im Monorepo (beide inkl. `ui-app`-`npm ci`, das allein 37 s bzw. 45 s); `npm ls`: genau ein core, 52 Abhaengige deduped; `npm test` 0, `test:startup` 22/22, `build:prod` 0 und `build:local` 0 (101 Pact-, 301 Klassen-Typen), `start:local` auf 3001: Abnahmeskript 27/27, `GET /api/nodes` 162 Eintraege, 97 Base-Dogs, Namen und `pack` gleich der Referenz aus dem Arbeitsbaum, `packageVersion` 0.3.0 bei allen 97.

Abweichungen vom Plan:
- **typedefs im core-Repo als Unterordner `typedefs/`**, mit Historie (`git subtree add`), nicht als Workspace: core baut es ueber den Pfad (`tsc -p typedefs/tsconfig.json`, `extends: ./typedefs/tsconfig.base.json`), damit die Git-Installation von core keine Registry braucht. Veroeffentlicht wird es mit core (gleiche Version, Tag `v<version>`, Tarball am Release); per Git installierbar ist es nicht (F4) — Dog-Pakete brauchen es nur als devDependency.
- **`git filter-branch --index-filter` statt `git filter-repo`**: filter-repo ist hier nicht installiert, `git subtree` schneidet nur einen Ordner. Gleiches Ergebnis (Pfadfilter ueber die Historie, leere Commits weg); der filter-repo-Zweig im Skript ist ungemessen.
- **Dog-Tests in base-dogs**: zusaetzlich zu den Plan-Tests prueft ein Test „genau ein core", einer `type-defs.json`/`surface.json`/`env.js` je Paket, einer die Env-Listen der Pakete (genannt -> im Code, `process.env.X` -> genannt; Lesungen ueber Helfer nur in der ersten Richtung). Grund: `check-env-catalog` prueft im Paket-Betrieb nur noch Pakete mit Quelle unter `packages/`.
- **Startup-Block 2 (Paket-Kandidaten) bleibt vorerst im Server**: er lief in der Probe gegen die installierten Pakete mit (22/22). Entfernen erst, wenn CI in beiden Paket-Repos gruen ist.
- `tsconfig.json` schliesst `repo-templates/` aus (sonst landete die Testklasse `InMemoryChannelHub` in den Server-Typen, gemessen 302 statt 301).

Fuer beide Lagen vorbereitet (im Monorepo gemessen gruen): `check-env-catalog` ueberspringt die Paket-Richtung fuer installierte Pakete; `build-package-typedefs` und `precompile-typedefs` lesen schon `node_modules`; tsconfig-Pfade auf fehlende Quellen fallen auf `node_modules` zurueck (der Schnitt entfernt sie trotzdem).

Render (P3.5, nur dokumentiert, README „Deploying from packages"): im Server-Repo bewusst noch **keine** `.npmrc` mit `${NPM_TOKEN}` — fehlt die Variable, bricht npm ab. Schritte fuer den 10-0: klassisches PAT mit nur `read:packages` vom Paket-Besitzer; Render-Env `NPM_TOKEN` setzen; Schnitt auf einem Branch (`split-repos.cjs server . --registry --in-place`, schreibt `.npmrc` und exakte Versionen), `npm install` fuer den Lock; Build-Befehl bleibt `npm ci && npm run build:prod`; erster Deploy: Boot-Waechter, Node-Liste, `packageVersion`.

Risiken: GitHub startet bei mehr als drei Tags in einem Push keinen Workflow — die 52 Erst-Tags einzeln pushen oder per `workflow_dispatch` nachholen. Liefert die Registry wegen fehlender Rechte 404, haelt die Surface-Pruefung das fuer ein erstes Release; die Gegenprobe ueber die Git-Tags faengt das ab Release zwei. `npm link` eines Pakets aus `slopdogs-base-dogs` zieht dessen eigenes core (gemessen: Aufloesung landet in `slopdogs-base-dogs/node_modules`) — README rät zum Tarball.

### P5 — Bot

- Renovate im Server-Repo: `@martinschmieschek/slopdogs-*` als eine Gruppe, exakt gepinnt. **Patch und Minor** automatisch gemerged bei gruener Server-CI; **Major** bleibt als PR fuer den 10-0.
- Renovate in `slopdogs-base-dogs` fuer core: Peer-Bereich innerhalb einer Minor (`^0.3.0` bei 0.x); nur der Server pinnt core exakt.

### Danach, ohne Frist

`any` im Server (591) Datei fuer Datei abbauen, ESLint-Ausgangsliste schrumpfen lassen; grosse Dateien zerlegen (`mcp/tools/kennels.ts` 1338, `SerializedDog.ts` 1480).

## Spur U — UI (E9, nach P0, unabhaengig vom Schnitt)

Ist-Stand (Amar 31.10.): Favoriten gibt es nicht (0 Treffer); die Sterne in der Liste sind Bewertungen. Ein Klick auf die Kennel-Zeile oeffnet `/kennels/<ref>` (`sd-track-row.component.html:30-34`), diese Seite laesst den Kennel sofort laufen und ist zugleich der Editor (`waves-viewer.component.ts:239,417,469-484`); nur der Name oeffnet `/k/<ref>?defaultQuery` im neuen Tab (`:7-14`). Das Menue `⋯` gibt es schon (Open page, Docs, Copy link, Edit/Frozen, Export, Delete; `:51-77`, `kennel-list.component.ts:415-439`), sein „Edit" oeffnet nur den Einstellungs-Drawer (`app.routes.ts:8-35`).

1. **Favoriten je Nutzer.** Neue Tabelle `KennelFavorite` (`lineageId` + `userId` als Schluessel, `createdAt`) in beiden Store-Schemas nach dem Muster `KennelRating` (`store/prisma/schema.prisma:72-81`); Store-Methoden, Service, Handler (`PUT`/`DELETE /api/kennels/:id/favorite`), Feld `favorite` in der Listenantwort, Filter `favorites` in `ListQuery` (Paging und Sortierung bleiben auf dem Server, `ListQuery.ts:120-135`, `ConfigRouteHandler.ts:241-248`). Nur Kennels, keine Dogs. Anonyme Besucher: der Favoriten-Schalter fuehrt zum Login, keine Browser-Ablage. Dev-Super-User ohne Identitaet: wie bei den Bewertungen keine Favoriten (403). Im lokalen Modus gilt der lokale Nutzer (Spur L). Das Symbol unterscheidet sich von den Bewertungs-Sternen; die Gestaltung entscheidet Follie.
2. **Klick laedt immer.** Ein Klick irgendwo auf die Zeile der Kennel-Liste oeffnet `/k/<ref>?defaultQuery` im neuen Tab, wie heute der Name. Die Kennel-Seite mit dem Editor (`/kennels/<ref>`) ist nur noch ueber `⋯` → Edit erreichbar, die Einstellungen von dort aus. Wer nicht bearbeiten darf (`canMutate`, `visibility.ts:201-211`), sieht Edit nicht; frozen und Landing-Kennels zeigen Edit deaktiviert mit Hinweis statt still zu verschwinden.

Betroffen: `sd-track-row.*`, `kennel-list.*`, `kennel.service.ts`, `kennel-config.model.ts`, beide Store-Schemas, `PrismaStore.ts`, `KennelStatsService.ts`, ein neuer Handler, `ListQuery.ts`, `ConfigRouteHandler.ts`, `routeTable.ts`.

**Abnahme U:** eingeloggt Favorit setzen/entfernen, Filter zeigt nur Favoriten, ein zweiter Nutzer sieht sie nicht; Klick auf die Zeile oeffnet `/k/`, Editor nur ueber `⋯` → Edit; `testRouteTableMatchesExpressStack` gruen mit den neuen Routen.

## Spur L — Lokaler Modus auf dem Pi (E10, nach P0, unabhaengig vom Schnitt)

Ziel: SlopDogs laeuft auf einem Raspberry Pi im Heimnetz wie eine Hue-Steuerung, im Produktionsverhalten, ohne Login, PAT oder OAuth; jedes Geraet im lokalen Netz nutzt UI und MCP.

Ist-Stand (Amar 31.10.): Ohne Auth gibt es heute nur den Super-User-Modus bei `NODE_ENV` ungleich production/integration, sonst Abbruch mit Exit 78 (`mcp/auth/middleware.ts:40-61`, `main.ts:58-62`); der Super-User hat keinen Nutzer, Keys, „mine" und Sterne antworten 403, die UI haelt sich fuer anonym. Die gebaute UI wird nur bei production/integration ausgeliefert (`createHttpApplication.ts:119-125`); Build und Prisma-Generierung erzwingen Postgres nach `NODE_ENV` statt nach der URL (`scripts/run-build.cjs:3`, `scripts/prisma-generate-matching-env.cjs:9`, `scripts/run-prisma-sync.cjs:36`). Der Server bindet fest auf `0.0.0.0` (`main.ts:264`), es gibt keine Host- und keine Origin-Pruefung, auch nicht fuer WebSockets (`ChannelHub.ts:127`).

1. **Eigener Schalter** `SLOPDOGS_MODE=local` neben `NODE_ENV=production`, kein drittes `NODE_ENV`. Boot-Guard nach dem vorhandenen Muster: Abbruch bei oeffentlicher Basis-URL (nicht privat, nicht `.local`), `TRUST_PROXY_HOPS>0`, `MCP_AUTH_REQUIRED=true` oder gesetztem `RENDER`.
2. **Netzgrenze statt Auth:** Der Server lauscht im LAN. Angenommen werden nur Clients aus privaten Adressbereichen und Loopback, geprueft an der Socket-Adresse, nie an Weiterleitungs-Headern. Eine Liste erlaubter Hosts (Default: Hostname, `<hostname>.local`, LAN-IPs des Geraets, `localhost`; erweiterbar per Env) gilt fuer HTTP und WebSocket; schreibende Anfragen und WebSocket-Upgrades pruefen die Origin gegen dieselbe Liste; CORS nur fuer diese Origins. Das kostet die Nutzer im Netz nichts und verhindert, dass eine fremde Webseite im Browser eines Nutzers ueber DNS-Rebinding Kennels anlegt oder Code einschleust. Host- und Origin-Pruefung gelten auch im Dev-Modus, der heute dieselbe Luecke hat.
3. **Ein gemeinsamer lokaler Nutzer** statt Super-User: beim Boot angelegt, `/auth/me` liefert ihn, Besitz, „mine", jsonStore, Key-Store und Favoriten funktionieren ohne Sonderfall; die UI zeigt kein Login. Alle im Netz teilen ihn — ein hinterlegter API-Key gilt fuer jeden im Netz.
4. **Netzzugriff der Dogs:** Die Sandbox sperrt private Netze fuer Nutzer-Code weiter. Ins Heimnetz gehen nur Base-Dogs aus Paketen — belegt: ein Hue-Dog laeuft heute im lokalen Netz (10-0, 31.10.).
5. **Datenbank und Start:** Postgres oder SQLite nach `DATABASE_URL`, nicht nach `NODE_ENV`, in Build, Prisma-Generierung und Sync; der Build baut die UI mit; eigenes Startskript `start:local` ohne Dev-Sonderwege (keine Seeds aus dem Testweg, keine StartupTests).
6. **Pi als Zielplattform:** arm64, Node aus `.nvmrc`, Prisma-Engines fuer arm64, Betrieb als systemd-Dienst unter eigenem Nutzer, Anleitung im README. Speicher auf dem Pi messen (Boot-RSS, ein Lauf, Hoechstwert), danach Speicher-Waechter, Slot-Deckel und Rate-Limits als lokale Defaults festlegen — ob die heutigen Grenzen dort passen, ist ungemessen.

**Bewusst getragenes Risiko (10-0, 31.10.):** Dog-Code ist nicht sicher eingesperrt (`PLAN.md:2277`, isolated-vm aus P8 nicht umgesetzt). Ohne Auth kann jedes Geraet im lokalen Netz Code auf dem Pi ausfuehren, auch Gaeste im WLAN oder ein gekapertes IoT-Geraet. Die Netzgrenze aus L1/L2 verhindert, dass daraus ein offenes Gateway im Internet wird.

**Ebenfalls getragen (Nira 31.10.):** Eine selbst eingerichtete Weiterleitung auf TCP-Ebene (`ssh -R`, socat, frp, Tunnel-Dienste) kommt von Loopback und mit erlaubtem Host-Header und hebelt die Netzgrenze aus; das README warnt davor, im Container bricht der Start ohne `SLOPDOGS_LOCAL_ALLOW_CONTAINER=1` ab. Browser ohne `Sec-Fetch`-Header koennen per `<img>` einen GET-Lauf ausloesen, ohne das Ergebnis zu sehen. Ein `/k/`-Link auf einer fremden Website zeigt lokal 403.

**Umgesetzt 31.10.** (`77ae74c`, `f1026fe`, `2870a95`, `658ffa9`), auf dem Desktop gemessen: Abnahmeskript ueber die LAN-IP 27/27, Boot-Guard Exit 79 bei oeffentlicher URL, Proxy-Hops und neuem Master-Key auf vorhandenen Schluesseln. **Folgen fuer den Dev-Modus:** Host-, Origin- und Rahmenpruefung sind an; CORS nur noch fuer Server- und UI-Port; Docker-Portmapping, Codespaces und Werkzeuge auf anderen Ports bekommen 403, bis `LOCAL_ALLOWED_HOSTS` sie erlaubt. `build:prod` erzeugt bei einer SQLite-URL SQLite-Clients. Offen: Pi-Messung (Speicher, Hue-Dog, Unit-Haertung, cgroup), Pruefwert fuer den Master-Key, Dev-Bind nur auf 127.0.0.1.

**Abnahme L:** Pi im LAN, ein zweiter Rechner nutzt UI und MCP ohne Login; fremder Host-Header → 403; Anfrage von einer oeffentlichen Adresse → abgewiesen; gesetzte oeffentliche Basis-URL → Start bricht ab; der Hue-Dog laeuft; Speicherwerte des Pi im Plan nachgetragen.

## Risiken

- **core bewegt sich weiter, jetzt mit der Laufzeit:** Jeder Fix an Sandbox, Gate oder Speicher-Waechter wird ein core-Release vor dem Server-Deploy (Preis von O1-revidiert). Gegenmittel: Surface-Pruefung nur fuer den Vertrag (P2.6), Tag-Workflow und Renovate automatisch; solange core `0.x` ist, Peer-Bereich nur innerhalb einer Minor.
- **Zwei Stufen bei Vertragsaenderungen:** Eine core-Aenderung, die Dogs mitzieht, ist ein core-Release plus ein PR in `slopdogs-base-dogs`. Gegenmittel: Vertrag vor dem Schnitt schaerfen (P2.2).
- **Ergebnisform:** Nutzer-Code in der DB liest Base-Dog-Ergebnisse direkt. Eine geaenderte Ergebnisform ist ein Major-Sprung, auch bei gleichem Pact-Typ — die Surface-Pruefung sieht das nur, wenn der Ergebnistyp im Pact steht.
- **Zweite Kopie bei Git-Installation:** Abweichende Spezifikationen fuer core, geo-pact oder dogs-demo erzeugen eine zweite Instanz; das Parent-Matching schlaegt still fehl (F1, P3.4).
- **Lokaler Modus:** siehe „Bewusst getragenes Risiko" in Spur L.

## Entscheidungen 31.10. und Offenes

- **O1 — revidiert 10-0 2026-10-31: runtime gehoert in core.** Die Fassung vom 09.10. (eigenes Paket `slopdogs-runtime`) entfaellt. Umsetzung als ein Paket mit zwei Einstiegen (P2.3); die Plattform-Dogs bleiben zusammen in core.
- **O2 — entfaellt**, ersetzt durch E7 (StartupTests auf den Minimum-Satz, Runner mit Exit-Code).
- **Branch `fix/client-ip-fair-queue`** (3 Commits vom 05.10., nie als PR gestellt, nicht in main): bleibt liegen (E8). Inhalt laut Boreal: echte Client-IP hinter Cloudflare, faire Warteschlange je Quelle statt 429, TypeScript-Compiler erst beim Live-Kompilieren — main deckt keinen der drei Punkte ab. Folge: P0.1, P1.3, P1.5 und P2.1 aendern dieselben Dateien; wird der Branch spaeter gebraucht, muss er auf den neuen Stand neu aufgesetzt werden.
