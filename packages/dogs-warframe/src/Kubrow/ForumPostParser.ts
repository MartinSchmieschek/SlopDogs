/**
 * @file ForumPostParser.ts
 * Arr, matey! This cursed vessel parses the raw HTML of forum threads (Discourse and the like),
 * transforming their tangled eldritch markup into structured data -- topics with Markdown body
 * and media. To cosmic forms from tangent planes, we end as we began.
 * Used alongside Kubrow in the same accursed hold of this ship.
 */
import type { IPostMedia, IPostTopicData } from './interfaces/forumPost';

export class ForumPostParser {
    /**
     * Parses the HTML of the first post and yields a list of topics, each with Markdown and media.
     * Arr, we plunder structure from the formless chaos of raw markup.
     * @param html - Raw HTML of the thread page, dragged from the deep
     * @param url - Thread URL, for context amidst the void
     * @returns Parsed post data with title, author, date, url, and topics from the abyss
     */
    parse(html: string, url: string): {
        title: string;
        author: string;
        date: string;
        url: string;
        topics: IPostTopicData[];
    } {
        const title = this.extractTitle(html);
        const { author, date } = this.extractAuthorAndDate(html);
        const firstPostHtml = this.extractFirstPostBody(html);
        const topics = this.splitIntoTopics(firstPostHtml);

        return {
            title,
            author,
            date,
            url,
            topics,
        };
    }

    /** Arr, wrench the title from the HTML's skull like plunder from a sunken chest. */
    private extractTitle(html: string): string {
        const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
            ?? html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (match) {
            return this.stripHtml(match[1]).trim();
        }
        return '';
    }

    /** Extract the author and date -- who scrawled these words, and when did the void take them? */
    private extractAuthorAndDate(html: string): { author: string; date: string } {
        // Discourse: data-username, or typical patterns like "By ... , ... in"
        const authorMatch = html.match(/data-username="([^"]+)"/i)
            ?? html.match(/By\s+<[^>]+>([^<]+)</i)
            ?? html.match(/class="[^"]*username[^"]*"[^>]*>([^<]+)</i);
        const dateMatch = html.match(/data-time="(\d+)"|datetime="([^"]+)"|(\d{1,2}\s+\w+\s+\d{4})/i);
        return {
            author: authorMatch ? this.stripHtml(authorMatch[1]).trim() : '',
            date: dateMatch ? (dateMatch[1] ?? dateMatch[2] ?? dateMatch[3] ?? '') : '',
        };
    }

    /** Arr, pull the first post body from the abyss -- the .cooked content within the topic-post. */
    private extractFirstPostBody(html: string): string {
        // Discourse: .cooked in the first .topic-post
        const cookedMatch = html.match(/class="[^"]*cooked[^"]*"[\s\S]*?>([\s\S]*?)<\/div>\s*<\/div>\s*<\/article>/im)
            ?? html.match(/class="post[^"]*"[\s\S]*?class="[^"]*content[^"]*"[\s\S]*?>([\s\S]*?)<\/div>/im);
        if (cookedMatch) {
            return cookedMatch[1];
        }
        // Fallback: take the first larger content block, like salvaging wreckage from the deep
        const fallback = html.match(/<article[\s\S]*?>([\s\S]{100,}?)<\/article>/im);
        return fallback ? fallback[1] : html;
    }

    /**
     * Split the post HTML into topics by headings (h2/h3), like dividing plunder among the crew.
     * In luminous space blackened stars, they gaze, accuse, deny.
     */
    private splitIntoTopics(postHtml: string): IPostTopicData[] {
        const topics: IPostTopicData[] = [];
        // Split by headings (h2/h3) into sections -- each a chapter of the profane accord
        const headingRegex = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        const parts: { title: string; start: number; end: number }[] = [];
        while ((match = headingRegex.exec(postHtml)) !== null) {
            if (parts.length > 0) {
                parts[parts.length - 1].end = match.index;
            }
            parts.push({
                title: this.stripHtml(match[1]).trim(),
                start: match.index + match[0].length,
                end: postHtml.length,
            });
            lastIndex = match.index + match[0].length;
        }

        if (parts.length === 0) {
            // A single topic with all content -- one monolithic slab of void-truth
            const media = this.extractMedia(postHtml);
            const bodyMarkdown = this.htmlToMarkdown(postHtml);
            topics.push({ title: '', bodyMarkdown, media });
            return topics;
        }

        for (const part of parts) {
            const sectionHtml = postHtml.slice(part.start, part.end);
            const media = this.extractMedia(sectionHtml);
            const bodyMarkdown = this.htmlToMarkdown(sectionHtml);
            topics.push({ title: part.title, bodyMarkdown, media });
        }

        return topics;
    }

    /**
     * Arr, extract all media (images, videos, embeds) from the HTML --
     * carrion hordes trill their profane accord with eldritch plans.
     */
    private extractMedia(html: string): IPostMedia[] {
        const media: IPostMedia[] = [];

        // Images: <img src="..."> -- still visions of the void
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
        let m: RegExpExecArray | null;
        while ((m = imgRegex.exec(html)) !== null) {
            media.push({
                type: 'image',
                url: this.normalizeUrl(m[1]),
                alt: m[2]?.trim() || undefined,
            });
        }

        // Videos: <video src="..."> or <source src="..."> -- moving horrors from the deep
        const videoSrcRegex = /<video[\s\S]*?src=["']([^"']+)["']|<source[^>]+src=["']([^"']+\.(?:mp4|webm|ogg))["']/gi;
        while ((m = videoSrcRegex.exec(html)) !== null) {
            media.push({
                type: 'video',
                url: this.normalizeUrl(m[1] || m[2] || ''),
            });
        }

        // Embeds: iframe (YouTube, Vimeo, etc.) -- portals to other tangent planes
        const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
        while ((m = iframeRegex.exec(html)) !== null) {
            const src = m[1];
            if (/youtube|vimeo|dailymotion/i.test(src)) {
                media.push({
                    type: 'video',
                    url: this.normalizeUrl(src),
                    thumbnailUrl: undefined,
                });
            }
        }

        return media;
    }

    /** Convert HTML to Markdown -- rewriting the eldritch scripture into a tongue the crew can read. */
    private htmlToMarkdown(html: string): string {
        let md = html
            .replace(/<p>/gi, '\n\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, content) => {
                const prefix = '#'.repeat(parseInt(level, 10));
                return `\n\n${prefix} ${this.stripHtml(content).trim()}\n\n`;
            })
            .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_, c) => `**${this.stripHtml(c).trim()}**`)
            .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (_, c) => `**${this.stripHtml(c).trim()}**`)
            .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_, c) => `*${this.stripHtml(c).trim()}*`)
            .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (_, c) => `*${this.stripHtml(c).trim()}*`)
            .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => `[${this.stripHtml(text).trim()}](${href})`)
            .replace(/<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi, (_, src, alt) => `![${(alt || '').trim()}](${src})`)
            .replace(/<[^>]+>/g, '');
        md = md.replace(/\n{3,}/g, '\n\n').trim();
        return md;
    }

    /** Strip all HTML tags -- peel away the barnacles to reveal the bare hull beneath. */
    private stripHtml(html: string): string {
        return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    }

    /** Normalize a URL -- anchor it to the proper domain if it drifts without protocol. */
    private normalizeUrl(url: string): string {
        if (url.startsWith('//')) return 'https:' + url;
        if (url.startsWith('/')) return 'https://forums.warframe.com' + url;
        return url;
    }
}
