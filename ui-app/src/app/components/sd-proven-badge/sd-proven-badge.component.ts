import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * `proven` / `unproven` (6.5 `sd-proven-badge`): proven is the teal label (it ran, reliably, in real
 * kennels — "ok" in the colour rule), unproven the soft one. A server without stats renders nothing.
 */
@Component({
  selector: 'sd-proven-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (proven() === true) {
      <span class="sd-chip b ok" title="Proven: 5+ runs in 30 days, in a kennel, 80 % reliable">proven</span>
    } @else if (proven() === false) {
      <span class="sd-chip sd-chip--soft b" title="Not proven yet: too few runs, or not reliable">unproven</span>
    }
  `,
  // Below 12 px teal is a tint with teal ink, never paper on teal (DESIGN.md contrast table).
  styles: [`:host { display: inline-flex; } .b { min-height: 18px; padding: 1px 6px; font-size: 10px; }
    .ok { background: var(--live-soft); color: var(--live-ink); box-shadow: inset 0 0 0 1px var(--live); }`],
})
export class SdProvenBadgeComponent {
  /** null = no stats (old server): nothing. */
  readonly proven = input<boolean | null>(null);
}
