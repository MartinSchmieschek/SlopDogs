import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { DogGroup, DogOwnerFilter } from '../../models/dog-catalog';

export interface SdRailCount<K extends string = string> {
  key: K;
  label: string;
  /** null while the list loads: `—`. */
  count: number | null;
}

const PACKS_SHOWN = 10;

/**
 * Browser filters (6.5 `sd-filter-rail`): group, pack, owner — the rail on the left of /dogs (240) and
 * the body of the filter sheet on mobile. Options are label-maker rows with their counts; the active
 * one is ink. Packs: a search field and checkboxes, ten shown until `all n packs`.
 */
@Component({
  selector: 'sd-filter-rail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sd-filter-rail.component.html',
  styleUrls: ['./sd-filter-rail.component.scss'],
})
export class SdFilterRailComponent {
  private static seq = 0;
  /** The rail renders twice on a phone (rail hidden, sheet open) — ids stay unique. */
  readonly uid = `sd-rail-${++SdFilterRailComponent.seq}`;

  readonly groups = input.required<SdRailCount<'all' | DogGroup>[]>();
  readonly group = input<'all' | DogGroup>('all');
  readonly owners = input.required<SdRailCount<DogOwnerFilter>[]>();
  readonly owner = input<DogOwnerFilter>('everyone');
  /** Packs with their counts (base dogs only); empty on a server without `pack`. */
  readonly packs = input<SdRailCount[]>([]);
  readonly selectedPacks = input<readonly string[]>([]);
  readonly activeCount = input(0);

  readonly groupChange = output<'all' | DogGroup>();
  readonly ownerChange = output<DogOwnerFilter>();
  readonly packToggle = output<string>();
  readonly cleared = output<void>();

  readonly packQuery = signal('');
  readonly allPacks = signal(false);

  readonly visiblePacks = computed(() => {
    const q = this.packQuery().trim().toLowerCase();
    const chosen = new Set(this.selectedPacks());
    const hits = this.packs().filter((p) => !q || p.key.toLowerCase().includes(q));
    if (q || this.allPacks()) return hits;
    // Chosen packs stay visible even when they sit below the first ten.
    return hits.filter((p, i) => i < PACKS_SHOWN || chosen.has(p.key));
  });
  readonly hiddenPacks = computed(() => (this.packQuery() || this.allPacks() ? 0 : Math.max(0, this.packs().length - this.visiblePacks().length)));

  isChosen(key: string): boolean {
    return this.selectedPacks().includes(key);
  }

  count(n: number | null): string {
    return n === null ? '—' : String(n);
  }
}
