# Plan: Web-Push-Benachrichtigungen aufs Handy

Status: **Plan, geprüft gegen den Code (2026-10-05)** — noch kein Code. Branch `plan/web-push-notifications`.
Der Plan reist mit dem ersten Bau-PR nach `main`; er bekommt keinen eigenen PR.

## 1. Ziel

Ein Nutzer bekommt eine Nachricht auf sein Handy — **auch im Standby, ohne offene Website** —, auf
**Android und iPhone**. Zwei Auslöser:

1. **Der Agent meldet sich selbst** über das MCP-Tool `notify_me`: Frage, fertig, Info.
   Kein Auto-Push bei `build_kennel`/`save_node`.
2. **Ein Kennel meldet ein Ereignis** — nur über einen Umweg (Drain, Abschnitt 5b), nie über ein
   Push-Werkzeug im Dog-Code.

## 2. Entscheidungen (10-0, 2026-10-05)

| Thema | Entscheidung |
|---|---|
| Transport | Web Push mit eigenen VAPID-Schlüsseln. Keine Fremd-App. |
| Besitz | SlopDogs besitzt die Zustellung. Einzige Sendestelle: `NotificationService.sendToUser`. |
| Empfänger Agent | Wer `notify_me` aufruft, bekommt die Nachricht (`ctx.user.id`). |
| Empfänger Kennel | **Immer der eingeloggte Nutzer, der den Lauf auslöst** — öffentlich wie privat. Nie automatisch der Besitzer. Anonyme Läufe benachrichtigen niemanden. |
| Kennel-Umweg | (ii) Drain: der Kennel schreibt in einen Postausgang, ein Arbeiter der Plattform verschickt. |
| Einstellungen | Je Nutzer: Agent-Nachrichten an/aus; Kennel-Nachrichten je Kennel an/aus. |
| Geräte | Android und iPhone ab PR 1. |
| Service Worker | Schlichter `sw.js` nur mit `push` + `notificationclick`, **ohne fetch-Handler**. Kein Angular-`ngsw` — der beantwortet in der Grundeinstellung Navigationen aus dem App-Cache, unter Scope `/` auch Kennel-Seiten. |
| Drossel | Zentral in `sendToUser`, DB-atomar — nicht je Auslöser. |

**Folge der Empfänger-Regel:** Die frühere Idee „dogdoc meldet dem Besitzer, dass jemand gelesen hat“
ist nicht mehr Teil des Plans. Der Leser löst den Lauf aus, also ginge die Nachricht an ihn. Soll der
Besitzer-Fall zurückkommen, ist das eine eigene Ausnahme mit eigener Entscheidung.

## 3. Voraussetzung vor jedem Deploy von PR 1

Kennel-Seiten und die App teilen sich heute denselben Ursprung. Bevor neue, sitzungsgebundene
Push-Endpunkte live gehen, wird entschieden und umgesetzt, wie Kennel-Seiten von der App abgeschottet
werden (eigener Origin für `/k/` oder Sandbox-Header). Befund und Begründung liegen intern; Prüfung durch
Nira auf Freigabe.

## 4. Komponenten

### 4a. Datenbank — zwei neue Modelle
In **drei** Dateien, 1:1 gleich: `store/prisma-auth/schema.prisma`, `store/prisma-auth/schema.postgres.prisma`,
`store/prisma/schema.postgres.prisma` — **nicht** in `store/prisma/schema.prisma`.

Grund: Im Postgres-Betrieb pusht `scripts/run-prisma-sync.cjs` nur `store/prisma/schema.postgres.prisma`
mit `--accept-data-loss`; der Auth-Push wird übersprungen (`run-prisma-sync.cjs:55-74`,
`scripts/dbEnv.cjs:143-166`). Eine Tabelle nur im Auth-Schema entstünde im Betrieb nie.
Kein Auth-Modell nutzt `@relation` — `userId` als String plus `@@index` (Vorlage `UserKey`,
`store/prisma-auth/schema.prisma:74-93`). Skripte brauchen keine Änderung.

```
model PushSubscription {
  id         String    @id @default(uuid())
  userId     String
  endpoint   String    @unique
  p256dh     String
  auth       String
  ua         String?
  createdAt  DateTime  @default(now())
  lastUsedAt DateTime?
  @@index([userId])
}

model PushSettings {
  userId        String  @id
  agentEnabled  Boolean @default(true)
  mutedKennels  String  @default("")   // CSV der Lineage-IDs, Vorlage kennelGrants
  // Drossel-Zähler, Vorlage usedToday/usedDayStamp (UserKey)
}
```

Die Felder für PR 3 (`mutedKennels`) kommen schon in PR 1 — das spart eine Schemarunde.

### 4b. Server — `NotificationService` (`services/NotificationService.ts`, neu)
- `fromEnv`: ohne VAPID-Schlüssel oder `PUSH_ENABLED` aus (Vorlage `KeyStoreService.fromEnv`, `services/KeyStoreService.ts:224-242`).
- `sendToUser(userId, { title, body, url?, kind, kennelLineageId? })`: prüft Einstellungen und Drossel,
  sendet je Subscription, löscht Subscriptions bei 404/410.
- Drossel DB-atomar nach `consumeQuota` (`KeyStoreService.ts:333-351`). `SLOPDOGS_MCP_RATE_LIMIT` taugt nicht
  (Middleware im Prozessspeicher, `mcp/transports/mcp.ts:203-225`).
- Beim Anmelden einer Subscription nur HTTPS und eine Allowlist der Push-Dienste — sonst schickt der Server
  POSTs an beliebige URLs (Vorlage `hostAllowedBy`, `KeyStoreService.ts:197-200`).
- `url` nur als Pfad im eigenen Origin (Vorlage `safeReturnTo`, `mcp/auth/router.ts:33-37`).
- Transport-Interface für Tests (Vorlage `KeysNetwork` / `FakeKeysNetwork`).
- Abhängigkeit: `web-push` neu — oder Eigenbau mit `jose` + `node:crypto` (`jose` ist da, `package.json:170`).

Verdrahtung in `server-app/createHttpApplication.ts`: Dienst nach `keyStore` (`:196`), Handler zwischen
`:291` und `:299` — **vor** `:300`, sonst antwortet `/api/:subpath` zuerst.

### 4c. REST — `api/routes/PushRouteHandler.ts` (neu), nur Browser-Sitzung
`GET /api/push` (Status, Public Key) · `GET`/`POST /api/push/subscriptions` ·
`DELETE /api/push/subscriptions/:id` · `POST /api/push/test` · `GET`/`PUT /api/push/settings`.
Vorlage `KeysRouteHandler` (`api/routes/KeysRouteHandler.ts:11-57`), `requireLogin`
(`ConfigRouteHandler.ts:32-36`). Jeder Pfad in `api/routes/routeTable.ts` (`API_ROUTE`, `API_ROUTES`,
`EXPRESS_APP_ROUTES`) — das prüfen StartupTest und `lint:docs`.

### 4d. Client — PWA-Teile in `ui-app/public/`
- `sw.js`, `manifest.webmanifest`, `icons/*` nach `ui-app/public/`. Der vorhandene `express.static` liefert sie
  in production/integration am Root aus, mit passendem Typ und `max-age=0`
  (`server-app/httpFrontEnd.builtUi.ts:13`). Keine eigene Server-Route nötig.
- Manifest: `scope: "/"`, **`start_url: "/kennels"`** — auf `/` liegt der Landing-Kennel; ein neuer Pfad
  würde von der Alt-Weiche per 308 auf `/k/<name>` umgeleitet. `display: "standalone"`.
- `ui-app/src/index.html`: `<link rel="manifest">`, `apple-touch-icon`, `theme-color`.
- **Icons sind Handarbeit:** es gibt nur `favicon.ico`; die Marke existiert nur als Inline-SVG mit Webfont.

### 4e. UI — Account-Tab „Push“
Angular 18, standalone. Neuer Tab nach dem Muster des Keys-Tabs (`ui-app/src/app/utils/account.ts:2-18`,
Service nach `user-key.service.ts:10-27`):
- „Auf diesem Gerät aktivieren“ — `Notification.requestPermission` als erste Handlung im Klick.
- **iPhone ohne Homescreen-App:** statt des Knopfs die Anleitung „Zum Home-Bildschirm“.
- Geräteliste mit Entfernen, Testknopf.
- Schalter: Agent-Nachrichten an/aus (ab PR 2), Kennels stummschalten (ab PR 3).

## 5. Auslöser

### 5a. Agent → Aufrufer (`notify_me`, PR 2)
`mcp/tools/notify.ts` (neu), Vorlage `getKeyTools` (`mcp/tools/keys.ts:11-66`).
Argumente `kind` (question | done | info), `title`, `message`, `url?`.
Einzutragen in **beide** Werkzeuglisten (`mcp/transports/mcp.ts:191-198`, `mcp/transports/openapi.ts:61-68`),
ToolDeps-Feld in `mcp/tools/types.ts`, `createHttpApplication.ts:373-387` **und** `StartupTest.ts:2523-2548`
(sonst Root-Typecheck rot). `mcp/skill.md`: Werkzeug-Zähler 54 → 55 (prüft `lint:docs`), README-Abschnitt.
`/actions` hat kein Rate-Limit — die Drossel in `sendToUser` trägt das. Ohne Identität (Dev-Super-User) → `no_identity`.

### 5b. Kennel → auslösender Nutzer (Drain, PR 3)
- **Postausgang:** Dog-Code schreibt `jsonStore.set('@outbox:<id>', { title, body, url })`. Die jsonStore-Fabrik
  (`main.ts:102-143`) legt das unter dem Raum des auslösenden Nutzers ab und stempelt **serverseitig**
  `kennelLineageId` dazu (`ctx` aus `KennelRunHandler.ts:176-181` — für Dog-Code nicht fälschbar).
  Für `@outbox:` nur `set`; Zahl offener Einträge gedeckelt. Anonyme Läufe (`anon:`): verworfen.
- **Drain:** `services/KennelEventDrain.ts` (neu) nach `KennelCallCounter` (`services/KennelCallCounter.ts:240-311`,
  Start/Stop `main.ts:88, :240, :274-280, :307`). Timer mit `unref`, serialisierter Tick, Präfix-Abfrage statt
  Vollscan (`JsonStorageService.ts:64-76`), **Anspruch per Löschen** — beim Deploy laufen alter und neuer
  Prozess kurz parallel. Prüft Stummschaltung je Kennel, dann `sendToUser`.
- `JsonEntry` bleibt unverändert, keine Migration.

## 6. Phasen (je ein PR)

0. **Voraussetzung (Abschnitt 3):** Abschottung der Kennel-Seiten entschieden und umgesetzt.
1. **Durchstich:** Modelle, `NotificationService` mit Drossel und Allowlist, `/api/push/*`, Routentabelle,
   `sw.js` + Manifest + Icons, Account-Tab mit Aktivieren, iPhone-Anleitung, Geräteliste, Testknopf, Env.
   **Abnahme:** auf integration, Handy im Standby — Testknopf, es klingelt. Auf Android und iPhone.
2. **Agent klingelt:** `notify_me`, Schalter Agent-Nachrichten. **Abnahme:** eine Claude-Sitzung ruft das Tool, das Handy klingelt.
3. **Kennel-Drain:** Postausgang, Drain-Arbeiter, Stummschaltung je Kennel. **Abnahme:** ein Testkennel schreibt
   in den Postausgang, das Handy des auslösenden Nutzers klingelt; stummgeschaltet bleibt es still.

## 7. Env (Katalog `server-app/startupEnvCheck.ts` + beide `.env`-Beispiele)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_ENABLED` — Abschnitt features, nach `KEYSTORE_MASTER_KEY_V2`.
- Drain-Intervall — Abschnitt operations, nach `KENNEL_CALL_MAX_PENDING` (PR 3).
- Eine „recommended“-Regel lässt `testEnvCatalogWarnings` scheitern, bis `prodFull` (`StartupTest.ts:5767-5779`) die VAPID-Werte enthält.
- `VAPID_PRIVATE_KEY` ist ein Server-Geheimnis → Deploy-Checkliste, nie ins Repo.

## 8. Risiken und Prüfgrenzen
- **Abnahme nur auf integration am echten Gerät.** Lokal sieht der Dev-Super-User ohne Identität nur den Tab
  `beta` (`ui-app/src/app/utils/account.ts:15-17`); es gibt keinen `/auth`-Proxy. Deploy auf Wort.
- **Testschranke dünn:** StartupTest läuft nicht in `npm test` (nur dev oder `RUN_STARTUP_TESTS=1`); die UI hat
  keine Specs und ist nicht Teil von `npm test`; `sw.js` prüft niemand.
- **iPhone:** zuerst den Login in der Homescreen-App prüfen. Sitzungen liegen im MemoryStore und gehen bei jedem
  Neustart verloren — in der Homescreen-App heißt das: erneut anmelden.
- **Doppelversand** bei Deploy-Überlappung — durch Anspruch per Löschen abgefangen.
- Lokal vor `npm test`: `npm run prisma:sync` (generierter Client ist gitignored).

## 9. Quellen
Archon-Berichte vom 2026-10-05: Boreal (Server), Boreal (Client), Amar (Drain). Alle Datei:Zeile-Angaben dort belegt.
