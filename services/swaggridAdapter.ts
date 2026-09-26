import { publicKennelPath, type IKennelConfig } from '@slopdogs/core';
import type { Rune, SwaggridCast } from '@slopdogs/swaggrid';
import type { Waves } from './WavesConverter';
import { findLeadNodeEntry } from './WavesConverter';

/** Anzeigename des Leads in einer Spec fuer RUN-Leser — kein Dog-Name, keine id (W17). */
export const LEAD_ONLY_HERALD = 'lead';

/**
 * Mappt Kennel-Laufdaten auf das neutrale Swaggrid-Cast-Format.
 * `includeDefaults: false` laesst defaultQuery/defaultBody weg (leere Beispiele) —
 * die Defaults sind Konfiguration und gehen nur an Aufrufer mit Leserecht.
 * `leadOnly: true` (Kennel-Stufe RUN) zeigt nur das Lead-Ergebnis unter einem neutralen Namen:
 * keine Wellen, keine Dog-Namen, keine Zwischenergebnisse.
 */
export function toSwaggridCast(
    config: IKennelConfig,
    waves: Waves,
    options: { includeDefaults: boolean; leadOnly?: boolean } = { includeDefaults: true },
): SwaggridCast {
    const lead = findLeadNodeEntry(waves, config);
    const heraldId = options.leadOnly ? LEAD_ONLY_HERALD : lead?.id ?? (config.dogIds?.[0] ?? '');
    const strata: Rune[][] = options.leadOnly
        ? [[{ id: LEAD_ONLY_HERALD, name: LEAD_ONLY_HERALD, essence: lead?.result, bound: false }]]
        : waves.map((wave) =>
            wave.map((n) => ({
                id: n.id,
                lineageId: n.lineageId,
                name: n.name,
                essence: n.result,
                sigil: n.icon,
                bound: Boolean(n.codeTs),
            })),
        );
    return {
        rift: config.id,
        publicPath: publicKennelPath((config as { lineageId?: string }).lineageId ?? config.id),
        title: config.name,
        scroll: config.description,
        heraldId,
        whispers: options.includeDefaults ? config.defaultQuery : undefined,
        offering: options.includeDefaults ? config.defaultBody : undefined,
        strata,
    };
}
