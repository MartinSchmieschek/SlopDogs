import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { IDogStats } from '../../models/dog.model';
import { formatCount } from '../sd-plaque/sd-plaque.component';
import { SdProvenBadgeComponent } from '../sd-proven-badge/sd-proven-badge.component';
import { SdStatTilesComponent, type SdStatTile } from '../sd-stat-tiles/sd-stat-tiles.component';

/**
 * A dog's numbers (P4b stats; the browser preview's overview and the dog inspector's `stats` tab):
 * four tiles — runs 30d, reliable, kennels, avg ms — the proven label and its rule in one small line.
 * Loading shows `—` in every tile; a server without stats says so instead of showing zeros.
 */
@Component({
  selector: 'sd-dog-stats',
  standalone: true,
  imports: [SdStatTilesComponent, SdProvenBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sd-stat-tiles [tiles]="tiles()" />
    @if (stats(); as s) {
      <p class="rule sd-small">
        <sd-proven-badge [proven]="s.proven.badge" />
        <span>Proven means 5+ runs in 30 days, in a kennel, 80 % reliable. Score {{ s.proven.score }}.</span>
      </p>
      <p class="sd-small more">{{ detail() }}</p>
    } @else if (!loading()) {
      <p class="sd-small more">No numbers from this server yet.</p>
    }
  `,
  styles: [`
    :host { display: block; }
    .rule { display: flex; align-items: flex-start; gap: var(--s2); margin: var(--s3) 0 0; color: var(--ink-2); }
    .more { margin: var(--s1) 0 0; color: var(--ink-2); }
  `],
})
export class SdDogStatsComponent {
  readonly stats = input<IDogStats | undefined | null>(undefined);
  readonly loading = input(false);

  readonly tiles = computed<SdStatTile[]>(() => {
    const s = this.stats();
    const c = s?.calls;
    return [
      { label: 'runs 30d', value: c ? formatCount(c.ranked30d) : null, title: c ? `${formatCount(c.last30d)} runs in 30 days, ${formatCount(c.ranked30d)} of them real use` : undefined },
      { label: 'reliable', value: s ? `${Math.round(s.proven.reliability * 100)} %` : null, title: 'Share of runs without failure (0.7 until 5 runs)' },
      { label: 'kennels', value: s ? s.reuse.kennelsTransitive : null, title: s ? `${s.reuse.kennelsDirect} direct, ${s.reuse.kennelsForeign} foreign` : undefined },
      { label: 'avg ms', value: c?.avgDurationMs != null ? formatCount(c.avgDurationMs) : null, title: c ? `max ${formatCount(c.maxDurationMs)} ms` : undefined },
    ];
  });

  readonly detail = computed(() => {
    const s = this.stats();
    if (!s) return '';
    const c = s.calls;
    return `${formatCount(c.total)} runs in total · ${c.failures30d} failed · ${c.cached30d} cached · ${s.reuse.owners} owner${s.reuse.owners === 1 ? '' : 's'} · ${s.reuse.dependents} dependent${s.reuse.dependents === 1 ? '' : 's'}`;
  });
}
