// ESLint-Konfiguration von slopdogs-core — Kopie der Server-Konfiguration (PLAN-DOG-PAKETE P3.1, kein eigenes
// Konfigurationspaket), auf dieses Repo zugeschnitten: core samt Laufzeit unter src/, das Typ-Werkzeug unter
// typedefs/, Paket-Tests unter test/. Gleiche Versionen wie im Server (eslint 10, typescript-eslint 8).
//
// Ausgangsliste: der Bestand aus dem Monorepo wird ueber eslint-suppressions.json geduldet (beim Schnitt aus
// der Server-Liste uebernommen). Neue Verstoesse lassen `npm run lint` scheitern; ein behobener Verstoss
// ebenfalls, bis die Liste mit `npm run lint:prune` verkleinert ist.
import { fileURLToPath } from 'node:url';
import { defineConfig, globalIgnores, includeIgnoreFile } from 'eslint/config';
import tseslint from 'typescript-eslint';

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url));

export default defineConfig(
    includeIgnoreFile(gitignorePath, 'slopdogs-core/gitignore'),
    globalIgnores(['**/dist/', '.test-build/', '**/*.d.ts', '**/*.tsbuildinfo'], 'slopdogs-core/ignores'),
    {
        name: 'slopdogs-core/linter-options',
        linterOptions: { reportUnusedDisableDirectives: 'error' },
    },
    {
        name: 'slopdogs-core/typescript',
        files: ['**/*.{ts,mts,cts,js,cjs,mjs}'],
        extends: [tseslint.configs.recommended],
    },
    {
        name: 'slopdogs-core/commonjs',
        files: ['**/*.cjs'],
        languageOptions: { sourceType: 'commonjs' },
        rules: { '@typescript-eslint/no-require-imports': 'off' },
    },
);
