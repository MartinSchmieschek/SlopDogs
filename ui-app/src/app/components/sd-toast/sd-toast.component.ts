import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';

/**
 * The toast (6.5 `sd-toast`, U8): one line of ink with paper text for 4 s, bottom centre, above the
 * bottom bar on a phone; `with-link` adds one underlined link. Lives once in the app shell; pages call
 * `ToastService.show()`. The live region stays in the DOM so screen readers hear every new line.
 */
@Component({
  selector: 'sd-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="live" role="status" aria-live="polite">
      @if (toast.message(); as m) {
        @for (x of [m]; track x.id) {
          <p class="t sd-rise">{{ x.text }}@if (x.link; as l) { <a [href]="l.href">{{ l.label }}</a> }</p>
        }
      }
    </div>
  `,
  styles: [`
    .live { position: fixed; left: 50%; bottom: var(--s5); z-index: var(--z-toast); transform: translateX(-50%);
      width: max-content; max-width: calc(100vw - 32px); pointer-events: none; }
    .t { padding: var(--s2) var(--s4); background: var(--ink); color: var(--paper); border: 2px solid var(--paper);
      outline: 2px solid var(--ink); box-shadow: 4px 4px 0 var(--ink); pointer-events: auto; }
    a { margin-left: var(--s3); color: var(--paper); text-decoration-color: var(--ink-soft); }
    @media (max-width: 767px) { .live { bottom: calc(60px + var(--s4) + env(safe-area-inset-bottom)); } }
  `],
})
export class SdToastComponent {
  readonly toast = inject(ToastService);
}
