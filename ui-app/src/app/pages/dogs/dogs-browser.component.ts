import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type ParamMap } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, map, switchMap, tap } from 'rxjs/operators';
import { DogService } from '../../services/dog.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import type { DogInfo } from '../../models/dog.model';
import {
  DogCatalogEntry,
  sortCatalog,
  type DogGroup,
  type DogOwnerFilter,
  type DogSortKey,
} from '../../models/dog-catalog';
import { SdTopBarComponent } from '../../components/sd-top-bar/sd-top-bar.component';
import { SdSearchComponent } from '../../components/sd-search/sd-search.component';
import { SdChapterCardComponent } from '../../components/sd-chapter-card/sd-chapter-card.component';
import { SdSortComponent, type SdSortOption } from '../../components/sd-sort/sd-sort.component';
import { SdTrackSkeletonComponent } from '../../components/sd-track-skeleton/sd-track-skeleton.component';
import { SdBannerComponent } from '../../components/sd-banner/sd-banner.component';
import { SdVeilComponent } from '../../components/sd-veil/sd-veil.component';
import { SdBottomBarComponent } from '../../components/sd-bottom-bar/sd-bottom-bar.component';
import { SdDrawerComponent } from '../../components/sd-drawer/sd-drawer.component';
import { SdDogRowComponent } from '../../components/sd-dog-row/sd-dog-row.component';
import { SdFilterRailComponent, type SdRailCount } from '../../components/sd-filter-rail/sd-filter-rail.component';
import { SdDogPreviewComponent } from '../../components/sd-dog-preview/sd-dog-preview.component';

const SEARCH_DEBOUNCE_MS = 250;
const PAGE_ROWS = 60;
const SORT_KEYS: readonly DogSortKey[] = ['proven', 'calls30d', 'reuse', 'name'];
const SORT_OPTIONS: readonly SdSortOption<DogSortKey>[] = [
  { key: 'proven', label: 'proven' },
  { key: 'calls30d', label: 'calls 30d' },
  { key: 'reuse', label: 'reuse' },
  { key: 'name', label: 'name' },
];
const GROUPS: ReadonlyArray<{ key: 'all' | DogGroup; label: string }> = [
  { key: 'all', label: 'all' }, { key: 'base', label: 'base' }, { key: 'dogs', label: 'dogs' }, { key: 'mimic', label: 'mimic' },
];
const OWNERS: ReadonlyArray<{ key: DogOwnerFilter; label: string }> = [
  { key: 'everyone', label: 'everyone' }, { key: 'mine', label: 'mine' }, { key: 'foreign', label: 'foreign' }, { key: 'run-only', label: 'run only' },
];

interface Filters {
  q: string;
  group: 'all' | DogGroup;
  owner: DogOwnerFilter;
  packs: string[];
}

const isSortKey = (v: unknown): v is DogSortKey => typeof v === 'string' && (SORT_KEYS as readonly string[]).includes(v);
const isGroup = (v: unknown): v is DogGroup => v === 'base' || v === 'dogs' || v === 'mimic';
const isOwner = (v: unknown): v is DogOwnerFilter => typeof v === 'string' && OWNERS.some((o) => o.key === v);
const defaultDir = (k: DogSortKey): 'asc' | 'desc' => (k === 'name' ? 'asc' : 'desc');

/**
 * S6 Dogs, side B (P6 U5, 6.4, 8.21): every dog the caller may run — base dogs and dogs in one list,
 * `base` is a filter. Rail (group, owner, pack), search, sort chips (proven by default, 8.26), tracklist
 * rows; a row opens the preview (drawer / sheet). The URL is the state: `?q=&sort=&dir=&group=&pack=&owner=&dog=`.
 * The server sorts (`GET /api/nodes?lean=1&sort=`, the order list_nodes gives agents); filters and counts
 * run here over the one lean list.
 */
@Component({
  selector: 'app-dogs-browser',
  standalone: true,
  imports: [
    SdTopBarComponent, SdSearchComponent, SdChapterCardComponent, SdSortComponent, SdTrackSkeletonComponent,
    SdBannerComponent, SdVeilComponent, SdBottomBarComponent, SdDrawerComponent, SdDogRowComponent,
    SdFilterRailComponent, SdDogPreviewComponent,
  ],
  templateUrl: './dogs-browser.component.html',
  styles: [`
    :host { display: block; min-height: 100dvh; }
    .page { max-width: var(--max-list); margin: 0 auto; padding: 0 var(--gutter) var(--s8); }
    .tools { display: flex; align-items: center; justify-content: space-between; gap: var(--s3); padding: var(--s3) 0; }
    .tools sd-sort { min-width: 0; }
    .filter-btn { display: none; }
    .body { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: var(--s5); align-items: start; }
    .rail { position: sticky; top: calc(var(--top-bar-h) + 92px); max-height: calc(100dvh - var(--top-bar-h) - 108px);
      overflow: auto; padding: var(--s2) var(--s1) var(--s4) 0; }
    .stage { position: relative; min-height: 240px; }
    .status { padding: var(--s4) 0; text-align: center; color: var(--ink-2); }
    .empty { display: flex; flex-direction: column; align-items: flex-start; gap: var(--s3); padding: var(--s7) 0 var(--s5); max-width: 84ch; }
    .empty h2 { font: 400 28px/28px var(--font-display); letter-spacing: .03em; }
    .sheet-body { padding: var(--s4); }
    .fk { color: var(--ink-soft); }
    @media (max-width: 767px) {
      .page { padding-bottom: calc(var(--s8) + 60px); }
      .body { grid-template-columns: minmax(0, 1fr); }
      .rail { display: none; }
      .filter-btn { display: inline-flex; flex: none; }
    }
  `],
})
export class DogsBrowserComponent {
  private readonly dogService = inject(DogService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly sortOptions = SORT_OPTIONS;

  /** The lean list in server order. */
  readonly all = signal<DogCatalogEntry[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly epoch = signal(0);
  readonly rows = signal(PAGE_ROWS);

  readonly searchQuery = signal('');
  readonly filters = signal<Filters>({ q: '', group: 'all', owner: 'everyone', packs: [] });
  readonly sortKey = signal<DogSortKey>('proven');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly selectedKey = signal<string | null>(null);
  readonly sheetOpen = signal(false);
  private readonly toast = inject(ToastService);

  /** A server without stats (before P4b): no proven chip, no proven sort — name instead (8.26). */
  readonly hasStats = computed(() => this.all().some((d) => !!d.stats));
  readonly visibleSortOptions = computed(() => (this.hasStats() ? SORT_OPTIONS : SORT_OPTIONS.filter((o) => o.key === 'name')));
  readonly effectiveSort = computed<DogSortKey>(() => (this.hasStats() || this.loading() ? this.sortKey() : 'name'));

  /** Server order; a server without stats sorted by nothing the browser shows — then by name here. */
  readonly filtered = computed(() => {
    const hits = this.apply(this.filters());
    return this.hasStats() ? hits : sortCatalog(hits, 'name');
  });
  readonly shown = computed(() => this.filtered().slice(0, this.rows()));
  readonly selected = computed(() => {
    const key = this.selectedKey();
    return key ? this.all().find((d) => d.key === key) ?? null : null;
  });
  readonly activeFilters = computed(() => {
    const f = this.filters();
    return (f.group !== 'all' ? 1 : 0) + (f.owner !== 'everyone' ? 1 : 0) + f.packs.length;
  });
  readonly isFiltered = computed(() => this.activeFilters() > 0 || !!this.filters().q);
  readonly packCount = computed(() => new Set(this.all().map((d) => d.pack).filter(Boolean)).size);
  readonly kicker = computed(() => {
    const n = this.all().length;
    const parts = ['side B', this.loading() && !n ? '— tracks' : `${n} track${n === 1 ? '' : 's'}`];
    if (this.packCount()) parts.push(`${this.packCount()} packs`);
    return parts.join(' · ');
  });
  readonly sortLabel = computed(() => SORT_OPTIONS.find((o) => o.key === this.effectiveSort())?.label ?? 'name');

  readonly groupCounts = computed<SdRailCount<'all' | DogGroup>[]>(() => {
    const pool = this.loading() && !this.all().length ? null : this.apply({ ...this.filters(), group: 'all' });
    return GROUPS.map((g) => ({ ...g, count: pool ? pool.filter((d) => g.key === 'all' || d.group === g.key).length : null }));
  });
  readonly ownerCounts = computed<SdRailCount<DogOwnerFilter>[]>(() => {
    const pool = this.loading() && !this.all().length ? null : this.apply({ ...this.filters(), owner: 'everyone' });
    const owners = this.auth.user() ? OWNERS : OWNERS.filter((o) => o.key !== 'mine');
    return owners.map((o) => ({ ...o, count: pool ? pool.filter((d) => d.inOwner(o.key)).length : null }));
  });
  readonly packCounts = computed<SdRailCount[]>(() => {
    const counts = new Map<string, number>();
    for (const d of this.apply({ ...this.filters(), packs: [] })) if (d.pack) counts.set(d.pack, (counts.get(d.pack) ?? 0) + 1);
    for (const p of this.filters().packs) if (!counts.has(p)) counts.set(p, 0);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key, count]) => ({ key, label: key, count }));
  });
  readonly previewWidth = signal(typeof window !== 'undefined' && window.innerWidth >= 1440 ? 480 : 440);
  readonly returnTo = computed(() => (this.selectedKey() ? `/dogs?dog=${encodeURIComponent(this.selectedKey()!)}` : '/dogs'));

  private readonly searchInput = new Subject<string>();
  private readonly loads = new Subject<void>();
  private first = true;

  constructor() {
    this.searchInput.pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed()).subscribe((value) => {
      const q = value.trim();
      if (q === this.filters().q) return;
      this.patch({ q });
      this.writeParams({ q: q || null });
    });

    this.loads.pipe(
      tap(() => { this.loading.set(true); this.error.set(null); }),
      switchMap(() => this.dogService.getCatalog({ sort: this.sortKey(), dir: this.sortDir() }).pipe(
        map((res) => ({ list: res.data ?? [], failure: null as string | null })),
        catchError((err) => of({ list: [] as DogInfo[], failure: err?.status ? `Couldn't load dogs (${err.status}).` : "Couldn't load dogs." })),
      )),
      takeUntilDestroyed(),
    ).subscribe(({ list, failure }) => {
      this.loading.set(false);
      if (failure) { this.error.set(failure); return; }
      const userId = this.auth.user()?.id ?? null;
      this.all.set(list.map((d) => DogCatalogEntry.from(d, userId)));
      this.epoch.update((n) => n + 1);
      this.checkDeepLink();
    });

    // Signing in changes which dogs are yours and which the server lists.
    let authSeen = false;
    effect(() => {
      if (!this.auth.isReady()) return;
      this.auth.user();
      if (!authSeen) { authSeen = true; return; }
      this.loads.next();
    }, { allowSignalWrites: true });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => this.applyParams(p));
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchInput.next(value);
  }

  onSortKey(key: string): void {
    if (!isSortKey(key)) return;
    if (key === this.sortKey()) { this.toggleDir(); return; }
    this.sortKey.set(key);
    this.sortDir.set(defaultDir(key));
    this.writeParams({ sort: key === 'proven' ? null : key, dir: null });
    this.loads.next();
  }

  toggleDir(): void {
    this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    this.writeParams({ dir: this.sortDir() === defaultDir(this.sortKey()) ? null : this.sortDir() });
    this.loads.next();
  }

  setGroup(group: 'all' | DogGroup): void {
    this.patch({ group });
    this.writeParams({ group: group === 'all' ? null : group });
  }

  setOwner(owner: DogOwnerFilter): void {
    this.patch({ owner });
    this.writeParams({ owner: owner === 'everyone' ? null : owner });
  }

  togglePack(pack: string): void {
    const packs = this.filters().packs.includes(pack) ? this.filters().packs.filter((p) => p !== pack) : [...this.filters().packs, pack];
    this.patch({ packs });
    this.writeParams({ pack: packs.length ? packs.join(',') : null });
  }

  /** `[Clear filters]` drops group, owner and packs; the search stays (6.4). */
  clearFilters(): void {
    this.patch({ group: 'all', owner: 'everyone', packs: [] });
    this.writeParams({ group: null, owner: null, pack: null });
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.patch({ q: '' });
    this.writeParams({ q: null });
  }

  open(d: DogCatalogEntry): void {
    this.selectedKey.set(d.key);
    this.writeParams({ dog: d.key });
  }

  closePreview(): void {
    this.selectedKey.set(null);
    this.writeParams({ dog: null });
  }

  retry(): void {
    this.loads.next();
  }

  more(): void {
    this.rows.update((n) => n + PAGE_ROWS);
  }

  private apply(f: Filters): DogCatalogEntry[] {
    const q = f.q.toLowerCase();
    return this.all().filter((d) =>
      (f.group === 'all' || d.group === f.group)
      && d.inOwner(f.owner)
      && (!f.packs.length || (!!d.pack && f.packs.includes(d.pack)))
      && d.matches(q));
  }

  private patch(p: Partial<Filters>): void {
    this.filters.update((f) => ({ ...f, ...p }));
    this.rows.set(PAGE_ROWS);
  }

  private applyParams(p: ParamMap): void {
    const q = (p.get('q') ?? '').trim();
    const sort = p.get('sort');
    const dir = p.get('dir');
    const key: DogSortKey = isSortKey(sort) ? sort : 'proven';
    const nextDir = dir === 'asc' || dir === 'desc' ? dir : defaultDir(key);
    const group = p.get('group');
    const owner = p.get('owner');
    const packs = (p.get('pack') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (q !== this.filters().q) this.searchQuery.set(q);
    this.patch({ q, group: isGroup(group) ? group : 'all', owner: isOwner(owner) ? owner : 'everyone', packs });
    const resort = key !== this.sortKey() || nextDir !== this.sortDir();
    this.sortKey.set(key);
    this.sortDir.set(nextDir);
    this.selectedKey.set(p.get('dog'));
    if (this.first || resort) this.loads.next();
    this.first = false;
    this.checkDeepLink();
  }

  /** `?dog=` names a dog the list does not hold (gone, or not runnable for you): say so once, drop it. */
  private checkDeepLink(): void {
    const key = this.selectedKey();
    if (!key || this.loading() || this.error() || !this.all().length) return;
    if (this.all().some((d) => d.key === key)) return;
    this.selectedKey.set(null);
    this.writeParams({ dog: null });
    this.toast.show("That dog isn't here. It may be private, or it was renamed.");
  }

  private writeParams(patch: Record<string, string | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: patch, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
