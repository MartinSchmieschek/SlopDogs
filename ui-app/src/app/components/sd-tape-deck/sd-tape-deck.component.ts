import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * The tape deck: a cassette window with two reels that turn while something runs (6.5 `sd-tape-deck`).
 * 96 px on the veil, 16 px as the reel dot in a status chip. With `iris` on, the hub of the left reel
 * is a button — the easter egg of 8.18: no visible affordance, 44 px hit area, `aria-label="void"`.
 */
@Component({
  selector: 'sd-tape-deck',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 96 56" [attr.width]="size()" [attr.height]="size() * 56 / 96" aria-hidden="true"
      [class.spin]="spinning()">
      <rect x="1" y="1" width="94" height="54" fill="var(--paper-2)" stroke="var(--ink)" stroke-width="2" />
      <rect x="14" y="10" width="68" height="36" fill="none" stroke="var(--ink)" stroke-width="1" />
      <path d="M30 44 L66 44" stroke="var(--ink)" stroke-width="1" />
      <g class="reel"><circle cx="30" cy="28" r="14" fill="var(--paper)" stroke="var(--ink)" stroke-width="2" />
        <path d="M30 17v6M20.5 33.5l5.2-3M39.5 33.5l-5.2-3" stroke="var(--ink)" stroke-width="2" /></g>
      <g class="reel"><circle cx="66" cy="28" r="14" fill="var(--paper)" stroke="var(--ink)" stroke-width="2" />
        <path d="M66 17v6M56.5 33.5l5.2-3M75.5 33.5l-5.2-3" stroke="var(--ink)" stroke-width="2" />
        <circle cx="66" cy="28" r="4" fill="var(--ink)" /></g>
      @if (!iris()) {
        <circle cx="30" cy="28" r="4" fill="var(--ink)" />
      }
    </svg>
    @if (iris()) {
      <button type="button" class="iris" aria-label="void" (click)="onIris($event)"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="6" fill="var(--ink)" /></svg></button>
    }
  `,
  styles: [`
    :host { position: relative; display: inline-block; line-height: 0; }
    .reel { transform-box: fill-box; transform-origin: center; }
    .spin .reel { animation: sd-reel 3s linear infinite; }
    @keyframes sd-reel { to { transform: rotate(360deg); } }
    .iris { position: absolute; left: 31.25%; top: 50%; width: 44px; height: 44px; margin: -22px 0 0 -22px;
      padding: 0; border: 0; background: none; cursor: pointer; display: grid; place-items: center; }
    @media (prefers-reduced-motion: reduce) { .spin .reel { animation: none; } }
  `],
})
export class SdTapeDeckComponent {
  readonly size = input(96);
  readonly spinning = input(true);
  /** The left hub becomes the void button. */
  readonly iris = input(false);
  readonly irisClick = output<void>();

  onIris(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.irisClick.emit();
  }
}
