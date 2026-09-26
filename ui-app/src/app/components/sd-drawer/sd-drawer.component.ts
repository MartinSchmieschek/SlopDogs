import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { escapeLayerWhile } from '../../utils/escape-layers';

export type SdSheetSnap = 'peek' | 'half' | 'full';

const SNAPS: readonly SdSheetSnap[] = ['peek', 'half', 'full'];
const PEEK_PX = 96;

/**
 * Drawer and sheet shell (6.5 `sd-drawer`): on desktop a drawer on the right (inspector, 420) or the left
 * (palette, 360) with the hard shadow and an ink head; from 1440 it docks without a scrim. Below 768 it is
 * a bottom sheet with a 40x4 grip and three snap heights — peek 96 px, half 50 %, full 100 % — set by
 * dragging the grip or by tapping it. Content: `[drawer-head]` (the ink head), `[drawer-tabs]`, body.
 */
@Component({
  selector: 'sd-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-open]': 'open()',
    '[class.left]': 'side() === "left"',
    '[attr.data-snap]': 'open() ? snap() : null',
  },
  template: `
    @if (open()) {
      @if (snap() !== 'peek') {
        <div class="scrim" (click)="requestClose()" aria-hidden="true"></div>
      }
      <aside class="panel" role="dialog" [attr.aria-label]="label()"
        [style.width.px]="width()" [style.--sheet-h]="sheetHeight()" [class.dragging]="dragPx() !== null">
        <button type="button" class="grip" [attr.aria-label]="'Sheet height: ' + snap() + '. Tap to change.'"
          (click)="cycle()" (pointerdown)="dragStart($event)"><span aria-hidden="true"></span></button>
        <header class="head">
          <div class="head-main"><ng-content select="[drawer-head]" /></div>
          <button type="button" class="x" aria-label="Close" (click)="requestClose()">×</button>
        </header>
        <ng-content select="[drawer-tabs]" />
        <div class="body"><ng-content /></div>
      </aside>
    }
  `,
  styles: [`
    :host { display: contents; }
    .scrim { position: fixed; inset: 0; z-index: var(--z-drawer); background: var(--scrim); animation: sd-fade var(--dur-base) var(--ease-out); }
    .panel { position: fixed; top: 0; right: 0; bottom: 0; z-index: calc(var(--z-drawer) + 1); max-width: 100vw;
      display: flex; flex-direction: column; background: var(--paper-2); border-left: 2px solid var(--ink);
      box-shadow: -4px 4px 0 var(--ink); animation: dr-in var(--dur-base) var(--ease-out); --dr-from: translateX(24px); }
    :host(.left) .panel { right: auto; left: 0; border-left: 0; border-right: 2px solid var(--ink); box-shadow: 4px 4px 0 var(--ink);
      --dr-from: translateX(-24px); }
    @keyframes dr-in { from { opacity: 0; transform: var(--dr-from); } }
    .grip { display: none; }
    .head { display: flex; align-items: flex-start; gap: var(--s2); padding: var(--s3) var(--s3) var(--s3) var(--s4);
      background: var(--ink); color: var(--paper); }
    .head-main { flex: 1; min-width: 0; }
    .x { flex: none; width: 36px; height: 36px; border: 1px solid var(--ink-soft); background: none; color: var(--paper);
      font: 20px/1 var(--font-mono); cursor: pointer; }
    .body { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; }
    @media (min-width: 1440px) { .scrim { display: none; } }
    @media (max-width: 767px) {
      .panel, :host(.left) .panel { top: auto; left: 0; right: 0; width: auto !important; height: var(--sheet-h);
        border: 0; border-top: 2px solid var(--ink); box-shadow: 0 -4px 0 var(--ink);
        transition: height var(--dur-base) var(--ease-out); --dr-from: translateY(48px); }
      .panel.dragging { transition: none; }
      .grip { display: flex; justify-content: center; align-items: center; flex: none; height: 24px; border: 0;
        background: var(--paper-2); cursor: grab; touch-action: none; }
      .grip span { width: 40px; height: 4px; background: var(--ink); }
      :host([data-snap='peek']) .body { overflow: hidden; }
    }
    @media (prefers-reduced-motion: reduce) { .panel, .scrim { transition-duration: .01ms; animation-duration: .01ms; } }
  `],
})
export class SdDrawerComponent {
  readonly open = input(false);
  readonly side = input<'right' | 'left'>('right');
  readonly width = input(420);
  /** Accessible name of the dialog. */
  readonly label = input('');
  /** The sheet height a fresh open starts with (mobile). */
  readonly initialSnap = input<SdSheetSnap>('half');
  readonly closed = output<void>();

  readonly snap = signal<SdSheetSnap>('half');
  /** Height in px while the grip is dragged; null otherwise. */
  readonly dragPx = signal<number | null>(null);
  readonly sheetHeight = computed(() => {
    const px = this.dragPx();
    if (px !== null) return `${px}px`;
    const s = this.snap();
    return s === 'peek' ? `${PEEK_PX}px` : s === 'half' ? '50dvh' : '100dvh';
  });

  private dragFrom: { y: number; h: number } | null = null;

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.snap.set(this.initialSnap()));
    }, { allowSignalWrites: true });
    // Open drawers are escape layers: Esc closes only the topmost one (6.3).
    escapeLayerWhile(() => this.open(), () => this.closed.emit());
  }

  /** A tab that needs room (access, code) asks for the full sheet on a phone; the desktop drawer ignores it. */
  expandOnPhone(): void {
    if (typeof matchMedia === 'function' && matchMedia('(max-width: 767px)').matches) this.snap.set('full');
  }

  requestClose(): void {
    this.closed.emit();
  }

  /** Tap on the grip: peek -> half -> full -> peek. */
  cycle(): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.snap.update((s) => SNAPS[(SNAPS.indexOf(s) + 1) % SNAPS.length]);
  }

  setSnap(s: SdSheetSnap): void {
    this.snap.set(s);
  }

  private suppressClick = false;

  dragStart(e: PointerEvent): void {
    const panel = (e.currentTarget as HTMLElement).parentElement;
    if (!panel) return;
    this.dragFrom = { y: e.clientY, h: panel.getBoundingClientRect().height };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) => {
      if (!this.dragFrom) return;
      const dy = this.dragFrom.y - ev.clientY;
      if (Math.abs(dy) > 4) this.suppressClick = true;
      this.dragPx.set(Math.max(PEEK_PX, Math.min(window.innerHeight, this.dragFrom.h + dy)));
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      const px = this.dragPx();
      this.dragFrom = null;
      this.dragPx.set(null);
      if (px === null) return;
      const vh = window.innerHeight;
      const targets: Array<[SdSheetSnap, number]> = [['peek', PEEK_PX], ['half', vh / 2], ['full', vh]];
      targets.sort((a, b) => Math.abs(a[1] - px) - Math.abs(b[1] - px));
      this.snap.set(targets[0][0]);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  }

}
