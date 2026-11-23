import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked, type WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { TokenService, type INewPersonalToken, type IPersonalToken } from '../../services/token.service';
import { UserKeyService } from '../../services/user-key.service';
import type { IUserKey } from '../../models/user-key.model';
import { accountTabOf, visibleAccountTabs, type AccountTab } from '../../utils/account';
import { BetaService, type IBetaKey } from '../../services/beta.service';
import { MyPagesService, type IMyPages, type MyPageKind } from '../../services/my-pages.service';
import { KennelListPageService } from '../../services/kennel-list-page.service';
import { KennelService } from '../../services/kennel.service';
import { apiAbsoluteUrl } from '../../config/api-base';
import { publicKennelPath } from '../../config/public-paths';
import { KEYS_NOTICE, KEYSTORE_OFF, keyErrorText } from '../../utils/user-keys';
import { SdTopBarComponent } from '../../components/sd-top-bar/sd-top-bar.component';
import { SdChapterCardComponent } from '../../components/sd-chapter-card/sd-chapter-card.component';
import { SdBannerComponent } from '../../components/sd-banner/sd-banner.component';
import { SdUrlChipComponent } from '../../components/sd-url-chip/sd-url-chip.component';
import { SdTokenRowComponent } from '../../components/sd-token-row/sd-token-row.component';
import { SdKeyRowComponent } from '../../components/sd-key-row/sd-key-row.component';
import { SdKeyFormComponent } from '../../components/sd-key-form/sd-key-form.component';
import { SdTrackSkeletonComponent } from '../../components/sd-track-skeleton/sd-track-skeleton.component';

type ListState = 'idle' | 'loading' | 'ready' | 'error' | 'disabled';

/** One row of "Your pages": the kind, its label and the path it takes over. */
interface PageRow {
  kind: MyPageKind;
  label: string;
  path: string;
}

/**
 * S9 Account (P6 U7, 6.4): chapter card `ACCOUNT`, tabs profile · tokens · keys (`?tab=`), max 720.
 * profile: who you are, sign out, the `claude mcp add` box, your pages (your own `/` and `/kennels`: a kennel
 * id each, suggestions from your kennels, save and reset; in local mode they apply to every device).
 * tokens: personal access tokens over the JSON face of `/auth/tokens` — a new one shows its value once in an ink box. keys: the key store
 * (P4c) — masked rows, the add sheet, delete with a question, the notice that a database reset takes
 * them, and `The key store is off on this server.` without a master key. beta (admins only): closed-beta keys —
 * one key unlocks one Google account, once, no expiry; a new key shows its value once. Signed out: `/login?returnTo=`, except the local
 * super-user, who sees only the beta tab. Server in local mode: no sign out, no tokens tab.
 */
@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    SdTopBarComponent, SdChapterCardComponent, SdBannerComponent, SdUrlChipComponent,
    SdTokenRowComponent, SdKeyRowComponent, SdKeyFormComponent, SdTrackSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
})
export class AccountComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tokensApi = inject(TokenService);
  private readonly keysApi = inject(UserKeyService);
  readonly auth = inject(AuthService);
  private readonly betaApi = inject(BetaService);
  private readonly pagesApi = inject(MyPagesService);
  private readonly kennelsApi = inject(KennelService);
  private readonly kennelListPage = inject(KennelListPageService);

  readonly beta = this.betaApi.status;
  /** Server in local mode: no sign-out, no personal tokens. */
  readonly localMode = this.auth.localMode;
  readonly tabs = computed(() => visibleAccountTabs(!!this.user(), !!this.beta()?.admin, this.localMode()));
  readonly keysNotice = KEYS_NOTICE;
  readonly keystoreOff = KEYSTORE_OFF;
  readonly tab = signal<AccountTab>('profile');
  readonly user = this.auth.user;
  readonly initial = computed(() => {
    const u = this.user();
    return ((u?.name?.trim() || u?.email || '?').charAt(0) || '?').toUpperCase();
  });
  readonly mcpCommand = `claude mcp add --transport http slopdogs ${typeof window !== 'undefined' ? window.location.origin : ''}/mcp`;

  readonly tokens = signal<IPersonalToken[]>([]);
  readonly tokensState = signal<ListState>('idle');
  readonly freshToken = signal<INewPersonalToken | null>(null);
  readonly tokenName = signal('');
  readonly tokenBusy = signal<string | null>(null);
  readonly tokenError = signal<string | null>(null);

  readonly keys = signal<IUserKey[]>([]);
  readonly keysState = signal<ListState>('idle');
  readonly keyBusy = signal<string | null>(null);
  readonly keyError = signal<string | null>(null);
  readonly keyFormOpen = signal(false);
  readonly status = signal<string | null>(null);

  readonly betaKeys = signal<IBetaKey[]>([]);
  readonly betaState = signal<ListState>('idle');
  readonly betaBusy = signal<string | null>(null);
  readonly betaError = signal<string | null>(null);
  readonly freshBetaKey = signal<string | null>(null);
  readonly betaNote = signal('');

  readonly pageRows: readonly PageRow[] = [
    { kind: 'landing', label: 'Landing', path: '/' },
    { kind: 'list', label: 'List', path: '/kennels' },
  ];
  readonly myPages = signal<IMyPages | null>(null);
  readonly pagesState = signal<ListState>('idle');
  readonly pagesError = signal<string | null>(null);
  readonly pageDraft = signal<Record<MyPageKind, string>>({ landing: '', list: '' });
  readonly pageBusy = signal<MyPageKind | null>(null);
  readonly pageError = signal<Partial<Record<MyPageKind, string>>>({});
  readonly pageSuggestions = signal<Array<{ id: string; name: string }>>([]);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((q) => {
      this.tab.set(accountTabOf(q.get('tab')));
    });
    void this.betaApi.load();
    // Signed out: to the login with the way back — unless a beta admin without an account (local super-user):
    // then only the beta tab. Signed in: load what the open tab shows, once. A tab you may not see is the first.
    effect(() => {
      if (!this.auth.isReady() || !this.beta()) return;
      const user = this.user();
      const tabs = this.tabs();
      const tab = this.tab();
      untracked(() => {
        if (tabs.length === 0) {
          void this.router.navigate(['/login'], { queryParams: { returnTo: `/account?tab=${tab}` }, replaceUrl: true });
          return;
        }
        if (!tabs.includes(tab)) {
          this.tab.set(tabs[0]);
          return;
        }
        if (user && tab === 'profile' && this.pagesState() === 'idle') this.loadPages();
        if (user && tab === 'tokens' && this.tokensState() === 'idle') this.loadTokens();
        if (user && tab === 'keys' && this.keysState() === 'idle') this.loadKeys();
        if (tab === 'beta' && this.betaState() === 'idle') this.loadBetaKeys();
      });
    }, { allowSignalWrites: true });
  }

  select(tab: AccountTab): void {
    this.status.set(null);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, replaceUrl: true });
  }

  async signOut(): Promise<void> {
    await this.auth.logout();
    // Signed out, /kennels is the default again — the cached answer may still say "your list".
    this.kennelListPage.reset();
    void this.router.navigate(['/kennels']);
  }

  // === Your pages ===

  loadPages(): void {
    this.pagesState.set('loading');
    this.pagesError.set(null);
    this.pagesApi.get().subscribe({
      next: (r) => {
        this.myPages.set({ landing: r.landing, list: r.list });
        this.pagesState.set('ready');
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 401) {
          void this.router.navigate(['/login'], { queryParams: { returnTo: '/account?tab=profile' } });
          return;
        }
        this.pagesError.set(err.error?.error_description ?? `Couldn't load your pages (${err.status || 'network'}).`);
        this.pagesState.set('error');
      },
    });
    // Suggestions are your own kennels; without them the field still takes any id you can see.
    this.kennelsApi.getPage({ limit: 200, mine: true }).subscribe({
      next: (r) => this.pageSuggestions.set((r.data ?? []).map((k) => ({ id: k.lineageId ?? k.id, name: k.name ?? '' }))),
      error: () => this.pageSuggestions.set([]),
    });
  }

  /** The kennel's public page, absolute like every link that leaves the app. */
  pageLink(id: string): string {
    return apiAbsoluteUrl(publicKennelPath(id));
  }

  setPageDraft(kind: MyPageKind, value: string): void {
    this.pageDraft.update((draft) => ({ ...draft, [kind]: value }));
  }

  savePage(kind: MyPageKind): void {
    const id = this.pageDraft()[kind].trim();
    if (id) this.writePage(kind, id);
  }

  resetPage(kind: MyPageKind): void {
    this.writePage(kind, null);
  }

  private writePage(kind: MyPageKind, id: string | null): void {
    if (this.pageBusy()) return;
    this.pageBusy.set(kind);
    this.pageError.update((errors) => ({ ...errors, [kind]: undefined }));
    const changes: Partial<IMyPages> = kind === 'landing' ? { landing: id } : { list: id };
    const path = this.pageRows.find((row) => row.kind === kind)?.path ?? '/';
    this.pagesApi.set(changes).subscribe({
      next: (r) => {
        this.pageBusy.set(null);
        this.myPages.set({ landing: r.landing, list: r.list });
        this.pageDraft.update((draft) => ({ ...draft, [kind]: '' }));
        // /kennels may now be yours (or the default again): the next link asks the server.
        this.kennelListPage.reset();
        const now = r[kind];
        this.status.set(now ? `Saved. Signed in, ${path} takes you to /k/${now}.` : `${path} shows the default again.`);
      },
      error: (err: HttpErrorResponse) => {
        this.pageBusy.set(null);
        if (err.status === 401) {
          void this.router.navigate(['/login'], { queryParams: { returnTo: '/account?tab=profile' } });
          return;
        }
        const message: string = err.error?.error_description ?? `Couldn't save (${err.status || 'network'}).`;
        this.pageError.update((errors) => ({ ...errors, [kind]: message }));
      },
    });
  }

  // === Tokens ===

  loadTokens(): void {
    this.tokensState.set('loading');
    this.tokensApi.list().subscribe({
      next: (r) => {
        this.tokens.set(r.tokens ?? []);
        this.tokensState.set('ready');
      },
      error: (err: HttpErrorResponse) => this.failed(err, this.tokensState, this.tokenError, 'tokens'),
    });
  }

  newToken(): void {
    if (this.tokenBusy()) return;
    this.tokenBusy.set('new');
    this.tokenError.set(null);
    this.tokensApi.create(this.tokenName().trim()).subscribe({
      next: (r) => {
        this.tokenBusy.set(null);
        this.freshToken.set(r.token);
        this.tokenName.set('');
        const { jwt: _value, ...listed } = r.token;
        this.tokens.update((list) => [listed, ...list]);
      },
      error: (err: HttpErrorResponse) => {
        this.tokenBusy.set(null);
        this.tokenError.set(`Couldn't make a token (${err.status || 'network'}).`);
      },
    });
  }

  /** The value leaves the page for good. */
  dismissFresh(): void {
    this.freshToken.set(null);
  }

  revokeToken(t: IPersonalToken): void {
    this.tokenBusy.set(t.jti);
    this.tokenError.set(null);
    this.tokensApi.revoke(t.jti).subscribe({
      next: () => {
        this.tokenBusy.set(null);
        this.tokens.update((list) => list.map((x) => (x.jti === t.jti ? { ...x, status: 'revoked', revokedAt: new Date().toISOString() } : x)));
        if (this.freshToken()?.jti === t.jti) this.freshToken.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.tokenBusy.set(null);
        this.tokenError.set(`Couldn't revoke ${t.jti.slice(0, 8)} (${err.status || 'network'}).`);
      },
    });
  }

  // === Keys ===

  loadKeys(): void {
    this.keysState.set('loading');
    this.keysApi.list().subscribe({
      next: (r) => {
        this.keys.set(r.keys ?? []);
        this.keysState.set('ready');
      },
      error: (err: HttpErrorResponse) => this.failed(err, this.keysState, this.keyError, 'keys'),
    });
  }

  onKeySaved(key: IUserKey): void {
    this.keyFormOpen.set(false);
    this.keys.update((list) => [key, ...list.filter((k) => k.alias !== key.alias)]);
    this.status.set(`Saved ${key.alias}. Its value is not shown again.`);
  }

  deleteKey(key: IUserKey): void {
    this.keyBusy.set(key.alias);
    this.keyError.set(null);
    this.keysApi.remove(key.alias).subscribe({
      next: () => {
        this.keyBusy.set(null);
        this.keys.update((list) => list.filter((k) => k.alias !== key.alias));
        this.status.set(`Deleted ${key.alias}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.keyBusy.set(null);
        this.keyError.set(`Couldn't delete ${key.alias} (${err.status || 'network'}).`);
      },
    });
  }

  // === Beta keys (admins) ===

  loadBetaKeys(): void {
    this.betaState.set('loading');
    this.betaApi.list().subscribe({
      next: (r) => {
        this.betaKeys.set(r.keys ?? []);
        this.betaState.set('ready');
      },
      error: (err: HttpErrorResponse) => {
        this.betaError.set(err.error?.error_description ?? `Couldn't load the beta keys (${err.status || 'network'}).`);
        this.betaState.set('error');
      },
    });
  }

  newBetaKey(): void {
    if (this.betaBusy()) return;
    this.betaBusy.set('new');
    this.betaError.set(null);
    this.betaApi.create(this.betaNote().trim() ? { note: this.betaNote().trim() } : {}).subscribe({
      next: (r) => {
        this.betaBusy.set(null);
        this.freshBetaKey.set(r.code);
        this.betaNote.set('');
        this.betaKeys.update((list) => [r.key, ...list]);
      },
      error: (err: HttpErrorResponse) => {
        this.betaBusy.set(null);
        this.betaError.set(err.error?.error_description ?? `Couldn't make a beta key (${err.status || 'network'}).`);
      },
    });
  }

  revokeBetaKey(key: IBetaKey): void {
    this.betaBusy.set(key.id);
    this.betaError.set(null);
    this.betaApi.revoke(key.id).subscribe({
      next: (r) => {
        this.betaBusy.set(null);
        this.betaKeys.update((list) => list.map((k) => (k.id === key.id ? r.key : k)));
      },
      error: (err: HttpErrorResponse) => {
        this.betaBusy.set(null);
        this.betaError.set(`Couldn't revoke …${key.last4} (${err.status || 'network'}).`);
      },
    });
  }

  /** 401 means the session ended: back to the login. 503 on keys: the store is off. */
  private failed(
    err: HttpErrorResponse,
    state: WritableSignal<ListState>,
    message: WritableSignal<string | null>,
    what: 'tokens' | 'keys',
  ): void {
    if (err.status === 401) {
      void this.router.navigate(['/login'], { queryParams: { returnTo: `/account?tab=${what}` } });
      return;
    }
    if (what === 'keys' && (err.status === 503 || err.error?.error === 'keystore_disabled')) {
      state.set('disabled');
      return;
    }
    // no_identity: the dev super-user has no user of its own — say so instead of a bare 403.
    message.set(what === 'keys' && err.error?.error === 'no_identity'
      ? keyErrorText(err.status, 'no_identity').text
      : `Couldn't load your ${what} (${err.status || 'network'}).`);
    state.set('error');
  }
}
