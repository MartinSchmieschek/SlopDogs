/**
 * @file missionDetails.ts
 * Arr, matey! This interface charts every mission in the Origin System -- each node a
 * cursed island upon the star map, each enemy a carrion horror trilling its profane song.
 * Through endless faces, countless forms, a multitude unfolds.
 * The crew must know what lurks at each anchor point before sailing into the void.
 */

/** The full details of a mission node -- coordinates for navigating the eldritch star map. */
export interface IMissionDetails {
    /** The name visible to mortal eyes, matey. */
    Name: string;
    /** Link to the wiki -- a lantern against the cosmic dark. */
    Link: string;
    /** The planet (or vessel) where this node be anchored. */
    Planet: string;
    /** Mission type -- the nature of the horror that awaits the crew. */
    Type: string;
    /** Quotes associated with this accursed place. */
    Quotes: string;
    /** The tileset -- the architecture of the abyss. */
    Tileset: string;
    /** The enemy faction(s) -- what nameless horrors patrol these depths. */
    Enemy: string | string[];
    /** Minimum level of the void-touched foes. */
    MinLevel: number;
    /** Maximum level -- how deep the madness goes. */
    MaxLevel: number;
    /** Mastery XP plundered upon completion. */
    MasteryExp: number;
    /** Internal API name -- the true name, known only to the deep. */
    InternalName: string;

    /** Arr, an image of this accursed locale -- a glimpse into the abyss, if one exists. */
    Image?: string;
    /** The drop table alias -- a cipher to decode what plunder the void yields here. */
    DropTableAlias?: string;
    /** Cache drop table alias -- hidden plunder stashed in the wreckage of the deep. */
    CacheDropTableAlias?: string;
    /** Extra drop table alias -- additional spoils from brooding gulfs unknown. */
    ExtraDropTableAlias?: string;
    /** Arr, be this node hidden from mortal eyes upon the star map? */
    IsHidden?: boolean;
    /** Whether the void tracks ye crew's progress at this forsaken anchor point. */
    IsTracked?: boolean;
    /** A Dark Sector node -- territory claimed by carrion hordes from the deep. */
    IsDarkSector?: boolean;
    /** Arr, an Archwing mission -- ye take flight through the void's endless, eldritch expanse. */
    IsArchwing?: boolean;
    /** A Railjack mission -- sailing a vessel through void storms from brooding gulfs. */
    IsRailjack?: boolean;
    /** When this node was introduced -- the date its horror first crawled forth into our realm. */
    Introduced?: string;
    /** Requirements to access this cursed place -- what toll the void demands, matey. */
    Requirements?: string;
    /** Other miscellaneous data -- whispers from tangent planes, corporeal laws unwritten. */
    Other?: string;

    /** The boss that lurks here -- a named eldritch horror, through endless faces countless forms. */
    Boss?: string;
    /** A picture of the boss or locale -- so the crew knows what horror gazes back from the abyss. */
    Pic?: string;
    /** Known drops -- the plunder ye may wrench from this node's eldritch grasp. */
    Drops?: string[];

    /** Nodes accessible from here -- further passages into the cosmic dark, arr. */
    NextNodes?: string[];
    /** Nodes that lead to this one -- the trail of madness that brought ye to the deep. */
    PreviousNodes?: string[];
    /** The single previous node -- whence ye sailed before the void claimed yer course. */
    PreviousNode?: string;

    /** Credit reward for completion -- coin plundered from the abyss. */
    CreditReward?: number;
    /** Credits reward (alternate field) -- the void be inconsistent in its naming, matey. */
    CreditsReward?: number;
    /** Additional credit reward -- bonus plunder from the eldritch depths. */
    AdditionalCreditReward?: number;

    /** Dark Sector resource bonus -- plunder from the blackened depths. */
    DSResourceBonus?: number;
    /** Dark Sector XP bonus -- eldritch knowledge gained from the blackened depths. */
    DSXPBonus?: number;
    /** Dark Sector weapon bonus -- enhanced plunder for the crew's arms. */
    DSWeaponBonus?: number;
    /** Dark Sector weapon type -- the cursed armament favored in these forsaken waters. */
    DSWeapon?: string;

    /** Railjack fighter parameters -- the lesser horrors in the void storms. */
    FighterMinLevel?: number;
    FighterMaxLevel?: number;
    /** Maximum fighters in the void storm -- how many lesser horrors swarm the abyss. */
    MaxFighters?: number;
    /** Maximum crewships -- the larger vessels of the carrion hordes, arr. */
    MaxCrewships?: number;
    /** Number of objectives -- how many eldritch tasks the void demands of the crew. */
    Objectives?: number;
    /** Details of objectives -- the profane accord writ in the void's own tongue. */
    ObjectiveDetails?: string;
}
