/**
 * @file ForumFirstPost.ts
 * Arr, this be the first post of a forum thread -- the opening salvo fired across
 * the bow of the void. Its heralds are the stars it fells, the sky and Earth aflame.
 * Title, author, date, and the eldritch topics within: all plundered and anchored here
 * for the crew to inspect before madness claims their stalwart minds.
 */
import type { IPostMedia } from './interfaces/forumPost';
import { PostTopic } from './PostTopic';

/** The first post of a forum thread: title, metadata, and content split into topics from the deep. */
export class ForumFirstPost {
    constructor(
        /** The title of the thread -- first words scrawled upon the void's bulletin board, arr. */
        readonly title: string,
        /** The author -- which soul dared post into the eldritch depths of the forum. */
        readonly author: string,
        /** The date -- when these words were committed to the abyss, matey. */
        readonly date: string,
        /** The URL -- the portal to this thread upon the endless seas of the web. */
        readonly url: string,
        /** The topics -- sections of content plundered from the post, each bearing its own horrors from the deep. */
        readonly topics: PostTopic[]
    ) {}

    /**
     * Plunder all media from every topic -- images and videos dragged from the abyss.
     * @returns All media items across every topic in this post, arr
     */
    getMedia(): IPostMedia[] {
        return this.topics.flatMap((t) => t.getMedia());
    }

    /**
     * Arr, fetch only the images -- still frames of horrors glimpsed in luminous space.
     * @returns All image media items from the topics of this post
     */
    getImages(): IPostMedia[] {
        return this.topics.flatMap((t) => t.getImages());
    }

    /**
     * Retrieve the moving pictures -- videos that roil and moan like this realm of ours.
     * @returns All video media items from the topics of this post, matey
     */
    getVideos(): IPostMedia[] {
        return this.topics.flatMap((t) => t.getVideos());
    }
}
