import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type ParamMap } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, map, switchMap, tap } from 'rxjs/operators';
import {
  KennelService,
  type KennelSortDir,
  type KennelSortKey,
  type PagedApiResponse,
} from '../../services/kennel.service';
import { IKennelConfig } from '../../models/kennel-config.model';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmService } from '../../services/confirm.service';
import { apiAbsoluteUrl } from '../../config/api-base';
import { publicKennelDocsPath } from '../../config/public-paths';
import {
  publicKennelPathWithDefaults,
  readLastOpenedKennel,
  rememberLastOpenedKennel,
} from '../../utils/last-opened-kennel';
import { SdTopBarComponent } from '../../components/sd-top-bar/sd-top-bar.component';
import { SdSearchComponent } from '../../components/sd-search/sd-search.component';
import { SdChapterCardComponent } from '../../components/sd-chapter-card/sd-chapter-card.component';
import { SdSortComponent, type SdSortOption } from '../../components/sd-sort/sd-sort.component';
import { SdTrackRowComponent, type KennelRowAction } from '../../components/sd-track-row/sd-track-row.component';
import { SdTrackSkeletonComponent } from '../../components/sd-track-skeleton/sd-track-skeleton.component';
import { SdBannerComponent } from '../../components/sd-banner/sd-banner.component';
import { SdUrlChipComponent } from '../../components/sd-url-chip/sd-url-chip.component';
import { SdVeilComponent } from '../../components/sd-veil/sd-veil.component';
import { SdKennelSheetComponent, type KennelCreateData } from '../../components/sd-kennel-sheet/sd-kennel-sheet.component';
import { SdBottomBarComponent } from '../../components/sd-bottom-bar/sd-bottom-bar.component';

/** v3 (P4 4.9): the sort keys include `calls30d` and `rating`. */
const KENNEL_LIST_SORT_STORAGE_KEY = 'slopdogs.kennelList.sort.v3';
const KENNEL_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 250;

const SORT_KEYS: readonly KennelSortKey[] = ['name', 'createdAt', 'updatedAt', 'calls30d', 'rating'];
const SORT_OPTIONS: readonly SdSortOption<KennelSortKey>[] = [
  { key: 'name', label: 'name' },
  { key: 'updatedAt', label: 'updated' },
  { key: 'calls30d', label: 'runs 30d' },
  { key: 'rating', label: 'stars' },
];
const SORT_LABELS: Record<string, string> = {
  name: 'name',
  createdAt: 'created',
  updatedAt: 'updated',
  calls30d: 'runs 30d',
  rating: 'stars',
};

interface ListSort {
  sortKey: KennelSortKey;
  sortDir: KennelSortDir;
}

function isSortKey(v: unknown): v is KennelSortKey {
  return typeof v === 'string' && (SORT_KEYS as readonly string[]).includes(v);
}

function isSortDir(v: unknown): v is KennelSortDir {
  return v === 'asc' || v === 'desc';
}

/** Numbers and dates sort descending, the name ascending (P4 4.9). */
function defaultDir(key: KennelSortKey): KennelSortDir {
  return key === 'name' ? 'asc' : 'desc';
}

function readPersistedSort(): ListSort {
  const fallback: ListSort = { sortKey: 'name', sortDir: 'asc' };
  try {
    const raw = localStorage.getItem(KENNEL_LIST_SORT_STORAGE_KEY);
    if (!raw) return fallback;
    const o = JSON.parse(raw) as { sortKey?: unknown; sortDir?: unknown };
    return isSortKey(o.sortKey) && isSortDir(o.sortDir) ? { sortKey: o.sortKey, sortDir: o.sortDir } : fallback;
  } catch {
    return fallback;
  }
}

/** The page borders shift when the stock changes between two pages — the first copy wins. */
function dedupeKennelsById(list: IKennelConfig[]): IKennelConfig[] {
  const seen = new Set<string>();
  return list.filter((k) => (seen.has(k.id) ? false : (seen.add(k.id), true)));
}

/**
 * S1 Kennels, side A (P6 U2, 6.4): chapter card, tracklist rows, sort chips, search in `?q=`, plaque,
 * stars, skeleton, veil after 3 s, the create sheet on `?new=1`. Paging and the server contract are
 * unchanged: `GET /api/kennels?limit&offset&q&mine&sort&dir`.
 */
@Component({
  selector: 'app-kennel-list',
  standalone: true,
  imports: [
    SdTopBarComponent,
    SdSearchComponent,
    SdChapterCardComponent,
    SdSortComponent,
    SdTrackRowComponent,
    SdTrackSkeletonComponent,
    SdBannerComponent,
    SdUrlChipComponent,
    SdVeilComponent,
    SdKennelSheetComponent,
    SdBottomBarComponent,
  ],
  templateUrl: './kennel-list.component.html',
  styles: [`
    :host { display: block; min-height: 100dvh; }
    .page { max-width: var(--max-list); margin: 0 auto; padding: 0 var(--gutter) var(--s8); }
    .tools { display: flex; align-items: center; justify-content: space-between; gap: var(--s3); padding: var(--s3) 0; }
    .tools sd-sort { min-width: 0; }
    .new-top { display: inline-flex; }
    .fab { display: none; }
    .stage { position: relative; min-height: 240px; }
    .status { padding: var(--s4) 0; text-align: center; color: var(--ink-2); }
    .empty { display: flex; flex-direction: column; align-items: flex-start; gap: var(--s3); padding: var(--s7) 0 var(--s5); max-width: 84ch; }
    .empty h2 { font-family: var(--font-display); font-weight: 400; font-size: 28px; line-height: 28px; letter-spacing: .03em; }
    .empty sd-url-chip { align-self: stretch; }
    @media (max-width: 767px) {
      .page { padding-bottom: calc(var(--s8) + 60px); }
      .new-top { display: none; }
      .fab { display: inline-flex; position: fixed; right: var(--s4); bottom: calc(60px + var(--s4) + env(safe-area-inset-bottom));
        z-index: var(--z-sticky); width: 56px; height: 56px; font-size: 24px; }
      .tools .import { display: none; }
    }
  `],
})
export class KennelListComponent {
  private readonly kennelService = inject(KennelService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly authUser = this.auth.user;
  readonly sortOptions = SORT_OPTIONS;
  readonly origin = typeof window !== 'undefined' ? window.location.origin : '';
  readonly mcpCommand = `claude mcp add --transport http slopdogs ${this.origin}/mcp`;

  /** The pages loaded so far, in server order. */
  readonly kennels = signal<IKennelConfig[]>([]);
  /** Matches in total (after `q`/`mine`, before paging). */
  readonly total = signal(0);
  private readonly nextOffset = signal(0);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  /** Increments per replacing load — restarts the row stagger. */
  readonly listEpoch = signal(0);

  /** Raw field value (shown at once) and the debounced query the server was asked with. */
  readonly searchQuery = signal('');
  readonly appliedQuery = signal('');
  readonly onlyMine = signal(false);
  readonly sortKey = signal<KennelSortKey>('name');
  readonly sortDir = signal<KennelSortDir>('asc');

  /** The kennel opened last in this browser (by name or row) — marked in the list, kept in localStorage. */
  readonly lastOpened = signal<string | null>(readLastOpenedKennel());

  readonly sheetOpen = signal(false);
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);

  readonly showSkeleton = computed(() => this.loading() && this.kennels().length === 0);
  readonly hasMore = computed(() => this.nextOffset() < this.total());
  readonly isFiltered = computed(() => this.appliedQuery().length > 0 || this.onlyMine());
  readonly sortLabel = computed(() => SORT_LABELS[this.sortKey()] ?? this.sortKey());
  /** Owned rows count only once every row is loaded — a partial count would lie. */
  readonly yoursCount = computed(() =>
    this.authUser() && !this.hasMore() ? this.kennels().filter((k) => this.isYours(k)).length : null,
  );
  readonly kicker = computed(() => {
    const n = this.total();
    const parts = ['side A', `${n} track${n === 1 ? '' : 's'}`];
    const yours = this.yoursCount();
    if (yours) parts.push(`${yours} yours`);
    return parts.join(' · ');
  });

  private readonly loadMoreSentinel = viewChild<ElementRef<HTMLElement>>('loadMoreSentinel');
  private readonly searchInput = new Subject<string>();
  private readonly pageRequests = new Subject<{ offset: number; append: boolean }>();
  private lastRequest = { offset: 0, append: false };
  private pendingNew = signal(false);
  private firstParams = true;

  constructor() {
    const persisted = readPersistedSort();
    this.sortKey.set(persisted.sortKey);
    this.sortDir.set(persisted.sortDir);

    effect(() => {
      const value: ListSort = { sortKey: this.sortKey(), sortDir: this.sortDir() };
      try {
        localStorage.setItem(KENNEL_LIST_SORT_STORAGE_KEY, JSON.stringify(value));
      } catch {
        /* private mode / quota */
      }
    });

    // Login or logout changes what the server lists — reload (skipping the first, settled state).
    let authSeen = false;
    effect(() => {
      if (!this.auth.isReady()) return;
      const user = this.auth.user();
      if (!authSeen) {
        authSeen = true;
        return;
      }
      if (!user && this.onlyMine()) {
        this.onlyMine.set(false);
        this.writeParams({ mine: null });
      }
      this.reload();
    }, { allowSignalWrites: true });

    // `?new=1` opens the sheet — signed in at once, otherwise after the login round trip.
    effect(() => {
      if (!this.pendingNew() || !this.auth.isReady()) return;
      this.pendingNew.set(false);
      if (this.auth.user()) this.sheetOpen.set(true);
      else this.auth.login('/kennels?new=1');
    }, { allowSignalWrites: true });

    // Sentinel at the end of the list loads the next page.
    effect((onCleanup) => {
      const sentinel = this.loadMoreSentinel()?.nativeElement;
      if (!sentinel || typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) this.loadMore();
        },
        { rootMargin: '240px' },
      );
      observer.observe(sentinel);
      onCleanup(() => observer.disconnect());
    });

    this.searchInput.pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed()).subscribe((value) => {
      const q = value.trim();
      if (q === this.appliedQuery()) return;
      this.appliedQuery.set(q);
      this.writeParams({ q: q || null });
      this.reload();
    });

    this.pageRequests
      .pipe(
        tap((req) => {
          this.lastRequest = req;
          this.error.set(null);
          if (req.append) this.loadingMore.set(true);
          else this.loading.set(true);
        }),
        switchMap((req) =>
          this.kennelService
            .getPage({
              limit: KENNEL_PAGE_SIZE,
              offset: req.offset,
              q: this.appliedQuery(),
              mine: this.onlyMine(),
              sort: this.sortKey(),
              dir: this.sortDir(),
            })
            .pipe(
              map((res) => ({ req, res, failure: null as string | null })),
              catchError((err) =>
                of({
                  req,
                  res: null as PagedApiResponse<IKennelConfig> | null,
                  failure: err?.status ? `Couldn't load kennels (${err.status}).` : "Couldn't load kennels.",
                }),
              ),
            ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ req, res, failure }) => this.applyPage(req, res, failure));

    // The URL is the state: `?q=`, `?sort=`, `?dir=`, `?mine=1`, `?new=1`. Subscribed last — the first
    // emission is synchronous and its reload needs the page pipeline above.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => this.applyParams(params));
  }

  isYours(k: IKennelConfig): boolean {
    const user = this.authUser();
    return !!user && (k.myRights?.own ?? k.ownerId === user.id);
  }

  reload(): void {
    this.pageRequests.next({ offset: 0, append: false });
  }

  loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore() || this.error()) return;
    this.pageRequests.next({ offset: this.nextOffset(), append: true });
  }

  retry(): void {
    this.pageRequests.next(this.lastRequest);
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchInput.next(value);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.appliedQuery.set('');
    this.onlyMine.set(false);
    this.writeParams({ q: null, mine: null });
    this.reload();
  }

  onSortKey(key: string): void {
    if (!isSortKey(key)) return;
    if (key === this.sortKey()) {
      this.toggleSortDir();
      return;
    }
    this.sortKey.set(key);
    this.sortDir.set(defaultDir(key));
    this.writeParams({ sort: key, dir: this.sortDir() });
    this.reload();
  }

  toggleSortDir(): void {
    this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    this.writeParams({ sort: this.sortKey(), dir: this.sortDir() });
    this.reload();
  }

  toggleMine(): void {
    this.onlyMine.update((v) => !v);
    this.writeParams({ mine: this.onlyMine() ? '1' : null });
    this.reload();
  }

  openCreate(): void {
    // Before /auth/me answers nobody is known yet — a click then would send a signed-in user to Google.
    if (!this.auth.isReady()) return;
    if (!this.auth.user()) {
      this.auth.login('/kennels?new=1');
      return;
    }
    this.createError.set(null);
    this.sheetOpen.set(true);
    this.writeParams({ new: '1' });
  }

  closeCreate(): void {
    this.sheetOpen.set(false);
    this.createError.set(null);
    this.writeParams({ new: null });
  }

  onCreate(data: KennelCreateData): void {
    this.creating.set(true);
    this.createError.set(null);
    this.kennelService
      .create({
        id: data.id,
        name: data.name || undefined,
        description: data.description || undefined,
        emoji: data.emoji || undefined,
        visibility: data.visibility,
        dogIds: [],
      })
      .subscribe({
        next: (res) => {
          this.creating.set(false);
          if (!res.ok) {
            this.createError.set(res.error ?? "Couldn't create the kennel.");
            return;
          }
          const ref = res.data?.lineageId || res.id || data.id;
          void this.router.navigate(['/kennels', ref, 'edit']);
        },
        error: (err) => {
          this.creating.set(false);
          this.createError.set(err?.error?.error_description ?? err?.error?.error ?? `Couldn't create the kennel (${err?.status ?? 'network'}).`);
        },
      });
  }

  /** Absolute `/k/:id?<defaultQuery>` — the href behind the kennel name (new tab). */
  publicHref(kennel: IKennelConfig): string {
    return apiAbsoluteUrl(this.publicPathWithDefaults(kennel));
  }

  /** Name (public page) or row (kennel page) was opened: this kennel is now the marked one. */
  markOpened(kennel: IKennelConfig): void {
    const ref = this.kennelRef(kennel);
    this.lastOpened.set(ref);
    rememberLastOpenedKennel(ref);
  }

  onRowAction(kennel: IKennelConfig, action: KennelRowAction): void {
    const ref = this.kennelRef(kennel);
    switch (action) {
      case 'run':
      case 'open':
        this.markOpened(kennel);
        window.open(apiAbsoluteUrl(this.publicPathWithDefaults(kennel)), '_blank', 'noopener');
        return;
      case 'docs':
        window.open(apiAbsoluteUrl(publicKennelDocsPath(ref)), '_blank', 'noopener');
        return;
      case 'copy-link':
        this.copyText(apiAbsoluteUrl(this.publicPathWithDefaults(kennel)), 'Link copied.');
        return;
      case 'edit':
        void this.router.navigate(['/kennels', ref, 'edit']);
        return;
      case 'export':
        this.exportBundle(ref);
        return;
      case 'delete':
        void this.deleteKennel(kennel);
        return;
    }
  }

  importFromClipboard(): void {
    navigator.clipboard
      .readText()
      .then((text) => {
        let bundle: unknown;
        try {
          bundle = JSON.parse(text);
        } catch {
          this.error.set('The clipboard holds no valid JSON.');
          return;
        }
        this.kennelService.importBundle(bundle).subscribe({
          next: (res) => (res.ok ? this.reload() : this.error.set(res.error ?? 'Import failed.')),
          error: (err) => this.error.set(err?.error?.error ?? `Import failed (${err?.status ?? 'network'}).`),
        });
      })
      .catch(() => this.error.set('No access to the clipboard. Allow it and try again.'));
  }

  private applyParams(params: ParamMap): void {
    const q = (params.get('q') ?? '').trim();
    const sort = params.get('sort');
    const dir = params.get('dir');
    const mine = params.get('mine') === '1';
    let changed = this.firstParams;
    if (q !== this.appliedQuery()) {
      this.searchQuery.set(q);
      this.appliedQuery.set(q);
      changed = true;
    }
    if (isSortKey(sort) && sort !== this.sortKey()) {
      this.sortKey.set(sort);
      this.sortDir.set(isSortDir(dir) ? dir : defaultDir(sort));
      changed = true;
    } else if (isSortDir(dir) && dir !== this.sortDir()) {
      this.sortDir.set(dir);
      changed = true;
    }
    if (mine !== this.onlyMine()) {
      this.onlyMine.set(mine);
      changed = true;
    }
    if (params.get('new') === '1' && !this.sheetOpen()) this.pendingNew.set(true);
    this.firstParams = false;
    if (changed) this.reload();
  }

  private writeParams(patch: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: patch,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private applyPage(
    req: { offset: number; append: boolean },
    res: PagedApiResponse<IKennelConfig> | null,
    failure: string | null,
  ): void {
    this.loading.set(false);
    this.loadingMore.set(false);
    if (failure !== null || !res) {
      this.error.set(failure ?? "Couldn't load kennels.");
      return;
    }
    const page = res.data ?? [];
    if (req.append && page.length === 0) {
      // `total` promised more than came (the stock moved): mark the list complete, or the sentinel fires forever.
      this.total.set(this.nextOffset());
      return;
    }
    // Without `total` the server ignored the paging parameters (older state): the answer is the whole list.
    const total = res.total ?? (req.append ? this.total() : page.length);
    this.kennels.update((current) => dedupeKennelsById(req.append ? [...current, ...page] : page));
    this.total.set(total);
    this.nextOffset.set(req.offset + page.length);
    if (!req.append) {
      window.scrollTo({ top: 0 });
      this.listEpoch.update((n) => n + 1);
    }
  }

  kennelRef(kennel: IKennelConfig): string {
    return kennel.lineageId || kennel.id;
  }

  /** `/k/:id` plus the stored `defaultQuery` — what the name and `⏵` open and `Copy link` copies. */
  private publicPathWithDefaults(kennel: IKennelConfig): string {
    return publicKennelPathWithDefaults(this.kennelRef(kennel), kennel.defaultQuery);
  }

  private exportBundle(ref: string): void {
    this.kennelService.exportBundle(ref).subscribe({
      next: (bundle: unknown) => {
        const json = JSON.stringify(bundle, null, 2);
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(json).then(
            () => this.toast.show('Kennel copied as JSON.'),
            () => this.downloadJson(json, ref),
          );
        } else {
          this.downloadJson(json, ref);
        }
      },
      error: (err) => this.error.set(err?.error?.error ?? `Export failed (${err?.status ?? 'network'}).`),
    });
  }

  private async deleteKennel(kennel: IKennelConfig): Promise<void> {
    const ref = this.kennelRef(kennel);
    const ok = await this.confirm.ask({
      title: `Delete ${kennel.name || ref}?`,
      message: `Every version goes with it, and /k/${ref} stops answering. The dogs stay saved.`,
      confirmLabel: 'Delete kennel',
      variant: 'danger',
    });
    if (!ok) return;
    this.kennelService.delete(ref).subscribe({
      next: (res) => (res.ok ? this.reload() : this.error.set(res.error ?? 'Delete failed.')),
      error: (err) => this.error.set(err?.error?.error_description ?? err?.error?.error ?? `Delete failed (${err?.status ?? 'network'}).`),
    });
  }

  private downloadJson(json: string, ref: string): void {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ref}.kennel.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.show('Kennel downloaded as JSON.');
  }

  /** Clipboard first; without one the toast carries the text itself (no native prompt). */
  private copyText(text: string, done: string): void {
    const clip = navigator.clipboard;
    if (!clip?.writeText) {
      this.toast.show(text);
      return;
    }
    clip.writeText(text).then(() => this.toast.show(done), () => this.toast.show(text));
  }
}
