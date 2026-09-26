import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The chapter card (6.5 `sd-chapter-card`, variant page): the ink band on top of every page — kicker,
 * the Bebas title, data on the right. Sticky under the top bar. The kennel-head variant arrives with U3.
 */
@Component({
  selector: 'sd-chapter-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="band">
      <div class="text">
        <p class="sd-kicker kicker">{{ kicker() }}</p>
        <h1 class="sd-chapter-title">{{ title() }}</h1>
      </div>
      @if (aside()) {
        <p class="sd-data aside">{{ aside() }}</p>
      }
      <ng-content />
    </div>
  `,
  styleUrls: ['./sd-chapter-card.component.scss'],
})
export class SdChapterCardComponent {
  readonly kicker = input('');
  readonly title = input.required<string>();
  readonly aside = input('');
}
