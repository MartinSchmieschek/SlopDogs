import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { DogCatalogEntry } from '../../models/dog-catalog';
import { formatCount } from '../sd-plaque/sd-plaque.component';
import { SdProvenBadgeComponent } from '../sd-proven-badge/sd-proven-badge.component';
import { SdRightsChipComponent } from '../sd-rights-chip/sd-rights-chip.component';

/**
 * Tracklist row, dog variant (6.4 S6/S4, 6.5 `sd-track-row` dog): number, icon, name in Bebas, the proven
 * label, runs in 30 days, reuse, the rights chip. Second line: pack or owner, then the description; a
 * foreign run-only dog says `run only · v7`. `browser` opens the preview; `palette` is smaller, adds on
 * click, drags, paints foreign run-only dogs as ink rows (the black cassette) and links the preview (`i`).
 */
@Component({
  selector: 'sd-dog-row',
  standalone: true,
  imports: [SdProvenBadgeComponent, SdRightsChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--i]': 'staggerIndex()', '[class.pal]': 'variant() === "palette"' },
  template: `
    <div class="row" role="listitem" [class.sel]="selected()" [class.ink]="variant() === 'palette' && dog().runOnly"
      [class.yours]="dog().own">
      <span class="no" aria-hidden="true">{{ number() }}</span>
      <button type="button" class="main" [attr.aria-pressed]="variant() === 'browser' ? selected() : null"
        [attr.aria-label]="ariaLabel()" [attr.draggable]="variant() === 'palette'" (dragstart)="dragged.emit($event)"
        (click)="picked.emit()">
        <span class="l1">
          <span class="ic" [class.cas]="dog().runOnly" aria-hidden="true">{{ dog().runOnly ? '◼' : dog().icon || '◇' }}</span>
          <span class="nm">{{ dog().name }}</span>
          <sd-proven-badge [proven]="dog().proven" />
          @if (dog().frozen) { <span class="sd-chip sd-chip--frozen">frozen</span> }
          @if (dog().own) { <span class="sd-chip sd-chip--live">yours</span> }
        </span>
        <span class="meta sd-small">{{ meta() }}</span>
      </button>
      <span class="data">
        @if (dog().stats; as s) {
          <span class="runs" [title]="runsTitle()"><span class="g" aria-hidden="true">▷</span>{{ runs() }}</span>
          <span class="reuse" [title]="'used in ' + s.reuse.kennelsTransitive + ' kennel' + (s.reuse.kennelsTransitive === 1 ? '' : 's')">{{ s.reuse.kennelsTransitive }} k</span>
        }
        <sd-rights-chip [right]="dog().right" />
      </span>
      @if (variant() === 'palette') {
        <a class="info" [href]="'/dogs?dog=' + encoded()" target="_blank" rel="noopener"
          [attr.aria-label]="'Preview ' + dog().name + ' in a new tab'" title="Preview in the dog browser">i</a>
      }
    </div>
  `,
  styles: [`
    :host { display: block; animation: sd-row-in var(--dur-base) var(--ease-out) backwards;
      animation-delay: calc(min(var(--i, 0), 12) * 24ms); }
    .row { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto auto; align-items: center; column-gap: var(--s3);
      min-height: 56px; padding: var(--s2) var(--s2) var(--s2) 0; border-bottom: 1px solid var(--line); }
    .row:hover { background: var(--paper-3); }
    .row.yours { background: var(--live-soft); }
    .row.sel { background: var(--paper-3); box-shadow: inset 3px 0 0 var(--ink); }
    .no { justify-self: end; font: 20px/1 var(--font-display); color: var(--ink-3); }
    .main { min-width: 0; padding: 0; border: 0; background: none; color: inherit; text-align: left; font: inherit; cursor: pointer; }
    .main:hover .nm { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
    .l1 { display: flex; align-items: center; flex-wrap: wrap; gap: 4px var(--s2); }
    .ic { width: 20px; text-align: center; font-size: 16px; line-height: 1; }
    .ic.cas { color: var(--ink); }
    .nm { font: 18px/20px var(--font-display); letter-spacing: .03em; text-transform: uppercase; padding-top: 2px; overflow-wrap: anywhere; }
    .meta { display: block; margin-top: 2px; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .data { display: flex; align-items: center; gap: var(--s3); font-size: 13px; line-height: 19px; font-variant-numeric: tabular-nums; color: var(--ink-2); white-space: nowrap; }
    .g { color: var(--ink-3); margin-right: 4px; }
    .info { display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid var(--line-strong); color: inherit;
      text-decoration: none; font: 700 13px/1 var(--font-mono); }
    :host(.pal) .row { grid-template-columns: 28px minmax(0, 1fr) auto; column-gap: var(--s2); min-height: 48px; }
    :host(.pal) .no { font-size: 16px; }
    :host(.pal) .nm { font-size: 16px; line-height: 18px; }
    :host(.pal) .data { grid-column: 2; grid-row: 2; gap: var(--s2); font-size: 12px; }
    :host(.pal) .info { grid-column: 3; grid-row: 1 / span 2; }
    :host(.pal) .main[draggable='true'] { cursor: grab; }
    .row.ink { background: var(--ink); color: var(--paper); }
    .row.ink .meta, .row.ink .data, .row.ink .g, .row.ink .no { color: var(--ink-soft); }
    .row.ink .ic.cas { color: var(--paper); }
    .row.ink sd-rights-chip ::ng-deep .sd-chip { border-color: var(--paper); color: var(--paper); }
    .row.ink .info { border-color: var(--ink-soft); }
    @media (max-width: 767px) {
      .row { grid-template-columns: 32px minmax(0, 1fr) auto; column-gap: var(--s2); row-gap: 2px; }
      .no { align-self: start; padding-top: 4px; }
      .data { grid-column: 2; grid-row: 2; }
    }
    @keyframes sd-row-in { from { opacity: 0; transform: translateY(4px); } }
    @media (prefers-reduced-motion: reduce) { :host { animation-duration: .01ms; animation-delay: 0ms; } }
  `],
})
export class SdDogRowComponent {
  readonly dog = input.required<DogCatalogEntry>();
  readonly index = input(0);
  readonly staggerIndex = input(0);
  readonly selected = input(false);
  readonly variant = input<'browser' | 'palette'>('browser');
  readonly picked = output<void>();
  readonly dragged = output<DragEvent>();

  readonly number = computed(() => String(this.index() + 1).padStart(2, '0'));
  readonly encoded = computed(() => encodeURIComponent(this.dog().key));
  readonly runs = computed(() => formatCount(this.dog().stats?.calls.ranked30d ?? 0));
  readonly runsTitle = computed(() => {
    const c = this.dog().stats?.calls;
    return c ? `${formatCount(c.ranked30d)} runs in 30 days · ${formatCount(c.total)} in total` : '';
  });
  readonly meta = computed(() => {
    const d = this.dog();
    const parts: string[] = [];
    if (d.runOnly) parts.push(d.version != null ? `run only · v${d.version}` : 'run only');
    else if (d.isBase) parts.push(d.pack ?? 'base');
    else if (d.own) parts.push('yours');
    else if (d.group === 'mimic') parts.push('mimic');
    if (d.description) parts.push(d.description);
    else if (d.runOnly && d.stats) {
      const n = d.stats.reuse.kennelsTransitive;
      parts.push(`in ${n} kennel${n === 1 ? '' : 's'}`);
    }
    return parts.join(' · ');
  });
  readonly ariaLabel = computed(() => {
    const d = this.dog();
    const verb = this.variant() === 'palette' ? (d.runOnly ? 'Add pinned' : 'Add') : 'Preview';
    return `${verb} ${d.name}`;
  });
}
