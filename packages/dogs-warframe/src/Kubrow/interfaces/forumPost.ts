/**
 * @file forumPost.ts
 * Arr, these be the interfaces for media and topic data plundered from forum posts.
 * In luminous space blackened stars, they gaze, accuse, deny --
 * and so too do images and videos stare back at ye from the deep.
 */

/** A single medium (image or video) found within a topic's content, dragged from the abyss. */
export interface IPostMedia {
    /** The type of medium -- whether this be a still image or a moving vision from the abyss, arr. */
    type: 'image' | 'video';
    /** The URL -- where this cursed medium be anchored upon the endless seas of the web. */
    url: string;
    /** Thumbnail URL -- a smaller glimpse of the horror, for those not yet ready to face the deep, matey. */
    thumbnailUrl?: string;
    /** Alt text -- a mortal description of what eldritch vision this medium depicts. */
    alt?: string;
    /** Width in pixels -- the horizontal span of this window into the void. */
    width?: number;
    /** Height in pixels -- the vertical depth of this portal from brooding gulfs, arr. */
    height?: number;
}

/** Raw topic data from the parser -- the unrefined plunder, ready for PostTopic construction. */
export interface IPostTopicData {
    /** The topic title -- a heading plundered from the forum post's eldritch structure, arr. */
    title: string;
    /** The body in Markdown -- the raw scripture of the deep, converted from HTML. */
    bodyMarkdown: string;
    /** Media items -- images and videos dragged from the abyss within this topic, matey. */
    media: IPostMedia[];
}
