/**
 * TalkingDog.ts — The Captain of the Accursed Vessel
 *
 * Arr, this be the heart of our doomed fleet, matey. From brooding gulfs
 * are we beheld, by that which bears no name. The TalkingDog commands the
 * crew, summoning layouts from the abyss like a captain charting courses
 * through waters no sane soul would sail. To cosmic madness laws submit,
 * though stalwart minds entreat.
 */
import { Dog, IHuntingDog, IHuntingSeason } from "@slopdogs/core";
import { FoodPornRetriever, DishFlagBlackLab } from '@slopdogs/dogs-demo';
import { LayoutInputPact } from "./renderer/layouts/ILayoutInput";
import { LayoutRenderer } from "./renderer/LayoutRenderer";
import { TinderLayout } from "./renderer/layouts/tinderLayout";
import { BiographyLayout } from "./renderer/layouts/BiographyLayout";
import { RecipeLayout } from "./renderer/layouts/RecipeLayout";
import { ArticleLayout } from "./renderer/fragments/ArticleLayout";
import { GalleryLayout } from "./renderer/fragments/GalleryLayout";
import type { ILayoutInput } from "./renderer/layouts/ILayoutInput";
import type { LayoutBase } from "./renderer/layouts/LayoutBase";

/** Arr, the TalkingDog — a vessel that speaks the void's will into rendered form. */
export class TalkingDog extends Dog<string> {

    /** The pacts this vessel demands before it sails into the eldritch deep. */
    get required() {
        return [
            LayoutInputPact,
        ]
    }

    /** No optional cargo needed, matey — the abyss provides all ye never asked for. */
    get optional() {
        return [

        ]
    }

    /** The name by which the void knows this vessel. */
    get name(): string {
        return TalkingDog.name
    }

    get description(): string {
        return 'Renders dog yields into formatted output using layout templates (tinder, biography, recipe, article, gallery).';
    }

    /** The sigil branded upon the hull — its heralds are the stars it fells. */
    get icon(): string | undefined {
        return "\uD83D\uDCAC";
    }

    /**
     * Arr, here the crew plunders the season's exhausted bounty and forges
     * a layout from the deep. Corporeal laws are unwritten as suns and love
     * retreat — each layout type be another face of the multitude that unfolds.
     */
    protected yieldCollectorFactory: (season: IHuntingSeason) => Promise<string> = async (season: IHuntingSeason) => {
        const mimicDog = season.exhausted.find(d => this.matchesParent(LayoutInputPact, d));
        if (!mimicDog || !mimicDog.collected) {
            throw new Error('TalkingDog: LayoutInputProvider not found or has no data');
        }

        const input = mimicDog.collected as ILayoutInput;
        let layout: LayoutBase<any>;

        // Arr, choose yer doom — each layout be a different tentacle of the void
        switch (input.type) {
            case 'tinder':    layout = new TinderLayout(); break;
            case 'biography': layout = new BiographyLayout(); break;
            case 'recipe':    layout = new RecipeLayout(); break;
            case 'article':   layout = new ArticleLayout(); break;
            case 'gallery':   layout = new GalleryLayout(); break;
            default:
                throw new Error(`TalkingDog: Unknown layout type '${(input as any).type}'`);
        }

        layout.populate(input);

        // The renderer speaks the final incantation — we end as we began
        const renderer = new LayoutRenderer();
        return renderer.render(layout);
    }

}

