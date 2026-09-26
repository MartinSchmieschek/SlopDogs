import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface SdSortOption<K extends string = string> {
  key: K;
  label: string;
}

/**
 * Sort chips (6.5 `sd-sort`, variant kennels): outline chips, the active one is ink (never orange),
 * `⇅` flips the direction, an optional `mine only` filter. On narrow screens the row wraps.
 */
@Component({
  selector: 'sd-sort',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row" role="group" aria-label="Sort">
      @for (o of options(); track o.key) {
        <button type="button" class="sd-chip sd-chip--outline" [attr.aria-pressed]="o.key === active()"
          (click)="keyChange.emit(o.key)">{{ o.label }}</button>
      }
      <button type="button" class="sd-chip sd-chip--outline dir" (click)="dirToggle.emit()"
        [attr.aria-label]="dir() === 'asc' ? 'Ascending. Switch to descending.' : 'Descending. Switch to ascending.'"
        [title]="dir() === 'asc' ? 'ascending' : 'descending'">⇅ {{ dir() }}</button>
      @if (showMine()) {
        <button type="button" class="sd-chip sd-chip--outline" [attr.aria-pressed]="mine()"
          (click)="mineToggle.emit()">{{ mine() ? '● mine only' : '○ mine only' }}</button>
      }
    </div>
  `,
  styles: [`
    .row { display: flex; flex-wrap: wrap; gap: var(--s2); align-items: center;
      padding: 2px 3px 4px 0; }
    .row > * { flex: none; }
    .dir { letter-spacing: .06em; }
  `],
})
export class SdSortComponent {
  readonly options = input.required<readonly SdSortOption[]>();
  readonly active = input.required<string>();
  readonly dir = input<'asc' | 'desc'>('asc');
  readonly showMine = input(false);
  readonly mine = input(false);
  readonly keyChange = output<string>();
  readonly dirToggle = output<void>();
  readonly mineToggle = output<void>();
}
