import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { pickRandomRequiemQuote, type RequiemLoadingQuote } from '../../data/requiem-loading';
import { LastVoidTongueService } from '../../services/last-void-tongue.service';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';
import { SdTapeDeckComponent } from '../sd-tape-deck/sd-tape-deck.component';

/** Honest progress: a deterministic ease-out over 120 s that stops at 90 % and never claims "done". */
const PROGRESS_SPAN_S = 120;
const PROGRESS_CAP = 0.9;
const HINT_AFTER_S = 10;
const COLD_AFTER_S = 150;

/**
 * The veil (S11): nothing for the first seconds (the skeleton carries that), then paper at 92 %, the tape
 * deck with turning reels, a label with an honest timer, a 2 px ink progress line and one verse. The hub of
 * the left reel is the iris: it opens the void cinema with the loading video (8.18).
 */
@Component({
  selector: 'sd-veil',
  standalone: true,
  imports: [SdTapeDeckComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-visible]': 'visible()',
    '[class.is-fullscreen]': 'fullscreen()',
    '[attr.aria-hidden]': 'visible() ? null : "true"',
  },
  template: `
    @if (visible()) {
      <div class="veil" role="status" aria-live="polite" aria-busy="true">
        <sd-tape-deck [size]="96" [iris]="true" (irisClick)="openIris()" />
        <p class="head"><span class="lbl">{{ label() }}</span><span class="timer">{{ clock() }}</span></p>
        <div class="bar" aria-hidden="true"><span [style.width.%]="progress() * 100"></span></div>
        @if (cold()) {
          <p class="note">Still cold. Try again, or come back in a minute.</p>
          @if (retryable()) {
            <button type="button" class="sd-btn sd-btn--sm" (click)="retry.emit()">Retry</button>
          }
        } @else if (elapsed() >= hintAfter) {
          <p class="note">Cold starts take up to two minutes.</p>
        }
        <p class="verse">{{ quote.line1 }} {{ quote.line2 }} <span>{{ quote.name }}</span></p>
      </div>
    }
  `,
  styles: [`
    :host { display: block; position: absolute; inset: 0; z-index: 50; pointer-events: none; }
    :host(.is-visible) { pointer-events: auto; }
    :host(.is-fullscreen) { position: fixed; }
    .veil { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: var(--s3); padding: var(--s5); text-align: center;
      background: rgba(240, 230, 200, .92); }
    .head { display: flex; gap: var(--s3); align-items: baseline; }
    .lbl { font-size: 11px; line-height: 14px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
    .timer { font-size: 13px; color: var(--ink-2); font-variant-numeric: tabular-nums; }
    .bar { width: min(240px, 70vw); height: 2px; background: var(--line); }
    .bar span { display: block; height: 2px; background: var(--ink); transition: width 1s linear; }
    .note { font-size: 12px; line-height: 17px; color: var(--ink-2); }
    .verse { max-width: 34ch; font-size: 12px; line-height: 17px; font-style: italic; color: var(--ink-2); }
    .verse span { font-style: normal; color: var(--ink-3); }
    @media (prefers-reduced-motion: reduce) { .bar span { transition-duration: .01ms; } }
  `],
})
export class SdVeilComponent {
  private readonly cinema = inject(ErrorVideoPopupService);

  /** Before this, the veil shows nothing (6.4: cold start from 3 s). */
  readonly delayMs = input(3000);
  readonly label = input('Waking the kennel');
  /** Fixed over the viewport instead of the nearest positioned ancestor. */
  readonly fullscreen = input(false);
  /** Shows `[Retry]` once cold (>= 150 s); the owner decides what a retry is. */
  readonly retryable = input(false);
  readonly retry = output<void>();

  readonly quote: RequiemLoadingQuote = pickRandomRequiemQuote();
  readonly hintAfter = HINT_AFTER_S;

  private readonly startedAt = Date.now();
  private readonly now = signal(Date.now());
  private readonly reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  readonly elapsed = computed(() => Math.max(0, (this.now() - this.startedAt) / 1000));
  readonly visible = computed(() => this.elapsed() * 1000 >= this.delayMs());
  readonly cold = computed(() => this.elapsed() >= COLD_AFTER_S);
  readonly clock = computed(() => {
    const s = Math.floor(this.elapsed());
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
  readonly progress = computed(() => {
    const t = Math.min(this.elapsed(), PROGRESS_SPAN_S) / PROGRESS_SPAN_S;
    return PROGRESS_CAP * (this.reducedMotion ? t : 1 - Math.pow(1 - t, 3));
  });

  constructor() {
    inject(LastVoidTongueService).remember(this.quote);
    const timer = setInterval(() => this.now.set(Date.now()), 500);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  openIris(): void {
    this.cinema.openLoadingEasterEgg();
  }
}
