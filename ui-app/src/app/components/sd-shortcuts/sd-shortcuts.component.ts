import { ChangeDetectionStrategy, Component, ElementRef, HostListener, Injector, afterNextRender, inject, signal } from '@angular/core';
import { escapeLayerWhile } from '../../utils/escape-layers';
import { MODIFIER_LABEL as MOD, isTypingTarget } from '../../utils/keyboard';

/** The keys of the app (6.4 S2 editor rights; 6.3 `Esc` closes the top panel). */
const KEYS: ReadonlyArray<{ keys: string[]; what: string; where: string }> = [
  { keys: ['?'], what: 'This help', where: 'everywhere' },
  { keys: ['/'], what: 'Search', where: 'kennels, dogs' },
  { keys: ['Esc'], what: 'Close the top panel, menu or dialog', where: 'everywhere' },
  { keys: [MOD, 'Enter'], what: 'Run the kennel', where: 'kennel page' },
  { keys: [MOD, 'S'], what: 'Save — brief, settings or dog code, whichever is open', where: 'kennel page' },
];

/**
 * Keyboard help (U8): `?` outside a field opens a small dialog with every key the app knows; `Esc`
 * or `?` closes it. Lives once in the app shell. The page keys (run, save) live on the kennel page.
 */
@Component({
  selector: 'sd-shortcuts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="scrim sd-fade" (click)="open.set(false)" aria-hidden="true"></div>
      <div class="dlg sd-lift sd-rise" role="dialog" aria-modal="true" aria-labelledby="sd-keys-title">
        <p class="sd-kicker kick">keyboard</p>
        <p class="sd-h1" id="sd-keys-title">Shortcuts</p>
        <dl class="keys">
          @for (k of keys; track k.what) {
            <div class="row">
              <dt>@for (part of k.keys; track part; let last = $last) {<kbd>{{ part }}</kbd>@if (!last) {<span class="plus">+</span>}}</dt>
              <dd>{{ k.what }}<span class="sd-small where">{{ k.where }}</span></dd>
            </div>
          }
        </dl>
        <button type="button" class="sd-btn close" data-close (click)="open.set(false)">Close</button>
      </div>
    }
  `,
  styles: [`
    .scrim { position: fixed; inset: 0; z-index: var(--z-dialog); background: var(--scrim); }
    .dlg { position: fixed; top: 50%; left: 50%; z-index: calc(var(--z-dialog) + 1); translate: -50% -50%;
      width: min(520px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; padding: var(--s5);
      display: flex; flex-direction: column; gap: var(--s2); background: var(--paper-2); }
    .kick { color: var(--ink-2); }
    .keys { margin: var(--s2) 0 0; }
    .row { display: grid; grid-template-columns: 128px 1fr; gap: var(--s3); padding: var(--s2) 0; border-top: 1px solid var(--line); }
    dt { display: flex; align-items: center; flex-wrap: wrap; gap: var(--s1); }
    dd { margin: 0; display: flex; flex-direction: column; }
    kbd { min-width: 28px; padding: 2px 6px; background: var(--ink); color: var(--paper); font: 700 11px/14px var(--font-mono);
      letter-spacing: .08em; text-align: center; text-transform: uppercase; }
    .plus, .where { color: var(--ink-2); }
    .close { align-self: flex-end; margin-top: var(--s3); }
  `],
})
export class SdShortcutsComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly open = signal(false);
  readonly keys = KEYS;

  constructor() {
    escapeLayerWhile(() => this.open(), () => this.open.set(false));
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
    event.preventDefault();
    this.open.update((v) => !v);
    if (this.open()) {
      afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('[data-close]')?.focus(), { injector: this.injector });
    }
  }
}
