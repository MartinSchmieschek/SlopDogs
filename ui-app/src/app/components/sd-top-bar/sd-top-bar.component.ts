import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * Top bar (6.3, 6.5 `sd-top-bar`, variant list): SD emblem in Pirata One, the SLOPDOGS wordmark in Bebas,
 * the side links `side A · kennels`, `side B · dogs` (active = ink chip), then the projected search and
 * actions. The auth badge floats at the right edge (app shell), so the bar keeps room for it.
 */
@Component({
  selector: 'sd-top-bar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bar">
      <a class="mark" routerLink="/kennels" aria-label="SlopDogs, kennels">
        <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
          <circle cx="14" cy="14" r="14" fill="var(--ink)" />
          <text x="14" y="19.5" text-anchor="middle" font-family="Pirata One, serif" font-size="16"
            fill="var(--paper)">SD</text>
        </svg>
        <span class="word">SlopDogs</span>
      </a>
      <nav class="sides" aria-label="Sides">
        <a class="sd-chip sd-chip--soft side" routerLink="/kennels" routerLinkActive="is-on"
          [routerLinkActiveOptions]="{ exact: false }">side A · kennels</a>
        <a class="sd-chip sd-chip--soft side" routerLink="/dogs" routerLinkActive="is-on"
          [routerLinkActiveOptions]="{ exact: false }">side B · dogs</a>
      </nav>
      <div class="mid"><ng-content select="[bar-search]" /></div>
      <div class="end"><ng-content select="[bar-actions]" /></div>
    </header>
  `,
  styles: [`
    :host { display: block; position: sticky; top: 0; z-index: calc(var(--z-sticky) + 1); }
    .bar { display: flex; align-items: center; gap: var(--s3); height: var(--top-bar-h);
      padding: 0 136px 0 var(--gutter); background: var(--paper);
      border-bottom: 2px solid var(--ink); }
    .mark { display: inline-flex; align-items: center; gap: var(--s2); text-decoration: none; color: var(--ink); }
    .word { font-family: var(--font-display); font-size: 20px; line-height: 1; letter-spacing: .03em;
      text-transform: uppercase; padding-top: 2px; }
    .sides { display: flex; gap: var(--s2); }
    .side { text-decoration: none; }
    .side.is-on { background: var(--ink); color: var(--paper); }
    .mid { flex: 1; min-width: 0; display: flex; justify-content: center; }
    .end { display: flex; align-items: center; gap: var(--s2); }
    @media (max-width: 767px) {
      .sides { display: none; }
      .bar { gap: var(--s2); padding-right: 60px; }
    }
  `],
})
export class SdTopBarComponent {}
