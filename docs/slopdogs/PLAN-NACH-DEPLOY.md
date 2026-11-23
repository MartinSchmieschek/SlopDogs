# Fahrplan: nach dem Deploy von 0.3.0 – Merge nach main, dann Kennel-Shell und Shell-Dogs

**Stand 2026-11-09 (Lotus, Planung, kein Code):**
- Auf `feature/server-schnitt` liegt über 4cea224 (0.3.0, lokal committet, ungepusht) uncommittet „Eigene Seiten je Nutzer“ samt Härtung.
- Lotus hat am 04.11. nachgemessen: `npm test` 0, `test:startup` 34/34, `build:prod` 0, `build:local` 0.
- Die Pläne zu Shell und Video stehen fest, Code dazu gibt es noch nicht.

**23.11.:** Phase 0 läuft jetzt über `PLAN-RELEASE-0.3.0.md` (R1–R8). Der Release enthält zusätzlich die eigenen Seiten (10-0: „ja, mit rein“) und die Base-Dogs mit Wetter-Cache. Der Sichttest ist dort R5, vor dem Merge.

**23.11. 19:05: Phase 0 abgeschlossen.** 0.3.0 ist live (d1b1b84), die Abnahme ist grün, Details in `PLAN-RELEASE-0.3.0.md`. Offen aus 0.6 ist nur die Datenprüfung H3.

**Offen jetzt:** H3. Danach der Kennel-Cache 0.4.0 (`PLAN-KENNEL-CACHE.md`), dann Phase 1.
**Nächster Schritt:** Der 10-0 entscheidet E1–E6 im Kennel-Cache-Plan.

## Wiedereinstieg (zuerst lesen)

1. Den Stand prüfen, nur lesend:
   - `git -C ~/Downloads/SlopDogs-schnitt status --short`
   - `git log --oneline -3`
   - `git log origin/main --oneline -1` (am 09.11.: `main` = 8a746db, live).
2. Diese Datei von oben lesen und die erste Phase suchen, deren Abnahme fehlt. Dort weitermachen.
3. Die Detail-Pläne im selben Ordner:
   - `PLAN-EIGENE-SEITEN.md` (Phase 0);
   - `PLAN-KENNEL-SHELL.md` (Phasen 1 bis 4 und 6);
   - `PLAN-VIDEO.md` (Phase 5).
   - Aufklärung und Messungen liegen im Tresor unter `handoffs/*_slopdogs_{eigene_seiten_20261104,video_20261106}`.
4. Feste Regeln:
   - Kein Commit, kein Push und kein MR ohne Wort des 10-0.
   - Messungen laufen nacheinander, nie parallel, weil der RAM knapp ist.
   - Kein Claude-in-Chrome. Sichttests laufen per Headless-Chrome im Agenten oder über einen Link an den 10-0.
   - `ui-app/src/app/config/api-base.inject.ts` wird nie committet, die Datei ist ein Build-Artefakt.
   - Sicherheitsdetails stehen nur im Tresor, nie im Repo und nie in Commit-Texten, solange der Fix nicht live ist.
5. **Diese Plan-Dateien sind untracked.** `PLAN-NACH-DEPLOY`, `PLAN-KENNEL-SHELL` und `PLAN-VIDEO` werden erst committet, wenn 0.3.0 live ist (Phase 0.6), weil sie den Zweck der Sandbox beschreiben.

## Phase 0 — 0.3.0 abschließen: Commit, Merge nach main, Deploy auf Render

- **0.1 Sichttest (10-0):** `npm run start:local` (pusht das Schema selbst). Zu prüfen:
  - In `/account` „Your pages“ eine Landing und eine Liste setzen.
  - `/` und `/kennels` leiten dann auf `/k/<id>` um. „Reset to default“ stellt die Default-Seite wieder her.
  - Im lokalen Modus ist jeder der Nutzer `local`, die Einstellung gilt also für die ganze Instanz.
- **0.2 Commits (auf Wort):**
  - **Commit A, Härtung:** neutraler Text. Inhalt sind die Dateien aus Teil A im Void-Handoff vom 04.11. plus `test/startup/miniHttp.ts` und `testKennels.ts`. Aus `StartupTest.ts` und `CHANGELOG.md` gehören nur die A-Hunks dazu.
  - Danach `npm test` und `test:startup` auf A allein messen, erwartet sind 28/28.
  - **Commit B, Feature:** der Rest, ohne `api-base.inject.ts`. Danach wieder alle vier Messungen.
- **0.3 Push und MR:** `feature/server-schnitt` pushen und den MR nach `main` als Compare-Link anlegen (kein `gh` auf dem Rechner). Die Version ist 0.3.0, der CHANGELOG steht. Merge erst, wenn der 10-0 sicher ist.
- **0.4 Vor dem Deploy auf Render prüfen:**
  - Der Build-Befehl führt den Schema-Push aus (`render:integration:build` bzw. `prisma:sync:integration`). Ohne Push fehlt die Tabelle `UserPage`. Dann gilt für alle die Default-Seite, und Speichern antwortet 503.
  - Env nach Memory `reference_slopdogs_deploy_env`:
    - `SLOPDOGS_MAINTAINER_EMAILS` (sonst darf niemand Landing und Liste pflegen);
    - `SLOPDOGS_RESEED=<marke>` einmalig;
    - `MCP_AUTH_REQUIRED=true` und die Keystore-Schlüssel.
  - Prüfen, ob Render `main` automatisch deployt.
- **0.5 Live-Abnahme (kurz):**
  - `/api/health` meldet 0.3.0.
  - `/` und `/kennels` anonym wie bisher, mit `Vary: Cookie`.
  - `/k/<normaler-kennel>` trägt die CSP `sandbox …`.
  - Login funktioniert.
  - „Your pages“ setzen, dann folgt die Umleitung. Kennel löschen, dann gilt wieder die Default-Seite.
  - HEAD auf `/kennels` mit kaltem Memo messen (Nebenbefund aus `PLAN-EIGENE-SEITEN.md`).
- **0.6 Danach:**
  - Den Befund vom 31.10. im Tresor als geschlossen vermerken.
  - Diese Plan-Dateien dürfen jetzt committet werden.
  - Die offene Datenprüfung H3 vom 04.11. erledigen (Tresor, `wachsamkeit/archiv`).

**Abnahme Phase 0:** 0.3.0 läuft live, `main` = der gemergte Stand, die Live-Abnahme ist grün.

## Phase 1 — Messen, ob die Shell trägt (Amar)

Gemessen wird mit Headless-Chrome und einem eigenen Mini-Server im Scratchpad, ohne SlopDogs-Server. Details in `PLAN-KENNEL-SHELL.md`.
- **M1:** Erbt ein iframe in einer Seite mit CSP-Sandbox die Sandbox? Erwartet ist ja (laut Spezifikation, nicht gemessen).
- **M2:** Die Shell (echte Origin) öffnet die Fake-Kamera und reicht das Bild per lokaler WebRTC-Verbindung und `postMessage` in einen Sandbox-iframe. Kommt das Bild an?
- **M3:** Die Grundlagen der Shell: iframe-Höhe und Scrollen, Vollbild (`allow="fullscreen"`), Zurück-Taste, Titel, Deep-Link, Teilen-Link der Lobby aus dem iframe.

**Abnahme:** Ergebnistabelle im Handoff. Scheitert M2, kommt die Kamera nicht über die Shell, die Shell selbst (Login, Fähigkeiten) bleibt sinnvoll. Dann wird neu entschieden.

## Phase 2 — Aufklärung für den Detail-Plan (Boreal, nur lesen)

- Wo `/k/` HTML ausliefert (`KennelRunHandler`, `SecurityHeaders`) und wo die Shell davor gehört.
- Muster für statische Dog-Metadaten (`static mcpGuidance` in core) als Vorlage für `shellRequires`. Wo der Server beim Ausliefern die Dogs eines Kennels kennt.
- Welche Login- und Konto-Bausteine aus der Angular-App die Shell nutzen kann (`auth-badge`, `/auth/me`). Ob die Shell eine eigene kleine Seite wird, wie die Landing, oder in Angular entsteht.
- Bestehende Kennels, die in einem iframe brechen könnten: Vollbild, Navigation des obersten Fensters, `location`, Lobby-Teilen-Links, QR-Codes. Kandidaten: Zombie Hunter TV, KI-Früchte, dogdoc-Frames, Hue.

**Abnahme:** `PLAN-KENNEL-SHELL.md` hat den Detail-Plan (Dateien, Nachrichtenprotokoll v1, Tests). Der 10-0 hat ihn gelesen.

## Phase 3 — Shell Stufe 1: Rahmen, Login-Anzeige, Fähigkeit „login“ (Void)

- **Shell-Seite und Route:** fester Plattform-Code mit Login-Anzeige (wer, Anmelden, Abmelden, Konto). Der Kennel läuft als iframe mit derselben Sandbox wie heute.
- **`shellRequires` als statische Dog-Deklaration** in core. Der Server ermittelt die Vereinigung über die Dogs des Kennels. Dafür braucht es eine core-Release-Runde, 0.3.x passend zu den `peerDependencies ^0.3.0` der base-dogs.
- **Fähigkeit `login`:** Die Shell verlangt die Anmeldung, bevor der Kennel lädt. Der Kennel läuft serverseitig als der Nutzer, wie heute. Im Browser bekommt er den Login nie.
- **Gilt zunächst nur für Kennels, deren Dogs eine Fähigkeit fordern.** Alle anderen bleiben ohne Shell.
- **Sicherheitsregeln aus S6:**
  - Kein Kennel-Inhalt außerhalb des iframes.
  - Jede Nachricht prüfen (`event.source`, feste Typen).
- Nira prüft vor dem Commit.
- **Abnahme:** die vier Messbefehle grün, Startup-Tests für Shell, Protokoll und `login`, dazu der Sichttest des 10-0.

## Phase 4 — Fähigkeit „camera“ (Kamera, Mikrofon, Bildschirm) über die Shell (Void)

- Die Shell bietet Kamera, Mikrofon und Bildschirm an.
  - Eingeschaltet wird nur per Klick auf den Knopf der Shell, nie auf Anfrage des Kennels.
  - Die Zustimmung gilt je Nutzer und Kennel. Wo sie gespeichert wird, DB oder Browser, entscheidet der Detail-Plan.
- Das Bild kommt per lokaler WebRTC-Verbindung in den Kennel (der Weg aus M2).
- Solange die Kamera läuft, zeigt die Shell eine Anzeige, die der Kennel nicht verdecken kann.
- Im lokalen Modus über http im LAN gibt es keine Kamera, weil der sichere Kontext fehlt. Die UI sagt das.
- Nira prüft vor dem Commit.

## Phase 5 — P2P-Base-Dog `WebRtcPeers`, Video-Chat in Kennels (Void)

Details in `PLAN-VIDEO.md`.
- **Hub-Härtung zuerst:** Die Details stehen im Tresor. Dazu kommen die ersten Tests am Drahtprotokoll.
- **Hub:** eine neue Nachrichtenart `signal {to, data}`. Sie geht nur an den Empfänger, wird nicht gespeichert und ist gedrosselt. Den Absender trägt der Hub selbst ein.
- **ICE-Liste vom Server:** STUN `stun.l.google.com:19302` und `stun.cloudflare.com:3478`. TURN kommt später allein über die Env, mit HMAC-Zugangsdaten.
- **Base-Dog `WebRtcPeers`** in core, mit fertigem Code für Vermittlung, Mesh, Wiederverbinden, DataChannels und Ströme. Der Kennel-Bauer verdrahtet nur den Dog und schreibt seine Oberfläche. Mit `shellRequires: ['camera']` ergibt das einen Video-Chat.
- **Abnahme:** zwei echte Geräte in verschiedenen Netzen (WLAN und Mobilfunk). Ohne TURN ist die Quote unbekannt, deshalb wird sie gemessen und notiert.

## Phase 6 — Shell als Standard für alle Kennels

- Verträglichkeitstest der bestehenden Kennels in der Shell (Liste aus Phase 2), Befunde beheben.
- Danach öffnet jede `/k/`-Seite im Browser die Shell. Ob gepflegte Kennels wie Landing und Liste mitgehen, entscheidet der Detail-Plan.

## Zurückgestellt

- **K1, eine eigene Origin je Kennel** (`<id>.kennels.<domain>`): die sauberste Trennung. 10-0 am 09.11.: „ich bin noch nicht bereit eine 2. domain zu machen“.
- **TURN-Server:** Er kommt später allein über die Env. Auf Render läuft er nicht, weil Render kein UDP annimmt und nur einen Port öffnet.
- **Übertragung an viele (SFU) und Aufzeichnung:** nicht Teil dieses Vorhabens.
