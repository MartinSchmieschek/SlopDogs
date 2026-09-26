import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { IUserKey } from '../../models/user-key.model';
import { grantsLabel, usedLabel } from '../../utils/user-keys';

/**
 * One key as a tracklist row (6.4 S9, 6.5 `sd-key-row`): `01 openweather ••••3f2c api.openweathermap.org`,
 * second line `used 2 h ago · no grants`, `×` asks first: `Delete openweather? Dogs using
 * {{key:openweather}} will fail.` The value itself is never on the page — only its last four.
 */
@Component({
  selector: 'sd-key-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row" role="listitem" [class.busy]="busy()">
      <span class="n">{{ number() }}</span>
      <span class="main">
        <span class="l1"><span class="al">{{ key().alias }}</span> <span class="sd-data mask">••••{{ key().last4 }}</span>
          <span class="sd-data dom">{{ key().allowedDomains.join(', ') }}</span></span>
        <span class="sd-small sd-muted l2">{{ used() }} · {{ grants() }}</span>
      </span>
      <button type="button" class="sd-btn sd-btn--icon sd-btn--bare" [attr.aria-label]="'Delete ' + key().alias"
        [disabled]="busy()" (click)="asking.set(true)">×</button>
      @if (asking()) {
        <p class="ask sd-small" role="alertdialog" [attr.aria-label]="'Delete ' + key().alias">
          <span>Delete {{ key().alias }}? Dogs using {{ ref() }} will fail.</span>
          <button type="button" class="sd-btn sd-btn--sm sd-btn--danger" [disabled]="busy()" (click)="asking.set(false); remove.emit(key())">Delete</button>
          <button type="button" class="sd-btn sd-btn--sm sd-btn--bare" (click)="asking.set(false)">Keep</button>
        </p>
      }
    </div>
  `,
  styles: [`
    .row { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; align-items: center; min-height: 56px;
      padding: var(--s1) 0; border-bottom: 1px solid var(--line); }
    .row.busy { opacity: .6; }
    .n { font: 400 20px/1 var(--font-display); color: var(--ink-3); }
    .main { min-width: 0; }
    .l1, .l2 { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .al { font-weight: 700; }
    .mask, .dom { color: var(--ink-2); margin-left: var(--s2); }
    .ask { grid-column: 2 / -1; display: flex; align-items: center; flex-wrap: wrap; gap: var(--s2); margin: var(--s1) 0; }
  `],
})
export class SdKeyRowComponent {
  readonly key = input.required<IUserKey>();
  readonly index = input(0);
  readonly busy = input(false);
  readonly remove = output<IUserKey>();

  readonly asking = signal(false);
  readonly number = computed(() => String(this.index() + 1).padStart(2, '0'));
  readonly used = computed(() => usedLabel(this.key().lastUsedAt));
  readonly grants = computed(() => grantsLabel(this.key()));
  readonly ref = computed(() => `{{key:${this.key().alias}}}`);
}
