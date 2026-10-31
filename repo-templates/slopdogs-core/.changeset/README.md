# Changesets (slopdogs-core)

Ein Repo, ein Paket fuer Changesets: `@martinschmieschek/slopdogs-core` im Wurzelverzeichnis. Das Typ-Werkzeug
`@martinschmieschek/slopdogs-typedefs` (Ordner `typedefs/`) reist mit derselben Version — `npm run version-packages`
zieht es nach.

1. Mit jeder Aenderung: `npx changeset` (patch/minor/major; solange 0.x: Bruch des Vertrags = minor, siehe README).
2. Release vorbereiten: `npm run version-packages` (Version, CHANGELOG, typedefs-Version), committen.
3. Tag: `npx changeset tag` legt `v<version>` an (Ein-Paket-Repo). Der Push des Tags startet `.github/workflows/release.yml`.
