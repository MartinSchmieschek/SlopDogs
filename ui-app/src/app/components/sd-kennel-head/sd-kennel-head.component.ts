import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { escapeLayerWhile } from '../../utils/escape-layers';
import type { IKennelConfig, IKennelStats } from '../../models/kennel-config.model';
import { SdPlaqueComponent } from '../sd-plaque/sd-plaque.component';
import { SdStarsComponent } from '../sd-stars/sd-stars.component';
import { SdTapeDeckComponent } from '../sd-tape-deck/sd-tape-deck.component';

export type KennelHeadAction =
  | 'edit' | 'rename' | 'open' | 'docs' | 'copy-link' | 'export' | 'versions' | 'palette' | 'freeze' | 'unfreeze' | 'delete';

export type KennelRunState = 'idle' | 'running' | 'live' | 'failed';

/** The rights the head needs — from `myRights` (P3.5); a server without them gets the full head. */
export interface KennelHeadRights {
  read: boolean;
  edit: boolean;
  own: boolean;
}

/** Freeze locks every mutation; the controls stay visible, disabled, with this title (6.4 S2, 8.25). */
export const FROZEN_TITLE = 'Frozen. Unfreeze in settings.';

/**
 * Landing lock (P5, server `LANDING_KENNEL_IDS`): the same visible-but-disabled treatment as
 * frozen, but with no unfreeze offer — nobody mutates a landing kennel, not even the owner.
 */
export const LANDING_LOCK_TITLE = 'Locked: this kennel is a landing page (LANDING_KENNEL_IDS).';

/**
 * The kennel head (6.4 S2, 6.5 `sd-kennel-head`): the chapter card of the kennel page. Row one: `‹ kennels`,
 * the kicker and the state chips (`● live · 1.8 s`, `frozen`, `run only`, `read only`, an old version).
 * Row two: emoji and the name in Bebas — the one place the kennel name is a title — then the public URL
 * with `⧉`, docs, plaque, stars (a tap opens the rating tab), `[⏵ RUN]` (the only orange in the head) and
 * `⋯`. Below 1100 px URL and docs live in `⋯`; below 768 px Run and Dogs move to the bottom bar.
 * The band carries the tape-shell tokens (`data-theme="dark"`), so chips, stars and plaque read on ink.
 */
@Component({
  selector: 'sd-kennel-head',
  standalone: true,
  imports: [RouterLink, SdPlaqueComponent, SdStarsComponent, SdTapeDeckComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sd-kennel-head.component.html',
  styleUrls: ['./sd-kennel-head.component.scss'],
})
export class SdKennelHeadComponent {
  /** null while the config loads: the title is a skeleton bar. */
  readonly kennel = input<IKennelConfig | null>(null);
  readonly kennelId = input.required<string>();
  readonly stats = input<IKennelStats | undefined>(undefined);
  readonly rights = input<KennelHeadRights>({ read: true, edit: true, own: true });
  readonly frozen = input(false);
  /** Landing lock (P5): like frozen for the controls, but its own chip and no unfreeze offer. */
  readonly landingLocked = input(false);
  readonly dogCount = input<number | null>(null);
  readonly waveCount = input<number | null>(null);
  readonly runState = input<KennelRunState>('idle');
  readonly durationMs = input<number | null>(null);
  /** `v3 · 2026-09-20` while an older version is shown; null on the latest. */
  readonly oldVersion = input<string | null>(null);
  /** Absolute `/k/:id?<defaultQuery>`. */
  readonly publicUrl = input('');
  readonly docsUrl = input('');

  readonly run = output<void>();
  readonly rate = output<void>();
  readonly backToLatest = output<void>();
  readonly action = output<KennelHeadAction>();

  readonly menuOpen = signal(false);
  readonly frozenTitle = FROZEN_TITLE;
  readonly landingLockTitle = LANDING_LOCK_TITLE;

  readonly runOnly = computed(() => !this.rights().read);
  /** Landing behaves like frozen here — locked, not "read only". */
  readonly readOnly = computed(() =>
    this.rights().read && !this.rights().edit && !this.frozen() && !this.landingLocked());
  readonly name = computed(() => this.kennel()?.name || this.kennel()?.lineageId || this.kennelId());
  readonly emoji = computed(() => this.kennel()?.emoji?.trim() || '🐕');
  readonly publicPath = computed(() => {
    const url = this.publicUrl();
    try {
      const u = new URL(url);
      return u.pathname + u.search;
    } catch {
      return url;
    }
  });
  readonly kicker = computed(() => {
    const parts = ['side A'];
    const dogs = this.dogCount();
    const waves = this.waveCount();
    if (dogs !== null) parts.push(`${dogs} dog${dogs === 1 ? '' : 's'}`);
    if (waves !== null) parts.push(`${waves} wave${waves === 1 ? '' : 's'}`);
    if (dogs === null && waves === null && this.runOnly()) parts.push('run only');
    return parts.join(' · ');
  });
  readonly duration = computed(() => {
    const ms = this.durationMs();
    if (ms === null) return '';
    return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
  });
  /** The palette needs edit rights; frozen and landing keep it visible but locked. */
  readonly paletteHidden = computed(() =>
    this.runOnly() || (!this.rights().edit && !this.frozen() && !this.landingLocked()));
  /** Landing wins the title if both apply (unfreezing would not help); then frozen, then the normal hint. */
  readonly paletteTitle = computed(() => {
    if (this.landingLocked()) return this.landingLockTitle;
    if (this.frozen()) return this.frozenTitle;
    return 'Add dogs from the palette';
  });

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  pick(a: KennelHeadAction): void {
    this.menuOpen.set(false);
    this.action.emit(a);
  }

  constructor() {
    escapeLayerWhile(() => this.menuOpen(), () => this.menuOpen.set(false));
  }
}
