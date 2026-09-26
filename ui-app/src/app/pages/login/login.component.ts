import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { BetaService } from '../../services/beta.service';
import { pickRandomRequiemQuote } from '../../data/requiem-loading';
import { safeReturnTo } from '../../utils/account';

/**
 * S10 Login (P6 U7, 6.4): centred emblem and `SLOPDOGS` in Bebas 28, one quiet 44 px button
 * `[CONTINUE WITH GOOGLE]`, one random verse (small italic, its name as a teal label). `?returnTo=`
 * takes you back after Google — only to a path on this site. Already signed in: straight there. Closed beta
 * (SLOPDOGS_STAGE=beta, sign-in on): a beta-key field above the button; the key rides to Google and back once.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      <section class="card">
        <p class="mark">
          <svg viewBox="0 0 28 28" width="40" height="40" aria-hidden="true">
            <circle cx="14" cy="14" r="14" fill="var(--ink)" />
            <text x="14" y="19.5" text-anchor="middle" font-family="Pirata One, serif" font-size="16" fill="var(--paper)">SD</text>
          </svg>
          <span class="word">SlopDogs</span>
        </p>
        <h1 class="sd-sr-only">Sign in</h1>
        <p class="sd-small sd-muted lead">Sign in to build kennels, rate them and keep your keys.</p>
        @if (beta.status()?.keysRequired) {
          <label class="key">
            <span class="sd-label">Beta key <span class="sd-muted">· first sign-in only</span></span>
            <input class="sd-field sd-field--code" autocomplete="off" autocapitalize="off" spellcheck="false"
              placeholder="sdbeta_…" [value]="betaKey()" (input)="betaKey.set($any($event.target).value)"
              (keydown.enter)="continue()" />
            <span class="sd-small sd-muted">Closed beta: one key unlocks one Google account, once.</span>
          </label>
        }
        <button type="button" class="sd-btn sd-btn--lg go" [disabled]="!auth.isReady()" (click)="continue()">Continue with Google</button>
        <figure class="verse">
          <blockquote class="sd-small">{{ verse.line1 }}<br />{{ verse.line2 }}</blockquote>
          <figcaption><span class="sd-chip sd-chip--live">{{ verse.name }}</span></figcaption>
        </figure>
        <a class="back sd-small" routerLink="/kennels">‹ back to the kennels</a>
      </section>
    </main>
  `,
  styles: [`
    :host { display: block; min-height: 100dvh; background: var(--paper); }
    .wrap { display: grid; place-items: center; min-height: 100dvh; padding: var(--s5) var(--gutter); }
    .card { display: flex; flex-direction: column; align-items: center; gap: var(--s4); width: min(400px, 100%); text-align: center; }
    .mark { display: flex; align-items: center; gap: var(--s3); margin: 0; }
    .word { font: 400 28px/1 var(--font-display); letter-spacing: .03em; text-transform: uppercase; padding-top: 3px; }
    .lead { margin: 0; }
    .go { width: 100%; }
    .key { display: flex; flex-direction: column; gap: var(--s1); width: 100%; text-align: left; }
    .key input { width: 100%; box-sizing: border-box; font-size: 16px; }
    .verse { margin: var(--s3) 0 0; display: flex; flex-direction: column; align-items: center; gap: var(--s2); }
    blockquote { margin: 0; font-style: italic; color: var(--ink-2); }
    .back { color: var(--ink-2); text-decoration: none; border-bottom: 1px solid var(--line-strong); }
  `],
})
export class LoginComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  /** Where Google sends you back to: a same-site path from `?returnTo=`, else the kennels. */
  readonly target = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((q) => safeReturnTo(q.get('returnTo')))),
    { initialValue: '/kennels' },
  );

  readonly verse = pickRandomRequiemQuote();
  /** Closed beta (SLOPDOGS_STAGE=beta, sign-in on): the key field shows; an unlocked account needs none. */
  readonly beta = inject(BetaService);
  readonly betaKey = signal('');

  constructor() {
    void this.beta.load();
    effect(() => {
      if (!this.auth.isReady() || !this.auth.user()) return;
      const to = this.target();
      untracked(() => void this.router.navigateByUrl(to, { replaceUrl: true }));
    });
  }

  continue(): void {
    this.auth.login(this.target(), this.betaKey());
  }
}
