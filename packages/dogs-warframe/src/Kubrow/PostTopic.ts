/**
 * @file PostTopic.ts
 * Arr, a single topic section plundered from the first forum post -- bearing Markdown
 * content and media within its cursed hull. Roiling, moaning, this realm of ours,
 * in madness lost shall die. Yet the data persists, anchored against the void.
 */
import type { IPostMedia } from './interfaces/forumPost';

/** A topic section from the first forum post, carrying content (Markdown) and media from the abyss. */
export class PostTopic {
    constructor(
        readonly title: string,
        private readonly bodyMarkdown: string,
        private readonly media: IPostMedia[]
    ) {}

    /**
     * Arr, retrieve the Markdown body -- the raw scripture of the deep.
     * @returns The Markdown content of this topic section
     */
    getBodyMarkdown(): string {
        return this.bodyMarkdown;
    }

    /**
     * Plunder all media from this topic's hold.
     * @returns All media items within this topic, arr
     */
    getMedia(): IPostMedia[] {
        return [...this.media];
    }

    /**
     * Arr, fetch only the images -- frozen glimpses of blackened stars that gaze and accuse.
     * @returns All image media items within this topic
     */
    getImages(): IPostMedia[] {
        return this.media.filter((m) => m.type === 'image');
    }

    /**
     * Retrieve the videos -- moving visions from tangent planes, ye cannot unsee.
     * @returns All video media items within this topic, matey
     */
    getVideos(): IPostMedia[] {
        return this.media.filter((m) => m.type === 'video');
    }
}
