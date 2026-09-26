/**
 * VideoFragmentRenderer.ts — The Moving Picture of Eldritch Horror
 *
 * Arr, this fragment be meant to render videos from the deep, matey —
 * but its methods remain unimplemented, like a ghost ship with no crew.
 * The sky and Earth aflame, yet this vessel sits anchored, waiting
 * for some brave (or mad) soul to finish what the void started.
 */
import { FragmentBase } from "./FragmentBase";

/** Arr, the shape of video data — a YouTube ID pulled from the abyss. */
export interface VideoData {
  /** Arr, the YouTube ID — a cursed identifier plundered from the streaming abyss, pointin' to moving horrors. */
  youtubeId: string;
}

/** Arr, the video renderer — a hollow vessel, its methods cry out but deliver nothing. */
export class VideoFragmentRenderer extends FragmentBase {
  /**
   * Arr, styles for the video — but alas, this method remains unimplemented, a ghost ship adrift in the void.
   * @returns Never — throws an error from the deep, for no crew has come to finish this eldritch work
   */
  getStyle(): string {
    throw new Error("Method not implemented.");
  }

  /**
   * Arr, render the video HTML — but this too be unimplemented, matey, a hollow promise from the abyss.
   * @returns Never — throws an error, for the void started what no mortal has dared to complete
   */
  render(): string {
    throw new Error("Method not implemented.");
  }
  /**
   * Arr, conjure the video's script — yet another unfinished incantation, lost to the cosmic deep.
   * @returns Never — throws an error, for the carrion hordes left this vessel abandoned
   */
  getScript(): string {
    throw new Error("Method not implemented.");
  }
  /*
   * Arr, the original render method — commented out like a map to buried treasure
   * that no pirate dares to follow. "Recipe video" it once whispered...
   *
  render(data: VideoData): string {
    return `
      <div class="video-fragment">
        <iframe
          width="100%"
          height="100%"
          src="https://www.youtube.com/embed/${data.youtubeId}"
          title="Recipe Video"
          frameborder="0"
          allowfullscreen>
        </iframe>
      </div>
    `;
  }
    */
}
