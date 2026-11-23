# Plan: Videostreaming in Kennels (WebRTC, Absprache über die Lobby)

**Stand 2026-11-06: zurückgestellt (10-0).** Es gibt keinen Code. Die Aufklärung ist abgeschlossen: Boreal hat die Lobby kartiert, Amar hat gemessen, dass die Kamera unter der Sandbox gesperrt ist.
- **E7 (10-0):**
  > idee stellen wir hinten an das ist wirklich ein problem wenn kennels auf der adresse laufen dafür brauchen wir ein portal
- **Folge:** Video wartet auf die Trennung von Portal und Kennel-Seiten. Das Portal umfasst Login, `/api`, `/mcp` und `/account`. Die Kennel-Seiten bekommen eine eigene Adresse ohne Session (W3).
- Diese Trennung ist ein eigenes Projekt mit eigenem Plan und noch nicht beauftragt.
- Zu klären ist dort die Domain: Gibt es eine eigene, oder braucht es einen zweiten Render-Dienst?
- Die Hub-Mängel aus Boreals Karte bleiben bis dahin bestehen und sind nicht beauftragt.

**Nachtrag 2026-11-09:**
- Der 10-0 präzisiert das Ziel: P2P-WebRTC in Kennels über Base-Dogs.
- Pfad als Base-URL: verworfen. Er trennt keine Origin.
- K1, eine Origin je Kennel (`<id>.kennels.<domain>`): die sauberste Lösung, aber
  > ich bin noch nicht bereit eine 2. domain zu machen.
- Ohne neue Domain sind möglich:
  - **Stufe 1:** P2P in der Sandbox (DataChannels und Ströme aus Canvas oder Audio, Empfang). Gemessen innerhalb einer Seite, nicht zwischen Geräten.
  - **Stufe 2:** Die Kamera kommt über einen Rahmen der Plattform, der das Bild per lokaler WebRTC-Verbindung in den Kennel reicht. Nicht gemessen.
    - Die Kamera geht nur per Klick im Rahmen an.
    - Der Rahmen zeigt eine Anzeige, die der Kennel nicht verdecken kann.

- **Weiter (10-0, 09.11.):** Die Kamera kommt über die Kennel-Shell, siehe `PLAN-KENNEL-SHELL.md`. Die Shell folgt nach dem Render-Deploy.

**Nächster Schritt:** Erst der Render-Deploy, dann die Shell. Ob Stufe 1 (P2P) vorher kommt oder erst mit der Shell, ist offen. Dann wird dieser Plan auf W3 aufgesetzt.

## Auftrag (10-0, 2026-11-06)

> wir brächten noch eine möglichkeit in einen kennel einen turnserver zu machen so wie auch schon mit websocket wie setzten wir das am bestem um damit videostreaming möglich ist?

> können wir dann einen freien stun nehmen hat google solche?

## Entschieden

- **E1 Weg (Lotus):** Das Video läuft per WebRTC direkt zwischen den Browsern. Die Lobby (`ChannelHub`, `/api/channels`) übernimmt nur die Absprache, also SDP und ICE-Kandidaten.
  - Video über den WebSocket scheidet aus. Jede Nachricht ist auf 16 KB begrenzt (`WS_MAX_MESSAGE_BYTES`) und geht an alle im Raum. Alles hängt an einem einzigen Prozess mit knappem RAM.
- **E2 STUN (10-0):** Freie öffentliche Server: `stun:stun.l.google.com:19302` (dazu `stun1` bis `stun4`) und `stun:stun.cloudflare.com:3478`. Es gibt vorerst keinen TURN-Server.
  - Die Folge: Wo beide Seiten hinter strengem NAT sitzen, kommt keine Verbindung zustande (manches Mobilfunk-NAT, Firmennetze). Die Quote ist unbekannt, erst der Betrieb zeigt sie.
- **E3 TURN später nur über die Env:** Die ICE-Liste baut der Server. Kommen TURN-Adresse und Geheimnis in die Env, stellt der Server kurzlebige Zugangsdaten nach dem HMAC-Verfahren aus. Dafür ist keine Codeänderung nötig.
  - Auf Render geht kein eigener TURN-Server, weil Render nur HTTP auf einem Port annimmt und kein UDP.
- **E4 Lokaler Modus:** Im LAN verbinden sich die Geräte direkt. Dort braucht es kein TURN, die STUN-Liste schadet aber auch nicht.
- **E5 Grenze:** Die Verbindungen laufen als Mesh. Das trägt einen Sender und wenige Zuschauer. Eine Übertragung an viele (SFU) ist nicht Teil dieses Auftrags.

- **E6 Umfang (10-0, 2026-11-06):**
  > es geht ja nur um die vermittlung von teilnehmnern und aufbau der video verbindung das dies von einen base dog gemacht werden kann mit vorgefertigten code. damit dann ein user auch einen kennel bauen kann der video chat hat.
  - Ein Base-Dog übernimmt die Vermittlung der Teilnehmer und den Aufbau der Videoverbindung, mit fertigem Browser-Code. Der Kennel-Bauer (Nutzer oder KI) liefert nur die Oberfläche, also die Video-Elemente und die Knöpfe, und verdrahtet den Dog wie heute `base:WebSocketChannelRetriever`.
  - Medienserver, Aufzeichnung und Übertragung an viele gehören nicht dazu.

## Entwurf (vorbehaltlich der Aufklärung)

1. **Hub:** eine neue Nachrichtenart `signal {to, data}`.
   - Sie geht nur an einen Teilnehmer und wird nicht gespeichert.
   - Der Absender wird geprüft wie beim `patch`.
   - Sie ist je Teilnehmer gedrosselt.
   - Ein `patch` taugt nicht dafür: Er ersetzt den ganzen geteilten Stand, und jeder neue ICE-Kandidat würde den vorigen überschreiben.
2. **Plattform-Dog `IceServersRetriever`:** in core, neben `WebSocketChannelRetriever`. Er liefert `iceServers` vom Server und sieht nie ein Geheimnis.
   - `keys.fetch` scheidet aus, weil es mit den Schlüsseln dessen läuft, der den Kennel ausführt. Anonyme Zuschauer haben keine.
3. **Script-Baustein für die Seite:** Mesh, Kamera bzw. Bildschirm und die Fehlerfälle als fertiger Dog. Sonst baut jede KI ihr eigenes WebRTC.
4. **Doku:** die MCP-Anweisungen (Werkzeugkasten), `mcp/skill.md`, README und CHANGELOG.
5. **Release:** core bekommt eine neue Version, weil der Retriever und der Hub-Vertrag dort liegen. Danach zieht der Server die neue Version nach.

## Aufklärung Boreal (2026-11-06, nur gelesen)

Handoff: scratchpad `boreal_slopdogs_video_20261106.md`.

- **Muster:** Der Server setzt Dienste statisch an die Dog-Klasse, z. B. `WebSocketChannelRetriever.initService(hub)` (main.ts:258).
  - Für ICE gilt dasselbe: core bekommt das Interface `IIceServerProvider` mit `useProvider`.
  - Der Server baut die Liste in `server-app/IceServers.ts`. core liest keine Env.
- **`signal` braucht kein core-Release.** `IChannelHub` kennt keine Nachrichtentypen.
  - Den Absender trägt der Hub selbst ein, nie der Client.
- **Hub-Härtung** vor dem Bau von `signal`, dazu Tests am Drahtprotokoll. Die Details stehen außerhalb des Repos (Tresor, 2026-11-09).
- **Zulassung beim Upgrade:** In integration und production verbindet jeder, der die channelId kennt, auch anonym. Tickets gibt es nur in dev und im lokalen Modus.
- **Browser-Code-Dog:** Heute liefern Dogs nur ganze Seiten (`ChannelLiveSnippetRetriever` → `window.lobby`). `base:WebRtcCall` wäre der erste Dog, der ein Fragment liefert.
  - Ausgabe `{script}`, dazu `window.rtcCall` mit Events und festen Fehlercodes.
  - Der Lobby-Client wird als gemeinsame Funktion in core herausgezogen.
  - Der Dog kommt nach core, damit es bei einer Release-Runde bleibt.
- **Release:** Es wird core 0.3.4, nicht 0.4.0. Die 52 base-dogs-Pakete haben `peerDependencies ^0.3.0`, und unter 0.x deckt das nur 0.3.x ab.
  - Lokal gibt es keinen Quell-Checkout von core 0.3.3, also muss frisch von GitHub geklont werden.
- **O2 erledigt:** Der Server setzt weder `connect-src` noch eine `Permissions-Policy`. Es bleibt allein O1.

## Messung Amar (2026-11-06)

Handoff: scratchpad `amar_slopdogs_video_20261106.md`, Skripte in `amar-video/`.

**Messaufbau:** Chrome 156 headless, gesteuert per CDP. Die Seite kommt als Top-Level-Navigation von einem eigenen Node-Server und trägt die `/k/`-Kopfzeile, die aus `SecurityHeaders` nachgebaut ist.

**Unter der Sandbox:**
- `origin` ist `"null"`, `isSecureContext` ist true.
- `getUserMedia` und `getDisplayMedia` scheitern sofort mit `SecurityError: Invalid security origin`. Das gilt auch, wenn die Freigabe auf `granted` steht, und auch mit Permissions-Policy `camera=*`.
- **Ursache in Chromium:** Die Origin-Prüfung kommt vor jeder Prüfung der Freigaben (`MediaStreamDispatcherHost::DoGenerateStreams`). Deshalb hilft auch kein Sandbox-Token.
- **Firefox** sperrt dasselbe seit Version 66 (Bug 1371741). Das ist nur aus Quellen belegt, nicht gemessen.
- **Safari** ist ungeklärt.

**WebRTC selbst geht unter der Sandbox:**
- Ein `srflx`-Kandidat kommt über stun.l.google.com.
- Die Verbindung steht.
- Ein Bild aus einem Canvas kommt an.

**Ohne Sandbox:** Kamera und Bildschirm gehen.

**Urteil:** Ein normaler Kennel kann Video empfangen, aber keine Kamera und keinen Bildschirm senden.

## Offen

- **O1 erledigt (gemessen: gesperrt).** Der Weg ist eine Entscheidung des 10-0, siehe W1 bis W4 unten.
- **O3 Sicherer Kontext im LAN:** Browser geben Kamera und Mikrofon nur über HTTPS oder `localhost` frei. Im lokalen Modus über `http://<pi>:<port>` gibt es auf den anderen Geräten also gar keine Kamera, mit oder ohne Sandbox. Das ist eine bekannte Browser-Regel, hier nicht gemessen.

## Wege zu O1 (für den 10-0)

- **W1 Senden nur in gepflegten Kennels:** Kein normaler Nutzer kann einen Video-Chat bauen. Damit verfehlt W1 den Auftrag (E6).
- **W2 Sende-Seite der Plattform als Popup:** Die Seite kommt von uns, ohne Nutzer-Skript, und darf wegen `allow-popups-to-escape-sandbox` ohne Sandbox laufen.
  - Das geht ohne Umbau.
  - Aber das Video läuft im Popup, nicht im Kennel. Die Gestaltung des Kennel-Bauers erreicht es nicht, und auf dem Handy ist das holprig.
  - Eingebettet als iframe geht es nicht, weil der iframe die Sandbox des Kennels erbt.
- **W3 Eigene Adresse für Kennel-Seiten (Empfehlung Lotus):** `/k/` wird von einem zweiten Hostnamen ausgeliefert, der dieselbe App bedient, aber keine Anmeldung und keine Cookies kennt. Dort braucht es keine Sandbox, und die Kamera geht.
  - Das löst den Befund vom 31.10. grundsätzlich und nicht nur per Sandbox. Kennels bekommen ihre Herkunft zurück und damit auch ihren eigenen Browser-Speicher.
  - **Kosten:** eine zweite Domain, auf Render als Custom Domain am selben Dienst, dazu eine Weiche nach Host im Server. Im lokalen Modus genügt ein zweiter Port (siehe O3).
- **W4 Nur synthetische Quellen:** Kein Video-Chat, verworfen.
 `/k/` läuft mit CSP `sandbox` ohne `allow-same-origin`, also mit opaker Origin. Verdacht, nicht gemessen: Der Browser verweigert dort `getUserMedia`. Dann könnte ein normaler Kennel Video empfangen, aber nicht senden.
  - Amar misst das.
  - Bestätigt sich der Verdacht, ist das eine Sicherheitsentscheidung für den 10-0.
- **O2 CSP:** Prüfen, ob `connect-src` oder eine Permissions-Policy WebRTC bzw. die Kamera sperren.
