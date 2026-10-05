# Plan: Web-Push-Benachrichtigungen aufs Handy

Status: **Entwurf / Planung** — noch kein Code. Eigener Branch `plan/web-push-notifications`.

## 1. Ziel

Der Besitzer bekommt eine Nachricht auf sein Handy, **auch wenn das Handy im
Standby ist und keine Website offen ist**. Auslöser:

1. **Der Agent meldet sich selbst** (Haupt-Trigger): wenn er eine **Frage** hat
   oder **fertig** ist. Nicht automatisch bei jedem `save_node`/`build_kennel` —
   der Agent entscheidet bewusst, wann er klingelt.
2. **Ein Kennel-Event** (z. B. dogdoc: „ein User hat das Dokument gelesen") —
   **nur über einen Umweg**, nie als direktes Push-Primitive im Dog-Code.

## 2. Das Standby-Problem — und warum Web Push es löst

Zustellung darf **nicht** an der offenen Website hängen (offener Tab, WebSocket-
Lobby, Presence — das stirbt beim Tab-Schließen / Standby).

Bei Web Push hängt sie das auch nicht: Ein **Service Worker** wird einmal
registriert; danach weckt ihn der **OS-Push-Dienst** (FCM auf Android, APNs auf
iOS/macOS) über den jeweiligen Browser-Push-Endpoint — unabhängig davon, ob ein
Tab offen ist oder das Gerät schläft. Genau dafür gibt es Service Worker + Push
API. Kein Fremd-App nötig, alles selbst gehostet (eigene VAPID-Keys).

**Preis (bewusst gewählt, siehe Transport-Entscheidung):** Die UI muss zur PWA
werden (Service Worker + Manifest — fehlt heute), und **iOS liefert Web Push nur
für eine zum Homescreen hinzugefügte PWA**. Das ist der teuerste Posten des
Plans und steht als Risiko unten.

## 3. Architektur-Prinzip (hart)

**SlopDogs selbst besitzt die Benachrichtigung.** Plattform-eigen sind:

- die VAPID-Keys (Server-Geheimnis),
- der Service Worker + das Manifest (Client),
- die Speicherung der Push-Subscriptions pro User/Gerät,
- der Versand (`web-push` mit VAPID → Browser-Push-Endpoint).

**Kennels bekommen KEIN direktes Push-Primitive.** Kein `notify`-VM-Global, kein
gesegneter `fetch` auf einen Push-Dienst. Ein Kennel kann eine Benachrichtigung
höchstens **indirekt** anstoßen (Abschnitt 5c) — und das ist eine noch zu
bestätigende Design-Entscheidung, kein Freifahrtschein.

## 4. Komponenten

### 4a. Server — `NotificationService`
Ein einziger interner Dienst mit **einer** Kernmethode:

```
NotificationService.sendToUser(userId, { title, body, url?, kind? })
  → lädt alle PushSubscriptions des Users
  → sendet je Subscription via web-push (VAPID)
  → räumt abgelaufene/410-Subscriptions auf
```

Alle Auslöser (Agent-Tool, Server-intern, Kennel-Umweg) sind nur **Aufrufer**
dieser Methode. Sie ist die einzige Stelle, die VAPID und Endpoints kennt.

### 4b. Datenbank — neues Modell `PushSubscription`
Hängt am `User` (heute: `id, googleSub, email, name, picture, createdAt,
updatedAt` in `store/prisma-auth/schema.prisma`):

```
model PushSubscription {
  id        String   @id @default(uuid())
  userId    String
  endpoint  String   @unique      // der Browser-Push-Endpoint
  p256dh    String                // Public Key der Subscription
  auth      String                // Auth-Secret der Subscription
  ua        String?               // User-Agent, damit der User Geräte erkennt
  createdAt DateTime @default(now())
  lastUsedAt DateTime?
  // user   User   @relation(...)  // Relation wie bei AccessToken
}
```

**⚠ Schema-Duplikat-Falle** (siehe `reference_*`/PAT-Lektion): Prod teilt EINE
Postgres-DB zwischen Content- und Auth-Schema; der Deploy pusht das
**Content-Schema autoritativ** (`prisma db push --accept-data-loss`). Bei der
PAT-Arbeit hat das auth-only **Spalten** einer geteilten Tabelle gestrippt.
Offene Frage für ein **komplett neues, nur im Auth-Schema existierendes** Modell:
Lässt der Content-Push eine ihm unbekannte Tabelle in Ruhe, oder droppt er sie?
→ **Vor Bau verifizieren.** Falls er sie anfasst: `PushSubscription` in **beide**
Schemas spiegeln (wie AccessToken), sonst ist sie nach jedem Deploy weg.

### 4c. Client — PWA + Service Worker
- `manifest.webmanifest` + Icons (für „zum Homescreen hinzufügen", iOS-Pflicht).
- `sw.js` (bzw. Angular `ngsw` + Push-Handler): empfängt `push`-Event → zeigt
  die Notification; `notificationclick` → öffnet die mitgelieferte `url`
  (Deep-Link in den fertigen Kennel / das dogdoc).
- **Der Server muss den Service Worker am Site-Root ausliefern** (Scope = `/`),
  mit korrektem Content-Type und ohne aggressives Caching. Heute wird Angular in
  prod/integration aus `angularBrowserDir` serviert
  (`server-app/createHttpApplication.ts:105‑106`), Statisches unter `/static`
  (`:213`). → Eine Route für `/<sw>.js` und das Manifest am Root ergänzen.

### 4d. UI — Account-Seite
In `ui-app/src/app/pages/account/` (existiert):
- „Benachrichtigungen auf diesem Gerät aktivieren" → fragt die Browser-
  Permission, legt via `PushManager.subscribe({ applicationServerKey: VAPID_PUB })`
  eine Subscription an, schickt sie an einen neuen Endpoint `POST /api/push/subscribe`.
- Geräteliste (aus `PushSubscription.ua/createdAt`) mit „Gerät entfernen".
- „Test-Benachrichtigung senden"-Knopf (Selbsttest).

## 5. Die Auslöser-Oberflächen

### 5a. Agent → Besitzer (Haupt-Trigger, neues MCP-Tool)
Ein neues MCP-Tool, Muster wie die vorhandenen in `mcp/tools/*.ts`
(`name` + `handler: async (args, ctx, deps) => …`, `ctx.user?.id` liegt an —
vgl. `mcp/tools/kennels.ts:212‑216`):

```
name: 'notify_me'   (Arbeitstitel)
args: { kind: 'question' | 'done' | 'info', title, message, url? }
handler: → NotificationService.sendToUser(ctx.user.id, …)
```

Der Agent ruft es bewusst: „Ich habe eine Frage" / „Ich bin fertig". Es pusht an
**das Konto des Aufrufers** (der Agent baut unter dem PAT des Besitzers →
`ctx.user.id` ist der Besitzer). Anonyme Aufrufe → Fehler/no-op.
Doku reist mit dem Tool mit, damit der MCP es von selbst ankündigt.

### 5b. Server-intern (optional, bewusst sparsam)
`NotificationService` kann serverseitig auch bei echten Plattform-Ereignissen
feuern. **Aber:** laut Vorgabe **kein** Auto-Push an jedem `build_kennel`/
`save_node`. Diese Verdrahtung bleibt vorerst leer; der Agent über 5a ist der
Weg. (Hook-Punkte existieren falls später gewünscht: `build_kennel` in
`mcp/tools/kennels.ts`, Run-Abschluss `onDogRun` in
`api/routes/KennelRunHandler.ts:201`.)

### 5c. Kennel-Event → Besitzer (nur Umweg, zu bestätigen)
Für „ein User hat das dogdoc gelesen": Der dogdoc-`DocTrackSink` (ein **Kennel**
auf der Instanz, nicht Plattform-Code) bucht eine Sitzung als „gelesen"
(≥30 s + 40 % Tiefe). Der Dog-Code darf **nicht** direkt pushen.

Umweg-Varianten (eine davon wählen):
- **(i) Blessed interner Endpoint:** Die Plattform stellt `POST /api/push/from-kennel`
  bereit, das **ausschließlich** an den **Besitzer des aufrufenden Kennels**
  pusht (Rate-limitiert, Owner aus dem Kennel-Kontext, kein frei wählbarer
  Empfänger). Der Sink-Dog ruft diesen einen Endpoint.
- **(ii) Drain-Modell:** Der Sink schreibt „gelesen"-Events wie bisher in seine
  Ablage; ein plattformseitiger Drain (Cron/Worker) macht daraus Pushes an den
  Owner. Entkoppelt, aber mehr bewegliche Teile.

Empfehlung: **(i)** — ein enger, besitzergebundener Endpoint ist der
kontrollierte „Umweg", den die Vorgabe meint, ohne ein allgemeines Kennel-Push-
Primitive zu öffnen. **Zu bestätigen vor Bau.**

## 6. Phasen (je eigener PR)

1. **Fundament (Server):** VAPID-Keys/Env, `PushSubscription`-Modell (+ Schema-
   Duplikat-Frage klären), `NotificationService.sendToUser`, Endpoints
   `POST/DELETE /api/push/subscribe`. Ohne Client testbar per curl + web-push.
2. **PWA/Client:** Manifest + Service Worker am Root ausliefern, Account-Seite
   (aktivieren / Geräteliste / Testknopf). Erster echter Push aufs Handy.
3. **Agent-Tool:** `notify_me` MCP-Tool (5a). Das ist der eigentliche Nutzen —
   Agent klingelt bei Frage/fertig.
4. **Kennel-Umweg (5c):** erst nach Bestätigung der Variante. dogdoc-Sink
   anpassen, dass er den blessed Endpoint ruft.

## 7. Offene Entscheidungen / Risiken

- **iOS:** Web Push nur für zum Homescreen hinzugefügte PWA. Onboarding muss das
  erklären, sonst „geht nicht auf dem iPhone". Größtes UX-Risiko.
- **Schema-Duplikat** (4b): vor Bau klären, ob der Content-Push die neue Tabelle
  droppt. Sonst nach jedem Deploy weg.
- **Service-Worker-Scope/Headers** (4c): muss vom Root mit richtigem MIME +
  Cache-Control kommen, sonst registriert er nicht oder bleibt alt stehen.
- **Subscription-Lifecycle:** Endpoints laufen ab / liefern 410 → beim Versand
  aufräumen, sonst tote Einträge.
- **VAPID-Privatkey** ist ein Server-Geheimnis → in die Keystore-/Env-Checkliste
  (`reference_slopdogs_deploy_env`), nie ins Repo.
- **Env-Katalog:** neue Vars (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT`, `PUSH_ENABLED`) in `server-app/startupEnvCheck.ts` + beide
  `.env.example` (Konsistenz-Test im StartupTest).

## 8. Anker (verifiziert)

- VM-Capability-Muster (bewusst NICHT für Push genutzt): `registerVmGlobalCapability`
  in `main.ts:102` (`jsonStore`).
- MCP-Tool-Muster + `ctx.user.id`: `mcp/tools/kennels.ts:212‑216`, `:352`;
  weitere Tools in `mcp/tools/*.ts`.
- UI-Auslieferung / SW-Scope: `server-app/createHttpApplication.ts:105‑106`, `:213`.
- Account-Seite: `ui-app/src/app/pages/account/`.
- User-Modell: `store/prisma-auth/schema.prisma` (model User).
- Server-Event-Hooks (für später, 5b): `mcp/tools/kennels.ts` (`build_kennel`),
  `api/routes/KennelRunHandler.ts:201` (`onDogRun`).
- Heute **keine** Push/Webhook/VAPID/Service-Worker-Infra im Repo — grüne Wiese.
