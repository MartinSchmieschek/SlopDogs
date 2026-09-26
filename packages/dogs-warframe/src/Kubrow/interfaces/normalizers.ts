/**
 * @file normalizers.ts
 * Arr, matey! This accursed tome holds every normalizer function for the World State data.
 * From brooding gulfs are we beheld, by that which bears no name -- yet we must give
 * names to the nameless, structuring the raw API chaos into forms the crew can navigate.
 * Carrion hordes trill their profane accord with eldritch plans, and we answer
 * by imposing order upon the madness. To cosmic madness laws submit, though stalwart minds entreat.
 */
import type {
    RawSortieFromApi, ISortieData,
    RawLiteSortieFromApi, IArchonHuntData,
    RawInvasionFromApi, IInvasionData,
    RawFissureFromApi, IFissureData,
    RawVoidStormFromApi, IVoidStormData,
    RawVoidTraderFromApi, IVoidTraderData,
    RawSyndicateMissionFromApi, ISyndicateMissionData,
    RawDailyDealFromApi, IDailyDealData,
    RawFlashSaleFromApi, IFlashSaleData,
    RawSeasonInfoFromApi, INightwaveData, INightwaveChallenge,
    RawGoalFromApi, IGoalData,
    RawNodeOverrideFromApi, INodeOverrideData,
    RawPVPChallengeFromApi, IPVPChallengeData,
    RawCalendarSeasonFromApi, ICalendarSeasonData,
    RawConquestFromApi, IConquestData,
    RawDescentFromApi, IDescentData,
    RawEndlessXpChoice, IEndlessXpChoiceData,
    RawFeaturedGuildFromApi, IFeaturedGuildData,
    RawPersistentEnemyFromApi, IPersistentEnemyData,
    RawGlobalUpgradeFromApi, IGlobalUpgradeData,
    IAlertMissionReward,
} from './warframeWorldState';

/** Arr, normalize a reward -- count the plunder so the crew knows what they've hauled from the deep. */
function normalizeReward(raw?: { credits?: number; items?: string[]; countedItems?: Array<{ ItemType: string; ItemCount: number }> }): IAlertMissionReward | undefined {
    if (!raw) return undefined;
    return {
        credits: raw.credits,
        items: raw.items,
        countedItems: raw.countedItems?.map(c => ({ count: c.ItemCount, type: c.ItemType })),
    };
}

/**
 * Normalize a Sortie -- the daily gauntlet, where to cosmic madness laws submit.
 * @param raw - The raw sortie data from the void's API, arr
 * @returns A normalized sortie, structured for the crew's comprehension
 */
export function normalizeSortie(raw: RawSortieFromApi): ISortieData {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        boss: raw.Boss,
        variants: raw.Variants.map(v => ({
            missionType: v.missionType,
            modifier: v.modifierType,
            node: v.node,
            tileset: v.tileset,
        })),
        active: !raw.Expiry?.isExpired(),
    };
}

/**
 * Normalize an Archon Hunt -- the pursuit of eldritch bosses across the void, matey.
 * @param raw - The raw lite-sortie data hauled from the abyss
 * @returns A normalized Archon Hunt, charted for mortal navigation
 */
export function normalizeArchonHunt(raw: RawLiteSortieFromApi): IArchonHuntData {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        boss: raw.Boss,
        missions: raw.Missions.map(m => ({
            missionType: m.missionType,
            node: m.node,
        })),
        active: !raw.Expiry?.isExpired(),
    };
}

/**
 * Arr, normalize an Invasion -- two factions clash while the void watches, accusing and denying.
 * @param raw - The raw invasion data disgorged from the deep
 * @returns A normalized invasion with progress calculated, matey
 */
export function normalizeInvasion(raw: RawInvasionFromApi): IInvasionData {
    const progress = raw.Goal !== 0 ? raw.Count / raw.Goal : 0;
    return {
        id: raw._id?.$oid ?? '',
        node: raw.Node,
        attackerFaction: raw.Faction,
        defenderFaction: raw.DefenderFaction,
        attackerReward: {
            credits: raw.AttackerReward?.credits,
            countedItems: raw.AttackerReward?.countedItems?.map(c => ({ count: c.ItemCount, type: c.ItemType })),
        },
        defenderReward: {
            credits: raw.DefenderReward?.credits,
            countedItems: raw.DefenderReward?.countedItems?.map(c => ({ count: c.ItemCount, type: c.ItemType })),
        },
        progress,
        completed: raw.Completed,
        active: !raw.Completed,
    };
}

/**
 * Normalize a Fissure -- tears in reality where the Void bleeds through, in luminous space blackened stars.
 * @param raw - The raw fissure data from the void's bleeding wounds, arr
 * @returns A normalized fissure, structured for the crew
 */
export function normalizeFissure(raw: RawFissureFromApi): IFissureData {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        node: raw.Node,
        missionType: raw.MissionType,
        tier: raw.Modifier,
        isStorm: false,
        isHard: raw.Hard ?? false,
        active: !raw.Expiry?.isExpired(),
    };
}

/**
 * Arr, normalize a Void Storm -- Railjack fissures, where the abyss roils and moans.
 * @param raw - The raw void storm data from the tempestuous deep
 * @returns A normalized void storm, charted for the crew's survival, matey
 */
export function normalizeVoidStorm(raw: RawVoidStormFromApi): IVoidStormData {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        node: raw.Node,
        tier: raw.ActiveMissionTier,
        active: !raw.Expiry?.isExpired(),
    };
}

/**
 * Normalize the Void Trader (Baro Ki'Teer) -- a merchant from beyond the veil, peddling cosmic wares.
 * @param raw - The raw void trader data hauled from the abyss, arr
 * @returns A normalized void trader with inventory manifest
 */
export function normalizeVoidTrader(raw: RawVoidTraderFromApi): IVoidTraderData {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        character: raw.Character,
        node: raw.Node,
        active: !raw.Expiry?.isExpired(),
        inventory: (raw.Manifest ?? []).map(m => ({
            item: m.ItemType,
            ducats: m.PrimePrice,
            credits: m.RegularPrice,
        })),
    };
}

/**
 * Normalize Syndicate Missions -- the secret orders, each with their own eldritch plans, matey.
 * @param raw - The raw syndicate mission data from the secret cabals of the deep
 * @returns A normalized syndicate mission, arr
 */
export function normalizeSyndicateMission(raw: RawSyndicateMissionFromApi): ISyndicateMissionData {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        syndicate: raw.Tag,
        nodes: raw.Nodes,
        active: !raw.Expiry?.isExpired(),
    };
}

/**
 * Arr, normalize Darvo's Daily Deal -- even in the cosmic abyss, there be bargains to plunder.
 * @param raw - The raw daily deal data from Darvo's void-touched inventory
 * @returns A normalized daily deal, matey
 */
export function normalizeDailyDeal(raw: RawDailyDealFromApi): IDailyDealData {
    return {
        item: raw.StoreItem,
        activation: raw.Activation,
        expiry: raw.Expiry,
        discount: raw.Discount,
        originalPrice: raw.OriginalPrice,
        salePrice: raw.SalePrice,
        total: raw.AmountTotal,
        sold: raw.AmountSold,
        active: !raw.Expiry?.isExpired(),
    };
}

/**
 * Normalize a Flash Sale -- fleeting as a star before the void swallows it whole.
 * @param raw - The raw flash sale data, arr, fleeting as it is
 * @returns A normalized flash sale from the deep
 */
export function normalizeFlashSale(raw: RawFlashSaleFromApi): IFlashSaleData {
    return {
        item: raw.TypeName,
        premiumOverride: raw.PremiumOverride,
        startDate: raw.StartDate,
        endDate: raw.EndDate,
        featured: raw.Featured ?? false,
        popular: raw.Popular ?? false,
        active: !raw.EndDate?.isExpired(),
    };
}

/**
 * Arr, normalize Nightwave -- the pirate radio of the void, broadcasting challenges from the deep.
 * @param raw - The raw season info from the void's dark frequency, matey
 * @returns A normalized Nightwave season with active challenges
 */
export function normalizeNightwave(raw: RawSeasonInfoFromApi): INightwaveData {
    return {
        activation: raw.Activation,
        expiry: raw.Expiry,
        season: raw.Season,
        phase: raw.Phase,
        tag: raw.AffiliationTag,
        activeChallenges: (raw.ActiveChallenges ?? []).map(c => normalizeNightwaveChallenge(c)),
        active: !raw.Expiry?.isExpired(),
    };
}

/** Normalize a Nightwave challenge -- each one a task from the abyss, demanding the crew's compliance. */
function normalizeNightwaveChallenge(raw: { _id: { $oid: string }; Activation: any; Expiry: any; Challenge: string; Daily?: boolean; isHard?: boolean }): INightwaveChallenge {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        challenge: raw.Challenge,
        isDaily: raw.Daily ?? false,
        isElite: raw.isHard ?? false,
        active: !raw.Expiry?.isExpired(),
    };
}

/**
 * Normalize a Goal / Event -- the great operations where the crew rallies against cosmic horrors.
 * @param raw - The raw goal data disgorged from the abyss, arr
 * @returns A normalized goal with reward data from the deep
 */
export function normalizeGoal(raw: RawGoalFromApi): IGoalData {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        node: raw.Node,
        tag: raw.Tag,
        description: raw.Desc,
        tooltip: raw.ToolTip,
        healthPct: raw.HealthPct,
        goal: raw.Goal,
        count: raw.Count,
        personal: raw.Personal ?? false,
        community: raw.Community ?? false,
        active: !raw.Expiry?.isExpired(),
        reward: normalizeReward(raw.Reward),
    };
}

/**
 * Arr, normalize a Node Override -- when the void rewrites the star map itself, matey.
 * @param raw - The raw node override from the void's rewriting hand
 * @returns A normalized node override, charted for the crew
 */
export function normalizeNodeOverride(raw: RawNodeOverrideFromApi): INodeOverrideData {
    return {
        id: raw._id?.$oid ?? '',
        node: raw.Node,
        hidden: raw.Hide ?? false,
        faction: raw.Faction,
    };
}

/**
 * Normalize a PVP Challenge -- Tenno against Tenno, roiling and moaning in this realm of ours.
 * @param raw - The raw PVP challenge data from the void's arena, arr
 * @returns A normalized PVP challenge for the crew
 */
export function normalizePVPChallenge(raw: RawPVPChallengeFromApi): IPVPChallengeData {
    return {
        id: raw._id?.$oid ?? '',
        type: raw.challengeTypeRefID,
        startDate: raw.startDate,
        endDate: raw.endDate,
        mode: raw.PVPMode,
        category: raw.Category,
        active: !raw.endDate?.isExpired(),
    };
}

/**
 * Normalize a Calendar Season -- the passage of time itself, marked by the void's eldritch rhythm.
 * @param raw - The raw calendar season from the void's celestial clock, matey
 * @returns A normalized calendar season with days and events
 */
export function normalizeCalendarSeason(raw: RawCalendarSeasonFromApi): ICalendarSeasonData {
    return {
        activation: raw.Activation,
        expiry: raw.Expiry,
        days: raw.Days.map(d => ({
            day: d.day,
            events: d.events.map(e => ({
                type: e.type,
                challenge: e.challenge,
                reward: e.reward,
            })),
        })),
        active: !raw.Expiry?.isExpired(),
    };
}

/**
 * Arr, normalize a Conquest -- territorial warfare across the system, in madness lost shall die.
 * @param raw - The raw conquest data from the warring depths
 * @returns A normalized conquest with missions and difficulties, arr
 */
export function normalizeConquest(raw: RawConquestFromApi): IConquestData {
    return {
        activation: raw.Activation,
        expiry: raw.Expiry,
        type: raw.Type,
        missions: raw.Missions.map(m => ({
            faction: m.faction,
            missionType: m.missionType,
            difficulties: m.difficulties.map(d => ({
                type: d.type,
                deviation: d.deviation,
                risks: d.risks,
            })),
        })),
        active: !raw.Expiry?.isExpired(),
    };
}

/**
 * Normalize a Descent (Circuit) -- a spiraling plunge into the deep, each challenge more maddening.
 * @param raw - The raw descent data from the spiraling abyss, matey
 * @returns A normalized descent with indexed challenges
 */
export function normalizeDescent(raw: RawDescentFromApi): IDescentData {
    return {
        activation: raw.Activation,
        expiry: raw.Expiry,
        seed: raw.RandSeed,
        challenges: raw.Challenges.map(c => ({
            index: c.Index,
            type: c.Type,
            challenge: c.Challenge,
            level: c.Level,
        })),
        active: !raw.Expiry?.isExpired(),
    };
}

/**
 * Normalize Endless XP Choices -- the void offers ye choices, matey, but all paths lead to the abyss.
 * @param raw - The raw endless XP choice from the void's offerings, arr
 * @returns A normalized endless XP choice with category and paths
 */
export function normalizeEndlessXpChoice(raw: RawEndlessXpChoice): IEndlessXpChoiceData {
    return {
        category: raw.Category,
        choices: raw.Choices,
    };
}

/**
 * Arr, normalize a Featured Guild -- clans raised from the deep to bask in fleeting glory.
 * @param raw - The raw featured guild data from the void's ledger, matey
 * @returns A normalized featured guild
 */
export function normalizeFeaturedGuild(raw: RawFeaturedGuildFromApi): IFeaturedGuildData {
    return {
        id: raw._id?.$oid ?? '',
        name: raw.Name,
        tier: raw.Tier,
        emblem: raw.Emblem ?? false,
    };
}

/**
 * Normalize a Persistent Enemy (Acolyte) -- stalkers from the void that hunt the crew relentlessly.
 * @param raw - The raw persistent enemy data from the shadows of the deep, arr
 * @returns A normalized persistent enemy with health and location
 */
export function normalizePersistentEnemy(raw: RawPersistentEnemyFromApi): IPersistentEnemyData {
    return {
        id: raw._id?.$oid ?? '',
        type: raw.AgentType,
        tag: raw.LocTag,
        healthPercent: raw.HealthPercent,
        discovered: raw.Discovered ?? false,
        lastLocation: raw.LastDiscoveredLocation,
        region: raw.Region,
    };
}

/**
 * Arr, normalize a Global Upgrade -- blessings from the void that touch all vessels in the system.
 * @param raw - The raw global upgrade data from the void's generosity, matey
 * @returns A normalized global upgrade with type and value
 */
export function normalizeGlobalUpgrade(raw: RawGlobalUpgradeFromApi): IGlobalUpgradeData {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        upgradeType: raw.UpgradeType,
        operationType: raw.OperationType,
        value: raw.Value,
        description: raw.LocalizedDesc,
        active: !raw.Expiry?.isExpired(),
    };
}
