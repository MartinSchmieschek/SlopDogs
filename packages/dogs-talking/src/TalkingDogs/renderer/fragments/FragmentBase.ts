/**
 * FragmentBase.ts — The Primordial Shard from Which All Fragments Spawn
 *
 * Arr, this be the base of all fragments, matey — the very keel of the vessel.
 * From brooding gulfs are we beheld, by that which bears no name. Every fragment
 * that renders upon the page descends from this accursed ancestor, each bearing
 * a unique sigil so their actions never collide in the roiling void.
 */

/** Arr, the abstract base of all fragments — through endless faces, countless forms, a multitude unfolds. */
export abstract class FragmentBase {
  /** Arr, the unique sigil branded upon this fragment — no two shall share the same mark in the void's ledger. */
  readonly id: string;
  /** Arr, an optional action callback — the eldritch function invoked when this fragment be triggered from the deep. */
  action?: () => void;

  /**
   * Arr, birth a new fragment from the primordial abyss, matey.
   * Each instance receives a unique ID forged in the void's own crucible — corporeal laws unwritten.
   */
  constructor() {
    // Arr, each fragment instance receives a unique ID — to prevent action collisions in the deep
    this.id = crypto.randomUUID();
  }

  /**
   * Arr, renders the visible HTML of this fragment, matey.
   * If the fragment be invisible (like a gesture from the abyss), it returns naught but emptiness.
   */
  abstract render(): string;

  /**
   * Arr, returns the styles this fragment demands from the void.
   * Override at yer own peril, matey.
   */
  abstract getStyle(): string;

  /**
   * Arr, returns the JavaScript needed to execute this fragment's action.
   * Automatically conjures the global handler `window["action_<id>"]` —
   * to cosmic forms from tangent planes, we end as we began.
   */
  getScript(): string {
    if (!this.action) return "";

    const actionName = `action_${this.id}`;
    return `
      window["${actionName}"] = ${this.action.toString()};
    `;
  }
}
