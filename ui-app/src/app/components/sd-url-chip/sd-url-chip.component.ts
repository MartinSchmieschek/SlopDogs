import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';

/**
 * URL chip (6.5 `sd-url-chip`, variant command box): the landing's `.cmd` turned down to 1 px —
 * ink box, paper mono text, `⧉` copies. Without clipboard access the text stays selectable.
 */
@Component({
  selector: 'sd-url-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cmd">
      <code>{{ text() }}</code>
      <button type="button" class="cp" (click)="copy()" [attr.aria-label]="copied() ? 'Copied' : 'Copy'">
        {{ copied() ? 'copied' : '⧉' }}</button>
    </div>
  `,
  styles: [`
    .cmd { display: flex; align-items: center; gap: var(--s3); max-width: 100%; padding: var(--s2) var(--s2) var(--s2) var(--s3);
      background: var(--ink); color: var(--paper); border: 1px solid var(--ink); }
    code { flex: 1; min-width: 0; overflow-wrap: anywhere; font: 13px/19px var(--font-mono); user-select: all; }
    .cp { flex: none; min-width: 36px; min-height: 36px; border: 1px solid var(--ink-soft); background: none;
      color: var(--paper); cursor: pointer; font-size: 12px; }
  `],
})
export class SdUrlChipComponent {
  readonly text = input.required<string>();
  readonly copied = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timer && clearTimeout(this.timer));
  }

  copy(): void {
    const done = () => {
      this.copied.set(true);
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.copied.set(false), 2000);
    };
    navigator.clipboard?.writeText(this.text()).then(done, () => {});
  }
}
