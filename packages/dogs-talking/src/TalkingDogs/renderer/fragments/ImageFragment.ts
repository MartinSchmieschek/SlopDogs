/**
 * ImageFragment.ts — The Porthole into the Abyss
 *
 * Arr, this fragment renders images and videos plundered from the deep, matey.
 * Each image be a vision of what lurks beneath — in luminous space blackened
 * stars, they gaze, accuse, deny. Whether still image or moving picture,
 * the void stares back through every pixel.
 */
import { FragmentBase } from "./FragmentBase";

/** Arr, an image fragment — a window into forbidden visions from beyond the veil. */
export class ImageFragment extends FragmentBase {

  /** Arr, the URL to the image — a coordinate charted in the void's own atlas, pointing to visions from the deep. */
  imageUrl?: string;
  /** Arr, alternative text for the image — a whispered description for those who cannot gaze upon the abyss. */
  alt?: string;

  /**
   * Arr, summon an image fragment from brooding gulfs, matey — the void provides its visions.
   * @param imageUrl - The URL from whence the cursed image shall be plundered
   * @param alt - The whispered description, lest the image fail to manifest from the deep
   */
  constructor(imageUrl?: string, alt?: string) {
    super();
    this.imageUrl = imageUrl;
    this.alt = alt ?? "";
  }

  /** Arr, checks if the URL points to a moving picture — some horrors demand motion to convey. */
  private isVideo(url?: string): boolean {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    const lowerUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('video');
  }

  /** Arr, render the image or video — gaze upon it if ye dare, matey. */
  render(): string {
    const url = this.imageUrl ?? "";
    if (this.isVideo(url)) {
      return `<div class="image-fragment-box"><video id="${this.id}" src="${url}" class="image-fragment" controls autoplay loop muted playsinline></video></div>`;
    }
    return `<div class="image-fragment-box"><img id="${this.id}" src="${url}" alt="${this.alt}" class="image-fragment" /></div>`;
  }

  /**
   * Arr, no scripts needed for a still vision — the abyss stares back in silence, matey.
   * @returns An empty string, for images need no eldritch incantations
   */
  getScript(): string {
    return "";
  }

  /** Arr, styles that keep the image contained — fully visible, aspect ratio preserved, like a cursed portrait that follows ye with its eyes. */
  getStyle(): string {
    return `
      .image-fragment-box {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        min-height: 0;
        max-height: min(90vh, 90dvh);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto;
      }
      .image-fragment {
        display: block;
        flex: 0 1 auto;
        /* Arr, fully visible: scale down proportionally, aspect ratio preserved like an ancient relic */
        max-width: 100%;
        max-height: min(90vh, 90dvh);
        width: auto;
        height: auto;
        object-fit: contain;
        object-position: center;
        border-radius: 12px;
      }
      video.image-fragment {
        background: #111;
      }
    `;
  }
}
