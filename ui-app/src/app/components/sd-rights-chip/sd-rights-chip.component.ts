import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { DogRight } from '../../models/dog-catalog';

const TITLES: Record<DogRight, string> = {
  run: 'You can run it. The code stays with its owner.',
  read: 'You can run it and read its code.',
  edit: 'You can run, read and edit it.',
};

/**
 * What the caller may do (6.5 `sd-rights-chip`, from `myRights` P3.5): `run` / `read` / `edit` as an
 * outline label at the end of a row. `edit` is ink — the one right that changes things.
 */
@Component({
  selector: 'sd-rights-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="sd-chip r" [class.sd-chip--outline]="right() !== 'edit'" [title]="title()">{{ right() }}</span>`,
  styles: [`:host { display: inline-flex; } .r { min-height: 20px; padding: 1px 6px; font-size: 10px; cursor: default; }`],
})
export class SdRightsChipComponent {
  readonly right = input.required<DogRight>();
  readonly title = computed(() => TITLES[this.right()]);
}
