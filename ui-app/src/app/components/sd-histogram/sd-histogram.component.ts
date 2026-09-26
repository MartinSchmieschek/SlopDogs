import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { IRatingView } from '../../services/kennel.service';

/**
 * The star distribution (6.5 `sd-histogram`): five hard ink bars on `--paper-3`, five stars on top.
 * Bars are relative to the largest bucket; counts stay readable as data. Without ratings: one line.
 */
@Component({
  selector: 'sd-histogram',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (total() > 0) {
      <ol class="h" [attr.aria-label]="'Ratings by stars, ' + total() + ' in total'">
        @for (row of rows(); track row.stars) {
          <li class="r" [attr.aria-label]="row.stars + ' stars: ' + row.count">
            <span class="k" aria-hidden="true">{{ row.stars }}★</span>
            <span class="t" aria-hidden="true"><span class="b" [style.width.%]="row.pct"></span></span>
            <span class="n">{{ row.count }}</span>
          </li>
        }
      </ol>
    } @else {
      <p class="e">No ratings yet.</p>
    }
  `,
  styles: [`
    :host { display: block; }
    .h { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .r { display: grid; grid-template-columns: 28px 1fr 40px; align-items: center; gap: var(--s2);
      font-size: 13px; line-height: 19px; font-variant-numeric: tabular-nums; }
    .k { color: var(--ink-2); }
    .t { height: 12px; background: var(--paper-3); }
    .b { display: block; height: 12px; background: var(--ink); }
    .n { text-align: right; color: var(--ink-2); }
    .e { font-size: 12px; line-height: 17px; color: var(--ink-2); }
  `],
})
export class SdHistogramComponent {
  readonly histogram = input<IRatingView['histogram'] | null | undefined>(null);

  readonly total = computed(() => {
    const h = this.histogram();
    return h ? h[1] + h[2] + h[3] + h[4] + h[5] : 0;
  });
  readonly rows = computed(() => {
    const h = this.histogram();
    if (!h) return [];
    const max = Math.max(1, h[1], h[2], h[3], h[4], h[5]);
    return ([5, 4, 3, 2, 1] as const).map((stars) => ({ stars, count: h[stars], pct: (h[stars] / max) * 100 }));
  });
}
