import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { escapeLayerWhile } from '../../utils/escape-layers';
import type { IKennelConfig } from '../../models/kennel-config.model';
import { SdPlaqueComponent } from '../sd-plaque/sd-plaque.component';
import { SdStarsComponent } from '../sd-stars/sd-stars.component';

export type KennelRowAction = 'run' | 'open' | 'docs' | 'copy-link' | 'edit' | 'export' | 'delete';

/** Unique ids for the hint under a locked `Edit` (aria-describedby). */
let editHintSeq = 0;

/** "3 h ago" — short, English, falls back to the date after a week. */
export function relativeTime(iso: string | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const min = Math.round((now - t) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 8) return `${d} d ago`;
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Tracklist row, kennel variant (6.4 S1, 6.5 `sd-track-row`): number, emoji, title in Bebas, chips only
 * for non-defaults (`run only`, `private`, `frozen`, `yours`), then plaque, stars, time, the favorite flag,
 * `⏵` and `⋯`. The whole row loads the kennel: the name is a stretched link to the public page
 * `/k/:id?<defaultQuery>` in a new tab (one tab stop per row); flag, `⏵` and `⋯` sit above it as their own
 * buttons. `⋯ → Edit` opens the kennel page (run + editor); a landing or frozen kennel shows it disabled
 * with the reason. The kennel opened last is marked (`current`: ink bar, `last opened` chip,
 * `aria-current`). Rights come from `myRights` (P3.5); a server without them gets the full menu, as before.
 */
@Component({
  selector: 'sd-track-row',
  standalone: true,
  imports: [SdPlaqueComponent, SdStarsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--i]': 'staggerIndex()' },
  templateUrl: './sd-track-row.component.html',
  styleUrls: ['./sd-track-row.component.scss'],
})
export class SdTrackRowComponent {
  readonly kennel = input.required<IKennelConfig>();
  readonly index = input(0);
  /** Position inside the current page for the 24 ms stagger (capped at 12 rows). */
  readonly staggerIndex = input(0);
  readonly yours = input(false);
  /** Absolute `/k/:id?<defaultQuery>` — a click on the row (its stretched name link) opens it in a new tab. */
  readonly publicHref = input('');
  /** The kennel opened last in this browser. */
  readonly current = input(false);
  /** A favorite request for this row is under way. */
  readonly favoriteBusy = input(false);
  readonly action = output<KennelRowAction>();
  /** The row link was followed (marks the kennel as opened last). */
  readonly opened = output<void>();
  /** The favorite flag was pressed; the list decides (sign in, set or clear). */
  readonly favoriteToggle = output<void>();

  readonly menuOpen = signal(false);

  readonly ref = computed(() => this.kennel().lineageId || this.kennel().id);
  readonly title = computed(() => this.kennel().name || this.ref());
  readonly emoji = computed(() => this.kennel().emoji?.trim() || '🐕');
  readonly number = computed(() => String(this.index() + 1).padStart(2, '0'));
  readonly frozen = computed(() => !!(this.kennel().frozen ?? this.kennel().myRights?.frozen));
  readonly favorite = computed(() => !!this.kennel().favorite);
  /**
   * Maintained kennel (server lock `landing`: LANDING_KENNEL_IDS, the seeded landing and the seeded curated kennels
   * such as `slopdogs-kennels`). Only maintainers (SLOPDOGS_MAINTAINER_EMAILS) change it; for them `edit` is true.
   */
  readonly maintained = computed(() => this.kennel().myRights?.locked === 'landing');
  /** Why `Edit` is disabled, or null when it is not locked. A maintainer edits a maintained kennel. */
  readonly editLock = computed(() =>
    this.frozen()
      ? 'Frozen. Unfreeze in settings.'
      : this.maintained() && !this.kennel().myRights?.edit
        ? 'Maintained. Only maintainers change it.'
        : null,
  );
  /** The note under an enabled Edit of a maintained kennel (the caller is a maintainer). */
  readonly maintainerNote = computed(() => (this.maintained() && !this.editLock() ? 'Maintained. You are a maintainer.' : null));
  readonly editHintId = `sd-track-row-edit-hint-${++editHintSeq}`;
  /** Run without read (P3.5 stage 1): name, emoji, description only; no code behind the row. */
  readonly runOnly = computed(() => {
    const r = this.kennel().myRights;
    return r ? !r.read : this.kennel().visibility === 'run-only';
  });
  readonly isPrivate = computed(() => this.kennel().visibility === 'private');
  readonly canEdit = computed(() => this.kennel().myRights?.edit ?? true);
  /**
   * Owner or editor — the server deletes for both (canMutate). Not on a community kennel (no owner: every signed-in
   * user may edit it, but the list does not offer to delete it), not maintained, not frozen.
   */
  readonly canDelete = computed(() => {
    const k = this.kennel();
    const r = k.myRights;
    if (this.frozen() || this.maintained()) return false;
    if (!r) return true;
    return r.own || (r.edit && !!k.ownerId);
  });
  readonly meta = computed(() => {
    const k = this.kennel();
    const parts = [this.ref()];
    if (Array.isArray(k.dogIds)) parts.push(`${k.dogIds.length} dog${k.dogIds.length === 1 ? '' : 's'}`);
    if (k.description?.trim()) parts.push(k.description.trim());
    return parts.join(' · ');
  });
  readonly when = computed(() => this.kennel().updatedAt || this.kennel().createdAt);
  readonly whenLabel = computed(() => relativeTime(this.when()));
  readonly whenTitle = computed(() => {
    const w = this.when();
    return w ? new Date(w).toLocaleString('en-GB') : '';
  });

  toggleFavorite(event: Event): void {
    event.stopPropagation();
    this.favoriteToggle.emit();
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  pick(a: KennelRowAction): void {
    this.menuOpen.set(false);
    this.action.emit(a);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  constructor() {
    escapeLayerWhile(() => this.menuOpen(), () => this.closeMenu());
  }
}
