import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { escapeLayerWhile } from '../../utils/escape-layers';

/**
 * The dialog (6.5 `sd-confirm`, U8): paper with the one hard shadow, an H1 title, one message line,
 * optional projected content (a field), `[Cancel]` and the confirm button — quiet or danger, never a
 * red fill. `Esc` and the scrim cancel; while busy nothing closes. On open the focus goes to a
 * projected `[autofocus]` field, else to Cancel; on close it returns to where it came from.
 */
@Component({
  selector: 'sd-confirm',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="scrim sd-fade" (click)="cancel()" aria-hidden="true"></div>
      <div class="dlg sd-lift sd-rise" role="alertdialog" aria-modal="true" [attr.aria-label]="title()"
        [attr.aria-busy]="busy()" (keydown)="trap($event)">
        <p class="sd-h1">{{ title() }}</p>
        @if (message(); as m) { <p class="msg">{{ m }}</p> }
        <ng-content />
        <div class="acts">
          <button type="button" class="sd-btn" data-cancel [disabled]="busy()" (click)="cancel()">{{ cancelLabel() }}</button>
          <button type="button" class="sd-btn" [class.sd-btn--danger]="variant() === 'danger'"
            [class.sd-btn--primary]="variant() === 'primary'" [disabled]="busy() || confirmDisabled()"
            [attr.aria-busy]="busy()" (click)="confirmed.emit()">{{ busy() ? busyLabel() : confirmLabel() }}</button>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }
    .scrim { position: fixed; inset: 0; z-index: var(--z-dialog); background: var(--scrim); }
    .dlg { position: fixed; top: 50%; left: 50%; z-index: calc(var(--z-dialog) + 1); translate: -50% -50%;
      width: min(440px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; padding: var(--s5);
      display: flex; flex-direction: column; gap: var(--s3); background: var(--paper-2); }
    .msg { color: var(--ink-2); }
    .acts { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--s2); margin-top: var(--s2); }
  `],
})
export class SdConfirmComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly open = input(false);
  readonly title = input('Are you sure?');
  readonly message = input<string | null>(null);
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly busyLabel = input('Working…');
  /** quiet (default), primary (the one orange of a form dialog), danger (2 px danger ink). */
  readonly variant = input<'quiet' | 'primary' | 'danger'>('quiet');
  readonly busy = input(false);
  readonly confirmDisabled = input(false);

  readonly confirmed = output<void>();
  readonly dismissed = output<void>();

  private returnFocus: HTMLElement | null = null;

  constructor() {
    escapeLayerWhile(() => this.open(), () => this.cancel());
    effect(() => {
      if (this.open()) untracked(() => this.focusIn());
      else untracked(() => this.focusBack());
    });
  }

  cancel(): void {
    if (!this.busy()) this.dismissed.emit();
  }

  /** Tab stays inside the dialog. */
  trap(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const items = this.focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusIn(): void {
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const target = root.querySelector<HTMLElement>('[autofocus]') ?? root.querySelector<HTMLElement>('[data-cancel]');
      target?.focus();
    }, { injector: this.injector });
  }

  private focusBack(): void {
    const el = this.returnFocus;
    this.returnFocus = null;
    if (el?.isConnected) el.focus();
  }

  private focusables(): HTMLElement[] {
    const sel = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]';
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(sel));
  }
}
