/**
 * ArticleLayout.ts — The Scroll of Forbidden Tidings
 *
 * Arr, this layout assembles an article from fragments plundered
 * from the deep — image, headline, paragraph, and the dread "Read More"
 * that lures ye further into the abyss. Its heralds are the stars it fells,
 * the sky and Earth aflame.
 */
import { ArticleLayoutEnum } from "../enums/ArticleLayoutEnum";
import { ImageFragment } from "./ImageFragment";
import { TextFragment } from "./TextFragment";
import { ButtonFragment } from "./ButtonFragment";
import { LayoutBase } from "../layouts/LayoutBase";
import type { ILayoutInput, IArticleInput } from "../layouts/ILayoutInput";

/** Arr, the article layout — a vessel that carries news from the void to yer screen. */
export class ArticleLayout extends LayoutBase<ArticleLayoutEnum> {
  /** Anchor the fragments in place, matey — the crew assembles the cursed article. */
  constructor() {
    super();
    this.fragments.set(ArticleLayoutEnum.HeaderImage, new ImageFragment());
    this.fragments.set(ArticleLayoutEnum.Headline, new TextFragment("Headline"));
    this.fragments.set(ArticleLayoutEnum.Paragraph, new TextFragment("Lorem ipsum..."));
    this.fragments.set(ArticleLayoutEnum.ReadMore, new ButtonFragment("Read more"));
  }

  /** Populate this vessel with data plundered from the input — the void provides. */
  populate(input: ILayoutInput): void {
    const data = input as IArticleInput;

    const image = this.get(ArticleLayoutEnum.HeaderImage);
    if (image && "imageUrl" in image) (image as ImageFragment).imageUrl = data.imageUrl;

    const headline = this.get(ArticleLayoutEnum.Headline);
    if (headline && "text" in headline) (headline as TextFragment).text = data.headline;

    const paragraph = this.get(ArticleLayoutEnum.Paragraph);
    if (paragraph && "text" in paragraph) (paragraph as TextFragment).text = data.paragraph;
  }
}
