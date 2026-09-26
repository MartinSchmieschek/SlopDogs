import { Component, HostListener, inject, signal, OnInit, computed, DestroyRef, effect, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import type { HttpErrorResponse } from '@angular/common/http';
import {
  KennelService,
  isKennelRunView,
  type IRatingView,
  type KennelRunView,
} from '../../services/kennel.service';
import { DogService } from '../../services/dog.service';
import { AuthService } from '../../services/auth.service';
import {
  IKennelConfig,
  IKennelStats,
  KennelVersionEntry,
  IKennelNodeAnnotation,
  IKennelEdgeAnnotation,
} from '../../models/kennel-config.model';
import { kennelRefForDog } from '../../utils/kennel-ref-for-dog';
import { DogEntry, Waves } from '../../models/dog-entry.model';
import { DogInfo } from '../../models/dog.model';
import type { DogCatalogEntry } from '../../models/dog-catalog';
import { VersionTimelineComponent, TimelineVersion } from '../../components/version-timeline/version-timeline.component';
import { VisNetworkComponent } from '../../components/vis-network/vis-network.component';
import { GraphCanvasScaleComponent } from '../../components/graph-canvas-scale/graph-canvas-scale.component';
import { DogSidePanelComponent } from '../../components/dog-side-panel/dog-side-panel.component';
import { findKennelDogIndex, graphNodeIdMatchesKennelDogId } from '../../utils/kennel-dog-id-match';
import { collectDescendantBranchNodeIds } from '../../components/vis-network/graph-layout';
import { DogPanelSectionId } from '../../utils/dog-panel-sections';
import { apiAbsoluteUrl } from '../../config/api-base';
import { publicKennelDocsPath, publicKennelOpenApiPath, publicKennelPath } from '../../config/public-paths';
import { WavesJsonEditorComponent } from './components/waves-json-editor.component';
import { WavesDogPaletteComponent } from './components/waves-dog-palette.component';
import { SdConfirmComponent } from '../../components/sd-confirm/sd-confirm.component';
import { SdDogFactsComponent } from '../../components/sd-dog-facts/sd-dog-facts.component';
import { ToastService, pinnedToast } from '../../services/toast.service';
import { ConfirmService, LEAVE_UNSAVED } from '../../services/confirm.service';
import type { LeavesSafely } from '../../guards/unsaved-changes.guard';
import { hasModifier } from '../../utils/keyboard';
import { hasEscapeLayer } from '../../utils/escape-layers';
import { KENNEL_NAME_MAX, renameErrorText, renameProblem } from '../../utils/kennel-rename';
import {
  FROZEN_TITLE,
  LANDING_LOCK_TITLE,
  SdKennelHeadComponent,
  type KennelHeadAction,
  type KennelHeadRights,
  type KennelRunState,
} from '../../components/sd-kennel-head/sd-kennel-head.component';
import { SdBottomBarComponent } from '../../components/sd-bottom-bar/sd-bottom-bar.component';
import { SdWaveCanvasComponent } from '../../components/sd-wave-canvas/sd-wave-canvas.component';
import { SdDrawerComponent } from '../../components/sd-drawer/sd-drawer.component';
import { SdRatingComponent } from '../../components/sd-rating/sd-rating.component';
import { SdHistogramComponent } from '../../components/sd-histogram/sd-histogram.component';
import { SdStatTilesComponent, type SdStatTile } from '../../components/sd-stat-tiles/sd-stat-tiles.component';
import { SdBannerComponent } from '../../components/sd-banner/sd-banner.component';
import { SdVeilComponent } from '../../components/sd-veil/sd-veil.component';
import { SdUrlChipComponent } from '../../components/sd-url-chip/sd-url-chip.component';
import { formatCount } from '../../components/sd-plaque/sd-plaque.component';
import { SdKennelSettingsComponent } from '../../components/sd-kennel-settings/sd-kennel-settings.component';
import type { KennelVisibility } from '../../models/kennel-config.model';
import { CANT_EDIT_TOAST, editDeepLinkOpens, isListedEditor } from '../../utils/kennel-settings';

/** Inspector tabs of the kennel (6.4 S2; access lives in the settings drawer, U6). `?panel=` opens one directly. */
export type KennelTab = 'brief' | 'versions' | 'rating' | 'stats';
const KENNEL_TABS: readonly KennelTab[] = ['brief', 'versions', 'rating', 'stats'];
/** A run-only kennel has no brief and no versions for the caller (W17): only rating and stats. */
const RUN_ONLY_TABS: readonly KennelTab[] = ['rating', 'stats'];
const TAB_LABELS: Record<KennelTab, string> = { brief: 'brief', versions: 'versions', rating: 'rating', stats: 'stats' };

/** loading: nothing known yet · full: READ · run-only: RUN without READ (W17 stage 1) · missing: 404. */
type ViewMode = 'loading' | 'full' | 'run-only' | 'missing';

const OLD_VERSION_TITLE = 'An older version. Back to latest to edit.';

/**
 * S2 Kennel page (P6 U3/U4, 6.4): the kennel head as chapter card, the ruled-inlay canvas (vis-network
 * for readable kennels, silhouettes for run-only ones), the bottom bar on mobile, and one drawer/sheet for
 * the kennel inspector (brief, versions, rating, stats), the dog inspector and edge notes. Rights come from
 * `myRights` (P3.5): readers get text instead of fields, frozen keeps every mutation control visible but
 * disabled with `Frozen. Unfreeze in settings.`; runs, ratings and export keep working (8.25).
 * `/kennels/:id/edit` is the same page with the settings drawer (S3, U6) open over it.
 * Keys (U8): `Ctrl/⌘+Enter` runs, `Ctrl/⌘+S` saves what is open (settings, dog code, brief); leaving with
 * unsaved work asks "Unsaved changes. Leave anyway?" (route guard, drawer close, tab close).
 */
@Component({
  selector: 'app-waves-viewer',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    GraphCanvasScaleComponent, VisNetworkComponent, DogSidePanelComponent,
    VersionTimelineComponent,
    WavesJsonEditorComponent, WavesDogPaletteComponent, SdConfirmComponent, SdDogFactsComponent,
    SdKennelHeadComponent, SdBottomBarComponent, SdWaveCanvasComponent, SdDrawerComponent, SdRatingComponent,
    SdHistogramComponent, SdStatTilesComponent, SdBannerComponent, SdVeilComponent, SdUrlChipComponent,
    SdKennelSettingsComponent,
  ],
  templateUrl: './waves-viewer.component.html',
  styleUrls: ['./waves-viewer.component.scss']
})
export class WavesViewerComponent implements OnInit, LeavesSafely {
  /** The ruled inlay shows cards at their real size (U3); the wrapper stays for pointer maths. */
  readonly graphCanvasScale = 1;
  readonly frozenTitle = FROZEN_TITLE;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private kennelService = inject(KennelService);
  private dogService = inject(DogService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  readonly auth = inject(AuthService);

  /** The open editors — asked for unsaved work and for `Ctrl/⌘+S`. */
  private readonly dogPanel = viewChild(DogSidePanelComponent);
  private readonly settingsDrawer = viewChild(SdKennelSettingsComponent);

  kennelId = '';
  readonly mode = signal<ViewMode>('loading');
  waves = signal<Waves | null>(null);
  kennelConfig = signal<IKennelConfig | null>(null);
  /** Calls and stars (P4) — from the single fetch or the list entry; the /run config carries none. */
  readonly kennelStats = signal<IKennelStats | undefined>(undefined);
  /** What a run-only caller sees of a run (W17 stage 1). */
  readonly runView = signal<KennelRunView | null>(null);
  readonly ratingView = signal<IRatingView | null>(null);
  selectedDog = signal<DogEntry | null>(null);
  /** Vom Graph-Fächer: welche Section im Side-Panel aktiv starten soll. */
  panelInitialSection = signal<DogPanelSectionId | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  /** Outcome of the last run for the status chip: `● live · 1.8 s` or `● failed`. */
  readonly lastRun = signal<{ ok: boolean; durationMs: number } | null>(null);
  availableDogs = signal<DogInfo[]>([]);
  isDragOver = false;
  isDragging = false;
  private dragEndTimer: any = null;
  private runStartedAt = 0;

  // --- Rename (kennel menu, U8): the name changes, the ID stays ---
  readonly renameOpen = signal(false);
  readonly renameDraft = signal('');
  readonly renameBusy = signal(false);
  readonly renameError = signal<string | null>(null);
  readonly renameMax = KENNEL_NAME_MAX;
  readonly renameProblem = computed(() => renameProblem(this.renameDraft(), this.kennelConfig()?.name ?? ''));
  /** The rule under the field once the name was touched (the untouched name needs no hint). */
  readonly renameHint = computed(() =>
    this.renameDraft() !== (this.kennelConfig()?.name ?? '') ? this.renameProblem() : null);

  // --- Kennel version timeline ---
  kennelVersions = signal<KennelVersionEntry[]>([]);
  /** The version GUID currently viewed — null means "latest". */
  activeKennelVersionId = signal<string | null>(null);
  selectedKennelVersionId = signal<string | null>(null);

  timelineVersions = computed<TimelineVersion[]>(() => {
    return this.kennelVersions().map(v => ({
      id: v.id,
      version: v.version,
      parentId: v.parentId,
      createdAt: v.createdAt,
      displayName: v.config?.name,
    }));
  });

  get currentKennelVersionId(): string {
    return this.activeKennelVersionId() || this.kennelConfig()?.id || '';
  }

  queryParams = signal<Array<{ key: string; value: string }>>([]);
  bodyJson = signal('{}');
  newQueryKey = '';
  newQueryValue = '';
  paramsSaving = signal(false);
  paramsDirty = signal(false);

  // --- Layout / annotations / task state ---
  /** Layout-Map keyed by kennel-dogIds-Ref (lineageId, base:Name, or version ID). */
  layoutNodes = signal<IKennelNodeAnnotation[]>([]);
  /** Edge-Kommentare keyed by (fromRef, toRef) — same identity rules as nodes. */
  layoutEdges = signal<IKennelEdgeAnnotation[]>([]);
  /** Global kennel-task text (markdown-fähig). */
  taskText = signal('');
  /** True if any layout/comment/task change is unsaved. */
  layoutDirty = signal(false);
  layoutSaving = signal(false);
  /** Edge whose comment editor is currently open in the drawer. */
  editingEdgeKey = signal<{ fromId: string; toId: string } | null>(null);
  edgeCommentDraft = '';

  // === Inspector / Palette UI state ===
  readonly kennelInspectorOpen = signal(false);
  readonly kennelInspectorTab = signal<KennelTab>('brief');
  readonly paletteOpen = signal(false);
  /** Settings drawer (6.4 S3) — open while the URL is `/kennels/:id/edit`. */
  readonly settingsOpen = signal(false);
  /** A deep link to `/edit` waits for the rights before it opens (or toasts). */
  private readonly settingsPending = signal(false);
  /** The `⋯` menu opens settings for readers too (read-only); only the deep link asks for edit rights. */
  private settingsFromMenu = false;
  /** Edge-cut staged but not confirmed yet — drives confirm dialog. */
  readonly pendingCut = signal<{ fromId: string; toId: string } | null>(null);
  readonly pendingDelete = signal(false);

  flatDogList = computed(() => {
    const w = this.waves();
    if (!w) return [];
    return w.flat();
  });

  // === Rights and locks (P3.5 myRights, 8.25 freeze) ===

  readonly rights = computed<KennelHeadRights>(() => {
    if (this.mode() === 'run-only') return { read: false, edit: false, own: false };
    const r = this.kennelConfig()?.myRights;
    return r ? { read: r.read, edit: r.edit, own: r.own } : { read: true, edit: true, own: true };
  });
  readonly frozen = computed(() => {
    const cfg = this.kennelConfig();
    return !!(cfg?.frozen ?? cfg?.myRights?.frozen);
  });
  /** Landing page (server LANDING_KENNEL_IDS): edit/own are false for everyone, including owner. */
  readonly landingLocked = computed(() => this.kennelConfig()?.myRights?.locked === 'landing');
  /** Readers without edit: text instead of fields, no palette, no drag, no cut. Landing behaves like
   * frozen here — locked, not "read only" — so it is excluded from this check. */
  readonly readOnly = computed(() => !this.frozen() && !this.landingLocked() && !this.rights().edit);
  /** Why mutations are locked right now (frozen, landing, or an older version on screen) — null when not. */
  readonly mutationLock = computed<string | null>(() => {
    if (this.landingLocked()) return LANDING_LOCK_TITLE;
    if (this.frozen()) return FROZEN_TITLE;
    if (this.activeKennelVersionId()) return OLD_VERSION_TITLE;
    return null;
  });
  readonly canMutate = computed(() => !this.readOnly() && !this.mutationLock() && this.mode() === 'full');

  // === Head ===

  readonly runState = computed<KennelRunState>(() => {
    if (this.loading()) return 'running';
    const last = this.lastRun();
    if (!last) return 'idle';
    return last.ok ? 'live' : 'failed';
  });
  readonly dogCount = computed<number | null>(() => {
    const rv = this.runView();
    if (this.mode() === 'run-only') return rv ? rv.waves.reduce((n, w) => n + w.dogCount, 0) : null;
    const w = this.waves();
    if (w) return w.flat().length;
    const ids = this.kennelConfig()?.dogIds;
    return Array.isArray(ids) ? ids.length : null;
  });
  readonly waveCount = computed<number | null>(() => {
    if (this.mode() === 'run-only') return this.runView()?.waves.length ?? null;
    return this.waves()?.length ?? null;
  });
  readonly oldVersionLabel = computed<string | null>(() => {
    const active = this.activeKennelVersionId();
    if (!active) return null;
    const list = this.kennelVersions();
    const idx = list.findIndex((v) => v.id === active);
    if (idx < 0) return 'older version';
    const date = list[idx].createdAt ? String(list[idx].createdAt).slice(0, 10) : '';
    return `v${list.length - idx}${date ? ' · ' + date : ''}`;
  });

  /** The first failing dog of the last run — the banner names it and offers `[Show dog]`. */
  readonly firstFailure = computed<{ wave: number; dog: DogEntry | null } | null>(() => {
    const w = this.waves();
    if (w) {
      for (let i = 0; i < w.length; i++) {
        const dog = w[i].find((d) => !!d.error);
        if (dog) return { wave: i + 1, dog };
      }
      return null;
    }
    const rv = this.runView();
    if (!rv) return null;
    let flat = 0;
    for (let i = 0; i < rv.waves.length; i++) {
      const slice = rv.dogs.slice(flat, flat + rv.waves[i].dogCount);
      if (slice.some((d) => d.status === 'failed')) return { wave: i + 1, dog: null };
      flat += rv.waves[i].dogCount;
    }
    return null;
  });
  readonly failureText = computed(() => {
    const f = this.firstFailure();
    if (!f) return null;
    if (!f.dog) return `Run failed in wave ${f.wave}.`;
    const first = String(f.dog.error ?? '').split(/\r?\n/)[0].trim();
    return `Run failed in wave ${f.wave}: ${f.dog.displayName || f.dog.name}${first ? ' — ' + first : ''}`;
  });

  // === Drawer ===

  /** One drawer: edge note, dog inspector, or kennel inspector — the newest wins. */
  readonly drawerMode = computed<'edge' | 'dog' | 'kennel' | null>(() => {
    if (this.editingEdgeKey()) return 'edge';
    if (this.selectedDog()) return 'dog';
    if (this.kennelInspectorOpen()) return 'kennel';
    return null;
  });
  readonly inspectorTabs = computed<KennelTab[]>(() =>
    [...(this.mode() === 'run-only' ? RUN_ONLY_TABS : KENNEL_TABS)],
  );
  readonly tabLabels = TAB_LABELS;
  readonly briefDirty = computed(() => this.layoutDirty() || this.paramsDirty());

  readonly statTiles = computed<SdStatTile[]>(() => {
    const s = this.kennelStats();
    const c = s?.calls;
    const r = s?.rating;
    const n = (v: number | undefined) => (typeof v === 'number' ? formatCount(v) : null);
    return [
      { label: 'runs 30d', value: n(c?.ranked30d), title: 'The public page and execute, last 30 days' },
      { label: 'runs total', value: n(c?.ranked), title: 'The public page and execute, all time' },
      { label: 'calls 30d', value: n(c?.last30d), title: 'Every run, editor runs included, last 30 days' },
      { label: 'calls total', value: n(c?.total), title: 'Every run, editor runs included' },
      { label: 'lead failed', value: n(c?.leadFailed), title: 'Runs whose lead dog failed' },
      { label: 'stars', value: r && r.count > 0 && r.avg !== null ? `${r.avg.toFixed(1)} · ${r.count}` : r ? '—' : null },
    ];
  });

  /** A foreign run-only dog in this kennel is pinned; a newer head lets editors lift the pin (8.15). */
  readonly selectedPin = computed(() => {
    const d = this.selectedDog();
    if (!d?.redacted || d.access !== 'run') return null;
    const newer = typeof d.latestVersion === 'number' && typeof d.version === 'number' && d.latestVersion > d.version;
    return { version: d.version ?? null, latestVersion: d.latestVersion ?? null, newer };
  });

  /** `v12 · 2026-09-20` of the newest version, for the settings drawer. */
  readonly latestVersionLabel = computed<string | null>(() => {
    const list = this.kennelVersions();
    if (!list.length) return null;
    const date = list[0].createdAt ? String(list[0].createdAt).slice(0, 10) : '';
    return `v${list.length}${date ? ' · ' + date : ''}`;
  });

  constructor() {
    // `/kennels/:id/edit` as a deep link: decide once the rights are known (8.25, 6.8 test 8).
    effect(() => {
      if (!this.settingsPending()) return;
      const mode = this.mode();
      const cfg = this.kennelConfig();
      const ready = this.auth.isReady();
      if (mode === 'loading' || (mode === 'full' && (!cfg?.myRights || !ready))) return;
      untracked(() => this.settleSettingsDeepLink());
    }, { allowSignalWrites: true });
  }

  readonly origin = typeof window !== 'undefined' ? window.location.origin : '';
  readonly mcpCommand = `claude mcp add --transport http slopdogs ${this.origin}/mcp`;

  /** Append ?version=... to a URL if a specific kennel version is selected. */
  private appendVersionParam(url: string): string {
    const v = this.activeKennelVersionId();
    if (!v) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}version=${encodeURIComponent(v)}`;
  }

  /** Swagger UI & OpenAPI — direkt Express (neuer Tab, kein Angular-Origin). */
  get swaggerDocsUrl(): string {
    return this.appendVersionParam(apiAbsoluteUrl(publicKennelDocsPath(this.kennelId)));
  }

  get swaggerJsonUrl(): string {
    return this.appendVersionParam(apiAbsoluteUrl(publicKennelOpenApiPath(this.kennelId)));
  }

  /**
   * Öffentlicher Kennel-Endpunkt (Lead-Yield): GET `/k/:kennelId` auf dem Express-Server —
   * nicht `/api/kennels/.../run`. Query-Parameter aus dem Panel werden angehängt.
   */
  get kennelRunBrowserUrl(): string {
    const base = apiAbsoluteUrl(publicKennelPath(this.kennelId));
    const q = this.buildQueryRecord();
    const keys = Object.keys(q).filter((k) => k.trim());
    const params = new URLSearchParams();
    keys.forEach((k) => params.set(k, q[k]));
    const v = this.activeKennelVersionId();
    if (v) params.set('version', v);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  ngOnInit() {
    // Route-Reuse: bei Wechsel /kennels/A → /kennels/B bleibt dieselbe Component-Instanz —
    // snapshot.params wäre sonst stale und PUT/GET würden den falschen Kennel treffen.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((pm) => {
      const id = pm.get('id');
      if (!id) return;
      this.kennelId = id;
      this.mode.set('loading');
      this.waves.set(null);
      this.kennelConfig.set(null);
      this.kennelStats.set(undefined);
      this.runView.set(null);
      this.ratingView.set(null);
      this.lastRun.set(null);
      this.selectedDog.set(null);
      this.panelInitialSection.set(null);
      this.activeKennelVersionId.set(null);
      this.selectedKennelVersionId.set(null);
      this.paramsDirty.set(false);
      this.layoutDirty.set(false);
      this.editingEdgeKey.set(null);
      this.edgeCommentDraft = '';
      this.error.set(null);
      this.loadHeader();
      this.loadWaves();
      this.loadAvailableDogs();
      this.loadKennelVersions();
    });

    // One route for `/kennels/:id` and `/kennels/:id/edit` (app.routes `kennelPageMatcher`): the instance
    // stays, the last segment opens and closes the settings drawer.
    this.route.url.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((segs) => {
      this.onSettingsUrl(segs.length === 3 && segs[2].path === 'edit');
    });

    // `?panel=brief|versions|rating|stats` opens the inspector on that tab (P4 4.9, 8.6).
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((qm) => {
      const panel = qm.get('panel') as KennelTab | null;
      if (panel && (KENNEL_TABS as readonly string[]).includes(panel)) {
        this.kennelInspectorTab.set(panel);
        this.kennelInspectorOpen.set(true);
        if (panel === 'rating' || panel === 'stats') this.loadRating();
      }
    });
  }

  // === Loading ===

  /**
   * The head: the single fetch (READ) carries stats and rights; without READ it answers 404, and a
   * run-only kennel is found in the list (RUN view: name, emoji, description, frozen, rights, stats).
   */
  private loadHeader(): void {
    const id = this.kennelId;
    this.kennelService.getById(id).subscribe({
      next: (res) => {
        if (id !== this.kennelId || !res.ok || !res.data) return;
        this.kennelStats.set(res.data.stats);
        if (!this.kennelConfig()) this.kennelConfig.set(res.data);
        else this.kennelConfig.update((c) => (c ? { ...c, frozen: res.data!.frozen, myRights: res.data!.myRights ?? c.myRights } : c));
        if (this.mode() === 'loading') this.mode.set('full');
      },
      error: (err: HttpErrorResponse) => {
        if (id !== this.kennelId || err.status !== 404) return;
        this.kennelService.findListed(id).subscribe({
          next: (entry) => {
            if (id !== this.kennelId || !entry) return;
            this.kennelStats.set(entry.stats);
            this.kennelConfig.set(entry);
            if (entry.myRights && !entry.myRights.read) this.mode.set('run-only');
          },
        });
      },
    });
  }

  loadWaves() {
    const id = this.kennelId;
    this.loading.set(true);
    this.error.set(null);
    this.runStartedAt = performance.now();

    const query = this.buildQueryRecord();
    let body: any = undefined;
    try {
      const raw = this.bodyJson().trim();
      // Auch "{}" ist gültig (BodyRetriever / leeres JSON-Objekt).
      if (raw) body = JSON.parse(raw);
    } catch { /* invalid JSON - ignore, send without body */ }

    const version = this.activeKennelVersionId() ?? undefined;
    this.kennelService.run(id, body, query, version).subscribe({
      next: (res) => {
        if (id !== this.kennelId) return;
        const elapsed = performance.now() - this.runStartedAt;
        if (isKennelRunView(res)) {
          this.mode.set('run-only');
          this.runView.set(res);
          this.waves.set(null);
          this.lastRun.set({ ok: res.dogs.every((d) => d.status === 'ok'), durationMs: res.durationMs });
          this.loading.set(false);
          return;
        }
        if (res.ok) {
          this.mode.set('full');
          this.waves.set(res.waves);
          this.setConfigFromRun(res.kennelConfig);
          this.loadKennelVersions();
          this.lastRun.set({ ok: !res.waves.flat().some((d) => !!d.error), durationMs: elapsed });

          const sel = this.selectedDog();
          if (sel) {
            // After re-run, the dog might have a new version ID — match by lineageId first, then by id.
            const updated = this.flatDogList().find(d =>
              d.id === sel.id ||
              (d.lineageId && d.lineageId === sel.lineageId)
            );
            this.selectedDog.set(updated ?? null);
          }
        } else {
          this.error.set(res.error ?? 'The run returned no result.');
          this.lastRun.set({ ok: false, durationMs: elapsed });
          if (res.kennelConfig) {
            this.mode.set('full');
            this.setConfigFromRun(res.kennelConfig);
          }
        }
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if (id !== this.kennelId) return;
        this.loading.set(false);
        if (err.status === 404) {
          this.mode.set('missing');
          return;
        }
        this.error.set(err.error?.error ?? err.message);
        this.lastRun.set({ ok: false, durationMs: performance.now() - this.runStartedAt });
        if (err.error?.kennelConfig) {
          this.mode.set('full');
          this.setConfigFromRun(err.error.kennelConfig);
        }
      }
    });
  }

  /** The /run config is the freshest; stats stay from the single fetch. */
  private setConfigFromRun(config: IKennelConfig): void {
    this.kennelConfig.set(config);
    this.syncParamsFromConfig(config);
  }

  private loadRating(): void {
    if (!this.kennelId || this.ratingView()) return;
    const id = this.kennelId;
    this.kennelService.getRating(id).subscribe({
      next: (v) => {
        if (id === this.kennelId) this.ratingView.set(v);
      },
      error: () => { /* the rating tab shows its own error */ },
    });
  }

  retry(): void {
    this.loadWaves();
    if (!this.kennelConfig()) this.loadHeader();
  }

  private syncParamsFromConfig(config: IKennelConfig) {
    if (!this.paramsDirty()) {
      if (config.defaultQuery) {
        this.queryParams.set(
          Object.entries(config.defaultQuery).map(([key, value]) => ({ key, value }))
        );
      } else {
        this.queryParams.set([]);
      }
      this.bodyJson.set(config.defaultBody ? JSON.stringify(config.defaultBody, null, 2) : '{}');
    }
    if (!this.layoutDirty()) {
      this.layoutNodes.set(Array.isArray(config.nodes) ? config.nodes.map(n => ({ ...n })) : []);
      this.layoutEdges.set(Array.isArray(config.edges) ? config.edges.map(e => ({ ...e })) : []);
      this.taskText.set(config.task ?? '');
    }
  }

  // === Head actions ===

  onHeadAction(action: KennelHeadAction): void {
    switch (action) {
      case 'edit': this.openSettings(); return;
      case 'rename': this.openRename(); return;
      case 'open': window.open(this.kennelRunBrowserUrl, '_blank', 'noopener'); return;
      case 'docs': window.open(this.swaggerDocsUrl, '_blank', 'noopener'); return;
      case 'copy-link': this.copyLink(); return;
      case 'export': this.exportKennel(); return;
      case 'versions': this.openKennelInspector('versions'); return;
      case 'palette': this.openPalette(); return;
      case 'freeze': this.setFrozen(true); return;
      case 'unfreeze': this.setFrozen(false); return;
      case 'delete': if (!this.frozen()) this.pendingDelete.set(true); return;
    }
  }

  copyLink(): void {
    const url = this.kennelRunBrowserUrl;
    navigator.clipboard?.writeText(url).then(() => this.showToast('Link copied.'), () => this.showToast(url));
  }

  openPalette(): void {
    if (!this.canMutate()) return;
    this.paletteOpen.set(true);
  }

  private setFrozen(frozen: boolean): void {
    const call = frozen ? this.kennelService.freeze(this.kennelId) : this.kennelService.unfreeze(this.kennelId);
    call.subscribe({
      next: () => this.onFrozenChanged(frozen),
      error: (err: HttpErrorResponse) => this.showToast(`Couldn't ${frozen ? 'freeze' : 'unfreeze'}: ${err.error?.error_description ?? err.error?.error ?? err.status}`),
    });
  }

  /** Freeze changed (head menu, access panel, unfreeze banner): chips, locks and rights follow. */
  onFrozenChanged(frozen: boolean): void {
    this.kennelConfig.update((c) => (c ? { ...c, frozen, myRights: c.myRights ? { ...c.myRights, frozen } : c.myRights } : c));
    this.showToast(frozen ? 'Frozen. Runs, ratings and copies keep working.' : 'Unfrozen.');
    this.loadHeader();
  }

  // === Settings drawer (6.4 S3) ===

  /** `⋯ Settings`: readers get the drawer read-only, frozen shows the unfreeze banner. */
  openSettings(): void {
    if (this.mode() !== 'full') return;
    this.settingsFromMenu = true;
    void this.router.navigate(['/kennels', this.kennelId, 'edit'], { queryParams: { panel: null }, queryParamsHandling: 'merge' });
  }

  closeSettings(): void {
    this.settingsOpen.set(false);
    this.leaveSettingsUrl();
  }

  private onSettingsUrl(edit: boolean): void {
    if (!edit) {
      this.settingsOpen.set(false);
      this.settingsPending.set(false);
      return;
    }
    if (this.settingsFromMenu) {
      this.settingsFromMenu = false;
      this.showSettings();
      return;
    }
    this.settingsPending.set(true);
  }

  /** The deep link opens for editors (frozen/landing: owner and editors, read-only); others get the toast. */
  private settleSettingsDeepLink(): void {
    this.settingsPending.set(false);
    const cfg = this.kennelConfig();
    const opens = this.mode() === 'full'
      && editDeepLinkOpens(this.rights(), this.frozen(), isListedEditor(cfg, this.auth.user()?.id), this.landingLocked());
    if (opens) {
      this.showSettings();
      return;
    }
    if (this.mode() !== 'missing') this.showToast(CANT_EDIT_TOAST);
    this.leaveSettingsUrl();
  }

  private showSettings(): void {
    this.cancelEdgeComment();
    this.closeSidePanel();
    this.kennelInspectorOpen.set(false);
    this.settingsOpen.set(true);
  }

  private leaveSettingsUrl(): void {
    if (!this.route.snapshot.url.some((s) => s.path === 'edit')) return;
    void this.router.navigate(['/kennels', this.kennelId], { queryParamsHandling: 'preserve', replaceUrl: true });
  }

  onSettingsSaved(): void {
    this.showToast('Saved.');
    this.loadHeader();
    this.loadWaves();
  }

  onVisibilityChanged(visibility: KennelVisibility): void {
    this.kennelConfig.update((c) => (c ? { ...c, visibility } : c));
  }

  /** Transfer or release: the caller's rights moved — reload them. */
  onOwnershipChanged(): void {
    this.loadHeader();
  }

  /** One navigation: off `/edit`, onto `?panel=versions` (the query subscription opens the tab). */
  async settingsToVersions(): Promise<void> {
    if (this.settingsDrawer()?.dirty() && !(await this.confirm.ask(LEAVE_UNSAVED))) return;
    this.settingsDrawer()?.discard();
    this.settingsOpen.set(false);
    void this.router.navigate(['/kennels', this.kennelId], {
      queryParams: { panel: 'versions' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  confirmDelete(): void {
    this.pendingDelete.set(false);
    this.kennelService.delete(this.kennelId).subscribe({
      next: () => void this.router.navigate(['/kennels']),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.error_description ?? err.error?.error ?? err.message),
    });
  }

  onRatingChanged(v: IRatingView): void {
    this.ratingView.set(v);
    this.kennelStats.update((s) => (s ? { ...s, rating: { avg: v.avg, count: v.count, score: v.score } } : s));
  }

  showToast(text: string): void {
    this.toast.show(text);
  }

  // === Rename (kennel menu) ===

  openRename(): void {
    if (!this.rights().edit || this.frozen() || this.mode() !== 'full') return;
    this.renameDraft.set(this.kennelConfig()?.name ?? '');
    this.renameError.set(null);
    this.renameOpen.set(true);
  }

  commitRename(): void {
    const name = this.renameDraft().trim();
    if (this.renameProblem() || this.renameBusy()) return;
    const id = this.kennelId;
    this.renameBusy.set(true);
    this.renameError.set(null);
    this.kennelService.rename(id, name).subscribe({
      next: () => {
        this.renameBusy.set(false);
        this.renameOpen.set(false);
        if (id !== this.kennelId) return;
        this.kennelConfig.update((c) => (c ? { ...c, name } : c));
        this.showToast(`Renamed to ${name}. The ID and every link stay.`);
        this.loadKennelVersions();
      },
      error: (err: HttpErrorResponse) => {
        this.renameBusy.set(false);
        this.renameError.set(renameErrorText(err.status));
      },
    });
  }

  // === Keys and unsaved work (U8) ===

  /** Unsaved brief/layout, dog code or settings — what a navigation away would drop. */
  hasUnsavedWork(): boolean {
    return this.briefDirty() || !!this.dogPanel()?.isDirty() || !!this.settingsDrawer()?.dirty();
  }

  /**
   * Route guard: another kennel or page takes over — ask first when something is unsaved. This kennel's
   * own URLs (`/kennels/:id`, `/edit`, `?panel=`) keep the page and its editors, so they pass.
   */
  canLeave(nextUrl: string): boolean | Promise<boolean> {
    const next = /^\/kennels\/([^/?#]+)(\/edit)?(?:[?#]|$)/.exec(nextUrl);
    if (next && (next[1] === this.kennelId || next[1] === encodeURIComponent(this.kennelId))) return true;
    return this.hasUnsavedWork() ? this.confirm.ask(LEAVE_UNSAVED) : true;
  }

  /** Closing the tab or reloading: the browser asks with its own words. */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.hasUnsavedWork()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  /** `Ctrl/⌘+Enter` runs, `Ctrl/⌘+S` saves the open editor — never under a dialog. */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (!hasModifier(event) || event.shiftKey) return;
    const key = event.key.toLowerCase();
    if (key !== 'enter' && key !== 's') return;
    if (key === 's') event.preventDefault();
    if (this.dialogOpen()) return;
    if (key === 'enter') {
      if (this.mode() === 'missing' || this.loading()) return;
      event.preventDefault();
      this.loadWaves();
      return;
    }
    this.saveOpenEditor();
  }

  /** Settings drawer first, then the dog in the inspector, then brief/query/body/layout. */
  private saveOpenEditor(): void {
    const settings = this.settingsDrawer();
    if (this.settingsOpen() && settings) {
      if (settings.editable()) settings.save();
      else this.showToast(this.landingLocked() ? LANDING_LOCK_TITLE : this.frozen() ? FROZEN_TITLE : 'Read only. Nothing to save.');
      return;
    }
    const panel = this.dogPanel();
    if (this.drawerMode() === 'dog' && panel?.canEditDog) {
      panel.saveCode();
      return;
    }
    if (this.briefDirty() && this.canMutate()) {
      this.saveKennel();
      return;
    }
    this.showToast(this.mutationLock() ?? 'Nothing to save.');
  }

  /** A dialog on top (confirm, rename, cut, delete, shortcut help): the page keys wait. */
  private dialogOpen(): boolean {
    return !!this.confirm.request() || this.renameOpen() || !!this.pendingCut() || this.pendingDelete()
      || (hasEscapeLayer() && !this.drawerMode() && !this.settingsOpen() && !this.paletteOpen());
  }

  /** Before the dog inspector lets go of a dog with unsaved code: ask. */
  private async dogPanelMayClose(): Promise<boolean> {
    if (this.drawerMode() !== 'dog' || !this.dogPanel()?.isDirty()) return true;
    return this.confirm.ask(LEAVE_UNSAVED);
  }

  // === Drawer ===

  openKennelInspector(tab: KennelTab): void {
    const allowed = this.inspectorTabs();
    const next = allowed.includes(tab) ? tab : allowed[0];
    this.selectedDog.set(null);
    this.editingEdgeKey.set(null);
    this.kennelInspectorTab.set(next);
    this.kennelInspectorOpen.set(true);
    if (next === 'rating' || next === 'stats') this.loadRating();
    this.writePanelParam(next);
  }

  selectKennelTab(tab: KennelTab): void {
    this.kennelInspectorTab.set(tab);
    if (tab === 'rating' || tab === 'stats') this.loadRating();
    this.writePanelParam(tab);
  }

  /** `‹ kennel`: from the dog inspector back to the kennel inspector in the same drawer. */
  async backToKennel(): Promise<void> {
    if (!(await this.dogPanelMayClose())) return;
    this.closeSidePanel();
    this.openKennelInspector(this.kennelInspectorTab());
  }

  async closeDrawer(): Promise<void> {
    if (!(await this.dogPanelMayClose())) return;
    this.cancelEdgeComment();
    this.closeSidePanel();
    this.kennelInspectorOpen.set(false);
    this.writePanelParam(null);
  }

  private writePanelParam(tab: KennelTab | null): void {
    if ((this.route.snapshot.queryParamMap.get('panel') ?? null) === tab) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { panel: tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Save both task/layout and query/body in one go — one button, one signal. */
  saveKennel(): void {
    if (!this.canMutate()) return;
    if (this.paramsDirty()) this.saveParams();
    if (this.layoutDirty()) this.saveLayout();
  }

  /** Palette click (S4): a run-only dog goes in as its version GUID — pinned (8.15) — and the toast says so. */
  onPaletteAdd(dog: DogCatalogEntry): void {
    const cfg = this.kennelConfig();
    if (!cfg || !this.canMutate()) return;
    const dogIds = [...(cfg.dogIds ?? []), dog.ref];
    this.kennelService.update(this.kennelId, { dogIds }).subscribe({
      next: (res) => {
        if (res && res.ok === false) {
          this.error.set(res.error ?? `Couldn't add ${dog.name}.`);
          return;
        }
        this.showToast(dog.runOnly
          ? `Added ${dog.name}, pinned to v${dog.version ?? '?'}.`
          : `Added ${dog.name}.`);
        this.loadWaves();
        this.loadAvailableDogs();
      },
      error: (err) => this.error.set(err?.error?.error_description ?? err?.error?.error ?? `Couldn't add ${dog.name} (${err?.status ?? 'network'}).`),
    });
  }

  /** Compute a stable kennel-ref for a DogEntry (lineageId, base:Name, or version ID). */
  kennelRefForDog(dog: DogEntry): string {
    return kennelRefForDog(dog, this.kennelConfig()?.dogIds ?? []);
  }

  /** Current node comment (if any) for the selected dog — fed into the side panel. */
  commentForSelectedDog = computed<string | null>(() => {
    const dog = this.selectedDog();
    if (!dog) return null;
    const ref = kennelRefForDog(dog, this.kennelConfig()?.dogIds ?? []);
    return this.layoutNodes().find(n => n.id === ref)?.comment ?? null;
  });

  /** Map of layout positions keyed by current Wave-DogEntry instance ID — feeds vis-network. */
  nodePositionsForGraph = computed<Map<string, { x: number; y: number }>>(() => {
    const cfg = this.kennelConfig();
    const dogs = this.flatDogList();
    const out = new Map<string, { x: number; y: number }>();
    if (!cfg || dogs.length === 0) return out;
    for (const ann of this.layoutNodes()) {
      if (ann.x == null || ann.y == null) continue;
      const dog = dogs.find(d => kennelRefForDog(d, cfg.dogIds ?? []) === ann.id);
      if (dog) out.set(dog.id, { x: ann.x, y: ann.y });
    }
    return out;
  });

  /** Map of node comments keyed by current Wave-DogEntry instance ID. */
  nodeCommentsForGraph = computed<Map<string, string>>(() => {
    const cfg = this.kennelConfig();
    const dogs = this.flatDogList();
    const out = new Map<string, string>();
    if (!cfg || dogs.length === 0) return out;
    for (const ann of this.layoutNodes()) {
      if (!ann.comment) continue;
      const dog = dogs.find(d => kennelRefForDog(d, cfg.dogIds ?? []) === ann.id);
      if (dog) out.set(dog.id, ann.comment);
    }
    return out;
  });

  /** Edge comments keyed as "fromInstanceId|toInstanceId" for the current waves. */
  edgeCommentsForGraph = computed<Map<string, string>>(() => {
    const cfg = this.kennelConfig();
    const dogs = this.flatDogList();
    const out = new Map<string, string>();
    if (!cfg || dogs.length === 0) return out;
    const refToInstanceIds = new Map<string, string[]>();
    for (const dog of dogs) {
      const ref = kennelRefForDog(dog, cfg.dogIds ?? []);
      const arr = refToInstanceIds.get(ref) ?? [];
      arr.push(dog.id);
      refToInstanceIds.set(ref, arr);
    }
    for (const ann of this.layoutEdges()) {
      if (!ann.comment) continue;
      const fromIds = refToInstanceIds.get(ann.fromId) ?? [];
      const toIds = refToInstanceIds.get(ann.toId) ?? [];
      for (const fId of fromIds) {
        for (const tId of toIds) {
          out.set(`${fId}|${tId}`, ann.comment);
        }
      }
    }
    return out;
  });

  onNodePositionsChanged(positions: Map<string, { x: number; y: number }>) {
    const cfg = this.kennelConfig();
    const dogs = this.flatDogList();
    if (!cfg || !this.canMutate()) return;
    const byRef = new Map<string, { x: number; y: number }>();
    for (const [instId, pos] of positions) {
      const dog = dogs.find(d => d.id === instId);
      if (!dog) continue;
      byRef.set(kennelRefForDog(dog, cfg.dogIds ?? []), pos);
    }
    const existing = this.layoutNodes();
    const seenRefs = new Set<string>();
    const next: IKennelNodeAnnotation[] = existing.map(ann => {
      const pos = byRef.get(ann.id);
      seenRefs.add(ann.id);
      if (pos) return { ...ann, x: pos.x, y: pos.y };
      return ann;
    });
    for (const [ref, pos] of byRef) {
      if (!seenRefs.has(ref)) next.push({ id: ref, x: pos.x, y: pos.y });
    }
    this.layoutNodes.set(next);
    this.layoutDirty.set(true);
  }

  onNodeCommentChanged(ev: { kennelRef: string; comment: string }) {
    if (!this.canMutate()) return;
    const trimmed = ev.comment.trim();
    const existing = this.layoutNodes();
    const idx = existing.findIndex(n => n.id === ev.kennelRef);
    if (idx >= 0) {
      const ann = existing[idx];
      const next = [...existing];
      if (!trimmed && ann.x == null && ann.y == null) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...ann, comment: trimmed || undefined };
      }
      this.layoutNodes.set(next);
    } else if (trimmed) {
      this.layoutNodes.set([...existing, { id: ev.kennelRef, comment: trimmed }]);
    }
    this.layoutDirty.set(true);
  }

  /** Open the edge note in the drawer for the given (from, to) instance IDs. */
  startEdgeComment(ev: { fromId: string; toId: string }) {
    const cfg = this.kennelConfig();
    if (!cfg) return;
    const dogs = this.flatDogList();
    const fromDog = dogs.find(d => d.id === ev.fromId);
    const toDog = dogs.find(d => d.id === ev.toId);
    if (!fromDog || !toDog) return;
    const fromRef = kennelRefForDog(fromDog, cfg.dogIds ?? []);
    const toRef = kennelRefForDog(toDog, cfg.dogIds ?? []);
    const cur = this.layoutEdges().find(e => e.fromId === fromRef && e.toId === toRef);
    this.editingEdgeKey.set({ fromId: ev.fromId, toId: ev.toId });
    this.edgeCommentDraft = cur?.comment ?? '';
  }

  /** `from → to` for the edge note head. */
  edgeLabel(): string {
    const ev = this.editingEdgeKey();
    if (!ev) return '';
    const dogs = this.flatDogList();
    const name = (id: string) => {
      const d = dogs.find((x) => x.id === id);
      return d?.displayName || d?.name || id;
    };
    return `${name(ev.fromId)} → ${name(ev.toId)}`;
  }

  commitEdgeComment() {
    const slot = this.editingEdgeKey();
    if (!slot) return;
    const cfg = this.kennelConfig();
    if (!cfg || !this.canMutate()) {
      this.editingEdgeKey.set(null);
      return;
    }
    const dogs = this.flatDogList();
    const fromDog = dogs.find(d => d.id === slot.fromId);
    const toDog = dogs.find(d => d.id === slot.toId);
    if (!fromDog || !toDog) {
      this.editingEdgeKey.set(null);
      return;
    }
    const fromRef = kennelRefForDog(fromDog, cfg.dogIds ?? []);
    const toRef = kennelRefForDog(toDog, cfg.dogIds ?? []);
    const trimmed = this.edgeCommentDraft.trim();
    const existing = this.layoutEdges();
    const idx = existing.findIndex(e => e.fromId === fromRef && e.toId === toRef);
    let changed = false;
    if (idx >= 0) {
      const next = [...existing];
      if (!trimmed) {
        next.splice(idx, 1);
      } else {
        next[idx] = { fromId: fromRef, toId: toRef, comment: trimmed };
      }
      this.layoutEdges.set(next);
      changed = true;
    } else if (trimmed) {
      this.layoutEdges.set([...existing, { fromId: fromRef, toId: toRef, comment: trimmed }]);
      changed = true;
    }
    if (changed) this.layoutDirty.set(true);
    this.editingEdgeKey.set(null);
    this.edgeCommentDraft = '';
  }

  cancelEdgeComment() {
    this.editingEdgeKey.set(null);
    this.edgeCommentDraft = '';
  }

  onTaskTextChange(value: string) {
    this.taskText.set(value);
    this.layoutDirty.set(true);
  }

  saveLayout() {
    if (this.layoutSaving()) return;
    this.layoutSaving.set(true);
    const cfg = this.kennelConfig();
    const payload: Partial<IKennelConfig> = {
      task: this.taskText().trim() || undefined,
      nodes: this.layoutNodes(),
      edges: this.layoutEdges(),
    };
    // Preserve other fields the backend merges by undefined.
    if (cfg) {
      payload.dogIds = cfg.dogIds;
      payload.name = cfg.name;
      payload.description = cfg.description;
      payload.emoji = cfg.emoji;
      payload.defaultQuery = cfg.defaultQuery;
      payload.defaultBody = cfg.defaultBody;
    }
    this.kennelService.update(this.kennelId, payload).subscribe({
      next: (res) => {
        this.layoutSaving.set(false);
        if (!res.ok) {
          this.error.set(res.error ?? 'Saving failed.');
          return;
        }
        this.layoutDirty.set(false);
        this.loadWaves();
      },
      error: (err) => {
        this.layoutSaving.set(false);
        this.error.set(err.error?.error_description ?? err.error?.error ?? err.message);
      }
    });
  }

  private buildQueryRecord(): Record<string, string> {
    const result: Record<string, string> = {};
    this.queryParams().forEach(p => {
      if (p.key.trim()) result[p.key] = p.value;
    });
    return result;
  }

  addQueryParam() {
    if (this.newQueryKey.trim()) {
      this.queryParams.set([...this.queryParams(), { key: this.newQueryKey, value: this.newQueryValue }]);
      this.newQueryKey = '';
      this.newQueryValue = '';
      this.paramsDirty.set(true);
    }
  }

  removeQueryParam(index: number) {
    const params = [...this.queryParams()];
    params.splice(index, 1);
    this.queryParams.set(params);
    this.paramsDirty.set(true);
  }

  /**
   * Query-Zeilen immutabel ins Signal schreiben — `[(ngModel)]` auf Objekten innerhalb
   * eines Signal-Arrays mutiert nur in-place; Signal/CD und Speichern können dadurch auseinanderlaufen.
   */
  setQueryParamAt(index: number, field: 'key' | 'value', value: string) {
    const cur = this.queryParams();
    if (index < 0 || index >= cur.length) return;
    const next = cur.map((p, i) =>
      i === index
        ? { key: field === 'key' ? value : p.key, value: field === 'value' ? value : p.value }
        : p
    );
    this.queryParams.set(next);
    this.paramsDirty.set(true);
  }

  onBodyJsonChange() {
    this.paramsDirty.set(true);
  }

  saveParams() {
    this.paramsSaving.set(true);
    // Ausstehende Add-Zeile mitzählen (viele tragen Key/Value ein und speichern ohne "+").
    if (this.newQueryKey.trim()) {
      this.queryParams.set([...this.queryParams(), { key: this.newQueryKey, value: this.newQueryValue }]);
      this.newQueryKey = '';
      this.newQueryValue = '';
      this.paramsDirty.set(true);
    }

    const defaultQuery: Record<string, string> = {};
    this.queryParams().forEach(p => {
      if (p.key.trim()) defaultQuery[p.key] = p.value;
    });

    let defaultBody: any = undefined;
    try {
      const raw = this.bodyJson().trim();
      if (raw) defaultBody = JSON.parse(raw);
    } catch {
      this.error.set('The body is not valid JSON.');
      this.paramsSaving.set(false);
      return;
    }

    // Full-Config senden: alle bekannten Felder des aktuellen Kennels mitschicken,
    // damit der Merge im Backend keine Felder aus einem (möglicherweise zurückfallenden)
    // existing-Load verliert.
    const current = this.kennelConfig();
    this.kennelService.update(this.kennelId, {
      name: current?.name,
      description: current?.description,
      emoji: current?.emoji,
      dogIds: current?.dogIds ?? [],
      defaultQuery: Object.keys(defaultQuery).length > 0 ? defaultQuery : undefined,
      defaultBody,
    }).subscribe({
      next: (res) => {
        this.paramsSaving.set(false);
        if (!res.ok) {
          this.error.set(res.error ?? 'Saving the query and body defaults failed.');
          return;
        }
        this.paramsDirty.set(false);
        this.loadWaves();
      },
      error: (err) => {
        this.paramsSaving.set(false);
        this.error.set(err.error?.error_description ?? err.error?.error ?? err.message);
      }
    });
  }

  /** The palette's list: what the kennel does not hold yet, without code (`lean=1`), proven first. */
  loadAvailableDogs() {
    this.dogService.getCatalog({ kennelId: this.kennelId, sort: 'proven', dir: 'desc' }).subscribe({
      next: (res) => this.availableDogs.set(res.data ?? []),
    });
  }

  private loadKennelVersions() {
    const id = this.kennelId;
    this.kennelService.getVersions(id).subscribe({
      next: (res) => {
        if (id === this.kennelId && res.ok && res.data) {
          this.kennelVersions.set(res.data);
        }
      },
      error: () => { /* no READ: no versions (run-only) */ },
    });
  }

  onKennelVersionSelected(versionId: string) {
    this.selectedKennelVersionId.set(versionId);
    // If the selected version is the newest, clear the override so URLs stay clean.
    const versions = this.kennelVersions();
    const newest = versions.length > 0 ? versions[0] : null;
    this.activeKennelVersionId.set(newest?.id === versionId ? null : versionId);
    this.loadWaves();
  }

  backToLatest(): void {
    const newest = this.kennelVersions()[0];
    if (newest) this.onKennelVersionSelected(newest.id);
    else {
      this.activeKennelVersionId.set(null);
      this.loadWaves();
    }
  }

  async onDogSelected(dog: DogEntry): Promise<void> {
    if (this.selectedDog()?.id !== dog.id && !(await this.dogPanelMayClose())) return;
    this.panelInitialSection.set(null);
    this.editingEdgeKey.set(null);
    this.selectedDog.set(dog);
  }

  onDogSectionEdit(ev: { dog: DogEntry; section: DogPanelSectionId }) {
    this.panelInitialSection.set(ev.section);
    this.selectedDog.set(ev.dog);
  }

  onDogDeleted(lineageId: string) {
    if (!this.canMutate()) return;
    this.selectedDog.set(null);
    const config = this.kennelConfig();
    if (!config) return;
    const dog = this.flatDogList().find(d => d.id === lineageId);
    // Remove from kennel dogIds — match version ID, lineageId (lineage), or base:Name.
    const ids = (config.dogIds ?? []).filter(kid =>
      kid !== lineageId &&
      kid !== dog?.lineageId &&
      kid !== `base:${lineageId}` &&
      kid !== `base:${dog?.name}`
    );
    this.kennelService.update(this.kennelId, { dogIds: ids }).subscribe({
      next: () => this.loadWaves(),
    });
  }

  /**
   * Stage a branch-cut request — actual removal is gated through the confirm dialog.
   */
  onBranchCutRequested(ev: { fromId: string; toId: string }) {
    if (!this.canMutate()) return;
    this.pendingCut.set(ev);
  }

  cancelBranchCut(): void {
    this.pendingCut.set(null);
  }

  /** Compute a short label for the confirm dialog: "<from> → <to>". */
  cutLabel(): string | null {
    const ev = this.pendingCut();
    if (!ev) return null;
    const dogs = this.flatDogList();
    const from = dogs.find(d => d.id === ev.fromId);
    const to = dogs.find(d => d.id === ev.toId);
    const fromLabel = from?.displayName || from?.name || ev.fromId;
    const toLabel = to?.displayName || to?.name || ev.toId;
    return `${fromLabel} → ${toLabel}`;
  }

  /**
   * Confirmed branch-cut — transitive sub-tree below the child node is removed.
   */
  confirmBranchCut() {
    const ev = this.pendingCut();
    this.pendingCut.set(null);
    if (!ev || !this.canMutate()) return;
    const config = this.kennelConfig();
    const waves = this.waves();
    if (!config || !waves?.length) return;

    const branchIds = collectDescendantBranchNodeIds(waves, ev.toId);
    const flat = this.flatDogList();

    const before = [...(config.dogIds ?? [])];
    const nextIds = before.filter(kid => {
      for (const nodeId of branchIds) {
        const dog = flat.find(d => d.id === nodeId);
        if (graphNodeIdMatchesKennelDogId(nodeId, kid, dog?.lineageId)) {
          return false;
        }
      }
      return true;
    });

    if (nextIds.length === before.length) {
      this.error.set('No matching dogIds entry to remove.');
      return;
    }

    this.kennelService.update(this.kennelId, { dogIds: nextIds }).subscribe({
      next: () => {
        this.selectedDog.set(null);
        this.loadWaves();
        this.loadAvailableDogs();
      },
      error: (err) => this.error.set(err.error?.error_description ?? err.error?.error ?? err.message ?? 'Updating the kennel failed.'),
    });
  }

  onDogMovedToFirst(_emitId: string) {
    const dog = this.selectedDog();
    if (!dog || !this.canMutate()) return;
    this.reorderKennelDogIds(ids => {
      const idx = findKennelDogIndex(ids, dog.id, dog.lineageId);
      if (idx <= 0) return ids;
      const copy = [...ids];
      const [entry] = copy.splice(idx, 1);
      return [entry, ...copy];
    });
  }

  /** Reihenfolge in der Config ändern und neu laden */
  private reorderKennelDogIds(mutate: (ids: string[]) => string[]) {
    const config = this.kennelConfig();
    if (!config) return;
    const before = [...(config.dogIds ?? [])];
    const after = mutate(before);
    if (after.length === before.length && after.every((id, i) => id === before[i])) {
      return;
    }
    this.kennelService.update(this.kennelId, { dogIds: after }).subscribe({
      next: () => this.loadWaves(),
    });
  }

  /** Find the kennel's dogIds entry that corresponds to this dog (by id or lineageId). */
  getKennelRefForDog(dog: DogEntry): string | null {
    const ids = this.kennelConfig()?.dogIds ?? [];
    // Exact version match
    if (ids.includes(dog.id)) return dog.id;
    // lineageId (latest) match
    if (dog.lineageId && ids.includes(dog.lineageId)) return dog.lineageId;
    return null;
  }

  /** Toggle pin: switch a kennel dogIds entry between lineageId (latest) and version-ID (pinned). */
  onPinChanged(ev: { lineageId: string; versionId: string | null }) {
    const config = this.kennelConfig();
    if (!config || !this.canMutate()) return;
    const ids = [...(config.dogIds ?? [])];
    // Find the entry that currently references this dog (by lineageId or any version of it)
    const idx = ids.findIndex(id => id === ev.lineageId || id === this.selectedDog()?.id);
    if (idx < 0) return;
    // Replace: null versionId → use lineageId (latest); otherwise → use versionId (pinned)
    ids[idx] = ev.versionId ?? ev.lineageId;
    this.kennelService.update(this.kennelId, { dogIds: ids }).subscribe({
      next: (res) => {
        if (res && res.ok === false) {
          this.error.set(res.error ?? 'Changing the pin failed.');
          return;
        }
        this.showToast(ev.versionId ? this.pinLabel(ev.versionId) : 'Follows the latest version.');
        this.loadWaves();
      },
      error: (err) => this.error.set(err.error?.error_description ?? err.error?.error ?? err.message),
    });
  }

  /** `Pinned to v3.` — the number from the dog's timeline when the panel knows it. */
  private pinLabel(versionId: string): string {
    const n = this.dogPanel()?.versions().find((v) => v.id === versionId)?.version;
    return n != null ? `Pinned to v${n}.` : 'Pinned.';
  }

  /**
   * `Update pin` (8.15): a foreign run-only dog stays pinned — lifting it means pinning the newer head,
   * never the lineage (the server answers `pin_required` for a lineageId).
   */
  updatePin(): void {
    const dog = this.selectedDog();
    const config = this.kennelConfig();
    if (!dog?.latestId || !config || !this.canMutate()) return;
    const ids = [...(config.dogIds ?? [])];
    const idx = ids.findIndex((id) => id === dog.id || (!!dog.lineageId && id === dog.lineageId));
    if (idx < 0) return;
    ids[idx] = dog.latestId;
    this.kennelService.update(this.kennelId, { dogIds: ids }).subscribe({
      next: (res) => {
        if (!res.ok) {
          this.error.set(res.error ?? 'Updating the pin failed.');
          return;
        }
        this.showToast(pinnedToast(dog.latestVersion));
        this.loadWaves();
      },
      error: (err) => this.error.set(err.error?.error_description ?? err.error?.error ?? err.message),
    });
  }

  /** The first failing dog in the dog inspector (`[Show dog]`). */
  showFailedDog(): void {
    const dog = this.firstFailure()?.dog;
    if (dog) void this.onDogSelected(dog);
  }

  closeSidePanel() {
    this.panelInitialSection.set(null);
    this.selectedDog.set(null);
  }

  onGlobalDragOver() {
    clearTimeout(this.dragEndTimer);
    this.isDragging = this.canMutate();
  }

  onGlobalDragEnd() {
    clearTimeout(this.dragEndTimer);
    this.dragEndTimer = setTimeout(() => {
      this.isDragging = false;
      this.isDragOver = false;
    }, 100);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    const target = event.currentTarget as HTMLElement;
    const related = event.relatedTarget as Node | null;
    if (!related || !target.contains(related)) {
      this.isDragOver = false;
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    this.isDragging = false;

    const lineageId = event.dataTransfer?.getData('application/dog-id');
    if (!lineageId || !this.canMutate()) return;

    const config = this.kennelConfig();
    if (!config) return;

    const dogIds = [...(config.dogIds ?? []), lineageId];
    this.kennelService.update(this.kennelId, { dogIds }).subscribe({
      next: () => {
        this.loadWaves();
        this.loadAvailableDogs();
      },
    });
  }

  /** Export runs while frozen (8.25): the bundle goes to the clipboard, else it downloads. */
  exportKennel() {
    this.kennelService.exportBundle(this.kennelId).subscribe({
      next: (bundle: any) => {
        const json = JSON.stringify(bundle, null, 2);
        navigator.clipboard.writeText(json).then(() => {
          this.showToast('Bundle copied.');
        }).catch(() => {
          // Fallback: download as file
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${this.kennelId}.kennel.json`;
          a.click();
          URL.revokeObjectURL(url);
          this.showToast('Bundle downloaded.');
        });
      },
      error: (err: HttpErrorResponse) => this.showToast(`Couldn't export: ${err.error?.error ?? err.status}`),
    });
  }

  createNewDog() {
    if (!this.canMutate()) return;
    const displayName = `dog-${Date.now()}`;
    this.dogService.create({
      displayName,
      tsCode: '// A new dog\nreturn {};',
    }).subscribe({
      next: (res) => {
        if (res.ok) {
          const config = this.kennelConfig();
          if (config) {
            // Use the lineageId (lineage GUID) so the kennel always loads the latest incarnation.
            const newDogRef = res.data?.lineageId || res.id;
            const dogIds = [...(config.dogIds ?? []), newDogRef];
            this.kennelService.update(this.kennelId, { dogIds }).subscribe({
              next: () => this.loadWaves(),
            });
          }
        }
      },
    });
  }
}
