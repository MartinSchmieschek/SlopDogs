/**
 * ILayoutInput.ts — The Parchment of Accursed Input Contracts
 *
 * Arr, herein be the interfaces that define what data each layout demands
 * from the deep, matey. From brooding gulfs are we beheld, by that which
 * bears no name — and each interface be a pact signed in eldritch ink,
 * binding the caller to provide what the void requires.
 */
import { createPact } from "@slopdogs/core";

/** Arr, the Tinder input — swipe through souls like a pirate sortin' plunder from the abyss. */
export interface ITinderInput {
    /** Arr, the type discriminant — marks this pact as 'tinder', so the void knows which doom to render. */
    type: 'tinder';
    /** Arr, the URL of the image — a vision plundered from the deep, displayed full-bleed on the card. */
    imageUrl: string;
    /** Arr, the title displayed upon the card — the name of the soul ye be judgin' from the abyss. */
    title: string;
    /** Arr, an optional description — the tale whispered beneath the title, from brooding gulfs beheld. */
    description?: string;
    /** Arr, optional: gradient strip above the input area — a banner from the void. */
    inputsHeader?: string;
    /** Arr, the question posed above the selection pills — the abyss demands ye choose. */
    inputQuestion?: string;
    /** Arr, selection options as wide rounded pills — like cursed doubloons laid before the crew. */
    inputOptions?: string[];
}

/** Arr, the biography input — the tale of a soul dragged from the deep. */
export interface IBiographyInput {
    /** Arr, the type discriminant — marks this pact as 'biography', a soul's chronicle from the void. */
    type: 'biography';
    /** Arr, the portrait URL — the cursed visage of the soul dragged up from the deep. */
    imageUrl: string;
    /** Arr, the name of the soul — through endless faces countless forms, yet each bears a name. */
    name: string;
    /** Arr, the birth information — the hour and place of one's cursed emergence into this eldritch realm. */
    birthInfo: string;
    /** Arr, the story — the full tale of this soul's voyage across the abyss, matey. */
    story: string;
}

/** Arr, the recipe input — ingredients and steps for brewing eldritch concoctions. */
export interface IRecipeInput {
    /** Arr, the type discriminant — marks this pact as 'recipe', an unholy culinary rite from the deep. */
    type: 'recipe';
    /** Arr, the image URL — a vision of the eldritch dish, plundered from the void's own galley. */
    imageUrl: string;
    /** Arr, the recipe title — the name of the concoction, whispered by carrion hordes in profane accord. */
    title: string;
    /** Arr, the ingredients — each one a component plundered from the abyss for this forbidden brew. */
    ingredients: string[];
    /** Arr, the steps — the ritual instructions, each one drawin' ye deeper into the void's culinary madness. */
    steps: string[];
}

/** Arr, the article input — headlines and paragraphs plundered from forbidden scrolls. */
export interface IArticleInput {
    /** Arr, the type discriminant — marks this pact as 'article', forbidden tidings from the deep. */
    type: 'article';
    /** Arr, the header image URL — a vision atop the scroll, plundered from brooding gulfs. */
    imageUrl: string;
    /** Arr, the headline — the bold proclamation that lures the crew to read further into the abyss. */
    headline: string;
    /** Arr, the paragraph — the body of the forbidden article, corporeal laws unwritten in its text. */
    paragraph: string;
}

/** Arr, the gallery input — a collection of visions from beyond the veil. */
export interface IGalleryInput {
    /** Arr, the type discriminant — marks this pact as 'gallery', a catalogue of forbidden visions. */
    type: 'gallery';
    /** Arr, the gallery title — the name inscribed above the hall of cursed images from the void. */
    title: string;
    /** Arr, the thumbnail URL — a small porthole into the abyss, a preview of the horrors within. */
    thumbnailUrl: string;
}

/** Arr, the union of all layout inputs — to cosmic forms from tangent planes, we end as we began. */
export type ILayoutInput = ITinderInput | IBiographyInput | IRecipeInput | IArticleInput | IGalleryInput;

/** Arr, the pact that binds the LayoutInputProvider to this vessel — signed in the void's own blood. */
export const LayoutInputPact = createPact<ILayoutInput>('LayoutInputProvider', { fromSourceType: 'ILayoutInput' });
