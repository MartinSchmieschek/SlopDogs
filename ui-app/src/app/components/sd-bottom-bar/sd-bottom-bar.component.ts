import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SdTapeDeckComponent } from '../sd-tape-deck/sd-tape-deck.component';

/**
 * Mobile bottom bar (6.3, 6.5 `sd-bottom-bar`), below 768 px only. Variant `sides`: the two sides of the
 * cassette, `Kennels · Dogs` (S1 /kennels, S6 /dogs). Variant `kennel` (S2):
 * `Dogs · [⏵ RUN] · Inspect` — Dogs opens the palette (missing for readers, disabled while frozen), Run is
 * the one orange of the screen and turns into `● running` with a turning reel.
 */
@Component({
  selector: 'sd-bottom-bar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, SdTapeDeckComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="bar" [attr.aria-label]="variant() === 'kennel' ? 'Kennel' : 'Sides'">
      @if (variant() === 'sides') {
        <a class="tab" routerLink="/kennels" routerLinkActive="on">Kennels</a>
        <a class="tab" routerLink="/dogs" routerLinkActive="on">Dogs</a>
      } @else {
        @if (!dogsHidden()) {
          <button type="button" class="tab" [disabled]="!!dogsLock()" [attr.title]="dogsLock()"
            (click)="dogs.emit()">Dogs</button>
        } @else {
          <span class="tab gap" aria-hidden="true"></span>
        }
        @if (running()) {
          <span class="run live-run" role="status"><sd-tape-deck [size]="22" /> running</span>
        } @else {
          <button type="button" class="run sd-btn sd-btn--primary" (click)="run.emit()">⏵ Run</button>
        }
        <button type="button" class="tab" [disabled]="inspectHidden()" (click)="inspect.emit()">Inspect</button>
      }
    </nav>
  `,
  styles: [`
    :host { display: none; }
    @media (max-width: 767px) {
      :host { display: block; position: fixed; left: 0; right: 0; bottom: 0; z-index: var(--z-sticky); }
      .bar { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center;
        gap: var(--s2); height: 60px; padding: 0 var(--s3) env(safe-area-inset-bottom); background: var(--paper);
        border-top: 2px solid var(--ink); }
      .tab { min-width: 0; min-height: 44px; border: 0; background: none; color: var(--ink); text-decoration: none;
        font: 700 11px/14px var(--font-mono); letter-spacing: .16em; text-transform: uppercase;
        display: grid; place-items: center; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
        cursor: pointer; }
      .tab:disabled { color: var(--ink-3); cursor: not-allowed; }
      .tab.on { box-shadow: inset 0 -3px 0 var(--ink); }
      .run { min-width: 120px; min-height: 44px; }
      .live-run { display: inline-flex; align-items: center; justify-content: center; gap: var(--s2);
        background: var(--ink); color: var(--paper); font: 700 12px/14px var(--font-mono); letter-spacing: .16em;
        text-transform: uppercase; }
    }
  `],
})
export class SdBottomBarComponent {
  readonly variant = input<'sides' | 'kennel'>('kennel');
  readonly running = input(false);
  /** No palette for readers and run-only kennels. */
  readonly dogsHidden = input(false);
  /** Frozen: Dogs stays visible, disabled, with this title. */
  readonly dogsLock = input<string | null>(null);
  readonly inspectHidden = input(false);
  readonly dogs = output<void>();
  readonly run = output<void>();
  readonly inspect = output<void>();
}
