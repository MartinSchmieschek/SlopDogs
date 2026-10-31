/**
 * Env-Variablen dieses Pakets (PLAN-DOG-PAKETE P2.7): der Server liest sie ueber `<paket>/env` in seinen Katalog
 * (server-app/startupEnvCheck.ts, ENV_CATALOG) — Startwarnung, .env-Beispiele und scripts/check-env-catalog.cjs.
 * Jede Variable, die dieses Paket liest, steht hier; jede, die hier steht, liest es.
 */
import type { DogEnvVar } from '@martinschmieschek/slopdogs-core';

export const envVars: readonly DogEnvVar[] = [
    {
        name: 'EBIRD_API_KEY',
        section: 'integrations',
        since: 'vor P1',
        purpose: 'eBird-Beobachtungen',
        defaultValue: '—',
        consequence: 'BirdRetriever steht nicht auf',
    },
];
