import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import type { DogInfo } from '../../../models/dog.model';
import { DogCatalogEntry, sortCatalog, type DogSortKey } from '../../../models/dog-catalog';
import { AuthService } from '../../../services/auth.service';
import { SdDrawerComponent } from '../../../components/sd-drawer/sd-drawer.component';
import { SdDogRowComponent } from '../../../components/sd-dog-row/sd-dog-row.component';

export type PaletteFilter = 'all' | 'base' | 'mine';
type PaletteSort = Extract<DogSortKey, 'proven' | 'name'>;

const SORT_STORAGE_KEY = 'slopdogs.palette.sort.v1';

function readSort(): PaletteSort {
  try {
    return localStorage.getItem(SORT_STORAGE_KEY) === 'name' ? 'name' : 'proven';
  } catch {
    return 'proven';
  }
}

/**
 * Dog palette (6.4 S4, P6 U5): left drawer 360 on desktop, bottom sheet on a phone (sd-drawer). The same
 * tracklist rows as the browser, smaller; ink head `DOGS ×`, search, `all · base · mine`, sort
 * `proven · name` (default proven, localStorage `slopdogs.palette.sort.v1`), groups BASE and DOGS, proven
 * first in each. A foreign run-only dog is an ink row `run only · v7` and goes in pinned. Click adds,
 * drag stays, `i` opens the browser preview in a new tab.
 */
@Component({
  selector: 'app-waves-dog-palette',
  standalone: true,
  imports: [SdDrawerComponent, SdDogRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sd-drawer [open]="open()" side="left" [width]="360" label="Dogs" initialSnap="half" (closed)="closeRequested.emit()">
      <div drawer-head>
        <p class="sd-kicker k">palette</p>
        <p class="sd-h1">Dogs</p>
      </div>
      <div drawer-tabs class="tools">
        <label class="sd-sr-only" for="palette-q">Search dogs</label>
        <input id="palette-q" class="sd-field" type="search" placeholder="Search dogs" autocomplete="off" spellcheck="false"
          [value]="query()" (input)="query.set($any($event.target).value)" (keydown.escape)="query.set('')" />
        <div class="chips">
          <span class="grp" role="group" aria-label="Filter">
            @for (f of filters(); track f) {
              <button type="button" class="sd-chip sd-chip--outline" [attr.aria-pressed]="filter() === f" (click)="filter.set(f)">{{ f }}</button>
            }
          </span>
          <span class="grp" role="group" aria-label="Sort">
            <button type="button" class="sd-chip sd-chip--outline" [attr.aria-pressed]="sort() === 'proven'" (click)="sort.set('proven')">proven</button>
            <button type="button" class="sd-chip sd-chip--outline" [attr.aria-pressed]="sort() === 'name'" (click)="sort.set('name')">name</button>
          </span>
        </div>
        <button type="button" class="sd-btn sd-btn--sm new" (click)="newDogRequested.emit()">+ New dog</button>
      </div>

      <div class="list">
        @for (g of groups(); track g.label) {
          <h2 class="sd-label cap">{{ g.label }} <span class="n">{{ g.rows.length }}</span></h2>
          <div role="list" [attr.aria-label]="g.label">
            @for (d of g.rows; track d.key; let i = $index) {
              <sd-dog-row variant="palette" [dog]="d" [index]="i" [staggerIndex]="i" (picked)="dogAdded.emit(d)"
                (dragged)="onDragStart($event, d)" />
            }
          </div>
        } @empty {
          <div class="empty">
            @if (query().trim()) {
              <p>No dogs match "{{ query().trim() }}".</p>
              <button type="button" class="sd-btn sd-btn--sm" (click)="query.set('')">Clear</button>
            } @else {
              <p>Every dog you can run is in this kennel already.</p>
            }
          </div>
        }
      </div>
    </sd-drawer>
  `,
  styles: [`
    .k { color: var(--ink-soft); }
    .tools { display: flex; flex-direction: column; gap: var(--s2); padding: var(--s3) var(--s4); border-bottom: 1px solid var(--line); background: var(--paper-2); }
    .tools .sd-field { min-height: 36px; padding-top: 6px; padding-bottom: 6px; }
    .chips { display: flex; justify-content: space-between; gap: var(--s2); flex-wrap: wrap; }
    .grp { display: flex; gap: 4px; }
    .grp .sd-chip { min-height: 28px; padding: 0 var(--s2); }
    .new { align-self: flex-start; }
    .list { padding: 0 var(--s4) var(--s5); }
    .cap { position: sticky; top: 0; z-index: 1; margin: 0; padding: var(--s3) 0 var(--s1); background: var(--paper-2); }
    .n { color: var(--ink-3); letter-spacing: 0; }
    .empty { padding: var(--s6) 0; color: var(--ink-2); display: flex; flex-direction: column; align-items: flex-start; gap: var(--s2); }
  `],
})
export class WavesDogPaletteComponent {
  private readonly auth = inject(AuthService);

  readonly availableDogs = input<DogInfo[]>([]);
  readonly open = input<boolean>(false);

  readonly closeRequested = output<void>();
  readonly newDogRequested = output<void>();
  /** The picked dog — its `ref` is what the kennel stores (version GUID for a run-only dog). */
  readonly dogAdded = output<DogCatalogEntry>();

  readonly query = signal('');
  readonly filter = signal<PaletteFilter>('all');
  readonly sort = signal<PaletteSort>(readSort());
  readonly filters = computed<PaletteFilter[]>(() => (this.auth.user() ? ['all', 'base', 'mine'] : ['all', 'base']));

  readonly entries = computed(() => {
    const userId = this.auth.user()?.id ?? null;
    return this.availableDogs().map((d) => DogCatalogEntry.from(d, userId));
  });

  /** BASE and DOGS apart (P4b 4b.8), proven first in each (or by name). */
  readonly groups = computed(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.filter();
    const hits = this.entries().filter((d) => d.matches(q) && (f === 'all' || (f === 'base' ? d.isBase : d.own)));
    const out = [
      { label: 'base', rows: sortCatalog(hits.filter((d) => d.isBase), this.sort()) },
      { label: 'dogs', rows: sortCatalog(hits.filter((d) => !d.isBase), this.sort()) },
    ];
    return out.filter((g) => g.rows.length > 0);
  });

  constructor() {
    effect(() => {
      const s = this.sort();
      try {
        localStorage.setItem(SORT_STORAGE_KEY, s);
      } catch {
        /* private mode */
      }
    });
  }

  onDragStart(event: DragEvent, dog: DogCatalogEntry): void {
    event.dataTransfer?.setData('application/dog-id', dog.ref);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }
}
