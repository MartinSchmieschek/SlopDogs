import { Component, Input } from '@angular/core';

export type DogDisplayVariant = 'toolbar' | 'panel' | 'compact' | 'list' | 'stacked' | 'graphVis';

@Component({
  selector: 'app-dog-display',
  standalone: true,
  template: `
    <span
      class="dog-display"
      [attr.data-variant]="variant"
      [class.toolbar]="variant === 'toolbar'"
      [class.panel]="variant === 'panel'"
      [class.compact]="variant === 'compact'"
      [class.list]="variant === 'list'"
      [class.stacked]="variant === 'stacked'"
      [class.graphVis]="variant === 'graphVis'"
    >
      @if (icon?.trim()) {
        <span class="glyph" aria-hidden="true">{{ icon }}</span>
      }
      <span class="label">{{ label }}</span>
    </span>
  `,
  styles: [`
    .dog-display {
      display: inline-flex;
      align-items: center;
      gap: 0.35em;
      min-width: 0;
    }
    .glyph {
      flex-shrink: 0;
      line-height: 1;
      font-size: 1.1em;
    }
    .label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .panel .glyph { font-size: 1.25em; }
    .panel .label { font-size: 1rem; font-weight: 700; }
    .toolbar .label { font-size: inherit; }
    .list .label { font-size: 12px; }
    .stacked {
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 0.25rem;
    }
    .stacked .glyph {
      font-size: 1.85rem;
      line-height: 1;
    }
    .stacked .label {
      font-size: 12px;
      font-weight: 700;
      color: var(--ink);
      white-space: normal;
      line-height: 1.2;
      max-width: 12rem;
    }
    /* Kompakte Graph-Knoten */
    .graphVis {
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 0.12rem;
    }
    .graphVis .glyph {
      font-size: 1.1rem;
      line-height: 1;
    }
    .graphVis .label {
      font-size: 10.5px;
      font-weight: 400;
      color: inherit;
      white-space: normal;
      line-height: 1.2;
      max-width: 5.5rem;
    }
  `]
})
export class DogDisplayComponent {
  @Input({ required: true }) label!: string;
  @Input() icon?: string;
  @Input() variant: DogDisplayVariant = 'toolbar';
}
