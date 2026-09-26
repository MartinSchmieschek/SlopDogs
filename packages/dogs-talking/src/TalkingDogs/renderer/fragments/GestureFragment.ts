/**
 * GestureFragment.ts — The Invisible Hand of the Void
 *
 * Arr, gestures be the unseen forces that steer this vessel, matey.
 * No HTML do they render — they lurk beneath the surface like
 * eldritch tentacles in the deep. Corporeal laws are unwritten,
 * as suns and love retreat before their silent command.
 */
import { FragmentBase } from "./FragmentBase";

/** Arr, a gesture fragment — invisible to the eye, yet the void hears every swipe and motion. */
export class GestureFragment extends FragmentBase {

  /**
   * Arr, summon a gesture fragment from the abyss, matey — name the unseen force that shall steer this vessel.
   * @param gestureName - The eldritch name of the gesture event, whispered through the void
   */
  constructor(public gestureName: string) {
    super();
  }

  /**
   * Arr, gestures render no HTML — they dwell unseen in the deep, invisible as the void's own breath.
   * @returns An empty string, for the abyss needs no visible form
   */
  render(): string {
    // Arr, gestures have no visible HTML — they dwell unseen in the abyss
    return "";
  }

  /**
   * Arr, no styles needed for this eldritch gesture — the void needs no adornment, matey.
   * @returns An empty string, for that which bears no name requires no CSS
   */
  getStyle(): string {
    // Arr, no styles needed — the void needs no adornment, matey
    return "";
  }

  /**
   * Arr, conjures the JavaScript incantation that binds this gesture to the void's listener, matey.
   * From brooding gulfs the event rises — carrion hordes trill their profane accord when triggered.
   * @returns The script string, an eldritch binding between gesture and action
   */
  getScript(): string {
    const actionName = `action_${this.id}`;
    return `
      window["${actionName}"] = window["${actionName}"] || function(){};
      window.addEventListener("${this.gestureName}", () => {
        if (typeof window["${actionName}"] === "function") {
          window["${actionName}"]();
        }
      });
    `;
  }
}
