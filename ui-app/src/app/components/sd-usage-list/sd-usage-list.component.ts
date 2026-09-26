import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { IDogUsage } from '../../models/dog.model';
import { apiAbsoluteUrl } from '../../config/api-base';

export type SdUsageState = 'loading' | 'error' | 'ready';

/**
 * Kennels that use a dog (6.5 `sd-usage-list`, P4b `GET /api/nodes/:id/usage`): tracklist lines with the
 * kennel link, its runs of this dog in 30 days and `⏵` to its public page; `+n private` for the ones the
 * caller may not run. `short` cuts at five and offers the rest; depends on / used by as chips.
 */
@Component({
  selector: 'sd-usage-list',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('loading') {
        @for (i of [0, 1, 2]; track i) { <div class="ln sk"><span class="sd-skel b1"></span><span class="sd-skel b2"></span></div> }
      }
      @case ('error') {
        <p class="err sd-small">Couldn't load usage. <button type="button" class="sd-btn sd-btn--sm" (click)="retry.emit()">Retry</button></p>
      }
      @default {
        @if (usage(); as u) {
          @if (!u.kennels.length && !u.hiddenKennels) {
            <p class="sd-small none">No kennel uses this dog yet.</p>
          }
          <ol class="ls">
            @for (k of shown(); track k.lineageId; let i = $index) {
              <li class="ln">
                <span class="no" aria-hidden="true">{{ i + 1 }}</span>
                <a class="kn" [routerLink]="['/kennels', k.lineageId]">{{ k.name || k.lineageId }}</a>
                @if (k.via === 'transitive') { <span class="sd-chip sd-chip--soft c" title="through another dog">via</span> }
                <span class="d" [title]="k.count30d + ' runs of this dog in 30 days'">▷ {{ k.count30d }}</span>
                <a class="sd-btn sd-btn--icon sd-btn--bare run" [href]="publicUrl(k.url)" target="_blank" rel="noopener"
                  [attr.aria-label]="'Run ' + (k.name || k.lineageId) + ' in a new tab'" title="Run in a new tab">⏵</a>
              </li>
            }
          </ol>
          @if (rest() > 0) {
            <button type="button" class="more sd-small" (click)="more.emit()">all {{ u.kennels.length }} kennels</button>
          }
          @if (u.hiddenKennels > 0) { <p class="sd-small hid">+{{ u.hiddenKennels }} private</p> }
          @if (deps()) {
            @if (u.dependencies.required.length || u.dependencies.optional.length) {
              <p class="sd-label cap">depends on</p>
              <p class="chips">
                @for (d of u.dependencies.required; track d) { <span class="sd-chip sd-chip--soft">{{ d }}</span> }
                @for (d of u.dependencies.optional; track d) { <span class="sd-chip sd-chip--soft" title="optional">{{ d }}?</span> }
              </p>
            }
            @if (u.dependents.length) {
              <p class="sd-label cap">used by</p>
              <p class="chips">
                @for (d of u.dependents; track d.lineageId) { <span class="sd-chip sd-chip--soft">{{ d.displayName || d.lineageId }}</span> }
              </p>
            }
          }
        }
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .ls { margin: 0; padding: 0; list-style: none; }
    .ln { display: flex; align-items: center; gap: var(--s2); min-height: 40px; border-bottom: 1px solid var(--line); }
    .sk { gap: var(--s3); } .b1 { width: 45%; height: 12px; } .b2 { width: 15%; height: 12px; }
    .no { width: 20px; text-align: right; font: 16px/1 var(--font-display); color: var(--ink-3); }
    .kn { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink);
      text-decoration: underline; text-decoration-color: var(--line-strong); text-underline-offset: 3px; }
    .c { min-height: 16px; padding: 1px 5px; font-size: 10px; }
    .d { font-size: 13px; font-variant-numeric: tabular-nums; color: var(--ink-2); white-space: nowrap; }
    .run { text-decoration: none; }
    .more { margin: var(--s2) 0 0; padding: 0; border: 0; background: none; color: var(--ink); cursor: pointer;
      text-decoration: underline; text-decoration-color: var(--line-strong); text-underline-offset: 3px; }
    .hid, .none { margin: var(--s2) 0 0; color: var(--ink-2); }
    .err { display: flex; align-items: center; gap: var(--s2); color: var(--danger-ink); }
    .cap { margin: var(--s3) 0 var(--s1); }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 0; }
  `],
})
export class SdUsageListComponent {
  readonly usage = input<IDogUsage | null>(null);
  readonly state = input<SdUsageState>('loading');
  /** Rows to show; null = all. */
  readonly limit = input<number | null>(null);
  /** depends on / used by chips (overview). */
  readonly deps = input(false);
  readonly retry = output<void>();
  readonly more = output<void>();

  readonly shown = computed(() => {
    const list = this.usage()?.kennels ?? [];
    const n = this.limit();
    return n === null ? list : list.slice(0, n);
  });
  readonly rest = computed(() => (this.usage()?.kennels.length ?? 0) - this.shown().length);

  publicUrl(path: string): string {
    return apiAbsoluteUrl(path);
  }
}
