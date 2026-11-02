// ESLint-Konfiguration des Servers und der Pakete (flat config, ESLint 10, typescript-eslint 8).
//
// Ausgangsliste: Der Bestand wird ueber ESLints eingebaute Bulk-Suppressions geduldet
// (eslint-suppressions.json, je Datei und Regel gezaehlt). Neue Verstoesse lassen `npm run lint`
// scheitern; wird ein geduldeter Verstoss behoben, scheitert der Lauf ebenfalls, bis die Liste mit
// `npx eslint . --prune-suppressions` verkleinert ist. So kann die Liste nur schrumpfen.
// Bestand neu aufnehmen (nur bewusst, z. B. nach einer neuen Regel): `npx eslint . --suppress-all`.
//
// Bewusst ohne type-checked Regeln (recommendedTypeChecked): die brauchen ein TypeScript-Programm
// ueber Server und alle Pakete. Das kostet ein Vielfaches an Laufzeit und Speicher (der Server-
// Typecheck allein laeuft schon mit erhoehtem Heap) und gehoert in einen eigenen Schritt, wenn die
// Ausgangsliste kleiner ist.
import { fileURLToPath } from 'node:url';
import { defineConfig, globalIgnores, includeIgnoreFile } from 'eslint/config';
import tseslint from 'typescript-eslint';

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url));

export default defineConfig(
    // Alles, was git nicht kennt, ist auch fuer ESLint kein Quelltext: dist/, store/generated/,
    // veraltete tsc-Ausgaben (.js neben .ts), lokale Datenbanken, Editor-Ordner.
    includeIgnoreFile(gitignorePath, 'slopdogs/gitignore'),
    globalIgnores(
        [
            // ui-app hat eine eigene Toolchain (Angular 18, eigene package.json, Lockfile, tsconfig
            // und .editorconfig). Ihr Lint gehoert zu angular-eslint in ui-app, als eigener Schritt.
            'ui-app/',
            // Doku, Archiv-Skins und die gebaute Landing (public/landing wird aus seed-data gerendert).
            'docs/',
            'public/',
            'deploy/',
            // Build-Ausgaben und Generiertes, auch falls es einmal nicht in .gitignore steht.
            '**/dist/',
            'store/generated/',
            '**/*.d.ts',
            '**/*.tsbuildinfo',
        ],
        'slopdogs/ignores',
    ),
    {
        name: 'slopdogs/linter-options',
        linterOptions: {
            // Jeder eslint-disable-Kommentar muss einen echten Treffer einer existierenden Regel
            // unterdruecken. Ungenutzte Kommentare sind Fehler und lassen sich nicht wegduldet.
            reportUnusedDisableDirectives: 'error',
        },
    },
    {
        name: 'slopdogs/typescript',
        files: ['**/*.{ts,mts,cts,js,cjs,mjs}'],
        extends: [tseslint.configs.recommended],
    },
    {
        // Node-Skripte als CommonJS (scripts/*.cjs, mcp/integration/*.cjs): require ist dort die
        // Modulsyntax und kein Verstoss.
        name: 'slopdogs/commonjs',
        files: ['**/*.cjs'],
        languageOptions: { sourceType: 'commonjs' },
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    },
    {
        // Dog-Rumpfe der Landing (theRun als Quelltext, ES5 fuer den Browser): kein Modul, sondern
        // ein Funktionsrumpf mit `return` auf oberster Ebene.
        name: 'slopdogs/dog-bodies',
        files: ['seed-data/kennels/**/*.js'],
        languageOptions: {
            sourceType: 'script',
            parserOptions: { ecmaFeatures: { globalReturn: true } },
        },
    },
);
