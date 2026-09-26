import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** One band of the silhouette canvas: the wave's chip label and its cards (status only). */
interface SilhouetteBand {
  label: string;
  order: number;
  cards: Array<{ key: string; failed: boolean }>;
}

/**
 * The ruled-inlay canvas, silhouette variant (6.5 `sd-wave-canvas`; 8.22; W17 stage 1): a run-only kennel
 * shows its waves as bands on the dot grid with ink silhouettes at 35 % — no names, no icons, nothing the
 * server did not send (`kennelRunView`: dog counts per wave and a status per dog). The latest wave is on
 * top, like the full graph (vis-network), which carries the same bands for readable kennels.
 */
@Component({
  selector: 'sd-wave-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="c" role="img" [attr.aria-label]="summary()">
      @for (band of bands(); track band.label) {
        <div class="band" [class.alt]="band.order % 2 === 1" [style.--d]="band.order * 40 + 'ms'">
          <span class="sd-chip chip">{{ band.label }}</span>
          <div class="cards">
            @for (card of band.cards; track card.key) {
              <span class="sil" [class.failed]="card.failed"></span>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; overflow: auto; }
    .c { min-height: 100%; padding: var(--s5) 0; background-color: var(--paper);
      background-image: radial-gradient(var(--grid) 1px, transparent 1.2px); background-size: 24px 24px; }
    .band { position: relative; display: flex; align-items: center; min-height: 112px; padding: var(--s4) var(--s4) var(--s4) 104px;
      border-top: 1px dashed var(--line-strong); animation: sd-band var(--dur-base) var(--ease-out) both; animation-delay: var(--d); }
    .band:first-child { border-top: 0; }
    .band.alt { background: color-mix(in srgb, var(--paper-2) 70%, transparent); }
    .chip { position: absolute; left: var(--s2); top: 50%; transform: translateY(-50%); }
    .cards { flex: 1; display: flex; flex-wrap: wrap; justify-content: center; gap: var(--s4); }
    .sil { width: 128px; height: 56px; background: var(--ink); opacity: .35; }
    .sil.failed { opacity: .55; outline: 2px solid var(--danger-ink); outline-offset: 2px; }
    @keyframes sd-band { from { opacity: 0; transform: translateY(4px); } }
    @media (max-width: 767px) {
      .band { padding-left: var(--s3); padding-top: 40px; }
      .chip { top: var(--s2); transform: none; }
      .sil { width: 96px; height: 44px; }
    }
    @media (prefers-reduced-motion: reduce) { .band { animation-duration: .01ms; animation-delay: 0ms; } }
  `],
})
export class SdWaveCanvasComponent {
  /** Dogs per wave, in run order (wave 01 first). */
  readonly waves = input<Array<{ dogCount: number }>>([]);
  /** One status per dog, flat in run order; missing = not run yet. */
  readonly statuses = input<Array<{ status: 'ok' | 'failed' }> | null>(null);

  readonly bands = computed<SilhouetteBand[]>(() => {
    const waves = this.waves();
    const statuses = this.statuses() ?? [];
    let flat = 0;
    const bands = waves.map((w, i) => {
      const cards = Array.from({ length: Math.max(0, w.dogCount) }, (_, j) => ({
        key: `${i}-${j}`,
        failed: statuses[flat + j]?.status === 'failed',
      }));
      flat += Math.max(0, w.dogCount);
      return { label: `wave ${String(i + 1).padStart(2, '0')}`, order: 0, cards };
    });
    return bands.reverse().map((b, order) => ({ ...b, order }));
  });

  readonly summary = computed(() => {
    const w = this.waves();
    const dogs = w.reduce((n, x) => n + x.dogCount, 0);
    return `${dogs} dog${dogs === 1 ? '' : 's'} in ${w.length} wave${w.length === 1 ? '' : 's'}, code hidden`;
  });
}
