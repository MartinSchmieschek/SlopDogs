# Changesets (slopdogs-base-dogs)

Jedes Paket unter `packages/` hat eine eigene Version und ein eigenes Release (PLAN-DOG-PAKETE P3.2). Nur
geaenderte Pakete bekommen ein Release.

1. Mit jeder Aenderung: `npx changeset` und die betroffenen Pakete waehlen.
2. Release vorbereiten: `npm run version-packages` (Versionen, CHANGELOGs, interne Bereiche), committen.
3. Tags: `npx changeset tag` legt `<paket>@<version>` an, z. B. `@martinschmieschek/slopdogs-dogs-weather@0.3.1`.
   Jeder Tag startet `.github/workflows/release.yml` fuer genau dieses Paket. GitHub startet bei mehr als drei
   Tags in einem Push keinen Workflow — Tags einzeln pushen (`git push origin <tag>`).

Peers: `geo-pact` und `dogs-demo` sind Peers ihrer Abhaengigen (F1). Mit `onlyUpdatePeerDependentsWhenOutOfRange`
zieht ein Release von ihnen die Abhaengigen nur nach, wenn deren Peer-Bereich die neue Version nicht mehr abdeckt.
