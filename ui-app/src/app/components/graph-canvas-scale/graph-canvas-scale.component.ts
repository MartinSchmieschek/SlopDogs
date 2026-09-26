import { Component, Input } from '@angular/core';

/**
 * „Neuer Canvas“: skaliert den eingebetteten Graph (z. B. vis-network) auf 50 %,
 * mit doppeltem Layout-Raum (200 % × 200 %) und transform-origin top-left —
 * wirkt wie mehr Luft zwischen den Knoten, ohne das Layout neu zu rechnen.
 */
@Component({
  selector: 'app-graph-canvas-scale',
  standalone: true,
  template: `
    <div class="gcs-outer">
      <div
        class="gcs-inner"
        [style.width.%]="innerPercent"
        [style.height.%]="innerPercent"
        [style.transform]="innerTransform">
        <ng-content />
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      flex: 1;
      min-height: 0;
      min-width: 0;
      height: 100%;
    }
    .gcs-outer {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .gcs-inner {
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
    }
  `],
})
export class GraphCanvasScaleComponent {
  /** 0.5 = 50 % visuelle Größe, Layout-Raum 1/scale. */
  @Input() scale = 0.5;

  get innerPercent(): number {
    const s = this.scale > 0 ? this.scale : 0.5;
    return 100 / s;
  }

  get innerTransform(): string {
    const s = this.scale > 0 ? this.scale : 0.5;
    return `scale(${s})`;
  }
}
