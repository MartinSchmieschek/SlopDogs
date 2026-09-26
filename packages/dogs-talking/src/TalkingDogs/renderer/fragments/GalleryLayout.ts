/**
 * GalleryLayout.ts — The Hall of Forbidden Visions
 *
 * Arr, this layout assembles a gallery of images plundered from the deep,
 * matey. In luminous space blackened stars, they gaze, accuse, deny — and
 * each thumbnail be a porthole into the cosmic abyss. The "Open" button
 * beckons ye to witness what no crew was meant to see.
 */
import { GalleryLayoutEnum } from "../enums/GalleryLayoutEnum";
import { TextFragment } from "./TextFragment";
import { ButtonFragment } from "./ButtonFragment";
import { ImageFragment } from "./ImageFragment";
import { LayoutBase } from "../layouts/LayoutBase";
import type { ILayoutInput, IGalleryInput } from "../layouts/ILayoutInput";

/** Arr, the gallery layout — a vessel displayin' forbidden images from beyond the veil. */
export class GalleryLayout extends LayoutBase<GalleryLayoutEnum> {
  /** Anchor the gallery fragments — title, thumbnails, and the dread "Open" button. */
  constructor() {
    super();
    this.fragments.set(GalleryLayoutEnum.Title, new TextFragment("Gallery"));
    this.fragments.set(GalleryLayoutEnum.Thumbnails, new ImageFragment());
    this.fragments.set(GalleryLayoutEnum.OpenGallery, new ButtonFragment("Open"));
  }

  /** Populate the gallery with plundered data — the abyss shares its visions. */
  populate(input: ILayoutInput): void {
    const data = input as IGalleryInput;

    const title = this.get(GalleryLayoutEnum.Title);
    if (title && "text" in title) (title as TextFragment).text = data.title;

    const thumb = this.get(GalleryLayoutEnum.Thumbnails);
    if (thumb && "imageUrl" in thumb) (thumb as ImageFragment).imageUrl = data.thumbnailUrl;
  }
}
