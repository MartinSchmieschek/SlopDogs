// ESLint-Konfiguration von slopdogs-base-dogs — Kopie der Server-Konfiguration (PLAN-DOG-PAKETE P3.1, kein
// eigenes Konfigurationspaket), gemeinsam fuer alle Pakete unter packages/. Gleiche Versionen wie im Server.
//
// Ausgangsliste: der Bestand aus dem Monorepo wird ueber eslint-suppressions.json geduldet (beim Schnitt aus
// der Server-Liste uebernommen). Neue Verstoesse lassen `npm run lint` scheitern; ein behobener Verstoss
// ebenfalls, bis die Liste mit `npm run lint:prune` verkleinert ist.
import { fileURLToPath } from 'node:url';
import { defineConfig, globalIgnores, includeIgnoreFile } from 'eslint/config';
import tseslint from 'typescript-eslint';

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url));

export default defineConfig(
    includeIgnoreFile(gitignorePath, 'slopdogs-base-dogs/gitignore'),
    globalIgnores(['**/dist/', '.test-build/', '**/*.d.ts', '**/*.tsbuildinfo'], 'slopdogs-base-dogs/ignores'),
    {
        name: 'slopdogs-base-dogs/linter-options',
        linterOptions: { reportUnusedDisableDirectives: 'error' },
    },
    {
        name: 'slopdogs-base-dogs/typescript',
        files: ['**/*.{ts,mts,cts,js,cjs,mjs}'],
        extends: [tseslint.configs.recommended],
    },
    {
        name: 'slopdogs-base-dogs/commonjs',
        files: ['**/*.cjs'],
        languageOptions: { sourceType: 'commonjs' },
        rules: { '@typescript-eslint/no-require-imports': 'off' },
    },
    {
        // P2.3: Dog-Pakete kennen von core nur den Vertrag (Haupteinstieg). Die Laufzeit (`/runtime`: Sandbox,
        // Gate, Kennel-Lauf, Plattform-Dogs) ist Server-Sache; nur die Paket-Tests unter test/ duerfen sie nutzen.
        name: 'slopdogs-base-dogs/contract-only',
        files: ['packages/**/*.{ts,mts,cts,js,cjs,mjs}'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['@martinschmieschek/slopdogs-core/*'],
                            message:
                                'Dog-Pakete importieren nur den Vertrag @martinschmieschek/slopdogs-core (PLAN-DOG-PAKETE P2.3); /runtime gehoert dem Server.',
                        },
                    ],
                },
            ],
        },
    },
);
