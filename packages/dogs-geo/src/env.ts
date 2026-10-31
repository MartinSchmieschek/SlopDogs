/**
 * Env-Variablen dieses Pakets (PLAN-DOG-PAKETE P2.7): der Server liest sie ueber `<paket>/env` in seinen Katalog
 * (server-app/startupEnvCheck.ts, ENV_CATALOG) — Startwarnung, .env-Beispiele und scripts/check-env-catalog.cjs.
 * Jede Variable, die dieses Paket liest, steht hier; jede, die hier steht, liest es.
 */
import type { DogEnvVar } from '@martinschmieschek/slopdogs-core';

export const envVars: readonly DogEnvVar[] = [
    {
        name: 'ORS_API_KEYS',
        section: 'integrations',
        since: 'vor P1',
        purpose: 'OpenRouteService-Keys, kommagetrennt',
        defaultValue: '—',
        consequence: 'Bloodhound-Route/-Isochrone stehen nicht auf',
    },
    {
        name: 'OVERPASS_URL',
        section: 'integrations',
        since: 'vor P1',
        purpose: 'Primaerer Overpass-Endpoint (vor der Fallback-Kette)',
        defaultValue: 'Kette lz4 -> kumi -> public',
        consequence: 'Default-Kette',
    },
    {
        name: 'OVERPASS_URLS',
        section: 'integrations',
        since: 'vor P1',
        purpose: 'Mehrere Overpass-Mirror, kommagetrennt (statt OVERPASS_URL)',
        defaultValue: '—',
        consequence: 'OVERPASS_URL bzw. Default-Kette',
    },
    {
        name: 'OVERPASS_INTERPRETER_URL',
        section: 'integrations',
        since: 'vor P1',
        purpose: 'Erzwingt EINEN Overpass-Server fuer die OpenStreetMap-Geometrie-Dogs',
        defaultValue: 'overpass-api.de, dann Mirror',
        consequence: 'Default',
    },
    {
        name: 'OVERPASS_USER_AGENT',
        section: 'integrations',
        since: 'vor P1',
        purpose: 'User-Agent an Overpass (mit Kontakt)',
        defaultValue: 'SlopDogs/<label> (contact: set OVERPASS_USER_AGENT)',
        consequence: 'generischer User-Agent',
    },
    {
        name: 'OVERPASS_QUERY_TIMEOUT_SEC',
        section: 'integrations',
        since: 'vor P1',
        purpose: 'Overpass [timeout:N] (Server-Laufzeit)',
        defaultValue: '25',
        consequence: 'Default',
    },
    {
        name: 'OVERPASS_FETCH_TIMEOUT_MS',
        section: 'integrations',
        since: 'vor P1',
        purpose: 'Abbruch-Budget je Overpass-Request (min. 5000)',
        defaultValue: '30000',
        consequence: 'Default',
    },
    {
        name: 'OVERPASS_MAX_RESPONSE_BYTES',
        section: 'integrations',
        since: 'vor P1',
        purpose: 'Deckel je Overpass-Antwort',
        defaultValue: '8388608 (8 MiB)',
        consequence: 'Default',
    },
];
