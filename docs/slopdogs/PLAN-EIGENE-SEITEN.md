# Plan: Eigene Seiten je Nutzer (Landing und Liste)

**Stand 2026-11-04 11:40:** Umgesetzt (Void, nur lokal geändert, kein Commit) auf `feature/server-schnitt` über 4cea224: die Härtung (Kopfversion, gepflegte IDs legt nur ein Maintainer an) und das Feature (Tabelle `UserPage`, `services/MyPagesService.ts`, Glied `server-app/MyPagesRedirect.ts` vor `/` und `/kennels`, `GET /api/kennel-list` mit `source`, `GET`/`PUT /api/my-pages`, MCP `get_my_pages`/`set_my_pages`, `/account` „Your pages", Doku). Gemessen nacheinander: `npm test` 0, `npm run test:startup` 34/34 (26 alte, 2 Härtung, 6 eigene Seiten), `npm run build:prod` 0, `npm run build:local` 0. Lotus hat danach selbst nachgemessen (11:47), mit demselben Ergebnis: test 0, startup 34/34, build prod 0, build local 0. E3 und E6 sind an die Umsetzung angeglichen.
**Offen:** Sichttest von `/account` und der Umleitung im Browser (10-0, `npm run start:local`); vor dem Deploy der Schema-Push (siehe Messung, letzter Punkt).
**Nächster Schritt:** Lotus misst nach und zeigt dem 10-0 den Diff (Härtung und Feature als getrennte Commits schneidbar), danach testet der 10-0 lokal. Kein Commit ohne sein Wort.

## Auftrag (10-0, 2026-11-04)

> ein user kann sich auch selber eine liste und landing page machen was in seinen userdaten steht

> wer eingeloggt ist sieht seine eigene pages und wer nicht eigeloggt ist die default pages. wenn er nichts eingestellt hat in seinen settings dann sieht er default

## Entschieden

- **E1 Verhalten (10-0):**
  - Eingeloggt mit Einstellung: Der Nutzer sieht seine Landing unter `/` und seine Liste unter `/kennels`.
  - Eingeloggt ohne Einstellung oder nicht eingeloggt: Die Default-Seiten bleiben wie heute (Rotation `LANDING_KENNEL_IDS`, `slopdogs-landing`, `slopdogs-kennels`).
- **E2 Weg (Lotus):** `/` und `/kennels` leiten auf `/k/<lineageId>` um (302). Die Seite wird nicht unter `/` ausgeliefert.
  - Grund: Unter `/` brechen pfadabhängige Dinge. Lobby-Teilen-Links (`location.pathname`) zeigen dann auf die `/`-Seite des Empfängers, also auf einen anderen Kennel. Formulare ohne `action`, relative Links und der Selbstabruf `?format=json` brechen ebenfalls.
  - Zusätzlich bliebe nur so die Entscheidung über Sandbox und Vertrauen an einer Stelle (`/k/`). Die Seite läuft dort als der Nutzer, mit denselben Rechten, derselben Sandbox und derselben Zulassung wie jeder `/k/`-Aufruf.
- **E3 Wählbar:** jeder Kennel, den der Nutzer sehen darf (`accessOf ≠ none`): eigene, geteilte und öffentliche.
  - Gespeichert wird die lineageId, beim Speichern aufgelöst. Eine Versions-GUID wird angenommen, auf ihre Lineage aufgelöst und als lineageId gespeichert; geprüft wird die Kopfversion.
  - Vor jeder Umleitung prüft der Server neu. Ist der Kennel gelöscht oder nicht mehr sichtbar, kommt still die Default-Seite.
- **E4 `?landing=<id>`** erzwingt weiter eine Landing aus der Rotation. Die Einstellung greift dann nicht, denn die ausdrückliche Anfrage gewinnt.
- **E5 Lokaler Modus:** Alle Geräte im LAN sind derselbe Nutzer `local`. Seine Einstellung wirkt also für die ganze Instanz, und die UI sagt das so. Im Dev-Super-User-Modus (ohne `MCP_AUTH_REQUIRED`) greift das Feature nicht, weil es keine Nutzer-ID gibt.
- **E6 Cache:**
  - `/` und `/kennels` senden immer `Vary: Cookie`.
  - Jede Antwort an einen eingeloggten Nutzer (Umleitung oder Default) geht mit `Cache-Control: private, no-cache` raus. Sonst sieht er nach dem Speichern oder nach dem Login bis zu fünf Minuten lang die alte Seite.
  - Anonym bleibt es wie heute.
- **E7 Härtung vorab:** zwei Punkte am Vertrauensweg. Sie stehen als eigener Commit vor dem Feature, mit neutralem Text. Die Beschreibung liegt außerhalb des Repos.
- **E8 Version:** Das Feature kommt in 0.3.0 (noch ungepusht), mit einer Zeile im CHANGELOG.

- **E9 Umfang der eigenen Seiten (10-0, 2026-11-04):**
  > so wie jede liste auch, so wie der user es sich selber aufbaut, nur enfach das jeder user sich selbst eine bauen kann
  - Eine eigene Landing oder Liste ist ein normaler Kennel. Sie kann genau das, was ihr Kennel unter `/k/` kann, ohne Sonderrechte und ohne neue Vertrauensregel.
  - Nicht gepflegte Kennels laufen in der Sandbox. Im Browser sehen sie deshalb keine persönlichen Daten wie Favoriten oder private Kennels. Das gilt für jede `/k/`-Seite genauso.

- **E10 Speicher (Lotus):** eine eigene Store-Tabelle `UserPage` (`userId`, `kind` = `landing` | `list`, `lineageId`, `updatedAt`; Schlüssel `userId` + `kind`). Sie steht in `store/prisma/schema.prisma` und `schema.postgres.prisma` und folgt dem Muster `KennelFavorite`.
  - Keine Spalten am User. Dessen Block steht an vier Orten, und der Login-`upsert` liest alle Spalten. Fehlte eine Spalte vor dem Push, schlüge jeder Google-Login mit 500 fehl (Präzedenz 47b9e82 → 4ece12d).
  - Fehlt die Tabelle, fällt nur das Feature aus: Lesen ergibt „keine Einstellung", Schreiben ergibt 503, ein Kennel lässt sich trotzdem löschen.
  - Wird ein Kennel gelöscht, verschwinden die Einträge, die auf ihn zeigen.
- **E11 Oberflächen (Lotus):**
  - REST `GET`/`PUT /api/my-pages`. PUT nutzt bei Sitzungsanfragen dieselbe Same-Origin-Prüfung wie `/auth/tokens`.
  - MCP-Werkzeuge `get_my_pages` und `set_my_pages`.
  - In Angular ein Abschnitt „Your pages" im Profil-Tab von `/account`.
  - Ein ⋯-Menü-Eintrag kommt nicht in diesen Auftrag.
- **E12 Ohne Lauf:** Die Umleitung prüft nur Einstellung, Kennel, Rechte und ob der Kennel Dogs hat. Laufen lässt den Kennel erst `/k/` mit seiner Zulassung. HEAD und GET verhalten sich gleich.
- **E13 Void allein:** Die Umsetzung bekommt ein einzelner Void, kein Team. Der RAM ist knapp, also wird nacheinander gemessen und nie parallel gebaut.

## Nebenbefunde (nicht im Auftrag)

- HEAD `/kennels` vor dem ersten GET (kaltes Memo) endet nicht in 404. Express 5 reicht das HEAD an die GET-Route weiter, und die lässt den Kennel einmal laufen (Void, aus dem Router-Code abgeleitet, nicht gemessen). Wer eine eigene Liste gesetzt hat, ist nicht betroffen, weil das Glied schon auf der HEAD-Route mit 302 antwortet.
- Unter `/k/` ersetzt der Server ‹stage› nicht, deshalb bleibt `data-stage` dort leer bzw. als Platzhalter stehen.

## Umfang (so beauftragt)

0. **Härtung (eigener Commit, zuerst):** zwei Punkte am Vertrauensweg gepflegter Kennels. Die Beschreibung liegt im Tresor, nicht im Repo.
1. **Speicher und Dienst:**
   - Tabelle `UserPage` (E10) und ein gemeinsamer Dienst für REST, MCP, Umleitung und Listen-Status.
   - Prüfung beim Speichern: Kennel auflösen, Nutzer darf ihn sehen (`accessOf ≠ none`), der Kennel hat Dogs. Gespeichert wird die lineageId der Kopfversion.
2. **Setzen:** `GET`/`PUT /api/my-pages` mit `{ landing, list }`, wobei `null` zurücksetzt. Dazu die MCP-Werkzeuge `get_my_pages`/`set_my_pages` und in `/account` (Profil-Tab) der Abschnitt „Your pages".
3. **Umleiten:**
   - GET und HEAD auf `/` bzw. `/kennels` laufen über ein Glied vor den heutigen Handlern, auf derselben Registrierung.
   - Eingeloggt, gesetzt und gültig ergibt 302 auf `/k/<lineageId>`, die Query geht mit. In jedem anderen Fall geht die Anfrage weiter an den heutigen Default.
   - Gibt es `?landing=<id>` aus der Rotation, greift die Einstellung nicht.
4. **Cache:**
   - `/` und `/kennels` senden immer `Vary: Cookie`.
   - Eingeloggte Anfragen bekommen `Cache-Control: private, no-cache`, auch die Default-Seite und die Umleitung.
   - Anonym bleibt es wie heute.
5. **`/api/kennel-list`** entscheidet je Anfrage und liefert `source: user | default` mit. Angular verwirft den 30-s-Cache nach dem Logout und nach dem Speichern.
6. **Tests:** StartupTests für:
   - anonym, eingeloggt ohne Einstellung, eingeloggt mit Einstellung;
   - gelöschte oder unsichtbare Kennels, `?landing=`, HEAD ohne Lauf, Kopfzeilen über HTTP;
   - REST- und MCP-Rundlauf, Aufräumen beim Löschen;
   - die Härtung in einer eigenen Testklasse.
7. **Doku:** README (Landing, App routes, API), CHANGELOG 0.3.0, AISkill.md, `mcp/skill.md` (Werkzeugzahl 54 → 56), `docs/slopdogs/PLAN.md` (P5 und Routentabelle), ARCHITECTURE.md:80/84, dazu diese Datei.

## Messung (Abnahme)

- `npm test`, `npm run test:startup`, `npm run build:prod` und `npm run build:local` laufen nacheinander und müssen grün sein.
- Ein Abnahmeskript gibt es im Repo nicht. Das alte (26/27) liegt außerhalb.
- Der 10-0 testet lokal mit `npm run start:local`. Im lokalen Modus ist er der Nutzer `local`, die Einstellung gilt dort also für alle.
- Vor dem Deploy prüfen: Führt der Render-Build-Befehl den Schema-Push aus (`render:integration:build`)? Ohne Push fehlt die Tabelle, dann fällt das Feature still aus (E10).
