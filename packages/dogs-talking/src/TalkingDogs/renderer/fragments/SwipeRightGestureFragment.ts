/**
 * SwipeRightGestureFragment.ts — The Starboard Embrace of the Void
 *
 * Arr, swipe right and ye accept what the abyss has offered, matey.
 * Like a vessel turnin' starboard to chase a phantom light on the horizon,
 * this gesture draws the current vision closer to yer cursed heart.
 * To cosmic madness laws submit, though stalwart minds entreat.
 */
import { FragmentBase } from "./FragmentBase";

/** Arr, swipe right gesture — the crew embraces the void's offering with a flick to starboard. */
export class SwipeRightGestureFragment extends FragmentBase {
  /**
   * Arr, renders naught — this starboard gesture be invisible, like the void's own whisper from the deep.
   * @returns An empty string, for acceptance needs no mortal form
   */
  render(): string {
    // Arr, no visible HTML — this gesture be as invisible as the void's whisper
    return "";
  }

  /**
   * Arr, no styles for the unseen — the eldritch starboard hand requires no adornment from the abyss.
   * @returns An empty string, silent as the void between stars
   */
  getStyle(): string {
    return "";
  }

  /**
   * Arr, conjures the JavaScript that listens for a rightward swipe or ArrowRight keypress, matey.
   * The crew steers starboard to embrace the void's offering — to cosmic madness laws submit.
   * @returns The script string binding touch and keyboard events to the void's starboard action
   */
  getScript(): string {
    const base = super.getScript();
    const actionVar = `action_${this.id}`;
    return `
      ${base}
      (() => {
        let touchStartX = 0;
        let touchEndX = 0;

        // --- Arr, detect touch gestures from the crew's fingers ---
        document.addEventListener("touchstart", e => {
          touchStartX = e.changedTouches[0].screenX;
        });

        document.addEventListener("touchend", e => {
          touchEndX = e.changedTouches[0].screenX;
          handleSwipe();
        });

        // --- Arr, arrow key as an alternative — for those who steer by keyboard through the void ---
        document.addEventListener("keydown", e => {
          if (e.key === "ArrowRight") {
            const fn = window["${actionVar}"];
            if (typeof fn === "function") fn(${this.action});
          }
        });

        function handleSwipe() {
          if (touchEndX > touchStartX + 75) { // Arr, minimum swipe distance before the abyss acknowledges ye
            const fn = window["${actionVar}"];
            if (typeof fn === "function") fn(${this.action});
          }
        }
      })();
    `;
  }
}
