import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import type { IDogStats, IDogUsage } from '../../models/dog.model';
import { DogService } from '../../services/dog.service';
import { SdDogStatsComponent } from '../sd-dog-stats/sd-dog-stats.component';
import { SdUsageListComponent, type SdUsageState } from '../sd-usage-list/sd-usage-list.component';

/**
 * The dog inspector's `usage` and `stats` tabs (6.4 S5): the same components as the browser preview,
 * loaded by the dog's key (`lineageId` or `base:X`). usage = `GET /api/nodes/:id/usage` (P4b); stats come
 * from the lean catalog (one shared request) — it carries them for run-only dogs too, whose single fetch
 * answers 404 without READ.
 */
@Component({
  selector: 'sd-dog-insight',
  standalone: true,
  imports: [SdDogStatsComponent, SdUsageListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mode() === 'usage') {
      <sd-usage-list [usage]="usage()" [state]="state()" [deps]="true" (retry)="load()" />
    } @else {
      @if (state() === 'error') {
        <p class="sd-small err">Couldn't load the numbers. <button type="button" class="sd-btn sd-btn--sm" (click)="load()">Retry</button></p>
      } @else {
        <sd-dog-stats [stats]="stats()" [loading]="state() === 'loading'" />
      }
    }
    <p class="sd-small link"><a [href]="'/dogs?dog=' + encoded()" target="_blank" rel="noopener">Open in the dog browser</a></p>
  `,
  styles: [`
    :host { display: block; padding: var(--s4); }
    .err { display: flex; gap: var(--s2); align-items: center; color: var(--danger-ink); }
    .link { margin: var(--s4) 0 0; }
    .link a { color: var(--ink); text-decoration-color: var(--line-strong); text-underline-offset: 3px; }
  `],
})
export class SdDogInsightComponent {
  private readonly dogService = inject(DogService);

  readonly dogKey = input.required<string>();
  readonly mode = input<'usage' | 'stats'>('usage');

  readonly usage = signal<IDogUsage | null>(null);
  readonly stats = signal<IDogStats | null>(null);
  readonly state = signal<SdUsageState>('loading');
  readonly encoded = signal('');

  constructor() {
    effect(() => {
      this.dogKey();
      this.mode();
      untracked(() => this.load());
    }, { allowSignalWrites: true });
  }

  load(): void {
    const key = this.dogKey();
    this.encoded.set(encodeURIComponent(key));
    this.state.set('loading');
    if (this.mode() === 'usage') {
      this.dogService.getUsage(key).subscribe({
        next: (u) => { if (this.dogKey() === key) { this.usage.set(u); this.state.set('ready'); } },
        error: () => this.dogKey() === key && this.state.set('error'),
      });
      return;
    }
    this.dogService.catalogOnce().subscribe({
      next: (list) => {
        if (this.dogKey() !== key) return;
        const hit = list.find((d) => d.id === key || (d as { lineageId?: string }).lineageId === key);
        this.stats.set(hit?.stats ?? null);
        this.state.set('ready');
      },
      error: () => this.dogKey() === key && this.state.set('error'),
    });
  }
}
