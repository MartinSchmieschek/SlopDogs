/**
 * SwipeLeftGestureFragment.ts — The Portside Lurch into the Abyss
 *
 * Arr, swipe left and ye dismiss what the void has shown ye, matey.
 * Like a vessel turnin' hard to port to avoid a kraken's grasp,
 * this gesture casts the current vision back into the deep.
 * Roiling, moaning, this realm of ours, in madness lost shall die.
 */
import { FragmentBase } from "./FragmentBase";

/** Arr, swipe left gesture — the crew rejects the void's offering with a flick to port. */
export class SwipeLeftGestureFragment extends FragmentBase {
  /**
   * Arr, renders naught — this portside gesture be invisible, lurkin' beneath the waves like a kraken in the deep.
   * @returns An empty string, for the void's left hand needs no form
   */
  render(): string {
    // Arr, no visible HTML — this gesture lurks unseen beneath the waves
    return "";
  }

  /**
   * Arr, no styles for the unseen — corporeal laws unwritten for this eldritch gesture.
   * @returns An empty string, barren as the void itself
   */
  getStyle(): string {
    return "";
  }

  /**
   * Arr, conjures the JavaScript that listens for a leftward swipe or ArrowLeft keypress, matey.
   * Through touch and key, the crew steers this vessel hard to port — carrion hordes acknowledge the dismissal.
   * @returns The script string binding touch and keyboard events to the void's portside action
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
          if (e.key === "ArrowLeft") {
            const fn = window["${actionVar}"];
            if (typeof fn === "function") fn(${this.action});
          }
        });

        function handleSwipe() {
          if (touchEndX < touchStartX - 75) { // Arr, minimum swipe distance before the abyss acknowledges ye
            const fn = window["${actionVar}"];
            if (typeof fn === "function") fn(${this.action});
          }
        }
      })();
    `;
  }
}
