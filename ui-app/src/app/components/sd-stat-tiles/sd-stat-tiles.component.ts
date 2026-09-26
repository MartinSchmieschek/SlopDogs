import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface SdStatTile {
  label: string;
  /** Rendered as data; null shows `—` (missing, never a gap). */
  value: string | number | null;
  title?: string;
}

/**
 * Data tiles (6.5 `sd-stat-tiles`): four numbers with 1 px lines between them, 4-up on wide panels and
 * 2x2 in a 420 drawer. Label-maker labels, data in Courier tabular numbers, no boxes, no colour.
 */
@Component({
  selector: 'sd-stat-tiles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl class="g">
      @for (t of tiles(); track t.label) {
        <div class="t" [attr.title]="t.title || null">
          <dt class="sd-label">{{ t.label }}</dt>
          <dd>{{ t.value ?? '—' }}</dd>
        </div>
      }
    </dl>
  `,
  styles: [`
    :host { display: block; }
    .g { display: grid; grid-template-columns: repeat(2, 1fr); margin: 0; border-top: 1px solid var(--line); border-left: 1px solid var(--line); }
    .t { padding: var(--s3); border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); min-width: 0; }
    dd { margin: 0; font-size: 22px; line-height: 28px; font-variant-numeric: tabular-nums; }
    @media (min-width: 1024px) { :host(.wide) .g { grid-template-columns: repeat(4, 1fr); } }
  `],
})
export class SdStatTilesComponent {
  readonly tiles = input<SdStatTile[]>([]);
}
