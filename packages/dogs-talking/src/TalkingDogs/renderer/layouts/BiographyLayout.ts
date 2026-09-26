/**
 * BiographyLayout.ts — The Chronicle of a Soul Lost to the Deep
 *
 * Arr, this layout tells the tale of a soul — portrait, name, birth,
 * and the story of their cursed voyage, matey. Through endless faces,
 * countless forms, a multitude unfolds... and each biography be but
 * another entry in the void's eternal ledger.
 */
import { BiographyLayoutEnum } from "../enums/BiographyLayoutEnum";
import { ImageFragment } from "../fragments/ImageFragment";
import { TextFragment } from "../fragments/TextFragment";
import { LayoutBase } from "./LayoutBase";
import type { ILayoutInput, IBiographyInput } from "./ILayoutInput";

/** Arr, the biography layout — a vessel that carries a soul's tale from the abyss to the screen. */
export class BiographyLayout extends LayoutBase<BiographyLayoutEnum> {
  /** Anchor the biography fragments — portrait, name, birth, and the eldritch story. */
  constructor() {
    super();
    this.fragments.set(BiographyLayoutEnum.Portrait, new ImageFragment());
    this.fragments.set(BiographyLayoutEnum.Name, new TextFragment("Name"));
    this.fragments.set(BiographyLayoutEnum.BirthInfo, new TextFragment("Born ..."));
    this.fragments.set(BiographyLayoutEnum.Story, new TextFragment("Story goes here..."));
  }

  /** Populate with plundered data — the void reveals all about this poor soul. */
  populate(input: ILayoutInput): void {
    const data = input as IBiographyInput;

    const portrait = this.get(BiographyLayoutEnum.Portrait);
    if (portrait && "imageUrl" in portrait) (portrait as ImageFragment).imageUrl = data.imageUrl;

    const name = this.get(BiographyLayoutEnum.Name);
    if (name && "text" in name) (name as TextFragment).text = data.name;

    const birth = this.get(BiographyLayoutEnum.BirthInfo);
    if (birth && "text" in birth) (birth as TextFragment).text = data.birthInfo;

    const story = this.get(BiographyLayoutEnum.Story);
    if (story && "text" in story) (story as TextFragment).text = data.story;
  }
}
