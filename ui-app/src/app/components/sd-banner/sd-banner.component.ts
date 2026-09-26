import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';

/**
 * Banner (6.5 `sd-banner`): one line with a 2 px line on the left. For `danger` the text is the
 * cinema trigger (8.18): a click opens the void cinema with the error video. Actions are projected.
 */
@Component({
  selector: 'sd-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="b" [class.danger]="tone() === 'danger'" [attr.role]="tone() === 'danger' ? 'alert' : 'status'">
      @if (tone() === 'danger') {
        <span class="t comfort-error-trigger" role="button" tabindex="0" title="Distant signal"
          (click)="openCinema()" (keydown.enter)="openCinema()"
          (keydown.space)="$event.preventDefault(); openCinema()">{{ text() }}</span>
      } @else {
        <span class="t">{{ text() }}</span>
      }
      <span class="a"><ng-content /></span>
    </div>
  `,
  styles: [`
    .b { display: flex; align-items: center; justify-content: space-between; gap: var(--s3); flex-wrap: wrap;
      padding: var(--s2) var(--s3); border-left: 2px solid var(--ink-2); background: var(--paper-2); }
    .danger { border-left-color: var(--danger-ink); background: var(--danger-soft); }
    .t { min-width: 0; overflow-wrap: anywhere; }
    .a { display: flex; gap: var(--s2); }
  `],
})
export class SdBannerComponent {
  private readonly cinema = inject(ErrorVideoPopupService);

  readonly text = input.required<string>();
  readonly tone = input<'danger' | 'warn' | 'info'>('danger');

  openCinema(): void {
    this.cinema.openPopup(this.text());
  }
}
