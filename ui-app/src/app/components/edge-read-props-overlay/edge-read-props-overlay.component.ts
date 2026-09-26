import { Component, Input } from '@angular/core';
import { DogReadPropsDisplayComponent } from '../dog-read-props-display/dog-read-props-display.component';

/**
 * Read tracking: one block per data direction (left incoming, right outgoing).
 */
@Component({
  selector: 'app-edge-read-props-overlay',
  standalone: true,
  imports: [DogReadPropsDisplayComponent],
  template: `
    <div class="edge-read-root" [class.edge-read-root--edge]="variant === 'edge'">
      <div class="edge-read-label">{{ title }}</div>
      <app-dog-read-props-display [paths]="paths" [plain]="variant === 'edge'" />
    </div>
  `,
  styleUrls: ['./edge-read-props-overlay.component.scss'],
})
export class EdgeReadPropsOverlayComponent {
  @Input({ required: true }) title!: string;
  @Input() paths: string[] = [];
  /** `edge`: no box, full width — inside the edge read-tracking panel. */
  @Input() variant: 'card' | 'edge' = 'card';
}
