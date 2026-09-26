/**
 * @file warframeWorldState.ts
 * Arr, matey! This be the grand codex of all types -- raw and normalized -- that define
 * the Warframe World State. From brooding gulfs are we beheld, by that which bears no name.
 * Herein lie the interfaces for every horror the API disgorges: Alerts, Sorties, Invasions,
 * Fissures, Void Storms, and countless other manifestations of the cosmic abyss.
 * Through endless faces, countless forms, a multitude unfolds.
 * To cosmic forms from tangent planes, we end as we began.
 */
import type { IMissionDetails } from './missionDetails';

/** Enriched date field (after enrichDateFields) -- time itself, plundered from the void's raw grasp. */
export interface EnrichedDate {
    /** The Date object -- mortal reckoning of a moment plundered from the void's timeless grasp. */
    date: Date;
    /** Unix timestamp in milliseconds -- the raw numerical sigil of when this moment was wrenched from the deep. */
    timestamp: number;
    /** Arr, has this moment sunk beneath the waves of time? Returns true if the date be past, lost to the abyss. */
    isExpired: () => boolean;
}

// ============================================================
// Raw API types (PascalCase, as returned by the Warframe API)
// Arr, these be the untamed forms, straight from the eldritch deep
// ============================================================

/** Raw Alert from the API -- a distress signal from the void, unprocessed. */
export interface RawAlertFromApi {
    /** The eldritch identifier -- a unique sigil from the void's own ledger. */
    _id: { $oid: string };
    /** When this alert materialized from the abyss, arr. */
    Activation: EnrichedDate;
    /** When this alert shall sink back into the deep. */
    Expiry: EnrichedDate;
    /** Mission details -- the nature of the horror that awaits the crew. */
    MissionInfo: {
        /** The node location on the star map -- coordinates of the cursed anchor point. */
        location: string;
        /** Mission type -- what eldritch trial the void has conjured. */
        missionType: string;
        /** The faction -- which carrion horde infests these depths, matey. */
        faction: string;
        /** Difficulty rating -- how deep into madness this mission plunges. */
        difficulty?: number;
        /** The reward for braving the abyss -- plunder for the crew. */
        missionReward?: {
            /** Credits -- coin wrenched from the void's coffers. */
            credits?: number;
            /** Counted items -- numbered plunder from brooding gulfs. */
            countedItems?: Array<{ ItemType: string; ItemCount: number }>;
            /** Named items -- specific treasures dragged from the deep. */
            items?: string[];
        };
        /** Minimum enemy level -- the weakest of the nameless horrors. */
        minEnemyLevel?: number;
        /** Maximum enemy level -- the mightiest terrors from the abyss. */
        maxEnemyLevel?: number;
        /** Level override -- when the void rewrites corporeal laws of difficulty. */
        levelOverride?: string;
        /** Enemy spec -- the eldritch blueprint of the horrors that await. */
        enemySpec?: string;
        /** Description text -- words scrawled by the void to lure the crew. */
        descText?: string;
        /** Maximum wave number -- how many tides of horror crash upon the crew. */
        maxWaveNum?: number;
    };
    /** A tag identifying this alert -- a brand from the void's own iron. */
    Tag?: string;
    /** Whether this node be forcibly unlocked -- the void tears open sealed doors, arr. */
    ForceUnlock?: boolean;
}

/** A single message within an Event -- whispers from the abyss in many tongues. */
export interface IRawEventMessage {
    /** The language code -- in what tongue the void whispers its proclamation. */
    LanguageCode: string;
    /** The message itself -- eldritch words from brooding gulfs, translated for mortal crew. */
    Message: string;
}

/** Raw Event from the API -- proclamations from the cosmic void. */
export interface RawEventFromApi {
    /** The eldritch identifier -- unique sigil from the void's ledger. */
    _id: { $oid: string };
    /** Messages in various tongues -- the void speaks to all, from brooding gulfs. */
    Messages: IRawEventMessage[];
    /** A property string, often a URL -- a portal to further horrors, arr. */
    Prop?: string;
    /** The date of this event -- when the void chose to make its proclamation. */
    Date?: EnrichedDate;
    /** Whether this event demands the crew's immediate attention from the deep. */
    Priority?: boolean;
    /** Arr, restricted to mobile vessels only -- some horrors are portable. */
    MobileOnly?: boolean;
    /** Whether this be a community event -- the entire crew of the Origin System unites. */
    Community?: boolean;
    /** Icon URL -- a sigil representing this eldritch proclamation. */
    Icon?: string;
}

/** Sortie Variant -- one leg of the daily gauntlet through the deep. */
export interface RawSortieVariant {
    /** The mission type -- what manner of void-trial this leg demands. */
    missionType: string;
    /** The modifier -- an eldritch twist upon corporeal laws, unwritten and rewritten. */
    modifierType: string;
    /** The node -- which cursed anchor point on the star map, arr. */
    node: string;
    /** The tileset -- the architecture of the abyss where this trial unfolds. */
    tileset?: string;
}

/** Raw Sortie -- the daily trial where stalwart minds entreat against cosmic madness. */
export interface RawSortieFromApi {
    /** The eldritch identifier from the void's own ledger, matey. */
    _id: { $oid: string };
    /** When this daily gauntlet emerged from the abyss. */
    Activation: EnrichedDate;
    /** When this trial sinks back into the deep. */
    Expiry: EnrichedDate;
    /** The reward pool -- what plunder awaits those who survive the void's gauntlet. */
    Reward: string;
    /** The seed -- the primordial number from which this horror was spawned. */
    Seed: number;
    /** The boss -- which named eldritch horror presides over this descent, arr. */
    Boss: string;
    /** Extra drops -- additional plunder the void may yield from brooding gulfs. */
    ExtraDrops: unknown[];
    /** The variants -- each leg of the gauntlet, through endless faces countless forms. */
    Variants: RawSortieVariant[];
}

/** Lite-Sortie Mission (Archon Hunt) -- a single step in hunting the named void-horrors. */
export interface RawLiteSortieMission {
    /** The mission type -- what void-trial this step of the hunt demands. */
    missionType: string;
    /** The node -- where the eldritch quarry lurks upon the star map, arr. */
    node: string;
}

/** Raw LiteSortie (Archon Hunt) -- the pursuit of eldritch bosses across the system. */
export interface RawLiteSortieFromApi {
    /** The eldritch identifier -- a unique brand from the void's iron. */
    _id: { $oid: string };
    /** When this hunt emerged from the cosmic dark. */
    Activation: EnrichedDate;
    /** When the hunt expires -- the quarry slips back into the abyss, matey. */
    Expiry: EnrichedDate;
    /** The reward pool -- plunder for those who slay the named horror. */
    Reward: string;
    /** The seed -- from which this hunt's madness was spawned. */
    Seed: number;
    /** The boss -- the Archon, a named void-horror through endless faces countless forms. */
    Boss: string;
    /** The missions -- each step in tracking the eldritch quarry across the system. */
    Missions: RawLiteSortieMission[];
}

/** Invasion Reward -- plunder seized from the clash of warring factions. */
export interface RawInvasionReward {
    /** Counted items -- numbered plunder seized from the clash of warring factions. */
    countedItems?: Array<{ ItemType: string; ItemCount: number }>;
    /** Credits -- coin spilled upon the battlefield of the deep, arr. */
    credits?: number;
}

/** Invasion Mission Info -- the seed and faction of a battle in the void's shadow. */
export interface RawInvasionMissionInfo {
    /** The seed -- the primordial number from which this battle's chaos was conjured. */
    seed: number;
    /** The faction -- which carrion horde commands this side of the conflict, matey. */
    faction: string;
}

/** Raw Invasion -- two factions clash while the void watches, accusing and denying. */
export interface RawInvasionFromApi {
    /** The eldritch identifier -- unique brand upon this clash from the void. */
    _id: { $oid: string };
    /** The attacking faction -- which horde surges forth from the abyss. */
    Faction: string;
    /** The defending faction -- which horde holds the line against the deep, arr. */
    DefenderFaction: string;
    /** The node -- where two armies collide upon the star map. */
    Node: string;
    /** Current count -- how far the battle has swung through endless faces. */
    Count: number;
    /** The goal -- the threshold at which one side claims victory from the void. */
    Goal: number;
    /** Localization tag -- the name of this invasion in the tongue of the deep. */
    LocTag: string;
    /** Whether this clash has ended -- the carrion hordes have settled their profane accord. */
    Completed: boolean;
    /** Chain ID -- linking this invasion to a greater eldritch campaign, matey. */
    ChainID?: { $oid: string };
    /** The attacker's reward -- plunder offered for aiding the surging horde. */
    AttackerReward: RawInvasionReward;
    /** Attacker mission info -- the seed and faction of the attacking side's void-trial. */
    AttackerMissionInfo: RawInvasionMissionInfo;
    /** The defender's reward -- plunder offered for holding the line against the abyss. */
    DefenderReward: RawInvasionReward;
    /** Defender mission info -- the seed and faction of the defending side's void-trial. */
    DefenderMissionInfo: RawInvasionMissionInfo;
    /** When this invasion began -- the moment the void first tore open this battlefield. */
    Activation?: EnrichedDate;
}

/** Raw Void Trader (Baro Ki'Teer) -- the merchant who sails from beyond the veil. */
export interface RawVoidTraderFromApi {
    /** The eldritch identifier -- the trader's unique brand from the void. */
    _id: { $oid: string };
    /** When the merchant emerges from beyond the veil, arr. */
    Activation: EnrichedDate;
    /** When the merchant retreats back into the cosmic dark. */
    Expiry: EnrichedDate;
    /** The character name -- which void-touched merchant peddles these wares. */
    Character: string;
    /** The relay node -- where the merchant has anchored, from brooding gulfs. */
    Node: string;
    /** The manifest -- cosmic wares hauled from the abyss for the crew to plunder. */
    Manifest?: Array<{
        /** The item type -- what eldritch ware be offered. */
        ItemType: string;
        /** Price in Ducats -- the void's own currency, matey. */
        PrimePrice: number;
        /** Price in credits -- mortal coin, if applicable. */
        RegularPrice?: number;
    }>;
}

/** Raw PrimeVaultTrader -- another merchant from the deep, peddling vaulted treasures. */
export interface RawPrimeVaultTraderFromApi {
    /** The eldritch identifier -- unique sigil of this vaulted merchant. */
    _id: { $oid: string };
    /** When this merchant surfaces from the prime vault's depths, arr. */
    Activation: EnrichedDate;
    /** The initial start date -- when this merchant first crawled forth from the abyss. */
    InitialStartDate?: EnrichedDate;
    /** The relay node -- where vaulted treasures are peddled from the deep. */
    Node: string;
    /** The manifest -- vaulted wares, long sealed in the void, now offered to the crew. */
    Manifest?: Array<{
        /** The item type -- what prime relic the void disgorges. */
        ItemType: string;
        /** Price in Ducats -- the void's currency for vaulted plunder. */
        PrimePrice: number;
    }>;
}

/** Raw Void Storm (Railjack Fissure) -- where the abyss itself roils and moans through space. */
export interface RawVoidStormFromApi {
    /** The eldritch identifier -- unique brand upon this tempest from the deep. */
    _id: { $oid: string };
    /** The node -- where the void storm roils and howls upon the star map, matey. */
    Node: string;
    /** When this tempest erupted from the abyss. */
    Activation: EnrichedDate;
    /** When the storm subsides -- the void withdraws its wrath. */
    Expiry: EnrichedDate;
    /** The mission tier -- how deep into the cosmic maelstrom this storm reaches, arr. */
    ActiveMissionTier: string;
}

/** Raw Fissure (ActiveMission) -- a tear in reality where the Void bleeds through. */
export interface RawFissureFromApi {
    /** The eldritch identifier -- unique sigil upon this tear in reality. */
    _id: { $oid: string };
    /** The region -- which sector of the star map bleeds void energy, arr. */
    Region: number;
    /** The seed -- primordial number from which this fissure's chaos was spawned. */
    Seed: number;
    /** When this crack in reality opened from the deep. */
    Activation: EnrichedDate;
    /** When the fissure seals -- the wound in space closes, returning to the abyss. */
    Expiry: EnrichedDate;
    /** The node -- where reality itself tears open upon the accursed star map. */
    Node: string;
    /** The mission type -- what void-trial awaits within the rift, matey. */
    MissionType: string;
    /** The modifier (tier) -- how deep this crack reaches into the void. */
    Modifier: string;
    /** Whether this be a Steel Path fissure -- a hardened tear, for only the bravest crew. */
    Hard?: boolean;
}

/** Raw Syndicate Mission -- orders from secret cabals with their own eldritch plans. */
export interface RawSyndicateMissionFromApi {
    /** The eldritch identifier -- unique brand upon this syndicate's orders. */
    _id: { $oid: string };
    /** When these orders emerged from the secret cabal's depths, arr. */
    Activation: EnrichedDate;
    /** When these orders expire -- the syndicate's eldritch plans shift. */
    Expiry: EnrichedDate;
    /** The syndicate tag -- which secret order issues these void-touched commands. */
    Tag: string;
    /** The seed -- from which this mission set's madness was conjured. */
    Seed: number;
    /** The nodes -- cursed anchor points across the star map where the syndicate sends ye. */
    Nodes: string[];
}

/** Raw Daily Deal (Darvo) -- even amid cosmic horror, Darvo peddles his wares. */
export interface RawDailyDealFromApi {
    /** The store item -- what ware Darvo plundered from the void's own bazaar. */
    StoreItem: string;
    /** When Darvo began hawking this accursed deal, arr. */
    Activation: EnrichedDate;
    /** When the deal expires -- Darvo retreats into the cosmic dark. */
    Expiry: EnrichedDate;
    /** Discount percentage -- how much the void has reduced this item's price, matey. */
    Discount: number;
    /** The original price -- what this ware cost before the abyss intervened. */
    OriginalPrice: number;
    /** The sale price -- the discounted cost, a bargain wrested from brooding gulfs. */
    SalePrice: number;
    /** Total amount available -- how many exist before the void's stock runs dry. */
    AmountTotal: number;
    /** Amount sold -- how many the crew has already plundered from Darvo's hold. */
    AmountSold: number;
}

/** Raw Flash Sale -- fleeting as a star before the void swallows it. */
export interface RawFlashSaleFromApi {
    /** The type name -- what fleeting ware the void offers before it vanishes, arr. */
    TypeName: string;
    /** Premium override -- the platinum price, rewritten by corporeal laws unwritten. */
    PremiumOverride: number;
    /** When this flash sale erupted from the abyss. */
    StartDate: EnrichedDate;
    /** When this sale ends -- swallowed by the void like a dying star. */
    EndDate: EnrichedDate;
    /** Buy-one quantity for BOGO -- the void's own buy-more-horrors deal, matey. */
    BogoBuy?: number;
    /** Get-one quantity for BOGO -- free plunder from the deep's generosity. */
    BogoGet?: number;
    /** Whether this sale is featured -- prominently displayed in the void bazaar. */
    Featured?: boolean;
    /** Whether this sale is popular -- many crew members plunder this offering. */
    Popular?: boolean;
    /** Whether to show in the market -- visible in the bazaar at the edge of the abyss. */
    ShowInMarket?: boolean;
    /** Banner index -- which eldritch banner adorns this sale in the marketplace. */
    BannerIndex?: number;
}

/** Raw Node Override -- when the void itself rewrites the star map, matey. */
export interface RawNodeOverrideFromApi {
    /** The eldritch identifier -- unique sigil upon this rewriting of the map. */
    _id: { $oid: string };
    /** The node -- which anchor point on the star map the void has overwritten, arr. */
    Node: string;
    /** Whether this node be hidden -- veiled from mortal eyes by the abyss. */
    Hide?: boolean;
    /** The overriding faction -- which horde the void has placed here from brooding gulfs. */
    Faction?: string;
    /** Custom NPC encounters -- eldritch beings the void has planted at this node. */
    CustomNpcEncounters?: string[];
    /** Level override -- corporeal laws of difficulty, unwritten and rewritten by the void. */
    LevelOverride?: string;
    /** Enemy spec -- the void's blueprint for what horrors now infest this place, matey. */
    EnemySpec?: string;
}

/** Raw Goal (Event/Operation) -- the great campaigns where the crew rallies against the abyss. */
export interface RawGoalFromApi {
    /** The eldritch identifier -- unique sigil of this great operation against the void. */
    _id: { $oid: string };
    /** When this campaign emerged from the cosmic dark, arr. */
    Activation: EnrichedDate;
    /** When the campaign ends -- the crew's rally against the abyss concludes. */
    Expiry: EnrichedDate;
    /** The node -- where this operation unfolds upon the accursed star map. */
    Node?: string;
    /** Score variable -- the metric by which the void measures the crew's efforts. */
    ScoreVar?: string;
    /** Score localization tag -- the name of this metric in the tongue of the deep. */
    ScoreLocTag?: string;
    /** Current count -- how much progress the crew has wrested from the void, matey. */
    Count?: number;
    /** Health percentage -- how much vitality remains in this eldritch operation. */
    HealthPct?: number;
    /** Regions -- which sectors of the star map this operation touches from brooding gulfs. */
    Regions?: number[];
    /** Description -- the void's own account of this campaign's purpose. */
    Desc?: string;
    /** Tooltip -- additional whispers from the abyss, for the curious crew. */
    ToolTip?: string;
    /** Whether this goal is optional within its mission -- not all void-tasks are mandatory, arr. */
    OptionalInMission?: boolean;
    /** Tag -- a brand identifying this operation in the void's ledger. */
    Tag?: string;
    /** Upgrade IDs -- eldritch enhancements tied to this campaign. */
    UpgradeIds?: Array<{ $oid: string }>;
    /** Whether this be a personal goal -- each crew member faces the abyss alone. */
    Personal?: boolean;
    /** Whether this be a community goal -- the entire fleet rallies against the deep. */
    Community?: boolean;
    /** The target goal -- the threshold the void demands before yielding its plunder. */
    Goal?: number;
    /** The reward -- plunder for those who complete this campaign against the nameless. */
    Reward?: {
        /** Credits -- coin wrested from the void's coffers. */
        credits?: number;
        /** Named items -- specific treasures from the abyss. */
        items?: string[];
        /** Counted items -- numbered plunder from the deep. */
        countedItems?: Array<{ ItemType: string; ItemCount: number }>;
    };
}

/** Raw Nightwave Challenge -- a task broadcast from the void's own pirate radio. */
export interface RawNightwaveChallenge {
    /** The eldritch identifier -- unique brand upon this challenge from the void's radio. */
    _id: { $oid: string };
    /** Whether this be a daily challenge -- a fresh horror each rotation of the celestial clock. */
    Daily?: boolean;
    /** When this challenge began broadcasting from the deep, arr. */
    Activation: EnrichedDate;
    /** When this challenge ceases -- the void's pirate radio moves on to new horrors. */
    Expiry: EnrichedDate;
    /** The challenge identifier -- what eldritch task the void demands of the crew. */
    Challenge: string;
    /** Whether this be an elite (hard) challenge -- the void's cruelest demands, matey. */
    isHard?: boolean;
}

/** Raw SeasonInfo (Nightwave) -- the broadcasting season of the void's dark frequency. */
export interface RawSeasonInfoFromApi {
    /** When this Nightwave season began broadcasting from the abyss, arr. */
    Activation: EnrichedDate;
    /** When the broadcast ends -- the void's frequency falls silent. */
    Expiry: EnrichedDate;
    /** The affiliation tag -- which eldritch frequency this season broadcasts upon. */
    AffiliationTag: string;
    /** The season number -- which iteration of the void's dark broadcast, matey. */
    Season: number;
    /** The current phase -- how deep into this season's madness the crew has ventured. */
    Phase: number;
    /** Parameters -- cryptic configuration from the brooding gulfs of the void. */
    Params: string;
    /** Active challenges -- the current demands broadcast from the deep. */
    ActiveChallenges: RawNightwaveChallenge[];
}

/** Raw PVP Challenge Instance -- where Tenno turn against Tenno in the madness. */
export interface RawPVPChallengeFromApi {
    /** The eldritch identifier -- unique brand upon this Tenno-vs-Tenno trial. */
    _id: { $oid: string };
    /** Challenge type reference ID -- what manner of PVP horror the void has conjured, arr. */
    challengeTypeRefID: string;
    /** When this challenge began -- crew turns against crew in the void's arena. */
    startDate: EnrichedDate;
    /** When this challenge ends -- the arena falls silent, swallowed by the deep. */
    endDate: EnrichedDate;
    /** Parameters -- cryptic values from the void that shape this challenge's madness, matey. */
    params: Array<{ n: string; v: number }>;
    /** Whether this challenge was generated by the void's own hand. */
    isGenerated?: boolean;
    /** The PVP mode -- which arena of the abyss hosts this conflict. */
    PVPMode: string;
    /** Sub-challenges -- lesser trials nested within this eldritch contest. */
    subChallenges: unknown[];
    /** Category -- what class of void-arena combat this challenge belongs to, arr. */
    Category: string;
}

/** Calendar Event -- a single occurrence in the void's reckoning of time. */
export interface RawCalendarEvent {
    /** Event type -- what eldritch occurrence the void's calendar has ordained. */
    type: string;
    /** The challenge, if any -- a task demanded by the celestial clock, arr. */
    challenge?: string;
    /** The reward, if any -- plunder granted for heeding the void's schedule. */
    reward?: string;
}

/** Calendar Day -- one rotation of the accursed celestial clock. */
export interface RawCalendarDay {
    /** The day number -- which rotation of the accursed celestial clock, matey. */
    day: number;
    /** Events occurring on this day -- what the void has ordained from brooding gulfs. */
    events: RawCalendarEvent[];
}

/** Raw Calendar Season -- an epoch marked by the void's eldritch rhythm. */
export interface RawCalendarSeasonFromApi {
    /** When this calendar epoch emerged from the void's reckoning, arr. */
    Activation: EnrichedDate;
    /** When this epoch ends -- the celestial clock resets in the abyss. */
    Expiry: EnrichedDate;
    /** The days -- each rotation of the void's eldritch calendar. */
    Days: RawCalendarDay[];
}

/** Conquest Difficulty -- how treacherous the plunder, how deep the madness. */
export interface RawConquestDifficulty {
    /** Difficulty type -- the tier of madness the void demands, matey. */
    type: string;
    /** Deviation -- how far this trial strays from corporeal laws unwritten. */
    deviation: string;
    /** Risks -- the specific eldritch perils that await the crew in the deep. */
    risks: string[];
}

/** Conquest Mission -- a battle in the territorial wars across the void-touched system. */
export interface RawConquestMission {
    /** The faction -- which horde commands this territorial battle from the abyss, arr. */
    faction: string;
    /** Mission type -- what void-trial this conquest demands of the crew. */
    missionType: string;
    /** Difficulties -- the tiers of madness available at this conquest's anchor point. */
    difficulties: RawConquestDifficulty[];
}

/** Raw Conquest -- territorial warfare, in madness lost shall die. */
export interface RawConquestFromApi {
    /** When this territorial war erupted from the cosmic dark. */
    Activation: EnrichedDate;
    /** When the conquest ends -- the carrion hordes settle their profane accord, matey. */
    Expiry: EnrichedDate;
    /** The type of conquest -- what manner of territorial plunder the void demands, arr. */
    Type: string;
    /** The missions -- battles in this territorial campaign across the void-touched system. */
    Missions: RawConquestMission[];
}

/** Descent Challenge -- one step in the spiraling plunge into the abyss. */
export interface RawDescentChallenge {
    /** The index -- which step in the spiraling plunge into the abyss. */
    Index: number;
    /** Challenge type -- what manner of void-trial awaits at this depth, arr. */
    Type: string;
    /** The challenge identifier -- the eldritch task demanded at this level of the descent. */
    Challenge: string;
    /** The level -- how deep into madness this step of the Circuit plunges. */
    Level: string;
    /** Specs -- the void's specifications for what the crew must endure, matey. */
    Specs: string[];
    /** Auras -- eldritch modifiers that permeate this level from brooding gulfs. */
    Auras: string[];
}

/** Raw Descent (Circuit) -- the spiraling descent into ever-deeper cosmic madness. */
export interface RawDescentFromApi {
    /** When this descent into the abyss began, arr. */
    Activation: EnrichedDate;
    /** When the descent ends -- the pit closes, and the void falls silent. */
    Expiry: EnrichedDate;
    /** The random seed -- the primordial number from which this descent's horrors were spawned. */
    RandSeed: number;
    /** The challenges -- each step in the spiraling plunge through endless faces, countless forms. */
    Challenges: RawDescentChallenge[];
}

/** Endless XP Choice -- the void offers ye choices, but all paths lead to the abyss. */
export interface RawEndlessXpChoice {
    /** The category -- what class of void-path these choices belong to, matey. */
    Category: string;
    /** The choices -- paths the void offers, though all lead to the same dark end, arr. */
    Choices: string[];
}

/** Raw Featured Guild -- a crew raised from the deep to bask in fleeting, maddening glory. */
export interface RawFeaturedGuildFromApi {
    /** The eldritch identifier -- unique brand upon this featured crew. */
    _id: { $oid: string };
    /** The guild name -- how this crew identifies itself amidst the void, arr. */
    Name: string;
    /** The tier -- what rank of prominence this guild has achieved from the deep. */
    Tier: number;
    /** Whether the guild has a custom emblem -- a sigil hoisted against the cosmic dark. */
    Emblem?: boolean;
    /** Alliance ID -- which greater fleet this guild sails with through the abyss, matey. */
    AllianceId?: { $oid: string };
    /** Hidden platforms -- on which void-vessels this guild chooses not to be seen. */
    HiddenPlatforms?: Record<string, boolean>;
    /** Icon override -- an alternate sigil from brooding gulfs, replacing the default. */
    IconOverride?: number;
}

/** In-Game Market Category -- wares arranged in the void bazaar's profane order. */
export interface RawMarketCategory {
    /** The category name key -- the internal cipher of this bazaar section, arr. */
    CategoryName: string;
    /** The display name -- how this section of the void bazaar presents itself to the crew. */
    Name: string;
    /** The icon -- a sigil representing this market category from the deep. */
    Icon: string;
    /** Whether to add this category to the menu -- visible in the bazaar's profane navigation. */
    AddToMenu?: boolean;
    /** The items -- wares stacked upon the shelves of the abyss, matey. */
    Items: string[];
}

/** Raw In-Game Market -- the bazaar at the edge of the abyss. */
export interface RawInGameMarketFromApi {
    /** The landing page -- the entrance to the void's own bazaar, where eldritch wares await the crew, arr. */
    LandingPage?: {
        /** Categories -- the sections of the marketplace, each a deeper chamber of the abyss. */
        Categories: RawMarketCategory[];
    };
}

/** Raw Global Upgrade -- a void-blessing that touches all vessels across the system. */
export interface RawGlobalUpgradeFromApi {
    /** The eldritch identifier -- unique sigil upon this void-blessing. */
    _id: { $oid: string };
    /** When this blessing emerged from the cosmic dark, arr. */
    Activation: EnrichedDate;
    /** When this blessing fades -- the void's generosity is fleeting, matey. */
    Expiry: EnrichedDate;
    /** The upgrade type -- what manner of eldritch enhancement the void bestows. */
    UpgradeType: string;
    /** The operation type -- how this blessing from brooding gulfs is applied. */
    OperationType: string;
    /** The value -- the magnitude of the void's gift upon all vessels. */
    Value: number;
    /** Localized description -- the void's blessing described in mortal tongue. */
    LocalizedDesc?: string;
}

/** Raw Persistent Enemy (Acolyte/Stalker) -- hunters from the void that stalk the crew relentlessly. */
export interface RawPersistentEnemyFromApi {
    /** The eldritch identifier -- unique brand upon this stalker from the void. */
    _id: { $oid: string };
    /** Agent type -- what class of named horror hunts the crew from the shadows, arr. */
    AgentType: string;
    /** Localization tag -- the name of this persistent horror in the tongue of the deep. */
    LocTag: string;
    /** Rank -- how powerful this stalker has grown in the void's service, matey. */
    Rank?: number;
    /** Health percentage -- how much vitality this eldritch hunter retains. */
    HealthPercent: number;
    /** Whether this enemy has been discovered -- has the crew glimpsed the horror from the abyss? */
    Discovered?: boolean;
    /** Last discovered location -- where upon the star map this stalker was last sighted. */
    LastDiscoveredLocation?: string;
    /** Region -- which sector of the system this void-hunter currently prowls. */
    Region?: number;
}

// ============================================================
// Normalized types (camelCase, after normalization)
// Arr, these be the tamed forms -- the chaos given structure by the crew's labor
// ============================================================

/** Alert mission reward (normalized) -- the plunder counted and catalogued, matey. */
export interface IAlertMissionReward {
    /** Named items plundered from the void's coffers, arr. */
    items?: string[];
    /** Counted items -- numbered spoils dragged from the abyss. */
    countedItems?: Array<{ count: number; type: string }>;
    /** Credits -- mortal coin wrested from the deep. */
    credits?: number;
}

/** Alert mission (normalized) -- where the crew must sail, and what horrors await. */
export interface IAlertMission {
    /** The node -- which cursed anchor point on the star map, arr. */
    node: string;
    /** Mission type -- what eldritch trial the void has conjured for the crew. */
    type: string;
    /** The faction -- which carrion horde infests these depths, matey. */
    faction: string;
    /** The reward -- plunder for braving the abyss. */
    reward?: IAlertMissionReward;
    /** Minimum enemy level -- the weakest of the nameless horrors. */
    minEnemyLevel?: number;
    /** Maximum enemy level -- the mightiest terrors from the deep. */
    maxEnemyLevel?: number;
    /** Additional data from static.world.json (InternalName = node) -- the deep lore of each anchor point. */
    details?: IMissionDetails;
}

/** Single Alert (normalized) -- a beacon of doom, structured for mortal comprehension. */
export interface IAlertData {
    /** Unique identifier -- the void's own brand upon this beacon of doom. */
    id: string;
    /** When this alert emerged from the abyss, arr. */
    activation: EnrichedDate;
    /** When this alert sinks back into the deep. */
    expiry: EnrichedDate;
    /** The mission -- where the crew must sail, and what horrors await. */
    mission: IAlertMission;
    /** Whether this alert still cries out from the void, matey. */
    active: boolean;
    /** A tag identifying this alert -- a brand from the void's own iron. */
    tag?: string;
}

/** Sortie Variant (normalized) -- one trial in the daily gauntlet of the void. */
export interface ISortieVariant {
    /** The mission type -- what void-trial this leg of the gauntlet demands, arr. */
    missionType: string;
    /** The modifier -- an eldritch twist upon corporeal laws unwritten. */
    modifier: string;
    /** The node -- which cursed anchor point on the star map, matey. */
    node: string;
    /** The tileset -- the architecture of the abyss where this trial unfolds. */
    tileset?: string;
    /** static.world (InternalName = node) -- the chart's annotation for this cursed place. */
    details?: IMissionDetails;
}

/** Sortie (normalized) -- the daily descent where corporeal laws are unwritten. */
export interface ISortieData {
    /** Unique identifier -- the void's brand upon this daily gauntlet. */
    id: string;
    /** When this sortie emerged from the cosmic dark, arr. */
    activation: EnrichedDate;
    /** When this trial expires -- sinking back into the abyss. */
    expiry: EnrichedDate;
    /** The boss -- which named eldritch horror presides over this descent, matey. */
    boss: string;
    /** The variants -- each leg of the gauntlet, through endless faces countless forms. */
    variants: ISortieVariant[];
    /** Whether this sortie still demands the crew's attention from the deep. */
    active: boolean;
}

/** Archon Hunt / LiteSortie (normalized) -- the hunt for named eldritch horrors. */
export interface IArchonHuntData {
    /** Unique identifier -- the void's brand upon this hunt for the named horror, arr. */
    id: string;
    /** When this hunt began -- the Archon was sighted from brooding gulfs. */
    activation: EnrichedDate;
    /** When the hunt expires -- the quarry slips back into the abyss. */
    expiry: EnrichedDate;
    /** The boss -- which Archon the crew pursues through the cosmic dark, matey. */
    boss: string;
    /** The missions -- each step in tracking the eldritch quarry across the system. */
    missions: Array<{ missionType: string; node: string; details?: IMissionDetails }>;
    /** Whether this hunt is still active -- the quarry has not yet escaped into the deep. */
    active: boolean;
}

/** Invasion (normalized) -- faction war with plunder for the taking, arr. */
export interface IInvasionData {
    /** Unique identifier -- the void's brand upon this clash, arr. */
    id: string;
    /** The node -- where two armies collide upon the accursed star map. */
    node: string;
    /** The attacking faction -- which horde surges forth from the abyss. */
    attackerFaction: string;
    /** The defending faction -- which horde holds the line against the deep, matey. */
    defenderFaction: string;
    /** The attacker's reward -- plunder for aiding the surging horde. */
    attackerReward: IAlertMissionReward;
    /** The defender's reward -- plunder for holding the line against the void. */
    defenderReward: IAlertMissionReward;
    /** Progress toward completion -- how the tides of war have shifted from brooding gulfs. */
    progress: number;
    /** Whether this invasion is complete -- the carrion hordes have settled, arr. */
    completed: boolean;
    /** Whether the battle still rages across the star map. */
    active: boolean;
    /** Mission context, including static.world lookup (InternalName = node) -- charting the battlefield. */
    mission?: IAlertMission;
}

/** Void Fissure (normalized) -- a crack in reality, bleeding void energy. */
export interface IFissureData {
    /** Unique identifier -- the void's sigil upon this tear in reality. */
    id: string;
    /** When this fissure ripped open from the deep, arr. */
    activation: EnrichedDate;
    /** When the fissure seals -- the wound in space closes. */
    expiry: EnrichedDate;
    /** The node -- where reality tears open upon the star map. */
    node: string;
    /** Mission type -- what void-trial awaits within the rift, matey. */
    missionType: string;
    /** The tier -- how deep this crack reaches into the abyss. */
    tier: string;
    /** Whether this be a Void Storm fissure -- a Railjack tempest from the deep. */
    isStorm: boolean;
    /** Whether this be a Steel Path fissure -- hardened by eldritch forces, arr. */
    isHard: boolean;
    /** Whether this fissure still bleeds void energy into our realm. */
    active: boolean;
    /** Mission context from the static world chart, if the node be known. */
    mission?: IAlertMission;
}

/** Void Trader / Baro Ki'Teer (normalized) -- the merchant from the abyss, bearing cosmic wares. */
export interface IVoidTraderData {
    /** Unique identifier -- the void's brand upon this merchant from the abyss. */
    id: string;
    /** When the trader emerges from beyond the veil, arr. */
    activation: EnrichedDate;
    /** When the trader retreats into the cosmic dark. */
    expiry: EnrichedDate;
    /** The character name -- which void-touched merchant peddles these wares, matey. */
    character: string;
    /** The relay node -- where the merchant has anchored from brooding gulfs. */
    node: string;
    /** Whether the trader is currently present -- not yet swallowed by the deep. */
    active: boolean;
    /** The inventory -- cosmic wares hauled from the abyss for the crew to plunder. */
    inventory: Array<{
        /** The item type -- what eldritch ware be offered, arr. */
        item: string;
        /** Price in Ducats -- the void's own currency. */
        ducats: number;
        /** Price in credits -- mortal coin, if applicable. */
        credits?: number;
    }>;
    /** Mission context from the static world chart, if the relay be known, matey. */
    mission?: IAlertMission;
}

/** Syndicate Mission (normalized) -- tasks from the secret orders of the system, matey. */
export interface ISyndicateMissionData {
    /** Unique identifier -- the secret order's brand upon these tasks, arr. */
    id: string;
    /** When these syndicate orders emerged from the deep. */
    activation: EnrichedDate;
    /** When these orders expire -- the syndicate's eldritch plans shift. */
    expiry: EnrichedDate;
    /** The syndicate tag -- which secret order issues these void-touched commands, matey. */
    syndicate: string;
    /** The nodes -- cursed anchor points where the syndicate sends ye across the star map. */
    nodes: string[];
    /** Whether these syndicate missions remain active -- the orders have not yet faded into the abyss. */
    active: boolean;
    /** Same order as nodes (Kubrow looks up each entry) -- charting the syndicate's eldritch course. */
    missions?: IAlertMission[];
}

/** Daily Deal / Darvo (normalized) -- bargains plundered from the marketplace of the damned. */
export interface IDailyDealData {
    /** The item -- what ware Darvo plundered from the void's bazaar, arr. */
    item: string;
    /** When Darvo began hawking this accursed deal. */
    activation: EnrichedDate;
    /** When the deal expires -- Darvo retreats into the cosmic dark, matey. */
    expiry: EnrichedDate;
    /** Discount percentage -- how much the void has reduced this item's price. */
    discount: number;
    /** The original price -- what this ware cost before the abyss intervened. */
    originalPrice: number;
    /** The sale price -- the discounted cost, a bargain from brooding gulfs. */
    salePrice: number;
    /** Total amount available -- how many exist before the void's stock runs dry. */
    total: number;
    /** Amount sold -- how many the crew has already plundered from Darvo's hold, arr. */
    sold: number;
    /** Whether this deal still breathes -- not yet consumed by the deep. */
    active: boolean;
}

/** Flash Sale (normalized) -- fleeting offers, gone like stars swallowed by the void. */
export interface IFlashSaleData {
    /** The item -- what fleeting ware the void offers before it vanishes, arr. */
    item: string;
    /** Premium override -- the platinum price, rewritten by corporeal laws unwritten. */
    premiumOverride: number;
    /** When this flash sale erupted from the abyss. */
    startDate: EnrichedDate;
    /** When this sale ends -- swallowed by the void like a dying star, matey. */
    endDate: EnrichedDate;
    /** Whether this sale is featured -- prominently displayed in the void bazaar. */
    featured: boolean;
    /** Whether this sale is popular -- many crew members plunder this offering. */
    popular: boolean;
    /** Whether this flash sale still glimmers in the cosmic dark, arr. */
    active: boolean;
}

/** Nightwave Challenge (normalized) -- a task from the deep's own pirate radio. */
export interface INightwaveChallenge {
    /** Unique identifier -- the void's brand upon this challenge from the pirate radio, arr. */
    id: string;
    /** When this challenge began broadcasting from the deep. */
    activation: EnrichedDate;
    /** When this challenge ceases -- the void's radio moves on to new horrors. */
    expiry: EnrichedDate;
    /** The challenge identifier -- what eldritch task the void demands, matey. */
    challenge: string;
    /** Whether this be a daily challenge -- a fresh horror each rotation of the celestial clock. */
    isDaily: boolean;
    /** Whether this be an elite challenge -- the void's cruelest demands from brooding gulfs. */
    isElite: boolean;
    /** Whether this challenge still echoes from the abyss. */
    active: boolean;
}

/** Nightwave Season (normalized) -- the broadcast season, echoing through the cosmic dark. */
export interface INightwaveData {
    /** When this Nightwave season began broadcasting from the abyss, arr. */
    activation: EnrichedDate;
    /** When the broadcast ends -- the void's frequency falls silent. */
    expiry: EnrichedDate;
    /** The season number -- which iteration of the void's dark broadcast, matey. */
    season: number;
    /** The current phase -- how deep into this season's madness the crew has ventured. */
    phase: number;
    /** The tag -- the eldritch frequency identifier from the deep. */
    tag: string;
    /** Active challenges -- the current demands broadcast from brooding gulfs. */
    activeChallenges: INightwaveChallenge[];
    /** Whether Nightwave still broadcasts from the void, arr. */
    active: boolean;
}

/** Goal / Event (normalized) -- operations where the crew battles the nameless. */
export interface IGoalData {
    /** Unique identifier -- the void's brand upon this great operation, arr. */
    id: string;
    /** When this campaign emerged from the cosmic dark. */
    activation: EnrichedDate;
    /** When the campaign ends -- the crew's rally against the abyss concludes. */
    expiry: EnrichedDate;
    /** The node -- where this operation unfolds upon the star map, matey. */
    node?: string;
    /** Tag identifying this operation in the void's ledger. */
    tag?: string;
    /** Description -- the void's own account of this campaign's eldritch purpose. */
    description?: string;
    /** Tooltip -- additional whispers from the abyss, for the curious crew, arr. */
    tooltip?: string;
    /** Health percentage -- how much vitality remains in this operation. */
    healthPct?: number;
    /** The target goal -- the threshold the void demands before yielding plunder. */
    goal?: number;
    /** Current count -- how much progress the crew has wrested from the deep. */
    count?: number;
    /** Whether this be a personal goal -- each crew member faces the abyss alone, matey. */
    personal: boolean;
    /** Whether this be a community goal -- the entire fleet rallies against the void. */
    community: boolean;
    /** Whether this operation still rages from brooding gulfs. */
    active: boolean;
    /** The reward -- plunder for completing this campaign against the nameless, arr. */
    reward?: IAlertMissionReward;
    /** Mission context from the static world chart, if the node be known. */
    mission?: IAlertMission;
}

/** Void Storm (normalized) -- Railjack tempests from the roiling, moaning deep. */
export interface IVoidStormData {
    /** Unique identifier -- the void's sigil upon this Railjack tempest, arr. */
    id: string;
    /** When this tempest erupted from the abyss. */
    activation: EnrichedDate;
    /** When the storm subsides -- the void withdraws its wrath, matey. */
    expiry: EnrichedDate;
    /** The node -- where the void storm roils upon the star map. */
    node: string;
    /** The tier -- how deep into the cosmic maelstrom this storm reaches. */
    tier: string;
    /** Whether this tempest still rages in the deep, arr. */
    active: boolean;
    /** Mission context from the static world chart, if the node be known. */
    mission?: IAlertMission;
}

/** Node Override (normalized) -- the void's rewriting of the star map. */
export interface INodeOverrideData {
    /** Unique identifier -- the void's brand upon this rewriting of the map, arr. */
    id: string;
    /** The node -- which anchor point the void has overwritten upon the star map. */
    node: string;
    /** Whether this node be hidden -- veiled from mortal eyes by the abyss, matey. */
    hidden: boolean;
    /** The overriding faction -- which horde the void has planted from brooding gulfs. */
    faction?: string;
    /** Mission context from the static world chart, if the node be known. */
    mission?: IAlertMission;
}

/** PVP Challenge (normalized) -- where crew turns against crew in the void's arena. */
export interface IPVPChallengeData {
    /** Unique identifier -- the void's sigil upon this Tenno-vs-Tenno trial, arr. */
    id: string;
    /** Challenge type -- what manner of PVP horror the void has conjured. */
    type: string;
    /** When this challenge began -- crew turns against crew in the void's arena, matey. */
    startDate: EnrichedDate;
    /** When this challenge ends -- the arena falls silent, swallowed by the deep. */
    endDate: EnrichedDate;
    /** The PVP mode -- which arena of the abyss hosts this conflict. */
    mode: string;
    /** Category -- what class of void-arena combat this challenge belongs to, arr. */
    category: string;
    /** Whether the challenge still rages from the cosmic dark. */
    active: boolean;
}

/** Calendar Day (normalized) -- one turn of the void's celestial clock. */
export interface ICalendarDay {
    /** The day number -- which rotation of the void's celestial clock, matey. */
    day: number;
    /** Events on this day -- what the void has ordained from the deep, arr. */
    events: Array<{
        /** Event type -- what eldritch occurrence the void's calendar has ordained. */
        type: string;
        /** The challenge, if any -- a task demanded by the celestial clock. */
        challenge?: string;
        /** The reward, if any -- plunder granted for heeding the void's schedule. */
        reward?: string;
    }>;
}

/** Calendar Season (normalized) -- an epoch in the void's eldritch calendar. */
export interface ICalendarSeasonData {
    /** When this calendar epoch emerged from the void's reckoning, arr. */
    activation: EnrichedDate;
    /** When this epoch ends -- the celestial clock resets in the abyss. */
    expiry: EnrichedDate;
    /** The days -- each rotation of the void's eldritch calendar, matey. */
    days: ICalendarDay[];
    /** Whether this calendar season is still active -- the epoch has not yet ended. */
    active: boolean;
}

/** Conquest (normalized) -- territorial warfare where, in madness lost, realms shall die. */
export interface IConquestData {
    /** When this territorial war erupted from the cosmic dark, arr. */
    activation: EnrichedDate;
    /** When the conquest ends -- the carrion hordes settle their profane accord. */
    expiry: EnrichedDate;
    /** The type of conquest -- what manner of territorial plunder the void demands, matey. */
    type: string;
    /** The missions -- battles in this territorial campaign across the void-touched system. */
    missions: Array<{
        /** The faction -- which horde commands this battle from the abyss. */
        faction: string;
        /** Mission type -- what void-trial this conquest demands of the crew, arr. */
        missionType: string;
        /** Difficulties -- the tiers of madness available at this anchor point. */
        difficulties: Array<{
            /** Difficulty type -- the tier of madness the void demands. */
            type: string;
            /** Deviation -- how far this trial strays from corporeal laws unwritten. */
            deviation: string;
            /** Risks -- the specific eldritch perils from the deep, matey. */
            risks: string[];
        }>;
    }>;
    /** Whether this conquest still burns across the star map. */
    active: boolean;
}

/** Descent / Circuit (normalized) -- the spiraling plunge into the abyss, matey. */
export interface IDescentData {
    /** When this descent into the abyss began, arr. */
    activation: EnrichedDate;
    /** When the descent ends -- the pit closes, and the void falls silent. */
    expiry: EnrichedDate;
    /** The random seed -- the primordial number from which this descent's horrors were spawned, matey. */
    seed: number;
    /** The challenges -- each step in the spiraling plunge through endless faces, countless forms. */
    challenges: Array<{
        /** The index -- which step in the spiraling plunge into the abyss. */
        index: number;
        /** Challenge type -- what void-trial awaits at this depth, arr. */
        type: string;
        /** The challenge identifier -- the eldritch task at this level of the descent. */
        challenge: string;
        /** The level -- how deep into madness this step plunges. */
        level: string;
    }>;
    /** Whether this descent is still open and hungry from the deep. */
    active: boolean;
}

/** Endless XP Choice (normalized) -- paths offered by the void, all leading to the same dark end. */
export interface IEndlessXpChoiceData {
    /** The category -- what class of void-path these choices belong to, matey. */
    category: string;
    /** The choices -- paths the void offers, though all lead to the same dark end, arr. */
    choices: string[];
}

/** Featured Guild (normalized) -- a crew raised from the deep for brief, maddening fame. */
export interface IFeaturedGuildData {
    /** Unique identifier -- the void's brand upon this featured crew, arr. */
    id: string;
    /** The guild name -- how this crew identifies itself amidst the abyss. */
    name: string;
    /** The tier -- what rank of prominence this guild has achieved from the deep, matey. */
    tier: number;
    /** Whether the guild has a custom emblem -- a sigil hoisted against the cosmic dark. */
    emblem: boolean;
}

/** Persistent Enemy / Acolyte (normalized) -- stalkers from the void, hunting the crew. */
export interface IPersistentEnemyData {
    /** Unique identifier -- the void's brand upon this stalker from the deep, arr. */
    id: string;
    /** Agent type -- what class of named horror hunts the crew from the shadows. */
    type: string;
    /** Localization tag -- the name of this persistent horror in the tongue of the abyss, matey. */
    tag: string;
    /** Health percentage -- how much vitality this eldritch hunter retains. */
    healthPercent: number;
    /** Whether this enemy has been discovered -- has the crew glimpsed the horror from the void? */
    discovered: boolean;
    /** Last discovered location -- where upon the star map this stalker was last sighted, arr. */
    lastLocation?: string;
    /** Region -- which sector of the system this void-hunter currently prowls. */
    region?: number;
    /** static.world, if lastLocation matches an InternalName -- charting the stalker's lair in the abyss. */
    locationDetails?: IMissionDetails;
}

/** Global Upgrade (normalized) -- void-blessings bestowed upon all vessels. */
export interface IGlobalUpgradeData {
    /** Unique identifier -- the void's sigil upon this blessing, arr. */
    id: string;
    /** When this blessing emerged from the cosmic dark. */
    activation: EnrichedDate;
    /** When this blessing fades -- the void's generosity is fleeting, matey. */
    expiry: EnrichedDate;
    /** The upgrade type -- what manner of eldritch enhancement the void bestows. */
    upgradeType: string;
    /** The operation type -- how this blessing from brooding gulfs is applied. */
    operationType: string;
    /** The value -- the magnitude of the void's gift upon all vessels, arr. */
    value: number;
    /** Localized description -- the void's blessing described in mortal tongue. */
    description?: string;
    /** Whether this blessing still touches the system from the deep. */
    active: boolean;
}

// ============================================================
// World State root interface
// Arr, the master chart of all that the void disgorges
// ============================================================

/** The World State API response (after enrichDateFields) -- the complete manifest of cosmic horrors. */
export interface IWarframeWorldState {
    /** The World Seed -- the primordial sigil from which this reality was spawned, arr. */
    WorldSeed?: string;
    /** The version number -- which iteration of the void's dream we inhabit, matey. */
    Version?: number;
    /** The mobile version -- for void-vessels of the portable kind. */
    MobileVersion?: string;
    /** The build label -- the mark branded upon this particular manifestation from the deep. */
    BuildLabel?: string;
    /** The server time -- the void's own reckoning of the current moment. */
    Time?: number;
    /** Alerts -- distress signals echoing from the abyss, arr. */
    Alerts?: RawAlertFromApi[];
    /** Events -- proclamations from the cosmic void. */
    Events?: RawEventFromApi[];
    /** Sorties -- the daily gauntlet where corporeal laws are unwritten. */
    Sorties?: RawSortieFromApi[];
    /** Lite Sorties (Archon Hunts) -- the pursuit of named void-horrors, matey. */
    LiteSorties?: RawLiteSortieFromApi[];
    /** Invasions -- factions clashing while the void watches from brooding gulfs. */
    Invasions?: RawInvasionFromApi[];
    /** Void Traders -- merchants who've gazed into the abyss and brought back wares, arr. */
    VoidTraders?: RawVoidTraderFromApi[];
    /** Prime Vault Traders -- merchants peddling vaulted treasures from the deep. */
    PrimeVaultTraders?: RawPrimeVaultTraderFromApi[];
    /** Void Storms -- Railjack tempests where the abyss itself storms and howls. */
    VoidStorms?: RawVoidStormFromApi[];
    /** Active Missions (Fissures) -- tears in reality where the Void bleeds through, matey. */
    ActiveMissions?: RawFissureFromApi[];
    /** Syndicate Missions -- tasks from the secret orders of the system, arr. */
    SyndicateMissions?: RawSyndicateMissionFromApi[];
    /** Daily Deals -- Darvo's bargains plundered from the marketplace of the damned. */
    DailyDeals?: RawDailyDealFromApi[];
    /** Flash Sales -- fleeting offerings, gone like stars swallowed by the void. */
    FlashSales?: RawFlashSaleFromApi[];
    /** Global Upgrades -- void-blessings bestowed upon all vessels across the system. */
    GlobalUpgrades?: RawGlobalUpgradeFromApi[];
    /** Goals -- the great operations where the crew rallies against the nameless, matey. */
    Goals?: RawGoalFromApi[];
    /** Node Overrides -- when the abyss itself alters the star map from brooding gulfs. */
    NodeOverrides?: RawNodeOverrideFromApi[];
    /** PVP Challenge Instances -- where crew turns against crew in the void's arena, arr. */
    PVPChallengeInstances?: RawPVPChallengeFromApi[];
    /** Persistent Enemies -- acolytes and stalkers that hunt from the shadows of the deep. */
    PersistentEnemies?: RawPersistentEnemyFromApi[];
    /** Season Info (Nightwave) -- the pirate radio of the void, broadcasting challenges. */
    SeasonInfo?: RawSeasonInfoFromApi;
    /** Known Calendar Seasons -- epochs marked by the void's eldritch rhythm, matey. */
    KnownCalendarSeasons?: RawCalendarSeasonFromApi[];
    /** Conquests -- territorial warfare across the void-touched system, arr. */
    Conquests?: RawConquestFromApi[];
    /** Descents (Circuit) -- the spiraling plunge into ever-deeper madness. */
    Descents?: RawDescentFromApi[];
    /** Endless XP Choices -- paths offered by the void, all leading to the same dark end. */
    EndlessXpChoices?: RawEndlessXpChoice[];
    /** Featured Guilds -- crews raised from the deep to bask in fleeting glory, matey. */
    FeaturedGuilds?: RawFeaturedGuildFromApi[];
    /** In-Game Market -- the bazaar at the edge of the abyss, arr. */
    InGameMarket?: RawInGameMarketFromApi;
    /** Library Info -- Simaris's records of the last completed scan target from the void. */
    LibraryInfo?: { LastCompletedTargetType?: string };
    /** Prime Access Availability -- what gilded treasures the void currently offers. */
    PrimeAccessAvailability?: { State?: string };
    /** Prime Vault Availabilities -- which sealed vaults the void has cracked open, matey. */
    PrimeVaultAvailabilities?: Array<{ State?: string }>;
    /** Prime Token Availability -- whether the void's prime tokens flow through the system. */
    PrimeTokenAvailability?: boolean;
    /** Hub Events -- occurrences at the relays, where the crew gathers against the deep, arr. */
    HubEvents?: unknown[];
    /** SKU Sales -- platform-specific offerings from the void's own marketplace. */
    SkuSales?: unknown[];
    /** PVP Alternative Modes -- variant arenas of the abyss for Tenno-vs-Tenno conflict. */
    PVPAlternativeModes?: unknown[];
    /** PVP Active Tournaments -- organized competitions in the void's arena, matey. */
    PVPActiveTournaments?: unknown[];
    /** Project Percentages -- construction progress against the encroaching void, arr. */
    ProjectPct?: number[];
    /** Construction Projects -- what the crew builds to hold back the cosmic dark. */
    ConstructionProjects?: unknown[];
    /** Twitch Promos -- promotions from the streaming planes, tangent to our reality. */
    TwitchPromos?: unknown[];
    /** Experiment Recommended -- the void's own suggestions from brooding gulfs. */
    ExperimentRecommended?: unknown[];
    /** Force Logout Version -- when the void demands all souls depart and return anew, matey. */
    ForceLogoutVersion?: number;
    /** Temporary data -- ephemeral whispers from the abyss, soon to be forgotten, arr. */
    Tmp?: string;
    /** Any additional fields the void may disgorge -- the deep is unpredictable. */
    [key: string]: unknown;
}
