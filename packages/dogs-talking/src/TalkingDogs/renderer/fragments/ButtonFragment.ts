/**
 * ButtonFragment.ts — The Cursed Trigger of the Deep
 *
 * Arr, press this button and ye invoke forces from beyond the veil, matey.
 * Carrion hordes trill their profane accord with eldritch plans — and each
 * click be a prayer to the nameless thing in the abyss. Ye have been warned.
 */
import { FragmentBase } from "./FragmentBase";

/** Arr, a button fragment — the crew presses it, and the void answers. */
export class ButtonFragment extends FragmentBase {

  /** Arr, the label branded upon this button — the text that lures the crew to press it and summon the void. */
  private label: string;

  /**
   * Arr, forge a button fragment from the deep, matey — label it with words that beckon the unwary.
   * @param label - The cursed inscription displayed upon the button's face
   */
  constructor(label: string) {
    super();
    this.label = label;
  }

  /**
   * Arr, renders the HTML for this accursed button — unique ID and style reference
   * branded upon it like a sigil from the deep.
   */
  render(): string {
    return `
      <button id="${this.id}" class="fragment-button">${this.label}</button>
    `;
  }

  /**
   * Arr, styles fit for a button forged in the abyss — glowing orange
   * like the last sun before the void swallows all.
   */
  getStyle(): string {
    return `
      .fragment-button {
        background: #ff7b00;
        border: none;
        border-radius: 1em;
        color: white;
        font-size: 1rem;
        padding: 1em 2em;
        margin: 1em;
        max-width: 100%;
        box-sizing: border-box;
        cursor: pointer;
        transition: transform 0.15s ease, background 0.15s ease;
      }
      .fragment-button:hover {
        background: #ff9e3d;
        transform: scale(1.05);
      }
    `;
  }

  /**
   * Arr, binds the action to this button via an EventListener, matey.
   * The renderer ensures all scripts are gathered into one global block —
   * like carrion hordes assembling in accord with eldritch plans.
   */
  getScript(): string {
    const baseScript = super.getScript();
    return `
      ${baseScript}
      document.getElementById("${this.id}")?.addEventListener("click", () => {
        const handler = window["action_${this.id}"];
        if (typeof handler === "function") handler();
      });
    `;
  }
}
