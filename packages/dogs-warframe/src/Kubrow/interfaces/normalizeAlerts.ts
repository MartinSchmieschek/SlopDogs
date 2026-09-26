/**
 * @file normalizeAlerts.ts
 * Arr, here we take the raw alert data -- shapeless and maddening as it arrives from the API --
 * and normalize it into something the crew can comprehend. Corporeal laws are unwritten,
 * as suns and love retreat, but at least our alert data shall have structure, matey.
 */
import type { IAlertData, RawAlertFromApi } from './warframeWorldState';

/**
 * Arr, transform a raw alert from the API's eldritch depths into a normalized, crew-readable form.
 * @param raw - The raw alert data disgorged from the void's API, matey
 * @returns A normalized alert, structured for mortal comprehension from the deep
 */
export function normalizeAlert(raw: RawAlertFromApi): IAlertData {
    const mission = raw.MissionInfo;
    const reward = mission?.missionReward;

    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        mission: {
            node: mission?.location ?? '',
            type: mission?.missionType ?? '',
            faction: mission?.faction ?? '',
            reward: reward
                ? {
                      credits: reward.credits,
                      items: reward.items,
                      countedItems: reward.countedItems?.map((c) => ({
                          count: c.ItemCount,
                          type: c.ItemType,
                      })),
                  }
                : undefined,
            minEnemyLevel: mission?.minEnemyLevel,
            maxEnemyLevel: mission?.maxEnemyLevel,
        },
        /** Arr, if the expiry has passed, this alert has sunk into the abyss. */
        active: !raw.Expiry?.isExpired(),
        tag: raw.Tag,
    };
}
