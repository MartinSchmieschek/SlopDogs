/**
 * LayoutBase.ts — The Skeletal Hull of All Layouts
 *
 * Arr, this be the abstract base from which all layouts rise, matey —
 * the very bones of the vessel. Corporeal laws are unwritten, as suns
 * and love retreat. Each layout holds a map of fragments, and from them
 * it conjures HTML, styles, and scripts — like a necromancer raising
 * a crew from the deep.
 */

import { FragmentBase } from "../fragments/FragmentBase";
import { ILayoutInput } from "./ILayoutInput";

/** Arr, the abstract base of all layouts — the keel upon which every cursed page is built. */
export abstract class LayoutBase<E extends string> {
  /** Arr, the map of fragments — each entry a named horror from the deep, keyed by its eldritch enum sigil. */
  protected fragments = new Map<E, FragmentBase>();

  /** Arr, populate this vessel with data from the input — each layout decides its own doom. */
  abstract populate(input: ILayoutInput): void;

  /** Arr, retrieve a fragment by its eldritch name from the map of the deep. */
  get(id: E): FragmentBase | undefined {
    return this.fragments.get(id);
  }

  /** Arr, search the fragments — like scoutin' the abyss for specific horrors. */
  find(is: (fragment:FragmentBase, id:string)=>boolean): FragmentBase[] {
    return Array.from(this.fragments.entries()).filter(item => is(item[1],item[0])).map(item => item[1])
  }

  /** Arr, muster the entire crew of fragments from the vessel's hold. */
  getAllFragments(): FragmentBase[] {
    return Array.from(this.fragments.values());
  }

  /** Arr, render all fragments into HTML — the void speaks through their combined markup. */
  renderHtml(): string {
    return this.getAllFragments()
      .map(f => f.render())
      .join("\n");
  }

  /** Arr, collect all styles from the crew — each fragment contributes its cursed CSS. */
  collectStyles(): string {
    return this.getAllFragments()
      .map(f => f.getStyle())
      .join("\n");
  }

  /** Arr, collect all scripts — the eldritch incantations that bring the page to unholy life. */
  collectScripts(): string {
    return this.getAllFragments()
      .map(f => f.getScript())
      .join("\n");
  }
}
