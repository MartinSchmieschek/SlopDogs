import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import type { HttpErrorResponse } from '@angular/common/http';
import type { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { KennelService, type IRatingView } from '../../services/kennel.service';
import { SdHistogramComponent } from '../sd-histogram/sd-histogram.component';

export type RatingState = 'loading' | 'anonymous' | 'readonly-owner' | 'unrated' | 'rated' | 'saving';

const STAR = 'M12 1.8l3 6.5 7 .8-5.3 4.8 1.5 6.9L12 17.3l-6.2 3.5 1.5-6.9L2 9.1l7-.8z';

/**
 * The rating tab (6.4 S7, 6.5 `sd-stars` input variant, P4 4.9 state machine): aggregate `4.3 · 12 ratings`,
 * the histogram, and your own stars at 24 px. States: loading (stars in `--ink-3`), anonymous (a tap signs
 * in and comes back to `?panel=rating`), readonly-owner (owners and editors don't rate), unrated (orange
 * hover preview), rated (the same star removes), saving (60 %), and an error line; 401 falls back to
 * anonymous. Every write emits the new view — the head aggregate follows without a reload.
 */
@Component({
  selector: 'sd-rating',
  standalone: true,
  imports: [SdHistogramComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-state]': 'state()' },
  template: `
    <p class="agg sd-data" aria-live="polite">
      @if (view(); as v) {
        @if (v.count > 0) {
          <span class="avg">{{ avg() }}</span> · {{ v.count }} rating{{ v.count === 1 ? '' : 's' }}
        } @else {
          no ratings yet
        }
      } @else {
        <span class="sd-skel sk" aria-hidden="true"></span><span class="sd-sr-only">loading ratings</span>
      }
    </p>
    <sd-histogram [histogram]="view()?.histogram ?? null" />

    <section class="mine">
      <h3 class="sd-label">Your rating</h3>
      @if (state() === 'readonly-owner') {
        <p class="note">Your kennel. Owners and editors don't rate.</p>
      } @else {
        <div class="stars" role="group" aria-label="Your rating" [class.busy]="state() === 'saving'"
          [class.idle]="state() === 'loading'" (mouseleave)="hover.set(0)">
          @for (n of five; track n) {
            <button type="button" class="star" [class.on]="n <= shown()" [class.preview]="hover() > 0 && n <= hover()"
              [class.slam]="n === slammed()" [attr.aria-label]="'Rate ' + n + ' of 5'"
              [attr.aria-pressed]="mine() === n" [disabled]="state() === 'loading' || state() === 'saving'"
              (mouseenter)="onHover(n)" (focus)="onHover(n)" (blur)="hover.set(0)" (click)="pick(n)">
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path [attr.d]="star" /></svg>
            </button>
          }
        </div>
        @if (state() === 'anonymous') {
          <button type="button" class="sd-btn sd-btn--sm signin" (click)="signIn()">Sign in to rate</button>
        } @else if (state() === 'rated') {
          <p class="sd-hint">tap the same star to remove</p>
        }
      }
      @if (error(); as e) {
        <p class="sd-hint sd-hint--error" role="alert">Couldn't save: {{ e }}</p>
      }
    </section>
  `,
  styles: [`
    :host { display: block; padding: var(--s4); }
    .agg { margin-bottom: var(--s3); color: var(--ink-2); }
    .avg { font-size: 18px; color: var(--ink); }
    .sk { display: inline-block; width: 140px; }
    .mine { margin-top: var(--s5); padding-top: var(--s4); border-top: 1px solid var(--line); }
    .note { color: var(--ink-2); }
    .stars { display: flex; gap: 2px; margin: var(--s2) 0; }
    .stars.busy { opacity: .6; }
    .star { display: grid; place-items: center; width: max(32px, var(--touch)); height: max(32px, var(--touch));
      padding: 0; border: 0; background: none; cursor: pointer; }
    .star:disabled { cursor: default; }
    path { fill: none; stroke: var(--ink-3); stroke-width: 1.5; stroke-linejoin: round; }
    .star.on path { fill: var(--ink); stroke: var(--ink); }
    .star.preview path { fill: var(--accent); stroke: var(--ink); }
    .idle path { stroke: var(--ink-3); fill: none; }
    .star.slam svg { animation: sd-slam var(--dur-slow) var(--ease-slam); }
    @keyframes sd-slam { from { transform: scale(1.35); } to { transform: none; } }
    .signin { margin-top: var(--s1); }
    @media (prefers-reduced-motion: reduce) { .star.slam svg { animation-duration: .01ms; } }
  `],
})
export class SdRatingComponent {
  private readonly auth = inject(AuthService);
  private readonly kennels = inject(KennelService);

  /** lineageId (or version GUID) of the kennel. */
  readonly kennelId = input.required<string>();
  readonly ownerId = input<string | null | undefined>(null);
  /** CSV of editor ids — only owners and editors see it, which is exactly who may not rate. */
  readonly editors = input<string | null | undefined>(null);
  readonly initial = input<IRatingView | null>(null);
  readonly changed = output<IRatingView>();

  readonly five = [1, 2, 3, 4, 5];
  readonly star = STAR;
  readonly view = signal<IRatingView | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly hover = signal(0);
  readonly slammed = signal(0);
  /** The server said 401 although the app thinks it is signed in. */
  private readonly sessionLost = signal(false);

  readonly mine = computed(() => this.view()?.mine ?? null);
  readonly avg = computed(() => (this.view()?.avg ?? 0).toFixed(1));
  readonly isOwn = computed(() => {
    const me = this.auth.user()?.id;
    if (!me) return false;
    if (this.ownerId() === me) return true;
    return (this.editors() ?? '').split(',').map((s) => s.trim()).includes(me);
  });
  readonly state = computed<RatingState>(() => {
    if (this.loading()) return 'loading';
    if (!this.auth.user() || this.sessionLost()) return 'anonymous';
    if (this.isOwn()) return 'readonly-owner';
    if (this.saving()) return 'saving';
    return this.mine() === null ? 'unrated' : 'rated';
  });
  /** Filled stars: the hover preview while pointing, otherwise your own rating. */
  readonly shown = computed(() => this.hover() || this.mine() || 0);

  private request: Subscription | null = null;

  constructor() {
    effect(() => {
      const id = this.kennelId();
      const seed = this.initial();
      untracked(() => this.load(id, seed));
    }, { allowSignalWrites: true });
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  onHover(n: number): void {
    const s = this.state();
    if (s === 'unrated' || s === 'rated') this.hover.set(n);
  }

  pick(n: number): void {
    const s = this.state();
    if (s === 'anonymous') {
      this.signIn();
      return;
    }
    if (s !== 'unrated' && s !== 'rated') return;
    const remove = this.mine() === n;
    this.saving.set(true);
    this.error.set(null);
    this.hover.set(0);
    const call = remove ? this.kennels.deleteRating(this.kennelId()) : this.kennels.setRating(this.kennelId(), n);
    this.request?.unsubscribe();
    this.request = call.subscribe({
      next: (v) => {
        this.saving.set(false);
        this.view.set(v);
        this.slammed.set(remove ? 0 : n);
        this.changed.emit(v);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        if (err.status === 401) {
          this.sessionLost.set(true);
          return;
        }
        this.error.set(err.error?.error_description ?? err.error?.error ?? `HTTP ${err.status}`);
      },
    });
  }

  signIn(): void {
    this.auth.login(window.location.pathname + '?panel=rating');
  }

  private load(id: string, seed: IRatingView | null): void {
    this.error.set(null);
    if (seed) {
      this.view.set(seed);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.request?.unsubscribe();
    this.request = this.kennels.getRating(id).subscribe({
      next: (v) => {
        this.view.set(v);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(err.error?.error_description ?? err.error?.error ?? `HTTP ${err.status}`);
      },
    });
  }
}
