import { BASE_DOG_PREFIX } from '@slopdogs/core';
import type { IStore } from '../store/IStore';

function parseDogIdsFromKennelRow(row: any): string[] {
    const raw = row?.dogIds;
    if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
    if (typeof raw === 'string') {
        try {
            const p = JSON.parse(raw);
            return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
        } catch {
            return [];
        }
    }
    if (row?.serializedDogConfig) {
        try {
            const cfg =
                typeof row.serializedDogConfig === 'string'
                    ? JSON.parse(row.serializedDogConfig)
                    : row.serializedDogConfig;
            const ids = cfg?.dogIds;
            return Array.isArray(ids) ? ids.filter((x: unknown): x is string => typeof x === 'string') : [];
        } catch {
            return [];
        }
    }
    return [];
}

/** Alle `base:…`-Kurznamen aus den jeweils neuesten Kennel-Versionen (pro Lineage). */
export async function collectBaseDogNamesFromLatestKennels(kennelsStore: IStore): Promise<Set<string>> {
    const rows = await kennelsStore.findLatestVersionsByType('KennelConfig');
    const names = new Set<string>();
    for (const row of rows) {
        for (const id of parseDogIdsFromKennelRow(row)) {
            if (id.startsWith(BASE_DOG_PREFIX)) {
                names.add(id.slice(BASE_DOG_PREFIX.length));
            }
        }
    }
    return names;
}

/**
 * Wirft, wenn ein Kennel in der DB einen Base-Dog referenziert, den die schlanke
 * Registry gar nicht KENNT (echte Luecke). Dogs, die zwar registriert sind, aber
 * env-bedingt nicht konstruieren konnten (fehlende API-Keys, siehe
 * `unavailableDogNames`), fuehren NUR zu einer Warnung — sie sollen nicht die
 * ganze Deployment mitnehmen. Der betroffene Kennel schlaegt erst beim
 * tatsaechlichen Lauf fehl; alles andere (inkl. MCP) laeuft weiter.
 */
export function assertSlimRegistryCoversKennelDbRefs(
    requiredDogNames: Set<string>,
    baseDogsMap: Map<string, unknown>,
    envLabel: string,
    unavailableDogNames: Set<string> = new Set(),
): void {
    const notCovered = [...requiredDogNames].filter((n) => !baseDogsMap.has(n)).sort();
    const degraded = notCovered.filter((n) => unavailableDogNames.has(n));
    const missing = notCovered.filter((n) => !unavailableDogNames.has(n));

    if (degraded.length > 0) {
        console.warn(
            `[${envLabel}] Kennels referenzieren Base-Dogs, die env-bedingt nicht starten konnten ` +
                `(fehlende API-Keys o. ae.): ${degraded.join(', ')}. Diese Kennels bleiben degradiert, ` +
                'bis die noetigen Env-Variablen gesetzt sind; der Rest der App laeuft normal.',
        );
    }
    if (missing.length === 0) return;
    throw new Error(
        `[${envLabel}] Schlanke Base-Dog-Registry deckt Kennels in der DB nicht. Fehlend im baseDogsMap: ${missing.join(', ')}. ` +
            'Ergänze server-registries/slimDeployRegistry.ts (Klassen + ggf. Pacts) oder entferne die Referenz aus dem Kennel.',
    );
}
