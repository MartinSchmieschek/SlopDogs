/**
 * @file Kubrow.ts
 * Arr, this be the Kubrow -- our faithful void-hound and the beating heart of this vessel!
 * It holds the World State data (from Simaris, that all-seeing eye) and provides
 * normalized getters for every category of cosmic horror the API can conjure.
 * From brooding gulfs are we beheld, by that which bears no name.
 * Its heralds are the stars it fells, the sky and Earth aflame.
 * Through endless faces, countless forms, a multitude unfolds.
 */
import type {
    IAlertData, IWarframeWorldState, RawEventFromApi,
    ISortieData, IArchonHuntData, IInvasionData,
    IFissureData, IVoidStormData, IVoidTraderData,
    ISyndicateMissionData, IDailyDealData, IFlashSaleData,
    INightwaveData, IGoalData, INodeOverrideData,
    IPVPChallengeData, ICalendarSeasonData, IConquestData,
    IDescentData, IEndlessXpChoiceData, IFeaturedGuildData,
    IPersistentEnemyData, IGlobalUpgradeData,
    IAlertMission,
} from './interfaces/warframeWorldState';
import { normalizeAlert } from './interfaces/normalizeAlerts';
import {
    normalizeSortie, normalizeArchonHunt, normalizeInvasion,
    normalizeFissure, normalizeVoidStorm, normalizeVoidTrader,
    normalizeSyndicateMission, normalizeDailyDeal, normalizeFlashSale,
    normalizeNightwave, normalizeGoal, normalizeNodeOverride,
    normalizePVPChallenge, normalizeCalendarSeason, normalizeConquest,
    normalizeDescent, normalizeEndlessXpChoice, normalizeFeaturedGuild,
    normalizePersistentEnemy, normalizeGlobalUpgrade,
} from './interfaces/normalizers';
import { ForumFirstPost } from './ForumFirstPost';
import { PostTopic } from './PostTopic';
import { enrichDateFields } from './DateFieldHandler';
import type { IMissionDetails } from './interfaces/missionDetails';
import staticWorld from './static.world.json';

/** Arr, the forum topic prefix -- the sigil that marks a URL as a portal to Discourse's depths. */
const FORUM_TOPIC_PREFIX = 'forums.warframe.com/topic/';

/** Lookup into static.world by InternalName (the API node) -- our chart of the accursed star map. */
const STATIC_MISSION_BY_INTERNAL_NAME = new Map<string, IMissionDetails>(
    (staticWorld as IMissionDetails[]).map((m) => [m.InternalName, m]),
);

/** Convert the Enemy field to a faction string -- naming the nameless horrors from the deep. */
function enemyToFactionString(enemy: IMissionDetails['Enemy']): string {
    if (enemy == null || enemy === '') return '';
    return Array.isArray(enemy) ? (enemy[0] ?? '') : enemy;
}

/**
 * Kubrow: the void-hound that holds the World State data (Simaris)
 * and provides normalized getters for all categories.
 * Roiling, moaning, this realm of ours, in madness lost shall die --
 * but not before the data is properly structured, matey.
 */
export class Kubrow {
    /** The raw enriched World State -- the eldritch truth, date-fields transmuted. */
    private raw: IWarframeWorldState | undefined;

    /**
     * Arr, birth the Kubrow from the raw Simaris data, enriching its cursed date fields.
     * @param simaris - The raw World State data hauled from the API's eldritch depths
     */
    constructor(readonly simaris: IWarframeWorldState) {
        this.raw = enrichDateFields(simaris);
    }

    // ── Alerts ── Arr, the distress signals echoing from the void ──

    /** Plunder all alerts, enriching each mission with static world data. */
    private get alerts(): IAlertData[] {
        return (this.raw?.Alerts ?? []).map((raw) => {
            const a = normalizeAlert(raw);
            return { ...a, mission: this.enrichAlertMission(a.mission) };
        });
    }

    /**
     * Arr, retrieve all alerts -- every beacon of doom in the system.
     * @returns All alerts from the void, enriched with mission details
     */
    getAlerts(): IAlertData[] {
        return [...this.alerts];
    }

    /**
     * Get only the active alerts -- those that haven't yet sunk into the abyss.
     * @returns Active alerts that still cry out from the deep, matey
     */
    getActiveAlerts(): IAlertData[] {
        return this.alerts.filter(a => a.active);
    }

    /**
     * Find alerts by node -- searching the star map for a specific cursed location.
     * @param node - The node name (or substring) to search for upon the star map, arr
     * @returns Alerts matching the given node
     */
    getAlertsByNode(node: string): IAlertData[] {
        const lower = node.toLowerCase();
        return this.alerts.filter(a => a.mission.node.toLowerCase().includes(lower));
    }

    /**
     * Find alerts by type -- what manner of horror awaits the crew.
     * @param type - The mission type (or substring) to filter by, matey
     * @returns Alerts matching the given type
     */
    getAlertsByType(type: string): IAlertData[] {
        const lower = type.toLowerCase();
        return this.alerts.filter(a => a.mission.type.toLowerCase().includes(lower));
    }

    /**
     * Find alerts by faction -- which eldritch horde sends forth its carrion heralds.
     * @param faction - The faction name (or substring) to filter by, arr
     * @returns Alerts matching the given faction
     */
    getAlertsByFaction(faction: string): IAlertData[] {
        const lower = faction.toLowerCase();
        return this.alerts.filter(a => a.mission.faction.toLowerCase().includes(lower));
    }

    /**
     * Arr, find alerts by reward item -- what plunder be offered from the deep.
     * @param itemNameSubstring - A substring of the reward item name to search for, matey
     * @returns Alerts whose rewards contain the given item name
     */
    getAlertsByRewardItem(itemNameSubstring: string): IAlertData[] {
        const lower = itemNameSubstring.toLowerCase();
        return this.alerts.filter(a => {
            const items = a.mission.reward?.items ?? [];
            const counted = a.mission.reward?.countedItems?.map(c => c.type) ?? [];
            return [...items, ...counted].some(name => name.toLowerCase().includes(lower));
        });
    }

    /**
     * Find a single alert by its id -- one particular scream from the void.
     * @param id - The unique identifier of the alert, arr
     * @returns The alert if found, or undefined if it has sunk into the abyss
     */
    getAlertById(id: string): IAlertData | undefined {
        return this.alerts.find(a => a.id === id);
    }

    /** Total number of alerts -- how many horrors cry out from the deep. */
    get alertCount(): number {
        return this.alerts.length;
    }

    /** Count of active alerts -- the living nightmares, not yet expired. */
    get activeAlertCount(): number {
        return this.getActiveAlerts().length;
    }

    // ── Events / Forum ── Messages from tangent planes ──

    /** Arr, get forum events -- threads linked from the void's own bulletin board. */
    private get forumEvents(): RawEventFromApi[] {
        return (this.raw?.Events ?? []).filter(
            e => e.Prop?.includes(FORUM_TOPIC_PREFIX),
        );
    }

    /**
     * Retrieve all forum-linked events, matey.
     * @returns Forum events whose Prop contains a forum topic URL from the deep
     */
    getForumEvents(): RawEventFromApi[] {
        return [...this.forumEvents];
    }

    /**
     * Get all events -- every proclamation from the cosmic abyss.
     * @returns All events from the void's bulletin board, arr
     */
    getEvents(): RawEventFromApi[] {
        return [...(this.raw?.Events ?? [])];
    }

    // ── Sorties ── The daily gauntlet of the void ──

    /**
     * Arr, get all Sorties -- the daily trials where corporeal laws are unwritten.
     * @returns All sorties, enriched with static world data from the deep
     */
    getSorties(): ISortieData[] {
        return (this.raw?.Sorties ?? []).map((raw) =>
            this.enrichSortie(normalizeSortie(raw)),
        );
    }

    /**
     * Get the active Sortie -- the current day's descent into madness.
     * @returns The active sortie, or undefined if none lurks in the void, matey
     */
    getActiveSortie(): ISortieData | undefined {
        return this.getSorties().find(s => s.active);
    }

    // ── Archon Hunts (LiteSorties) ── Hunting the named horrors ──

    /**
     * Arr, get Archon Hunts -- the pursuit of named void-horrors across the system.
     * @returns All Archon Hunts, enriched with static world data
     */
    getArchonHunts(): IArchonHuntData[] {
        return (this.raw?.LiteSorties ?? []).map((raw) =>
            this.enrichArchonHunt(normalizeArchonHunt(raw)),
        );
    }

    /**
     * Get the active Archon Hunt, if one lurks in the deep.
     * @returns The active Archon Hunt, or undefined if the quarry has escaped, arr
     */
    getActiveArchonHunt(): IArchonHuntData | undefined {
        return this.getArchonHunts().find(a => a.active);
    }

    // ── Invasions ── Faction wars beneath blackened stars ──

    /**
     * Arr, get all Invasions -- factions clashing while the void watches and accuses.
     * @returns All invasions with mission context if known, matey
     */
    getInvasions(): IInvasionData[] {
        return (this.raw?.Invasions ?? []).map((raw) =>
            this.attachMissionIfKnown(normalizeInvasion(raw)),
        );
    }

    /**
     * Get only active Invasions -- battles still raging across the star map.
     * @returns Active invasions from the deep, arr
     */
    getActiveInvasions(): IInvasionData[] {
        return this.getInvasions().filter(i => i.active);
    }

    /**
     * Find Invasions by faction -- which eldritch armies clash at the anchor points.
     * @param faction - The faction name (or substring) to filter by, matey
     * @returns Invasions involving the given faction
     */
    getInvasionsByFaction(faction: string): IInvasionData[] {
        const lower = faction.toLowerCase();
        return this.getInvasions().filter(i =>
            i.attackerFaction.toLowerCase().includes(lower) ||
            i.defenderFaction.toLowerCase().includes(lower)
        );
    }

    // ── Fissures (ActiveMissions) ── Tears in reality itself ──

    /**
     * Arr, get all Fissures -- rifts where the Void bleeds into our realm, matey.
     * @returns All fissures with mission context from the deep
     */
    getFissures(): IFissureData[] {
        return (this.raw?.ActiveMissions ?? []).map((raw) =>
            this.attachMissionIfKnown(normalizeFissure(raw)),
        );
    }

    /**
     * Get active Fissures -- the open wounds in space that still weep void energy.
     * @returns Active fissures that still bleed from the abyss, arr
     */
    getActiveFissures(): IFissureData[] {
        return this.getFissures().filter(f => f.active);
    }

    /**
     * Find Fissures by tier -- how deep the crack goes into the abyss.
     * @param tier - The tier name (or substring) to filter by, matey
     * @returns Active fissures matching the given tier
     */
    getFissuresByTier(tier: string): IFissureData[] {
        const lower = tier.toLowerCase();
        return this.getActiveFissures().filter(f => f.tier.toLowerCase().includes(lower));
    }

    // ── Void Storms (Railjack) ── Tempests from the deep ──

    /**
     * Arr, get Void Storms -- Railjack fissures where the abyss itself storms and howls.
     * @returns All void storms with mission context from the deep
     */
    getVoidStorms(): IVoidStormData[] {
        return (this.raw?.VoidStorms ?? []).map((raw) =>
            this.attachMissionIfKnown(normalizeVoidStorm(raw)),
        );
    }

    /**
     * Get active Void Storms -- the tempests still raging in the deep.
     * @returns Active void storms, arr
     */
    getActiveVoidStorms(): IVoidStormData[] {
        return this.getVoidStorms().filter(s => s.active);
    }

    // ── Void Trader (Baro Ki'Teer) ── The merchant from beyond the veil ──

    /**
     * Arr, get all Void Traders -- merchants who've gazed into the abyss and brought back wares.
     * @returns All void traders with mission context, matey
     */
    getVoidTraders(): IVoidTraderData[] {
        return (this.raw?.VoidTraders ?? []).map((raw) =>
            this.attachMissionIfKnown(normalizeVoidTrader(raw)),
        );
    }

    /**
     * Get the active Void Trader, if Baro has anchored at a relay.
     * @returns The active void trader, or undefined if the merchant has retreated into the deep, arr
     */
    getActiveVoidTrader(): IVoidTraderData | undefined {
        return this.getVoidTraders().find(t => t.active);
    }

    // ── Syndicate Missions ── Secret orders with eldritch agendas ──

    /**
     * Arr, get all Syndicate Missions -- tasks from the secret orders of the system.
     * @returns All syndicate missions, enriched with node lookups from the deep
     */
    getSyndicateMissions(): ISyndicateMissionData[] {
        return (this.raw?.SyndicateMissions ?? []).map((raw) =>
            this.enrichSyndicateMission(normalizeSyndicateMission(raw)),
        );
    }

    /**
     * Find Syndicate Missions by syndicate tag -- which order sends ye into the void, matey.
     * @param tag - The syndicate tag (or substring) to filter by, arr
     * @returns Syndicate missions matching the given syndicate
     */
    getSyndicateMissionsBySyndicate(tag: string): ISyndicateMissionData[] {
        const lower = tag.toLowerCase();
        return this.getSyndicateMissions().filter(s => s.syndicate.toLowerCase().includes(lower));
    }

    // ── Daily Deals (Darvo) ── Bargains at the edge of the abyss ──

    /**
     * Arr, get Darvo's Daily Deals -- even amid cosmic horror, there be bargains to plunder.
     * @returns All daily deals from Darvo's void-touched inventory
     */
    getDailyDeals(): IDailyDealData[] {
        return (this.raw?.DailyDeals ?? []).map(normalizeDailyDeal);
    }

    /**
     * Get the active Daily Deal, if Darvo still draws breath.
     * @returns The active deal, or undefined if Darvo has sunk into the abyss, matey
     */
    getActiveDailyDeal(): IDailyDealData | undefined {
        return this.getDailyDeals().find(d => d.active);
    }

    // ── Flash Sales ── Fleeting as stars before the void ──

    /**
     * Arr, get all Flash Sales -- offerings as fleeting as a dying star.
     * @returns All flash sales from the void's marketplace
     */
    getFlashSales(): IFlashSaleData[] {
        return (this.raw?.FlashSales ?? []).map(normalizeFlashSale);
    }

    /**
     * Get active Flash Sales -- the ones not yet swallowed by the abyss.
     * @returns Active flash sales still glimmering in the cosmic dark, arr
     */
    getActiveFlashSales(): IFlashSaleData[] {
        return this.getFlashSales().filter(s => s.active);
    }

    // ── Nightwave (SeasonInfo) ── The pirate radio of the void ──

    /**
     * Arr, get the Nightwave data -- broadcasts from the deep that challenge the crew.
     * @returns The Nightwave season data, or undefined if the radio has fallen silent, matey
     */
    getNightwave(): INightwaveData | undefined {
        const raw = this.raw?.SeasonInfo;
        return raw ? normalizeNightwave(raw) : undefined;
    }

    // ── Goals / Events ── The great operations against cosmic horrors ──

    /**
     * Arr, get all Goals -- the operations where the crew rallies against the void.
     * @returns All goals, enriched with mission context from the deep
     */
    getGoals(): IGoalData[] {
        return (this.raw?.Goals ?? []).map((raw) =>
            this.enrichGoal(normalizeGoal(raw)),
        );
    }

    /**
     * Get active Goals -- the battles still raging against the nameless.
     * @returns Active goals from the abyss, arr
     */
    getActiveGoals(): IGoalData[] {
        return this.getGoals().filter(g => g.active);
    }

    // ── Node Overrides ── When the void rewrites reality ──

    /**
     * Arr, get Node Overrides -- when the abyss itself alters the star map.
     * @returns All node overrides with mission context, matey
     */
    getNodeOverrides(): INodeOverrideData[] {
        return (this.raw?.NodeOverrides ?? []).map((raw) =>
            this.attachMissionIfKnown(normalizeNodeOverride(raw)),
        );
    }

    // ── PVP Challenges ── Tenno against Tenno in the madness ──

    /**
     * Get PVP Challenges -- where crew turns against crew in the void's arena.
     * @returns All PVP challenges from the void's arena, arr
     */
    getPVPChallenges(): IPVPChallengeData[] {
        return (this.raw?.PVPChallengeInstances ?? []).map(normalizePVPChallenge);
    }

    // ── Calendar Seasons ── The void's own reckoning of time ──

    /**
     * Arr, get Calendar Seasons -- the passage of time as marked by eldritch rhythms.
     * @returns All calendar seasons from the void's celestial clock
     */
    getCalendarSeasons(): ICalendarSeasonData[] {
        return (this.raw?.KnownCalendarSeasons ?? []).map(normalizeCalendarSeason);
    }

    /**
     * Get the active Calendar Season -- what epoch of madness we currently inhabit.
     * @returns The active calendar season, or undefined if time itself has collapsed, matey
     */
    getActiveCalendarSeason(): ICalendarSeasonData | undefined {
        return this.getCalendarSeasons().find(c => c.active);
    }

    // ── Conquests ── Territorial warfare in the cosmic dark ──

    /**
     * Arr, get all Conquests -- territorial plunder across the void-touched system.
     * @returns All conquests from the warring depths
     */
    getConquests(): IConquestData[] {
        return (this.raw?.Conquests ?? []).map(normalizeConquest);
    }

    /**
     * Get active Conquests -- wars still burning in the deep.
     * @returns Active conquests, arr
     */
    getActiveConquests(): IConquestData[] {
        return this.getConquests().filter(c => c.active);
    }

    // ── Descents (Circuit) ── A spiraling plunge into the abyss ──

    /**
     * Arr, get all Descents -- the Circuit's spiraling plunge into ever-deeper madness.
     * @returns All descents from the abyss, matey
     */
    getDescents(): IDescentData[] {
        return (this.raw?.Descents ?? []).map(normalizeDescent);
    }

    /**
     * Get active Descents -- the pits still open and hungry.
     * @returns Active descents from the deep, arr
     */
    getActiveDescents(): IDescentData[] {
        return this.getDescents().filter(d => d.active);
    }

    // ── Endless XP Choices ── All paths lead to the abyss ──

    /**
     * Arr, get Endless XP Choices -- the void offers paths, but all lead to the same dark end.
     * @returns All endless XP choices from the void's offerings, matey
     */
    getEndlessXpChoices(): IEndlessXpChoiceData[] {
        return (this.raw?.EndlessXpChoices ?? []).map(normalizeEndlessXpChoice);
    }

    // ── Featured Guilds ── Clans raised from the deep ──

    /**
     * Arr, get Featured Guilds -- crews raised from the deep to bask in fleeting glory.
     * @returns All featured guilds from the void's ledger
     */
    getFeaturedGuilds(): IFeaturedGuildData[] {
        return (this.raw?.FeaturedGuilds ?? []).map(normalizeFeaturedGuild);
    }

    // ── Persistent Enemies (Acolytes) ── Stalkers from the void ──

    /**
     * Arr, get Persistent Enemies -- acolytes and stalkers that hunt the crew from the shadows.
     * @returns All persistent enemies, enriched with location details from the deep, matey
     */
    getPersistentEnemies(): IPersistentEnemyData[] {
        return (this.raw?.PersistentEnemies ?? []).map((raw) =>
            this.enrichPersistentEnemy(normalizePersistentEnemy(raw)),
        );
    }

    // ── Global Upgrades ── Blessings from the void ──

    /**
     * Arr, get Global Upgrades -- void-blessings that touch all vessels in the system.
     * @returns All global upgrades from the void's generosity
     */
    getGlobalUpgrades(): IGlobalUpgradeData[] {
        return (this.raw?.GlobalUpgrades ?? []).map(normalizeGlobalUpgrade);
    }

    /**
     * Get active Global Upgrades -- blessings not yet faded into the cosmic dark.
     * @returns Active global upgrades, arr
     */
    getActiveGlobalUpgrades(): IGlobalUpgradeData[] {
        return this.getGlobalUpgrades().filter(u => u.active);
    }

    // ── Metadata ── The fundamental truths of the World State ──

    /** The World Seed -- the primordial sigil from which this reality was spawned. */
    get worldSeed(): string | undefined {
        return this.raw?.WorldSeed;
    }

    /** The version number -- which iteration of the void's dream we inhabit. */
    get version(): number | undefined {
        return this.raw?.Version;
    }

    /** The build label -- the mark branded upon this particular manifestation. */
    get buildLabel(): string | undefined {
        return this.raw?.BuildLabel;
    }

    /** Construction progress -- how far the crew has built against the encroaching void. */
    get constructionProgress(): number[] {
        return this.raw?.ProjectPct ?? [];
    }

    /** The Prime Access state -- what gilded treasures the void currently offers. */
    get primeAccessState(): string | undefined {
        return this.raw?.PrimeAccessAvailability?.State;
    }

    // ── Static World (Mission Details) ── The chart of all cursed nodes ──

    /**
     * Arr, get all mission details from static.world -- the complete chart of the accursed star map.
     * @returns All mission details from the static world data, matey
     */
    getMissionDetails(): IMissionDetails[] {
        return staticWorld as IMissionDetails[];
    }

    /**
     * Find a mission by name -- seeking a specific horror in the deep.
     * @param name - The exact mission name to search for, arr
     * @returns The mission details, or undefined if the name be unknown to the void
     */
    getMissionByName(name: string): IMissionDetails | undefined {
        const lower = name.toLowerCase();
        return this.getMissionDetails().find(m => m.Name.toLowerCase() === lower);
    }

    /**
     * Find missions by planet -- which cursed celestial body harbors these nightmares.
     * @param planet - The planet name to filter by, matey
     * @returns Missions anchored at the given planet
     */
    getMissionsByPlanet(planet: string): IMissionDetails[] {
        const lower = planet.toLowerCase();
        return this.getMissionDetails().filter(m => m.Planet.toLowerCase() === lower);
    }

    /**
     * Find missions by type -- what manner of void-touched ordeal awaits the crew.
     * @param type - The mission type to filter by, arr
     * @returns Missions matching the given type
     */
    getMissionsByType(type: string): IMissionDetails[] {
        const lower = type.toLowerCase();
        return this.getMissionDetails().filter(m => m.Type.toLowerCase() === lower);
    }

    /**
     * Find missions by enemy -- which nameless horde infests these anchor points.
     * @param enemy - The enemy faction name (or substring) to filter by, matey
     * @returns Missions infested by the given enemy
     */
    getMissionsByEnemy(enemy: string): IMissionDetails[] {
        const lower = enemy.toLowerCase();
        return this.getMissionDetails().filter(m => {
            const e = m.Enemy;
            if (Array.isArray(e)) return e.some(f => f.toLowerCase().includes(lower));
            return e.toLowerCase().includes(lower);
        });
    }

    /**
     * Find a mission by its InternalName -- the true name, whispered only in the void.
     * @param internalName - The internal API name of the node, arr
     * @returns The mission details, or undefined if the true name be unknown to the deep
     */
    getMissionByInternalName(internalName: string): IMissionDetails | undefined {
        return STATIC_MISSION_BY_INTERNAL_NAME.get(internalName);
    }

    /** Enrich an alert mission with static world details -- anchoring it to known coordinates. */
    private enrichAlertMission(mission: IAlertMission): IAlertMission {
        const details = STATIC_MISSION_BY_INTERNAL_NAME.get(mission.node);
        return details ? { ...mission, details } : mission;
    }

    /** Build an IAlertMission from a node + static.world lookup (details only if the node be charted). */
    private missionFromNode(node: string): IAlertMission {
        const details = STATIC_MISSION_BY_INTERNAL_NAME.get(node);
        if (!details) {
            return { node, type: '', faction: '' };
        }
        return {
            node,
            type: details.Type,
            faction: enemyToFactionString(details.Enemy),
            minEnemyLevel: details.MinLevel,
            maxEnemyLevel: details.MaxLevel,
            details,
        };
    }

    /** Arr, attach mission context if the node be known -- like pinning a chart to the helm. */
    private attachMissionIfKnown<T extends { node: string }>(
        item: T,
    ): T & { mission?: IAlertMission } {
        const mission = this.missionFromNode(item.node);
        return mission.details ? { ...item, mission } : item;
    }

    /** Enrich a Sortie with static world details for each variant's node. */
    private enrichSortie(sortie: ISortieData): ISortieData {
        return {
            ...sortie,
            variants: sortie.variants.map((v) => {
                const details = STATIC_MISSION_BY_INTERNAL_NAME.get(v.node);
                return details ? { ...v, details } : v;
            }),
        };
    }

    /** Enrich an Archon Hunt with static world details for each mission's node. */
    private enrichArchonHunt(archon: IArchonHuntData): IArchonHuntData {
        return {
            ...archon,
            missions: archon.missions.map((m) => {
                const details = STATIC_MISSION_BY_INTERNAL_NAME.get(m.node);
                return details ? { ...m, details } : m;
            }),
        };
    }

    /** Enrich Syndicate Missions -- look up each node in the chart of the damned. */
    private enrichSyndicateMission(
        syndicate: ISyndicateMissionData,
    ): ISyndicateMissionData {
        return {
            ...syndicate,
            missions: syndicate.nodes.map((node) => this.missionFromNode(node)),
        };
    }

    /** Enrich a Goal with mission details, if its node be charted upon the accursed map. */
    private enrichGoal(goal: IGoalData): IGoalData {
        if (!goal.node) return goal;
        const mission = this.missionFromNode(goal.node);
        return mission.details ? { ...goal, mission } : goal;
    }

    /** Enrich a Persistent Enemy with location details -- tracking the stalker through the abyss. */
    private enrichPersistentEnemy(
        enemy: IPersistentEnemyData,
    ): IPersistentEnemyData {
        if (!enemy.lastLocation) return enemy;
        const details = STATIC_MISSION_BY_INTERNAL_NAME.get(enemy.lastLocation);
        return details ? { ...enemy, locationDetails: details } : enemy;
    }

    /** Arr, ensure a URL bears the https protocol -- no uncharted waters on this vessel. */
    private ensureHttps(url: string): string {
        if (url.startsWith('https://') || url.startsWith('http://')) return url;
        if (url.startsWith('//')) return 'https:' + url;
        return 'https://' + url;
    }
}
