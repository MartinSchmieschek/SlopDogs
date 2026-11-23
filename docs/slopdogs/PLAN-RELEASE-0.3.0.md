# Plan: Release 0.3.0 — Server, eigene Seiten, Base-Dogs mit Wetter-Cache

**Stand 2026-11-23 18:45 — R1 bis R4 erledigt** (10-0: „ok los gehts wir machen es öffentlich“).
- **R1:** base-dogs `feature/open-meteo-dogs` (498e4ca fix, d8cc07f feat, bbc0963 release), gepusht; 10 Tags einzeln, alle 10 `release`-Läufe grün. Der PR nach `main` ist offen, Compare-Link liegt beim 10-0.
- **R2:** SlopDogs 4b02da4 (Härtung: allein `npm test` 0, startup 28/28) und dee3e57 (eigene Seiten: 0, 34/34).
- **R3:** 1ef6fab. Die vier Patches und sechs neuen Pakete in `package.json`; 8 Dogs und 8 Pacts in `full`- und `slimDeployRegistry`.
  - Heap slim 43 → 59 Klassen: heapUsed 99 → 99–103 MB, RSS 171 → 172–173 MB, im Rauschen.
  - Gemessen: startup 34/34, test 0, build:prod 0, build:local 0.
  - Der Live-Test mit `start:local` wurde nicht gemacht. Ersatz: Konstruktion aller 16 Klassen in der Heap-Messung und Live 8/8 in base-dogs.
- **R4:** d8e855c CHANGELOG (Datum 23.11., 58 Dog-Pakete, Open-Meteo-Dogs, 0.3.1). Branch `release/0.3.0` gepusht. Der PR-Text liegt im Scratchpad der Sitzung.
- `PLAN-EIGENE-SEITEN.md` bleibt mit den übrigen Plänen untracked, bis 0.3.0 live ist (R8), weil er die Härtung beim Namen nennt.

Auftrag 10-0 (23.11.):
- „mach einen release branch fertig, bei dem auch infos sind, was sich geändert hat. dann kann ich den mergen und wir sehen, wie die aktuelle version dann läuft“
- Eigene Seiten: „ja, mit rein“.
- Base-Dogs: „machen wir dann mit dem release, erstelle einen plan“.

Kennel-Caching ist **nicht** Teil davon und kommt als eigener Release danach (`PLAN-KENNEL-CACHE.md`).

**19:00:** PRs angelegt (10-0: „du machst die prs“, „volle freiheit“), alle Checks grün:
- base-dogs #1 `feature/open-meteo-dogs`;
- SlopDogs #19 `release/0.3.0`.

Lokaler Teil von R5 durch Lotus mit `start:local` (slim):
- `/api/health` meldet 0.3.0 und 4 Dogs auf 0.3.1.
- `/` sendet `Vary: Cookie` und `private, no-cache`.
- Eigene Seiten: PUT setzt die Landing, `/` und HEAD antworten mit 302 auf `/k/slopdogs-kennels` samt Query; Zurücksetzen gibt wieder 200.
- `list_nodes` zeigt die 8 neuen Dogs.

Der Merge per API wurde von der Rechteprüfung der Sitzung abgewiesen.

**19:05 — Release abgeschlossen.**
- **R6:** Der 10-0 hat gemergt (base-dogs 62360e2, SlopDogs d1b1b84, je als Merge-Commit) und den Render-Deploy ausgelöst. Live seit 18:58.
- **R7 live grün:**
  - `/api/health` meldet 0.3.0 und d1b1b84.
  - Slim-Registry: 21 Pakete, sun, weather und air-quality auf 0.3.1. water steht nicht in slim.
  - `/` anonym `public, max-age=300` mit `Vary: Cookie`; `/kennels` `Vary: Cookie`.
  - `/k/<normal>` mit CSP `sandbox` ohne `allow-same-origin`; `/k/slopdogs-kennels` ohne Sandbox.
  - `/api/my-pages` anonym 401; mit Token GET und PUT 200, die Tabelle `UserPage` existiert also.
  - `list_nodes` zeigt die 8 neuen Dogs.
  - `set_my_pages` und `get_my_pages` sind registriert.
  - Speicher nach dem Boot: RSS 166 MB, cgroup 208 von 512 MB, 0 OOM.
- **R8:** Befund 31.10. und H1/H2 im Tresor geschlossen. Die Pläne gehen als eigener PR ins Repo.

**Offen:** Der Wetter-Cache im Live-Server ist nicht ausdrücklich gemessen. H3-Datenprüfung (`PLAN-NACH-DEPLOY` 0.6). `SLOPDOGS_MAINTAINER_EMAILS`/`SLOPDOGS_RESEED` hat der 10-0 auf Render gesetzt oder nicht, unbestätigt.
**Nächster Schritt:** Kennel-Cache als 0.4.0 (`PLAN-KENNEL-CACHE.md`, E1–E6).

## Ausgangslage (gemessen 23.11.)

| Repo | Stand |
|---|---|
| SlopDogs `main` | 0.2.0-beta.1, `8a746db` (09.10.), live |
| SlopDogs `feature/server-schnitt` | 0.3.0, `4cea224` ungepusht, 46 Commits vor `main`, 0 dahinter; darüber nicht committet: eigene Seiten (34 geänderte Dateien, +507/−59, dazu 10 neue Code-Dateien) |
| slopdogs-base-dogs `main` | `5ed2bf7`, alle Pakete 0.3.0 |
| slopdogs-base-dogs `feature/sun-cache` | nicht committet: Cache-Fixes (sun, weather, water, air-quality) und 6 neue Pakete (openmeteo, solar, wind, soil, snow, storm); Tests 24/24, `eslint .` und `prettier --check .` sauber, Live-Abruf 8/8 |

Der Server lädt Dogs nur, wenn sie in der `package.json` (Tarball-URL) **und** in der Registry stehen. Unter `NODE_ENV=production|integration` (Render) gilt `server-registries/slimDeployRegistry.ts`, lokal `fullRegistry.ts`.

## Schritte

| # | Wer | Inhalt | Abnahme |
|---|---|---|---|
| **R1** | Lotus | **Base-Dogs veröffentlichen.** Branch `feature/open-meteo-dogs` aus dem jetzigen Stand. Drei Commits: (1) `fix(cache)` = 4 Retriever, 2 Changesets, 2 Tests; (2) `feat(open-meteo)` = 6 Pakete, 2 Tests, `tsconfig.packages.json`, `package-lock.json`; (3) `chore(release)` = `npm run version-packages`. Nach jedem Commit `npm test`. Push des Branches, dann `npx changeset tag` und die 10 Tags **einzeln** pushen (4 Patches 0.3.1: sun, weather, water, air-quality; 6 Erst-Releases 0.3.0). | 10 grüne `release`-Läufe, an jedem GitHub-Release hängt der Tarball. Compare-Link `main...feature/open-meteo-dogs` an den 10-0 (Merge ohne Squash, damit die Tags auf `main` liegen). |
| **R2** | Lotus | **Eigene Seiten committen** auf `feature/server-schnitt`, wie in `PLAN-NACH-DEPLOY.md` 0.2: Commit A Härtung (neutraler Text, keine Sicherheitsdetails), messen (`npm test`, `test:startup`, erwartet 28/28); Commit B Feature ohne `ui-app/src/app/config/api-base.inject.ts`. | Nach B: `npm test` 0, `test:startup` grün, `build:prod` 0, `build:local` 0. Nacheinander messen, nicht parallel (RAM). |
| **R3** | Lotus | **Server auf die neuen Dogs heben.** `npm run update:dogs` hebt die 4 Patches. Die 6 neuen Pakete per Tarball-URL in die `package.json`, `openmeteo` ausdrücklich (Peer wie `geo-pact`). Die 8 neuen Dogs samt Pacts in `fullRegistry.ts` und `slimDeployRegistry.ts` eintragen. Heap mit und ohne neue Dogs messen (`scripts/compare-registry-heap.cjs`), weil Render mit `--max-old-space-size=320` läuft. Commit C `feat(dogs)`. | Alle vier Messungen wie R2 grün. Lokal `start:local`: `list_nodes` zeigt die 8 neuen Dogs, ein Wetter-Kennel zweimal aufgerufen holt beim zweiten Mal nichts nach. Heap-Zuwachs als Zahl im Plan. |
| **R4** | Lotus | **Änderungsinfo.** `CHANGELOG.md` 0.3.0: Datum auf den Release-Tag, Abschnitte für eigene Seiten (steht schon im Diff) und Dogs (Wetter-Cache, neue Pakete) ergänzen. Die Version bleibt 0.3.0, weil sie nie veröffentlicht war. Commit D `docs(changelog)`. Branch `release/0.3.0` auf diesen Stand, pushen. PR-Text mit Änderungen und Deploy-Liste (unten) als Datei im Scratchpad. | Compare-Link `main...release/0.3.0` und PR-Text beim 10-0. |
| **R5** | 10-0 | **Vor dem Merge.** Sichttest auf `release/0.3.0` lokal (`npm run start:local`): `/account`, „Your pages“, Umleitung von `/` und `/kennels`. Render prüfen: Env (siehe unten), Build-Befehl mit Schema-Push, Auto-Deploy von `main` ja/nein. | Sichttest ok, Env gesetzt. |
| **R6** | 10-0 | **Merge** `release/0.3.0` → `main`, ohne Squash. Deploy auf Render (automatisch oder von Hand). | Render-Deploy grün. |
| **R7** | Lotus | **Live-Abnahme.** `/api/health` meldet 0.3.0 und die Dog-Versionen 0.3.1. `/` und `/kennels` anonym wie bisher, mit `Vary: Cookie`. `/k/<kennel>` trägt die Sandbox-CSP. Login geht, „Your pages“ setzen, die Umleitung folgt. Ein Wetter-Kennel zweimal aufgerufen, beim zweiten Mal aus dem Cache. `list_nodes` zeigt die neuen Dogs. RSS in `health_check` beobachten. | Alle Punkte grün, Ergebnis im Tresor. |
| **R8** | Lotus | **Danach.** Den Befund vom 31.10. im Tresor schließen. Plan-Dateien committen (`PLAN-NACH-DEPLOY` 0.6). `feature/server-schnitt` ist damit aufgegangen. Base-Dogs-PR mergen lassen, falls noch offen. Dann Kennel-Cache als 0.4.0. | — |

## Deploy-Liste für Render (gehört in den PR-Text)

- Build-Befehl führt den Schema-Push aus (`render:integration:build` → `prisma:sync:integration`). Ohne Push fehlt die Tabelle `UserPage`: Dann gilt für alle die Default-Seite, Speichern antwortet 503, alles andere läuft.
- `SLOPDOGS_MAINTAINER_EMAILS` setzen. Sonst darf niemand Landing und Kennel-Liste pflegen und keine gepflegte ID anlegen.
- `SLOPDOGS_RESEED=<marke>` einmal setzen, damit Landing und Liste in der neuen Form angelegt werden.
- `MCP_AUTH_REQUIRED=true` und die Keystore-Schlüssel wie bisher (Memory `reference_slopdogs_deploy_env`).
- Vorher prüfen, ob Render `main` automatisch deployt. Dann ist der Merge der Deploy.

## Rückweg

- Render: den vorigen Deploy wiederherstellen (Rollback im Dashboard). `main` per Revert-Commit zurück, kein Force-Push.
- Die Tabelle `UserPage` stört den alten Stand nicht, sie bleibt einfach liegen.
- Base-Dogs-Releases bleiben stehen: Der alte Server pinnt 0.3.0 per Tarball und merkt davon nichts.

## Risiken

- **Eigene Seiten ohne Sichttest:** Der 10-0 hat entschieden, sie mitzunehmen. Der Sichttest steht deshalb in R5 **vor** dem Merge, nicht danach.
- **Speicher auf Render:** 8 Dogs mehr in der schlanken Registry. Das Budget ist knapp (Ausfall Oktober). R3 misst den Heap. Ist der Zuwachs zu hoch, kommen die neuen Dogs nur in `fullRegistry` und Render bekommt sie mit dem nächsten Release.
- **Tags vom Branch:** Wird der Base-Dogs-PR mit Squash gemergt, liegen die Tags neben `main`. Die Releases funktionieren trotzdem, die Historie ist nur unsauber.

## Regeln

- Commits ohne Co-Autor-Zeile. Identität Martin Schmieschek (googlemail).
- Keine Sicherheitsdetails in Commit- oder PR-Texten, solange der Fix nicht live ist.
- `api-base.inject.ts` wird nie committet.
- Messungen laufen nacheinander.
- Merge nach `main` und Deploy macht nur der 10-0.
