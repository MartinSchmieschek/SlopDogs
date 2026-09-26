import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { DogEntry } from '../../models/dog-entry.model';
import { shortDogLabel } from '../../utils/short-dog-label';

/**
 * Dog card on the ruled inlay (P6 U3, 8.22): 128×56 paper card, 2 px ink, square.
 * Variants: `lead` (hard shadow + chip), `failed`, `selected` (accent outline), `foreign`
 * (redacted run-only dog: ink-filled, lock, `pinned vN`), `redacted` (private: lock, `private`).
 */
@Component({
  selector: 'sd-dog-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="c" [class.lead]="lead()" [class.failed]="failed()" [class.sel]="selected()"
      [class.foreign]="kind() === 'foreign'" [title]="title()">
      @if (lead()) { <span class="sd-chip lc">lead</span> }
      @if (status(); as s) { <span class="dot" [class.err]="s === 'err'" aria-hidden="true"></span> }
      <span class="ic" [class.none]="!icon()" aria-hidden="true">{{ icon() || '◇' }}</span>
      <span class="tx">
        <span class="nm">@if (kind() !== 'own') {<svg class="lk" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M3 4.5V3a2 2 0 0 1 4 0v1.5"/><rect x="1.5" y="4.5" width="7" height="5"/></svg>}{{ label() }}</span>
        @switch (kind()) {
          @case ('foreign') { <span class="sd-chip sd-chip--frozen sub-chip">{{ pinned() }}</span> }
          @case ('redacted') { <span class="sd-chip sd-chip--soft sub-chip">private</span> }
          @default { @if (sub()) { <span class="sub">{{ sub() }}</span> } }
        }
      </span>
    </div>
  `,
  styles: [`
    :host { display: block; width: 128px; height: 56px; }
    .c { position: relative; box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center;
      gap: 8px; padding: 0 12px 0 8px; background: var(--paper-2); color: var(--ink); border: 2px solid var(--ink);
      font-family: var(--font-mono); }
    .lead { box-shadow: 4px 4px 0 var(--ink); }
    .failed { border-color: var(--danger-ink); }
    .sel { outline: 3px solid var(--accent); outline-offset: 2px; }
    .foreign { background: var(--ink); color: var(--paper); border-color: var(--ink); }
    .foreign.failed { border-color: var(--danger-ink); }
    .lc { position: absolute; top: -11px; left: 6px; min-height: 16px; padding: 1px 5px; font-size: 10px; }
    .foreign .lc { background: var(--paper-3); color: var(--ink); }
    .dot { position: absolute; top: 5px; right: 5px; width: 8px; height: 8px; background: var(--live); }
    .dot.err { background: var(--danger-ink); }
    .ic { flex: none; width: 24px; text-align: center; font-size: 20px; line-height: 24px; }
    .ic.none { font-size: 16px; color: var(--ink-3); }
    .foreign .ic.none { color: var(--ink-soft); }
    .tx { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .nm { display: block; font-size: 13px; line-height: 17px; white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; }
    .lk { width: 10px; height: 10px; margin-right: 4px; vertical-align: -1px; fill: none; stroke: currentColor;
      stroke-width: 1.4; }
    .lk rect { fill: currentColor; }
    .sub { display: block; font-size: 12px; line-height: 17px; color: var(--ink-2); white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; }
    .sub-chip { align-self: flex-start; min-height: 16px; padding: 1px 5px; font-size: 10px; letter-spacing: .1em; }
  `],
})
export class SdDogCardComponent {
  readonly dog = input.required<DogEntry>();
  readonly lead = input(false);
  readonly selected = input(false);

  readonly name = computed(() => this.dog().displayName?.trim() || this.dog().name);
  /**
   * What fits the 72 px of text (Courier 13 px: 9 characters, 7 behind the lock) with the part that tells
   * siblings apart — `Slo…SkinA`, not `SlopdogsL…` (U5). The full name stays in the title.
   */
  readonly label = computed(() => shortDogLabel(this.name(), this.kind() === 'own' ? 9 : 7));
  readonly icon = computed(() => this.dog().icon?.trim() ?? '');
  readonly kind = computed<'own' | 'foreign' | 'redacted'>(() => {
    const d = this.dog();
    if (!d.redacted) return 'own';
    return d.access === 'run' ? 'foreign' : 'redacted';
  });
  readonly failed = computed(() => !!this.dog().error);
  /** Status after a run: danger on error, live when a result came back; nothing for private dogs. */
  readonly status = computed<'ok' | 'err' | null>(() => {
    const d = this.dog();
    if (d.error) return 'err';
    if (this.kind() === 'redacted' || d.result === undefined) return null;
    return 'ok';
  });
  readonly pinned = computed(() => {
    const v = this.dog().version;
    return v != null ? `pinned v${v}` : 'pinned';
  });
  readonly sub = computed(() => {
    const d = this.dog();
    if (d.mimic) return 'mimic';
    if (!d.codeTs && !d.serializedDogConfig && d.id === d.name) return 'base';
    const ctx = d.contextName?.trim();
    return ctx && ctx !== this.name() ? ctx : '';
  });
  readonly title = computed(() => {
    const err = this.dog().error?.split('\n')[0]?.trim();
    return err ? `${this.name()}\n${err}` : this.name();
  });
}
