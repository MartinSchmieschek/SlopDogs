# Plan: Kennel-Shell

**Stand 2026-11-09:** Nur Entscheidungen, es gibt keinen Code und keine Messung.
**Reihenfolge (10-0):** Das ist der nächste Schritt **nach** dem Deploy von 0.3.0 auf Render, also nach den eigenen Seiten und der Härtung.
**Nächster Schritt danach:** Amar misst die Tragfähigkeit (M1, M2). Danach Aufklärung durch Boreal, dann der Plan im Detail.

Der Fahrplan mit Reihenfolge und Abnahmen steht in `PLAN-NACH-DEPLOY.md`. Diese Datei ist der Detail-Plan der Shell.

Herkunft: `PLAN-VIDEO.md`. Die Kamera ist unter der `/k/`-Sandbox gesperrt (gemessen 06.11.), und eine zweite Domain kommt vorerst nicht (10-0, 09.11.).

## Idee

Jede Kennel-Seite, die ein Mensch im Browser öffnet, läuft in einer **Shell**.
- Die Shell ist fester Plattform-Code auf der Haupt-Adresse und läuft mit Login.
- Der Kennel steckt darin als iframe, mit der Sandbox wie heute: ohne Login und ohne Adresse.
- Was einen Login oder eine Browser-Erlaubnis braucht, erledigt die Shell für den Kennel, je Kennel und mit Zustimmung des Nutzers. Der Kennel fragt per `postMessage`.

Nicht betroffen sind Abrufe per `?format=json`, MCP und `/execute`.

## Entschieden

- **S1 (10-0):** Die Shell kommt nach dem Render-Deploy.
- **S2 (10-0):** Die Shell zeigt selbst die Nutzer- und Login-Dinge: wer eingeloggt ist, Anmelden und Abmelden, das Konto. Der Kennel sieht davon nichts.
- **S3 (10-0):** Es gibt unterschiedliche Shells. Dogs setzen eine Shell-Konfiguration voraus, z. B. „benötigt Kamera“ oder „benötigt User-Login“.
- **S4 (Lotus, zu S3):** Es gibt **eine** Shell-Implementierung mit Fähigkeiten statt mehrerer Shell-Codebasen. Die „unterschiedlichen Shells“ sind Konfigurationen dieser einen Shell.
  - Ein Dog deklariert seine Anforderungen statisch an der Klasse, wie `mcpGuidance`, z. B. `shellRequires: ['camera', 'login']`.
  - Die Shell-Konfiguration eines Kennels ist die Vereinigung der Anforderungen aller seiner Dogs. Der Server ermittelt sie beim Ausliefern.
  - **Eine Anforderung gewährt nichts**, sie fordert nur an:
    - „Kamera“ heißt, die Shell bietet die Kamera an. Einschalten nur per Klick im Rahmen und mit Zustimmung des Nutzers, je Kennel.
    - „Login“ heißt, die Shell verlangt die Anmeldung, bevor der Kennel lädt. Der Kennel läuft dann serverseitig als der Nutzer wie heute. Im Browser bekommt er den Login trotzdem nie.
- **S5 (Lotus):** Die Umstellung kommt in zwei Schritten:
  1. Zuerst die Shell nur für Kennels, deren Dogs eine Fähigkeit fordern.
  2. Sie wird Standard für alle, sobald die bestehenden Kennels darin nachweislich laufen (zum Beispiel Zombie Hunter, KI-Früchte, dogdoc).
- **S6 Sicherheitsregeln (Lotus):**
  - Die Shell zeigt nie Inhalt aus dem Kennel außerhalb des iframes an.
  - Jede Nachricht aus dem iframe wird geprüft (`event.source` gegen das eigene iframe, feste Nachrichtenarten).
  - Eine laufende Kamera zeigt die Shell mit einer Anzeige, die der Kennel nicht verdecken kann.
  - Nira prüft die Shell vor dem Deploy.

## Messen vor dem Bau

- **M1:** Erbt ein iframe in einer Seite mit CSP-Sandbox die Sandbox? Das ist die Gegenprobe zur Variante „gepflegter Kennel im Nutzer-Kennel“.
- **M2:** Kommt das Kamerabild aus der Shell im Kennel an, der als Sandbox-iframe läuft, per lokaler WebRTC-Verbindung und `postMessage`?

## Offen (für den Detail-Plan)

- **Durchreichen ans iframe:** Höhe, Scrollen, Vollbild (`allow="fullscreen"`), Zurück-Taste, Titel, Deep-Links und Link-Vorschau.
- **Fähigkeiten:** Welche gibt es außer Kamera und Login? Kandidaten: Mikrofon, Bildschirm, Speicher je Kennel, Benachrichtigungen.
- **Gedächtnis der Zustimmung:** Wo merkt sich die Shell die Zustimmung je Nutzer und Kennel (DB oder Browser)?
- **Gepflegte Kennels** wie Landing und Liste: mit Shell oder ohne?
- **Lokaler Modus:** Ohne HTTPS gibt es im LAN keine Kamera.
