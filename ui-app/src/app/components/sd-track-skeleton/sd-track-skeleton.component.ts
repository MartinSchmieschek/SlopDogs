import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Skeleton rows (6.4 S1): hairlines and two paper-3 bars each; no reels, no verse. */
@Component({
  selector: 'sd-track-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (i of rows(); track i) {
      <div class="r" aria-hidden="true">
        <span></span>
        <span><i class="sd-skel a" [style.width.%]="30 + (i * 17) % 35"></i><i class="sd-skel b"></i></span>
      </div>
    }
  `,
  styles: [`
    .r { display: grid; grid-template-columns: 44px 1fr; column-gap: var(--s3); align-items: center;
      min-height: 56px; border-bottom: 1px solid var(--line); }
    .a { height: 14px; margin-bottom: 6px; }
    .b { width: 55%; height: 10px; }
  `],
})
export class SdTrackSkeletonComponent {
  readonly count = input(8);
  readonly rows = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
