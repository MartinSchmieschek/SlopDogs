/**
 * TextFragment.ts — The Whispering Runes of the Deep
 *
 * Arr, this fragment renders text upon the page, matey — each word a rune
 * scrawled by the void itself. From brooding gulfs are we beheld, by that
 * which bears no name. The text wraps and breaks as it must, for even
 * eldritch incantations must respect the width of the vessel.
 */
import { FragmentBase } from "./FragmentBase";

/** Arr, a text fragment — words plundered from the void and rendered for mortal eyes. */
export class TextFragment extends FragmentBase {
  /** Arr, the text content — runes scrawled by the void, carried up from the deep for mortal eyes to behold. */
  text: string;

  /**
   * Arr, summon a text fragment from the abyss, matey — inscribe the void's whispers upon the page.
   * @param text - The eldritch words plundered from brooding gulfs
   */
  constructor(text: string) {
    super();
    this.text = text;
  }

  /** Arr, render the text — let the void's whispers be seen by the crew. */
  render(): string {
    return `<p id="${this.id}" class="text-fragment">${this.text}</p>`;
  }

  /**
   * Arr, no scripts needed for mere text — the void's whispers require no JavaScript incantation.
   * @returns An empty string, silent as the carrion hordes at rest
   */
  getScript(): string {
    return "";
  }

  /** Arr, styles that keep the text from overflowing the vessel's hull. */
  getStyle(): string {
    return `
      .text-fragment {
        font-family: sans-serif;
        margin: 0.5rem 0;
        max-width: 100%;
        overflow-wrap: anywhere;
        word-wrap: break-word;
        word-break: break-word;
      }
    `;
  }
}
