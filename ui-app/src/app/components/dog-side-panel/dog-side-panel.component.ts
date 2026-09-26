import {
  Component, Input, Output, EventEmitter, signal, inject, ViewChild, OnChanges, SimpleChanges, computed,
} from '@angular/core';
import { DogEntry } from '../../models/dog-entry.model';
import { DogDisplayComponent } from '../dog-display/dog-display.component';
import { VersionTimelineComponent, TimelineVersion } from '../version-timeline/version-timeline.component';
import { DogService, VersionEntry } from '../../services/dog.service';
import { graphNodeIdMatchesKennelDogId } from '../../utils/kennel-dog-id-match';
import {
  DogPanelSectionId,
  buildDogPanelSections,
  DEFAULT_PANEL_SECTION,
  getDefaultPanelSection,
  dogInsightKey,
} from '../../utils/dog-panel-sections';
import { SdDogInsightComponent } from '../sd-dog-insight/sd-dog-insight.component';
import { DogSidePanelCodeArtifactComponent } from './artifacts/dog-side-panel-code-artifact.component';
import { DogSidePanelVmTypedefArtifactComponent } from './artifacts/dog-side-panel-vm-typedef-artifact.component';
import { DogSidePanelResultArtifactComponent } from './artifacts/dog-side-panel-result-artifact.component';
import { DogSidePanelParentsArtifactComponent } from './artifacts/dog-side-panel-parents-artifact.component';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';
import { SdAccessPanelComponent } from '../sd-access-panel/sd-access-panel.component';

export type { DogPanelSectionId } from '../../utils/dog-panel-sections';
export { DEFAULT_PANEL_SECTION, getDefaultPanelSection } from '../../utils/dog-panel-sections';

@Component({
  selector: 'app-dog-side-panel',
  standalone: true,
  imports: [
    DogDisplayComponent,
    VersionTimelineComponent,
    DogSidePanelCodeArtifactComponent,
    DogSidePanelVmTypedefArtifactComponent,
    DogSidePanelResultArtifactComponent,
    DogSidePanelParentsArtifactComponent,
    SdAccessPanelComponent,
    SdDogInsightComponent,
  ],
  templateUrl: './dog-side-panel.component.html',
  styleUrls: ['../../styles/dog-node-card.scss', './dog-side-panel.component.scss'],
})
export class DogSidePanelComponent implements OnChanges {
  private errorVideoPopup = inject(ErrorVideoPopupService);

  @ViewChild(DogSidePanelCodeArtifactComponent) codeArtifact?: DogSidePanelCodeArtifactComponent;

  @Input() dog!: DogEntry;
  @Input() allDogs: DogEntry[] = [];
  /** Erster Eintrag in `kennelConfig.dogIds` (Lead-Slot); für Stern/Strip-Matching. */
  @Input() kennelLeadDogIdsSlot: string | null = null;
  /** Wenn true: Lead-Strip oben; Save-Bar versteckt den doppelten Lead-Button. */
  @Input() kennelLeadControlsEnabled = false;
  /** Vom Graph-Fächer gesetzt: diese Section sofort aktiv. */
  @Input() initialSection: DogPanelSectionId | null = null;
  /** The kennel's reference for this dog — lineageId means "latest", version-ID means "pinned". */
  @Input() kennelDogRef: string | null = null;
  /** Bestehender Node-Kommentar im Kennel (kennel.nodes[].comment). */
  @Input() kennelNodeComment: string | null = null;
  /**
   * Leser ohne Edit-Recht am Kennel: Lead-Stern nicht klickbar, Kommentar nur lesend (leer = weg),
   * "Remove from kennel" und Pin-Umschaltung ausgeblendet. Code-Save am Dog selbst bleibt unberuehrt.
   */
  @Input() kennelReadOnly = false;
  /**
   * Kennel frozen: dieselben Kennel-Controls sichtbar, aber disabled; der Text ist der Tooltip
   * (z. B. "Frozen. Unfreeze in settings."). null = nicht gesperrt.
   */
  @Input() kennelLock: string | null = null;
  /** Inside a drawer (sd-drawer) the drawer head closes; the panel drops its own `×`. */
  @Input() showClose = true;
  @Output() saved = new EventEmitter<void>();
  /** Emits the trimmed comment together with the kennel-ref of this dog. */
  @Output() kennelNodeCommentChanged = new EventEmitter<{ kennelRef: string; comment: string }>();
  @Output() deleted = new EventEmitter<string>();
  @Output() movedToFirst = new EventEmitter<string>();
  /** Emits { lineageId, versionId } — parent updates the kennel's dogIds entry accordingly. */
  @Output() pinChanged = new EventEmitter<{ lineageId: string; versionId: string | null }>();
  @Output() renamed = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  private dogService = inject(DogService);

  private readonly dogSignal = signal<DogEntry | null>(null);

  /** Welche Edit-Section unten sichtbar ist (Kreis-Buttons am Dog-Hub). */
  readonly activeSection = signal<DogPanelSectionId | null>(null);

  /**
   * Bindungsname im VM-Kontext, wie ihn der Server liefert — nur wenn er vom
   * sichtbaren Titel abweicht. Fehlt er, wird nichts angezeigt und nichts geraten.
   */
  readonly contextName = computed(() => {
    const d = this.dogSignal();
    const ctx = d?.contextName?.trim();
    return ctx && ctx !== (d?.displayName || d?.name) ? ctx : '';
  });

  readonly availableSections = computed(() => {
    const d = this.dogSignal();
    return d ? buildDogPanelSections(d) : [];
  });

  /** `usage` / `stats` (U5): the key list and `/usage` know this dog by — lineageId or `base:X`. */
  readonly insightKey = computed(() => {
    const d = this.dogSignal();
    return d ? dogInsightKey(d) : null;
  });

  parentsRequired = signal<string[]>([]);
  parentsOptional = signal<string[]>([]);
  saving = signal(false);
  saveError = signal<string | null>(null);
  saveSuccess = signal(false);
  renaming = signal(false);

  versions = signal<VersionEntry[]>([]);
  selectedVersionId = signal<string | null>(null);
  editorDog = signal<DogEntry | null>(null);

  timelineVersions = computed<TimelineVersion[]>(() => {
    return this.versions().map(v => ({
      id: v.id,
      version: v.version,
      parentId: v.parentId,
      createdAt: v.createdAt,
      displayName: v.config?.displayName,
    }));
  });

  get isSerialized(): boolean {
    return !!this.dog?.codeTs;
  }

  /** P3.5: fremder Dog ohne Leserecht — nur Ergebnis, keine Bearbeitung. */
  get isRedacted(): boolean {
    return !!this.dog?.redacted;
  }

  /** Code, Name und Parents bearbeitbar: eigener lesbarer SerializedDog. */
  get canEditDog(): boolean {
    return this.isSerialized && !this.isRedacted;
  }

  /** Label-Maker-Chip fuer redacted Dogs: `run only` bzw. `private`. */
  get accessChip(): string | null {
    if (!this.isRedacted) return null;
    return this.dog.access === 'none' ? 'private' : 'run only';
  }

  get leadStarClickable(): boolean {
    return !this.isCurrentLead && !this.kennelReadOnly && !this.kennelLock;
  }

  get leadStarTitle(): string {
    if (this.isCurrentLead) return "Lead dog (the kennel's answer)";
    if (this.kennelLock) return this.kennelLock;
    if (this.kennelReadOnly) return 'Not the lead dog';
    return 'Make lead';
  }

  get canRemoveFromKennel(): boolean {
    return !this.kennelReadOnly && (!!this.dog?.deletable || this.isSerialized);
  }

  /** Kommentar-Feld: Leser sehen es nur, wenn schon ein Kommentar da ist. */
  get showKennelNodeComment(): boolean {
    if (!this.kennelDogRef) return false;
    return !this.kennelReadOnly || !!this.kennelNodeComment?.trim();
  }

  get showSaveBar(): boolean {
    return this.canEditDog || this.canRemoveFromKennel;
  }

  get isCurrentLead(): boolean {
    if (!this.kennelLeadControlsEnabled || !this.kennelLeadDogIdsSlot || !this.dog) {
      return false;
    }
    return graphNodeIdMatchesKennelDogId(this.dog.id, this.kennelLeadDogIdsSlot, this.dog.lineageId);
  }

  get availableParents(): DogEntry[] {
    return this.allDogs.filter(d => d.id !== this.dog?.id);
  }

  get currentVersion(): number {
    return this.dog?.serializedDogConfig?.version ?? 0;
  }

  /**
   * The version ID currently pinned in the kennel, or null if set to "always latest".
   * Derived from kennelDogRef: if it matches the lineageId → not pinned; if it matches a version → pinned.
   */
  get pinnedVersionId(): string | null {
    if (!this.kennelDogRef || !this.dog) return null;
    // If the kennel ref equals the lineageId (lineage), nothing is pinned (= latest).
    if (this.kennelDogRef === this.dog.lineageId) return null;
    // Otherwise the kennel ref is a specific version ID → that version is pinned.
    return this.kennelDogRef;
  }

  /** Forwarded from the version graph — the user pinned or unpinned a version node. */
  onPinToggled(versionId: string | null) {
    if (!this.dog?.lineageId || this.kennelReadOnly || this.kennelLock) return;
    this.pinChanged.emit({ lineageId: this.dog.lineageId, versionId });
  }

  onComfortVideoClick(message: string): void {
    this.errorVideoPopup.openPopup(message);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['dog'] && this.dog) {
      this.dogSignal.set(this.dog);
      this.parentsRequired.set([...(this.dog.parentsRequired ?? [])]);
      this.parentsOptional.set([...(this.dog.parentsOptional ?? [])]);
      this.editorDog.set(this.dog);
      this.selectedVersionId.set(null);
      if (this.isSerialized && !this.isRedacted) {
        this.loadVersions();
      } else {
        this.versions.set([]);
      }
      this.syncActiveSection();
    }
    if (changes['initialSection'] && this.initialSection != null) {
      const ids = this.availableSections().map((s) => s.id);
      if (ids.includes(this.initialSection)) {
        this.activeSection.set(this.initialSection);
      }
    }
  }

  private syncActiveSection(): void {
    const d = this.dogSignal();
    const ids = this.availableSections().map((s) => s.id);
    const cur = this.activeSection();
    const preferred = d ? getDefaultPanelSection(d) : DEFAULT_PANEL_SECTION;
    if (cur === null || !ids.includes(cur)) {
      const next = ids.includes(preferred) ? preferred : (ids[0] ?? null);
      this.activeSection.set(next);
    }
  }

  selectSection(id: DogPanelSectionId): void {
    this.activeSection.set(id);
  }

  isSectionActive(id: DogPanelSectionId): boolean {
    return this.activeSection() === id;
  }

  private loadVersions() {
    // Use lineageId (lineage GUID) to fetch all incarnations across branches — the id is just one incarnation.
    const lookupId = this.dog.lineageId || this.dog.serializedDogConfig?.lineageId || this.dog.id;
    this.dogService.getVersions(lookupId).subscribe({
      next: (res) => {
        if (res.ok && res.data) {
          this.versions.set(res.data);
        }
      }
    });
  }

  onVersionSelected(versionId: string) {
    if (!versionId) {
      this.selectedVersionId.set(null);
      this.editorDog.set(this.dog);
      this.parentsRequired.set([...(this.dog.parentsRequired ?? [])]);
      this.parentsOptional.set([...(this.dog.parentsOptional ?? [])]);
    } else if (versionId === this.dog.id) {
      // Selecting the current version — keep it selected (for pin/unpin) but load current code.
      this.selectedVersionId.set(versionId);
      this.editorDog.set(this.dog);
      this.parentsRequired.set([...(this.dog.parentsRequired ?? [])]);
      this.parentsOptional.set([...(this.dog.parentsOptional ?? [])]);
    } else {
      this.selectedVersionId.set(versionId);
      const version = this.versions().find(v => v.id === versionId);
      if (version) {
        this.editorDog.set({
          ...this.dog,
          codeTs: version.config.theRun,
        });
        this.parentsRequired.set([...(version.config.parentsRequired ?? [])]);
        this.parentsOptional.set([...(version.config.parentsOptional ?? [])]);
      }
    }
  }

  toggleParentRequired(parentId: string) {
    const current = this.parentsRequired();
    if (current.includes(parentId)) {
      this.parentsRequired.set(current.filter(id => id !== parentId));
    } else {
      this.parentsOptional.set(this.parentsOptional().filter(id => id !== parentId));
      this.parentsRequired.set([...current, parentId]);
    }
  }

  toggleParentOptional(parentId: string) {
    const current = this.parentsOptional();
    if (current.includes(parentId)) {
      this.parentsOptional.set(current.filter(id => id !== parentId));
    } else {
      this.parentsRequired.set(this.parentsRequired().filter(id => id !== parentId));
      this.parentsOptional.set([...current, parentId]);
    }
  }

  isParentRequired(parentId: string): boolean {
    return this.parentsRequired().includes(parentId);
  }

  isParentOptional(parentId: string): boolean {
    return this.parentsOptional().includes(parentId);
  }

  /**
   * Unsaved work in this panel (U8, "Unsaved changes. Leave anyway?"): code in the open editor that differs
   * from the version it was loaded from, or parents toggled away from it. A save clears it via the new dog.
   */
  isDirty(): boolean {
    if (!this.dog || !this.canEditDog || this.saving()) return false;
    const base = this.editorDog() ?? this.dog;
    const code = this.codeArtifact?.getCurrentCode();
    const norm = (s: string | null | undefined) => (s ?? '').replace(/\r\n/g, '\n');
    if (code != null && norm(code) !== norm(base.codeTs)) return true;
    const same = (a: string[], b: string[] | undefined) =>
      a.length === (b ?? []).length && a.every((x) => (b ?? []).includes(x));
    const selected = this.selectedVersionId();
    const version = selected ? this.versions().find((v) => v.id === selected)?.config : null;
    const req = version ? version.parentsRequired : base.parentsRequired;
    const opt = version ? version.parentsOptional : base.parentsOptional;
    return !same(this.parentsRequired(), req) || !same(this.parentsOptional(), opt);
  }

  saveCode() {
    if (!this.dog || !this.canEditDog) return;

    this.saving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    const code = this.codeArtifact?.getCurrentCode();
    if (code == null) {
      this.saving.set(false);
      this.saveError.set('The editor is not ready yet.');
      return;
    }

    // If an old version is selected, use ITS id as the save target —
    // the Controller sets parentId to this id, forking a branch from the old incarnation.
    // If no old version selected, save from the current version (linear continuation).
    const saveId = this.selectedVersionId() || this.dog.id;

    this.dogService.save(saveId, {
      tsCode: code,
      icon: this.dog.icon,
      parentsRequired: this.parentsRequired(),
      parentsOptional: this.parentsOptional(),
    }).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.ok) {
          this.saveSuccess.set(true);
          setTimeout(() => this.saveSuccess.set(false), 2000);
          this.loadVersions(); // Reload the branching tree after save — the new incarnation must appear
          this.saved.emit();
        } else {
          this.saveError.set(res.error ?? 'Could not save.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(err.message);
      }
    });
  }

  commitRename(event: Event) {
    const input = event.target as HTMLInputElement;
    const newName = input.value.trim();
    this.renaming.set(false);
    if (!this.canEditDog || !newName || !this.dog?.lineageId || newName === this.dog.displayName) return;
    this.dogService.rename(this.dog.lineageId, newName).subscribe({
      next: () => {
        this.renamed.emit();
        this.saved.emit(); // reload waves to reflect new name
      },
    });
  }

  deleteDog() {
    if (!this.dog || !this.canRemoveFromKennel || this.kennelLock) return;
    // Just tell the parent to remove this dog from the kennel — no DB deletion here.
    this.deleted.emit(this.dog.id);
  }

  moveToFirst() {
    if (!this.leadStarClickable) return;
    this.movedToFirst.emit(this.dog.id);
  }

  /**
   * The user edited the per-node kennel comment. We emit the kennel-ref + trimmed comment;
   * the parent (waves-viewer) merges it into kennelConfig.nodes and marks the layout dirty.
   */
  onKennelNodeCommentInput(value: string) {
    if (!this.kennelDogRef || this.kennelReadOnly || this.kennelLock) return;
    this.kennelNodeCommentChanged.emit({ kennelRef: this.kennelDogRef, comment: value });
  }
}
