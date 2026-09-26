import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { IKennelStats } from '../../models/kennel-config.model';

/** Groups digits with a thin space: 1240 -> "1 240". */
export function formatCount(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * The plaque (6.5 `sd-plaque`): runs of the last 30 days, handwritten on the inlay — ink, mono, no box.
 * Missing stats (server before P4) render nothing; 0 stays "0".
 */
@Component({
  selector: 'sd-plaque',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (stats(); as s) {
      <span class="p" [title]="title()" [attr.aria-label]="title()"><span class="g" aria-hidden="true">▷</span>{{ count() }}@if (full()) {<span class="u"> · 30d</span>}</span>
    }
  `,
  styles: [`
    :host { display: inline-block; }
    .p { font-size: 13px; line-height: 19px; color: var(--ink-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .g { color: var(--ink-3); margin-right: 4px; }
    .u { color: var(--ink-3); }
  `],
})
export class SdPlaqueComponent {
  readonly stats = input<IKennelStats | undefined>(undefined);
  /** Adds the " · 30d" unit. */
  readonly full = input(false);

  readonly count = computed(() => formatCount(this.stats()?.calls.ranked30d ?? 0));
  readonly title = computed(() => {
    const c = this.stats()?.calls;
    if (!c) return '';
    return `${formatCount(c.ranked30d)} runs in 30 days · ${formatCount(c.ranked)} in total`;
  });
}
