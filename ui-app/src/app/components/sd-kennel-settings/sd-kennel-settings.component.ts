import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import type { HttpErrorResponse } from '@angular/common/http';
import { KennelService } from '../../services/kennel.service';
import { AclService } from '../../services/acl.service';
import { KENNEL_EMOJI_PRESETS } from '../../data/kennel-emoji-presets';
import { publicKennelPath } from '../../config/public-paths';
import type { IKennelConfig, KennelVisibility } from '../../models/kennel-config.model';
import type { DogEntry } from '../../models/dog-entry.model';
import { graphNodeIdMatchesKennelDogId } from '../../utils/kennel-dog-id-match';
import {
  bodyProblem,
  reorderDogIds,
  settingsFormOf,
  settingsDirty,
  settingsPayload,
  settingsView,
  type QueryRow,
  type SettingsForm,
  type SettingsRights,
} from '../../utils/kennel-settings';
import { ConfirmService, LEAVE_UNSAVED } from '../../services/confirm.service';
import { LANDING_LOCK_TITLE } from '../sd-kennel-head/sd-kennel-head.component';
import { SdDrawerComponent } from '../sd-drawer/sd-drawer.component';
import { SdBannerComponent } from '../sd-banner/sd-banner.component';
import { SdAccessPanelComponent } from '../sd-access-panel/sd-access-panel.component';

/** One dog of the order list: label from the last run, ink row for a pinned foreign run-only dog. */
interface DogOrderRow {
  ref: string;
  label: string;
  icon: string;
  pinned: number | null;
}

/**
 * The settings drawer (6.4 S3, 560 over the kennel page, sheet on a phone; `kennel-config` is gone as a
 * page): name, ID, description, emoji (popover), the access panel (visibility, people, freeze),
 * dogs in order with the lead on top, defaults (query rows, body JSON), a pointer to the versions, then
 * `[SAVE] Cancel Delete kennel`. Readers see it read-only; frozen shows the unfreeze banner and locks
 * every field (8.25). The deep link `/kennels/:id/edit` opens it (the page decides who may).
 */
@Component({
  selector: 'sd-kennel-settings',
  standalone: true,
  imports: [SdDrawerComponent, SdBannerComponent, SdAccessPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sd-kennel-settings.component.html',
  styleUrls: ['./sd-kennel-settings.component.scss'],
})
export class SdKennelSettingsComponent {
  private readonly kennels = inject(KennelService);
  private readonly acl = inject(AclService);
  private readonly confirm = inject(ConfirmService);

  readonly open = input(false);
  readonly kennel = input<IKennelConfig | null>(null);
  readonly kennelId = input.required<string>();
  readonly rights = input<SettingsRights | null>(null);
  readonly frozen = input(false);
  /** Landing lock (P5, LANDING_KENNEL_IDS): read-only like frozen, but no unfreeze offer in this drawer. */
  readonly landingLocked = input(false);
  /** The dogs of the last run — names and icons for the order list. */
  readonly dogs = input<DogEntry[]>([]);
  /** `v12 · 2026-09-20` of the newest version, `null` without versions. */
  readonly latestVersion = input<string | null>(null);
  readonly versionCount = input(0);

  readonly closed = output<void>();
  readonly saved = output<void>();
  readonly frozenChange = output<boolean>();
  readonly ownershipChanged = output<void>();
  readonly visibilityChange = output<KennelVisibility>();
  readonly openVersions = output<void>();
  readonly deleteRequested = output<void>();

  readonly presets = KENNEL_EMOJI_PRESETS;
  readonly landingLockTitle = LANDING_LOCK_TITLE;

  readonly name = signal('');
  readonly description = signal('');
  readonly emoji = signal('');
  readonly emojiOpen = signal(false);
  readonly dogIds = signal<string[]>([]);
  readonly query = signal<QueryRow[]>([]);
  readonly body = signal('');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly unfreezing = signal(false);

  readonly view = computed(() => settingsView(this.rights(), this.frozen(), this.landingLocked()));
  readonly editable = computed(() => this.view() === 'edit');
  readonly own = computed(() => !!this.rights()?.own);
  readonly lineage = computed(() => this.kennel()?.lineageId || this.kennelId());
  readonly publicPath = computed(() => publicKennelPath(this.lineage()));
  readonly bodyError = computed(() => bodyProblem(this.body()));
  readonly dogRows = computed<DogOrderRow[]>(() => this.dogIds().map((ref) => this.dogRow(ref)));
  /** Typed but not saved (U8): closing asks first. */
  readonly dirty = computed(() => this.open() && this.editable() && settingsDirty(this.kennel(), this.form()));

  constructor() {
    // A fresh open (or a new config while closed) resets the form; typing never gets overwritten.
    effect(() => {
      if (!this.open()) return;
      const cfg = this.kennel();
      untracked(() => this.reset(cfg));
    }, { allowSignalWrites: true });
  }

  private form(): SettingsForm {
    return {
      name: this.name(),
      description: this.description(),
      emoji: this.emoji(),
      dogIds: this.dogIds(),
      query: this.query(),
      body: this.body(),
    };
  }

  private reset(cfg: IKennelConfig | null): void {
    const f = settingsFormOf(cfg);
    this.name.set(f.name);
    this.description.set(f.description);
    this.emoji.set(f.emoji);
    this.dogIds.set(f.dogIds);
    this.query.set(f.query);
    this.body.set(f.body);
    this.error.set(null);
    this.emojiOpen.set(false);
  }

  private dogRow(ref: string): DogOrderRow {
    const dog = this.dogs().find((d) => graphNodeIdMatchesKennelDogId(d.id, ref, d.lineageId));
    const pinned = dog?.redacted && dog.access === 'run' ? dog.version ?? 0 : null;
    return {
      ref,
      label: dog?.displayName || dog?.name || (ref.startsWith('base:') ? ref.slice(5) : ref),
      icon: dog?.icon || (pinned !== null ? '◼' : '◇'),
      pinned,
    };
  }

  pickEmoji(e: string): void {
    this.emoji.set(e);
    this.emojiOpen.set(false);
  }

  move(index: number, how: 'lead' | 'up' | 'down' | 'remove'): void {
    if (!this.editable()) return;
    this.dogIds.update((ids) => reorderDogIds(ids, index, how));
  }

  setQuery(index: number, field: keyof QueryRow, value: string): void {
    this.query.update((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  addQuery(): void {
    this.query.update((rows) => [...rows, { key: '', value: '' }]);
  }

  removeQuery(index: number): void {
    this.query.update((rows) => rows.filter((_, i) => i !== index));
  }

  /** Back, Cancel, the scrim, `×` and Esc: with unsaved changes the dialog asks "Leave anyway?" first. */
  async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (this.dirty() && !(await this.confirm.ask(LEAVE_UNSAVED))) return;
    this.discard();
    this.closed.emit();
  }

  /** "Leave" answered: the typed changes go; the form shows the stored config again. */
  discard(): void {
    this.reset(this.kennel());
  }

  save(): void {
    if (!this.editable() || this.saving()) return;
    const payload = settingsPayload(this.kennel(), this.form());
    if (!payload.ok) return;
    this.saving.set(true);
    this.error.set(null);
    this.kennels.update(this.kennelId(), payload.patch).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res && res.ok === false) {
          this.error.set(res.error ?? "Couldn't save the settings.");
          return;
        }
        this.saved.emit();
        this.closed.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(`Couldn't save the settings: ${err.error?.error_description ?? err.error?.error ?? err.status}.`);
      },
    });
  }

  unfreeze(): void {
    if (!this.own() || this.unfreezing()) return;
    this.unfreezing.set(true);
    this.acl.unfreeze('kennel', this.lineage()).subscribe({
      next: () => {
        this.unfreezing.set(false);
        this.frozenChange.emit(false);
      },
      error: (err: HttpErrorResponse) => {
        this.unfreezing.set(false);
        this.error.set(`Couldn't unfreeze: ${err.error?.error_description ?? err.error?.error ?? err.status}.`);
      },
    });
  }
}
