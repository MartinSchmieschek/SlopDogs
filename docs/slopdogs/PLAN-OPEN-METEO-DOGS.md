# Plan: Open-Meteo vollstaendig als gecachte Base-Dogs, thematisch getrennt

**Stand 2026-11-23 12:20 — S1 + S2 gebaut und nachgemessen, uncommittet** (base-dogs `feature/sun-cache`; nach dem PC-Absturz um 11:38 unbeschaedigt geprueft). Hilfspaket `packages/openmeteo` (E2) und fuenf Themenpakete, je 0.3.0: dogs-solar (SolarRadiationRetriever, SolarRadiationHistoryRetriever, SatelliteRadiationRetriever, jetzt auf dem Hilfspaket), dogs-wind (WindProfileRetriever), dogs-soil (SoilRetriever, EvapotranspirationRetriever), dogs-snow (SnowRetriever), dogs-storm (ThunderstormRetriever; Stufe englisch `low/moderate/elevated/high/unknown` wie die uebrigen Dogs, vorher deutsch). Gemessen 12:09-12:18: Bau 58 Pakete, Repo-Tests 24/24, `eslint .` und `prettier --check .` sauber; Live-Abruf je Dog 8/8 (Paderborn, Schnee auf der Zugspitze, Archiv 20.06.2025), je Dog genau ein Abruf, zweiter Lauf 11 m daneben aus dem Cache. Offen: Commit in drei Stuecken (Fix / Feature / Versionen), Push, PR, Tags, Release (S4a); danach Server-Einbindung (S4b). S3 nicht beauftragt. 10-0 (23.11.): **kein dogs-climate, kein Neigungswinkel (GTI) bei Solar.** Repo der Dogs: `slopdogs-base-dogs` (lokal `~/Downloads/slopdogs-base-dogs`). Auftrag 10-0 (23.11.): „mehr gecachte Base-Dogs, die die Open-Meteo-Daten abrufen … die sollten wir alle nutzen“, „Hunde thematisch trennen“.

Erledigt vorab (Branch `feature/sun-cache`, uncommittet, Tests 12/12): Sun-Dog cacht; Weather, Water, Air-Quality cachen in 1-km-Zellen statt 200 m.

---

## 1. Bestand

| Paket | Dog | Open-Meteo-API | Variablen | Cache |
|---|---|---|---|---|
| dogs-weather | WeatherRetriever | forecast | current + hourly: Temperatur, gefuehlt, Feuchte, Wettercode, Wind 10 m, Regenwahrscheinlichkeit | 15 min |
| dogs-sun | SunRetriever | forecast | daily: Auf-/Untergang, Tageslaenge, Sonnenstunden, UV max | 1 h |
| dogs-astronomy | AstronomyRetriever | forecast | dieselben daily-Werte wie Sun + Mond (lokal gerechnet) | 1 h |
| dogs-historical-weather | HistoricalWeatherRetriever | archive | daily: Temperatur, Niederschlag, Schnee, Wind, Sonnenstunden | 6 h |
| dogs-water | WaterRetriever | marine | Wellen, Stroemung, Wassertemperatur | 15 min |
| dogs-air-quality | AirQualityRetriever | air-quality | AQI, Feinstaub, Gase, 6 Pollenarten | 30 min |
| dogs-geocoding | ElevationRetriever | elevation | Hoehe | — |

**Sonneneinstrahlung liefert kein Base-Dog.** Der Solar-Simulator (A039) holt GHI/DNI/DHI selbst im eigenen Dog und cacht in `jsonStore` — mit den bekannten Folgen (Cache je Namensraum, `anon:` von jedem oeffentlichen Kennel ueberschreibbar).

Ungenutzt: Einstrahlung, Wind in Hoehe, Boden, Verdunstung, Schnee und Frostgrenze, Gewitter-Kenngroessen, Druckflaechen, Satellit, Flusspegel, Klimaprojektion, Saison- und Ensemble-Vorhersage, Wolken in Schichten, Sicht, Luftdruck.

## 2. Schnitt: ein Paket je Thema, ein Dog je benennbarer Sache

| Paket (neu) | Dog | Was er liefert (ein Satz) | API | Cache |
|---|---|---|---|---|
| **dogs-solar** | `SolarRadiationRetriever` | stuendliche Einstrahlung GHI/DNI/DHI auf die Waagerechte fuer die naechsten Tage (ohne Neigung, 10-0) | forecast | 30 min |
| | `SolarRadiationHistoryRetriever` | stuendliche Einstrahlung + Temperatur + Wind eines vergangenen Zeitraums (Ertragsrechnung) | archive | 30 Tage (Vergangenheit aendert sich nicht; letzte 5 Tage 6 h) |
| | `SatelliteRadiationRetriever` | gemessene Einstrahlung der letzten Stunden aus Satellitendaten | satellite | 15 min |
| **dogs-wind** | `WindProfileRetriever` | Windgeschwindigkeit und -richtung in 10/80/120/180 m plus Boeen | forecast | 30 min |
| **dogs-soil** | `SoilRetriever` | Bodentemperatur und Bodenfeuchte in fuenf Tiefen | forecast | 1 h |
| | `EvapotranspirationRetriever` | Verdunstung ET₀, Dampfdruckdefizit, Niederschlag — Giessbedarf | forecast | 1 h |
| **dogs-storm** | `ThunderstormRetriever` | Gewitterneigung: CAPE, Lifted Index, CIN, Blitzpotenzial (15-min) | forecast | 15 min |
| **dogs-snow** | `SnowRetriever` | Schneehoehe, Neuschnee, Schneefallgrenze, Nullgradgrenze | forecast | 1 h |
| **dogs-atmosphere** | `PressureLevelRetriever` | Temperatur, Wind, Feuchte auf waehlbaren Druckflaechen (1000–30 hPa) | forecast | 1 h |
| | `CloudLayerRetriever` | Wolken tief/mittel/hoch, Sicht, Luftdruck | forecast | 30 min |
| **dogs-flood** | `RiverDischargeRetriever` | Abfluss des naechsten Flusses, Vorhersage und Vergleich zum Mittel | flood | 6 h |

Bestehende Pakete bleiben, wie sie sind. Doppelt sind Sun und Astronomy (gleicher Abruf) — zusammenlegen ist ein eigener Schritt, nicht Teil hiervon.

## 3. Gemeinsame Grundlage

- **Hilfscode zuerst im Paket:** in S1 teilen sich die drei Solar-Dogs ein internes Modul; ein eigenes Paket erst, wenn S2 denselben Code braucht (einfachste Loesung zuerst).
- **Hilfspaket `slopdogs-openmeteo`** (kein Dog, gebaut in S2, Peer der Themenpakete wie `geo-pact`): Abruf mit Timeout, User-Agent, Fehlertext; Cache-Schluessel (`geoBucketKey` mit `bucketM: 1000`, Variablensatz, Zeitraum); TTL-Konstanten je API; Quellenangabe. Heute hat jedes Paket seinen eigenen Abruf-Code — neue Pakete nutzen das Hilfspaket, die alten ziehen spaeter um.
- **Ein Abruf je Thema und Zelle:** jeder Dog fragt seinen festen Variablensatz und schneidet erst danach zu. Verschiedene Kennels mit verschiedenen Wuenschen teilen so denselben Eintrag.
- **Kontingent:** Open-Meteo zaehlt einen Abruf je Anfrage, mehr als 10 Variablen oder mehr als 2 Wochen Zeitraum zaehlen anteilig mehr (15 Variablen, 2 Wochen = 1,5). Variablensaetze je Dog darum bei hoechstens 10 halten. Frei: 600/min, 5.000/h, 10.000/Tag, 300.000/Monat — fuer alle Kennels auf der Render-IP zusammen.
- **Quellenangabe Pflicht (CC BY 4.0):** jedes Ergebnis traegt `source: "Open-Meteo.com (CC BY 4.0)"`.
- **Pacts:** je Dog ein Query-Pact wie bisher (`lat`, `lng` plus eigene Felder), damit Kennels die Parameter per MimicDog liefern.

## 4. Lizenz — vor dem Bau klaeren

Die freie API ist **nur fuer nicht-kommerzielle Nutzung**. Der kleinste Bezahlplan (Standard) schliesst Archiv und Satellit **nicht** ein (beide in dogs-solar), die gibt es erst ab Professional. Ob SlopDogs als oeffentlicher Dienst „nicht-kommerziell“ ist, entscheidet der 10-0 (E1).

## 5. Reihenfolge

| Schritt | Inhalt | Abnahme |
|---|---|---|
| S1 ✓ | Hilfspaket `slopdogs-openmeteo` + `dogs-solar` (alle drei Dogs) | Tests mit Attrappe; ein Live-Abruf je Dog; Solar-Simulator koennte von `jsonStore` auf `SolarRadiationHistoryRetriever` wechseln |
| S2 ✓ | `dogs-wind`, `dogs-soil`, `dogs-snow`, `dogs-storm` (nur forecast-API, gleiches Muster) | wie S1 |
| S3 | `dogs-atmosphere`, `dogs-flood` | wie S1 |
| S4a ✓ 23.11. | Release: 3 Commits (Fix mit Changesets / Feature / `version-packages`), PR nach `main`, nach Merge `changeset tag`, 10 Tags einzeln pushen (4 Patches 0.3.1: sun, weather, water, air-quality; 6 Erst-Releases 0.3.0: openmeteo, solar, wind, soil, snow, storm) | je Tag ein gruener `release`-Lauf, Tarball am GitHub-Release |
| S4b ✓ ohne Seed 23.11. (SlopDogs 1ef6fab, auch slim) | Server: neue Pakete per Tarball-URL (openmeteo als Peer wie geo-pact), `update:dogs`, Seed-Kennel je Thema als Beispiel | `list_nodes` zeigt die Dogs mit Beschreibung |

## Entscheidungen (offen, 10-0)

| # | Frage | Empfehlung |
|---|---|---|
| E1 | Lizenz: freie API weiter nutzen oder Bezahlplan | blockiert diesen Release nicht: das Archiv ruft `HistoricalWeatherRetriever` schon heute ab, der Satellit laeuft unter denselben freien Bedingungen. Bleibt eine Frage an die ganze Plattform |
| E2 | Hilfspaket ja/nein | ja — gebaut (S2) |
| E3 | Schnitt wie in Abschnitt 2 | fuer S1/S2 umgesetzt (10-0 23.11.: „3 ja … getrennt“) |
| E4 | Solar-Simulator auf `SolarRadiationHistoryRetriever` umstellen, sobald live | ja |

**Gestrichen 23.11. (10-0):** `dogs-climate` (Klimaprojektion, Saison, Ensemble) und der Neigungswinkel/GTI in dogs-solar. Neigung rechnet weiter der Solar-Simulator selbst aus GHI/DNI/DHI.
