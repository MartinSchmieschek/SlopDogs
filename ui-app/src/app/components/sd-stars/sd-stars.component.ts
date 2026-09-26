import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { IKennelStats } from '../../models/kennel-config.model';

const STAR = 'M8 1.2l2 4.3 4.7.5-3.5 3.2 1 4.6L8 11.5l-4.2 2.3 1-4.6L1.3 6l4.7-.5z';

/**
 * Star aggregate (6.5 `sd-stars`, variant aggregate 16 px): ink outlines, filled up to the rounded average,
 * empty in `--ink-3`, never yellow. `count 0` shows `★ —` with `title="no ratings yet"`; missing stats render
 * nothing. The input variant (24 px, rating tab) arrives with U4.
 */
@Component({
  selector: 'sd-stars',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rating(); as r) {
      @if (r.count > 0) {
        <span class="s" [title]="title()" [attr.aria-label]="title()">
          @if (!compact()) {
            <svg viewBox="0 0 80 16" width="80" height="16" aria-hidden="true">
              @for (i of five; track i) {
                <path [attr.d]="star" [attr.transform]="'translate(' + i * 16 + ' 0)'"
                  [class.on]="i < filled()" />
              }
            </svg>
          } @else {
            <span class="g" aria-hidden="true">★</span>
          }
          <span class="n">{{ avg() }}</span><span class="c">({{ r.count }})</span>
        </span>
      } @else {
        <span class="s none" title="no ratings yet" aria-label="no ratings yet"><span class="g" aria-hidden="true">★</span>—</span>
      }
    }
  `,
  styles: [`
    :host { display: inline-block; }
    .s { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; line-height: 19px;
      font-variant-numeric: tabular-nums; white-space: nowrap; }
    path { fill: none; stroke: var(--ink-3); stroke-width: 1.5; stroke-linejoin: round; }
    path.on { fill: var(--ink); stroke: var(--ink); }
    .g { color: var(--ink); }
    .none, .none .g, .c { color: var(--ink-3); }
  `],
})
export class SdStarsComponent {
  readonly stats = input<IKennelStats | undefined>(undefined);
  /** One glyph instead of five outlines (narrow rows). */
  readonly compact = input(false);

  readonly five = [0, 1, 2, 3, 4];
  readonly star = STAR;
  readonly rating = computed(() => this.stats()?.rating);
  readonly avg = computed(() => (this.rating()?.avg ?? 0).toFixed(1));
  readonly filled = computed(() => Math.round(this.rating()?.avg ?? 0));
  readonly title = computed(() => {
    const r = this.rating();
    return r ? `${this.avg()} of 5 · ${r.count} rating${r.count === 1 ? '' : 's'}` : '';
  });
}
