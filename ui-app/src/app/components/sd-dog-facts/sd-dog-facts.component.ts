import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import type { DogEntry } from '../../models/dog-entry.model';
import { isBaseDog, type DogInfo } from '../../models/dog.model';
import { DogService } from '../../services/dog.service';
import { AuthService } from '../../services/auth.service';
import { dogInsightKey } from '../../utils/dog-panel-sections';
import { formatCount } from '../sd-plaque/sd-plaque.component';

/**
 * The numbers line in the dog inspector's ink head (6.4 S5): `PROVEN · 4 kennels · 812 ms avg · v7 · yours`.
 * Proven and the numbers come from the shared lean catalog (one request a minute, the same one the stats
 * tab reads); the version from the dog that ran; `yours` from the owner, base dogs name their pack.
 * A dog the catalog does not know (or a server without stats) shows only what the run knows.
 */
@Component({
  selector: 'sd-dog-facts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (proven() !== null) {
      <span class="sd-chip pv" [class.ok]="proven()">{{ proven() ? 'proven' : 'unproven' }}</span>
    }
    @for (part of parts(); track part) { <span class="part">{{ part }}</span> }
  `,
  styles: [`
    :host { display: flex; flex-wrap: wrap; align-items: center; gap: 2px var(--s2); margin-top: var(--s1);
      font-size: 12px; line-height: 17px; color: var(--ink-soft); }
    .pv { min-height: 18px; padding: 1px 6px; background: var(--paper-3); color: var(--ink-2); }
    /* Teal chips carry paper text only from 12 px 700 (DESIGN.md contrast table). */
    .pv.ok { background: var(--live); color: var(--paper-2); font-size: 12px; }
    .part + .part::before { content: '·'; margin-right: var(--s2); }
  `],
})
export class SdDogFactsComponent {
  private readonly dogs = inject(DogService);
  private readonly auth = inject(AuthService);

  readonly dog = input.required<DogEntry>();

  private readonly entry = signal<DogInfo | null>(null);

  readonly proven = computed<boolean | null>(() => this.entry()?.stats?.proven.badge ?? null);
  readonly parts = computed<string[]>(() => {
    const d = this.dog();
    const e = this.entry();
    const s = e?.stats;
    const out: string[] = [];
    if (s) {
      const k = s.reuse.kennelsTransitive;
      out.push(`${k} kennel${k === 1 ? '' : 's'}`);
      if (s.calls.avgDurationMs != null) out.push(`${formatCount(Math.round(s.calls.avgDurationMs))} ms avg`);
    }
    // A redacted dog's version and access stand in the line below (`run only · pinned to v7`).
    const v = d.redacted ? null : d.serializedDogConfig?.version ?? d.version;
    if (v != null) out.push(`v${v}`);
    if (e && isBaseDog(e)) out.push(e.pack ? `base · ${e.pack}` : 'base');
    else if (!d.redacted && e && this.isYours(e)) out.push('yours');
    return out;
  });

  constructor() {
    effect(() => {
      const key = dogInsightKey(this.dog());
      untracked(() => this.load(key));
    }, { allowSignalWrites: true });
  }

  private load(key: string | null): void {
    this.entry.set(null);
    if (!key) return;
    this.dogs.catalogOnce().subscribe({
      next: (list) => {
        if (dogInsightKey(this.dog()) !== key) return;
        this.entry.set(list.find((x) => x.id === key || (!isBaseDog(x) && x.lineageId === key)) ?? null);
      },
      error: () => undefined,
    });
  }

  private isYours(e: DogInfo): boolean {
    if (isBaseDog(e)) return false;
    const me = this.auth.user()?.id;
    return !!(e.myRights?.own || (me && e.ownerId === me));
  }
}
