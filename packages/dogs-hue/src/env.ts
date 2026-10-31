/**
 * Env-Variablen dieses Pakets (PLAN-DOG-PAKETE P2.7): der Server liest sie ueber `<paket>/env` in seinen Katalog
 * (server-app/startupEnvCheck.ts, ENV_CATALOG) — Startwarnung, .env-Beispiele und scripts/check-env-catalog.cjs.
 * Jede Variable, die dieses Paket liest, steht hier; jede, die hier steht, liest es.
 */
import type { DogEnvVar } from '@martinschmieschek/slopdogs-core';

export const envVars: readonly DogEnvVar[] = [
    {
        name: 'HUE_BRIDGE_HOST',
        section: 'integrations',
        since: 'vor P1',
        purpose: 'Philips-Hue-Bridge (Host/IP)',
        defaultValue: '—',
        consequence: 'HueBridgeEnvRetriever steht nicht auf',
    },
    {
        name: 'HUE_BRIDGE_USER',
        section: 'integrations',
        since: 'vor P1',
        purpose: 'Hue-API-User der Bridge',
        defaultValue: '—',
        consequence: 'HueBridgeEnvRetriever steht nicht auf',
    },
    {
        name: 'HUE_INTER_COMMAND_DELAY_MS',
        section: 'integrations',
        since: 'vor P1',
        purpose: 'Pause zwischen Hue-Befehlen (ms)',
        defaultValue: '120',
        consequence: 'Default',
    },
];
