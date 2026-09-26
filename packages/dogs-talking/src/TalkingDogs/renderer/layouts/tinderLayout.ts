/**
 * TinderLayout.ts — The Swipe-Deck of Damned Souls
 *
 * Arr, this be the Tinder layout, matey — a card UI where ye swipe through
 * souls like a pirate sortin' plunder on the quarterdeck. Full-bleed images,
 * gradient overlays, text from the deep, and a "Next" button that pulls ye
 * ever deeper into the abyss. Roiling, moaning, this realm of ours, in
 * madness lost shall die. Optional pill inputs float like cursed doubloons
 * upon a glass card — the void demands ye choose.
 */
import { ButtonFragment } from "../fragments/ButtonFragment";
import { ImageFragment } from "../fragments/ImageFragment";
import { TextFragment } from "../fragments/TextFragment";
import { LayoutBase } from "./LayoutBase";
import type { ILayoutInput, ITinderInput } from "./ILayoutInput";

/** Arr, the named slots of the Tinder layout — each a face in the void's swipe-deck of damned souls. */
export enum TinderLayoutEnum {
  PresentationImage = "PresentationImage",
  Title = "Title",
  Description = "Description",
  Next = "Next",
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Arr, card + optional glass card with pill inputs — a Tinder-style vessel of doom.
 * Inserted AFTER fragment styles (collectStyles) — the void layers its horrors in order.
 */
const TINDER_LAYOUT_CSS = `
  body:has(.tinder-stack) {
    padding: 0;
    background: #0c0c0c;
  }
  .layout-root:has(.tinder-stack) {
    min-height: min(100vh, 100dvh);
    width: 100%;
    max-width: 100%;
  }
  .tinder-stack {
    --tinder-card-radius: 12px;
    box-sizing: border-box;
    min-height: min(100vh, 100dvh);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    max-width: 100%;
    margin: 0;
    padding: 0.5rem 0.75rem;
    padding-bottom: max(0.5rem, env(safe-area-inset-bottom, 0px));
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    background: #0c0c0c;
  }
  .tinder-card {
    position: relative;
    flex: 0 0 auto;
    width: 100%;
    max-width: min(100%, 430px);
    height: 80vh;
    height: 80dvh;
    margin: 0;
    border-radius: var(--tinder-card-radius);
    overflow: hidden;
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.35),
      0 2px 8px rgba(0, 0, 0, 0.2);
    background: #111;
  }
  .tinder-card__media {
    position: absolute;
    inset: 0;
    z-index: 0;
  }
  .tinder-card__media .image-fragment-box {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    max-height: none !important;
    max-width: none !important;
    min-height: 0;
    margin: 0;
    display: block;
    overflow: hidden;
    align-items: stretch;
    justify-content: stretch;
  }
  .tinder-card__media .image-fragment {
    position: absolute;
    inset: 0;
    width: 100% !important;
    height: 100% !important;
    max-width: none !important;
    max-height: none !important;
    object-fit: cover;
    object-position: center center;
    border-radius: 0;
  }
  .tinder-card__gradient {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 55%;
    z-index: 1;
    pointer-events: none;
    background: linear-gradient(
      to top,
      rgba(20, 5, 8, 0.95) 0%,
      rgba(0, 0, 0, 0.55) 50%,
      transparent 100%
    );
  }
  .tinder-card__info {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 1rem 1.1rem 5.25rem;
    z-index: 2;
    color: #fff;
    text-align: left;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  }
  .tinder-card__name {
    margin: 0 0 0.35rem;
    font-size: clamp(1.5rem, 5vw, 1.85rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }
  .tinder-card__bio {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.45;
    font-weight: 400;
    opacity: 0.95;
    max-height: 4.5em;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }
  .tinder-card__chrome {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    padding: 0 1rem calc(0.85rem + env(safe-area-inset-bottom, 0px));
    pointer-events: auto;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.75) 0%,
      rgba(0, 0, 0, 0.35) 55%,
      transparent 100%
    );
  }
  .tinder-next {
    width: 100%;
    max-width: 280px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .tinder-next .fragment-button {
    margin: 0;
    width: 100%;
    padding: 0.85rem 1.25rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-size: 0.8rem;
    border-radius: 999px;
    box-shadow: 0 4px 14px rgba(255, 100, 50, 0.45);
  }

  /* --- Arr, selection pills (optional) — cursed choices from the deep --- */
  .tinder-inputs {
    flex-shrink: 0;
    align-self: center;
    max-width: min(100%, 430px);
    width: 100%;
    padding: 0 0.25rem 1rem;
    box-sizing: border-box;
  }
  .tinder-inputs__header-strip {
    background: linear-gradient(105deg, #ff6b9d 0%, #c471ed 45%, #7b68ee 100%);
    color: #fff;
    font-weight: 700;
    font-size: 0.95rem;
    text-align: center;
    padding: 0.65rem 1rem;
    border-radius: 16px 16px 0 0;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    letter-spacing: 0.02em;
  }
  .tinder-inputs__glass {
    background: rgba(32, 32, 36, 0.72);
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0 0 16px 16px;
    padding: 1rem 1rem 1.1rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  }
  .tinder-inputs__header-strip + .tinder-inputs__glass {
    border-radius: 0 0 16px 16px;
    border-top: none;
  }
  .tinder-inputs__glass:not(.tinder-inputs__glass--with-strip) {
    border-radius: 16px;
  }
  .tinder-inputs__question {
    margin: 0 0 0.85rem;
    color: #fff;
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.35;
    text-align: center;
  }
  .tinder-inputs__pills {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }
  .tinder-pill {
    display: block;
    width: 100%;
    margin: 0;
    padding: 0.85rem 1.1rem;
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 0.95rem;
    font-weight: 500;
    text-align: center;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.12s ease, border-color 0.15s ease;
    box-sizing: border-box;
    font-family: inherit;
  }
  .tinder-pill:hover {
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(255, 255, 255, 0.35);
  }
  .tinder-pill:active {
    transform: scale(0.98);
  }
`;

/** Arr, the TinderLayout — a swipe-deck vessel from the abyss where the crew judges souls with a flick, through endless faces countless forms. */
export class TinderLayout extends LayoutBase<TinderLayoutEnum> {
  /** Arr, the gradient header strip text — a banner from the void, displayed above the glass card of cursed choices. */
  private _inputsHeader = "";
  /** Arr, the question posed above the selection pills — the abyss demands ye choose, matey. */
  private _inputQuestion = "";
  /** Arr, the selection pill options — cursed doubloons laid before the crew, each a path deeper into the eldritch deep. */
  private _inputOptions: string[] = [];

  /**
   * Arr, assemble the Tinder layout's fragments — image, title, description, and the dread "Next" button
   * that pulls ye ever deeper into the void's swipe-deck of damned souls.
   */
  constructor() {
    super();

    this.fragments.set(TinderLayoutEnum.PresentationImage, new ImageFragment());
    this.fragments.set(TinderLayoutEnum.Title, new TextFragment("Dog Name"));
    this.fragments.set(TinderLayoutEnum.Description, new TextFragment("Recipe description here..."));
    this.fragments.set(TinderLayoutEnum.Next, new ButtonFragment("Next"));
  }

  /**
   * Arr, render the full Tinder card HTML — image, name, bio, "Next" button, and optional pill inputs
   * rise from brooding gulfs into a card layout. The void's own UI, matey.
   * @returns The HTML string of the accursed Tinder card, complete with optional glass-card inputs
   */
  renderHtml(): string {
    const image = this.get(TinderLayoutEnum.PresentationImage) as ImageFragment | undefined;
    const title = this.get(TinderLayoutEnum.Title) as TextFragment | undefined;
    const desc = this.get(TinderLayoutEnum.Description) as TextFragment | undefined;
    const next = this.get(TinderLayoutEnum.Next) as ButtonFragment | undefined;

    const mediaHtml = image ? image.render() : "";
    const titleHtml = escapeHtml(title?.text ?? "");
    const bioHtml = escapeHtml(desc?.text ?? "");
    const nextHtml = next ? `<div class="tinder-next">${next.render()}</div>` : "";

    const hasHeader = !!this._inputsHeader.trim();
    const hasQuestion = !!this._inputQuestion.trim();
    const hasPills = this._inputOptions.length > 0;
    const showInputsBlock = hasHeader || hasQuestion || hasPills;

    let inputsHtml = "";
    if (showInputsBlock) {
      const strip = hasHeader
        ? `<div class="tinder-inputs__header-strip">${escapeHtml(this._inputsHeader)}</div>`
        : "";
      const glassClass =
        hasHeader
          ? "tinder-inputs__glass tinder-inputs__glass--with-strip"
          : "tinder-inputs__glass";
      const q = hasQuestion
        ? `<p class="tinder-inputs__question">${escapeHtml(this._inputQuestion)}</p>`
        : "";
      const pills = hasPills
        ? `<div class="tinder-inputs__pills">${this._inputOptions
            .map((o) => `<button type="button" class="tinder-pill">${escapeHtml(o)}</button>`)
            .join("")}</div>`
        : "";
      inputsHtml = `
  <section class="tinder-inputs" aria-label="Selection">
    ${strip}
    <div class="${glassClass}">
      ${q}
      ${pills}
    </div>
  </section>`;
    }

    return `
<div class="tinder-stack">
  <div class="tinder-card">
    <div class="tinder-card__media">${mediaHtml}</div>
    <div class="tinder-card__gradient" aria-hidden="true"></div>
    <div class="tinder-card__info">
      <h1 class="tinder-card__name">${titleHtml}</h1>
      ${bioHtml ? `<p class="tinder-card__bio">${bioHtml}</p>` : ""}
    </div>
    <div class="tinder-card__chrome">
      ${nextHtml}
    </div>
  </div>
${inputsHtml}
</div>
`.trim();
  }

  /**
   * Arr, collect all styles and append the Tinder-specific CSS — the void layers its horrors in order, matey.
   * @returns The combined CSS string, eldritch stylesheets merged from fragment and layout alike
   */
  collectStyles(): string {
    return super.collectStyles() + TINDER_LAYOUT_CSS;
  }

  /**
   * Arr, populate this Tinder vessel with data plundered from the input, matey.
   * Image, title, description, and optional pill choices — the abyss fills every slot.
   * @param input - The layout input pact, cast as ITinderInput by the void's own hand
   */
  populate(input: ILayoutInput): void {
    const data = input as ITinderInput;

    this._inputsHeader = data.inputsHeader?.trim() ?? "";
    this._inputQuestion = data.inputQuestion?.trim() ?? "";
    this._inputOptions = Array.isArray(data.inputOptions) ? [...data.inputOptions] : [];

    const image = this.get(TinderLayoutEnum.PresentationImage);
    if (image && "imageUrl" in image) (image as ImageFragment).imageUrl = data.imageUrl;

    const title = this.get(TinderLayoutEnum.Title);
    if (title && "text" in title) (title as TextFragment).text = data.title;

    if (data.description) {
      const desc = this.get(TinderLayoutEnum.Description);
      if (desc && "text" in desc) (desc as TextFragment).text = data.description;
    }

    const next = this.get(TinderLayoutEnum.Next);
    if (next) (next as ButtonFragment).action = () => window.location.reload();
  }
}
