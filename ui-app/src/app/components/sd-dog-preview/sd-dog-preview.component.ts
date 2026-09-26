import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import type { DogCatalogEntry } from '../../models/dog-catalog';
import type { DogEntry } from '../../models/dog-entry.model';
import type { IDogUsage } from '../../models/dog.model';
import { DogService } from '../../services/dog.service';
import { SdDrawerComponent } from '../sd-drawer/sd-drawer.component';
import { SdDogStatsComponent } from '../sd-dog-stats/sd-dog-stats.component';
import { SdUsageListComponent, type SdUsageState } from '../sd-usage-list/sd-usage-list.component';
import { SdRightsChipComponent } from '../sd-rights-chip/sd-rights-chip.component';
import { SdKennelPickerComponent } from '../sd-kennel-picker/sd-kennel-picker.component';
import { DogEditorComponent } from '../dog-editor/dog-editor.component';
import { SdAccessPanelComponent } from '../sd-access-panel/sd-access-panel.component';

export type DogPreviewTab = 'overview' | 'usage' | 'code' | 'access';

const OVERVIEW_USAGE_ROWS = 5;

/**
 * The dog preview (8.21: a dog is only a preview, no page; 6.5 `sd-dog-preview`): drawer on the right
 * (440, 480 from 1440), bottom sheet on a phone. Ink head from the row at once — icon, name, pack or
 * owner, version, rights chip. Tabs overview (stat tiles, the proven rule, five kennels, depends on /
 * used by), usage (every kennel), code (Monaco inlay, read-only — only with READ; a run-only dog has
 * no code tab and its head says so), access (owner and editors: the access panel). Footer: `[USE IN KENNEL ▾]`.
 */
@Component({
  selector: 'sd-dog-preview',
  standalone: true,
  imports: [SdDrawerComponent, SdDogStatsComponent, SdUsageListComponent, SdRightsChipComponent, SdKennelPickerComponent, DogEditorComponent, SdAccessPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sd-dog-preview.component.html',
  styleUrls: ['./sd-dog-preview.component.scss'],
})
export class SdDogPreviewComponent {
  private readonly dogService = inject(DogService);

  readonly dog = input<DogCatalogEntry | null>(null);
  readonly width = input(440);
  readonly returnTo = input('/dogs');
  readonly closed = output<void>();
  private readonly drawer = viewChild(SdDrawerComponent);

  readonly tab = signal<DogPreviewTab>('overview');
  readonly usage = signal<IDogUsage | null>(null);
  readonly usageState = signal<SdUsageState>('loading');
  /** Code and version of a readable dog; loaded when the preview opens. */
  readonly code = signal<string | null>(null);
  readonly codeState = signal<'idle' | 'loading' | 'error' | 'ready'>('idle');
  readonly version = signal<number | null>(null);

  /** code only with READ; access only for the owner and editors (the ACL answers 404 to everyone else). */
  readonly tabs = computed<DogPreviewTab[]>(() => {
    const d = this.dog();
    const out: DogPreviewTab[] = ['overview', 'usage'];
    if (d?.canReadCode) out.push('code');
    if (d && !d.isBase && (d.right === 'edit' || d.own)) out.push('access');
    return out;
  });
  readonly headMeta = computed(() => {
    const d = this.dog();
    if (!d) return '';
    const parts: string[] = [];
    if (d.isBase) parts.push(d.pack ? `base · ${d.pack}` : 'base');
    else if (d.own) parts.push('yours');
    else if (d.group === 'mimic') parts.push('mimic');
    const v = d.runOnly ? d.version : this.version();
    if (v != null) parts.push(`v${v}`);
    if (d.runOnly) parts.push('run only · code stays with its owner');
    return parts.join(' · ');
  });
  readonly codeDog = computed<DogEntry | null>(() => {
    const d = this.dog();
    const code = this.code();
    if (!d || code === null) return null;
    return { id: d.raw.id, lineageId: d.key, name: d.name, codeTs: code, result: null, deletable: false, editable: false, mimic: d.group === 'mimic' };
  });

  constructor() {
    effect(() => {
      const d = this.dog();
      untracked(() => this.reset(d));
    }, { allowSignalWrites: true });
  }

  select(t: DogPreviewTab): void {
    this.tab.set(t);
    // Access (people below the visibility) and code need the whole sheet on a phone, else they sit under the edge.
    if (t === 'access' || t === 'code') this.drawer()?.expandOnPhone();
    if (t === 'code' && this.codeState() === 'idle') this.loadCode();
  }

  loadUsage(): void {
    const d = this.dog();
    if (!d) return;
    this.usageState.set('loading');
    this.dogService.getUsage(d.key).subscribe({
      next: (u) => {
        if (this.dog()?.key !== d.key) return;
        this.usage.set(u);
        this.usageState.set('ready');
      },
      error: () => this.dog()?.key === d.key && this.usageState.set('error'),
    });
  }

  loadCode(): void {
    const d = this.dog();
    if (!d?.canReadCode) return;
    this.codeState.set('loading');
    this.dogService.getById(d.key).subscribe({
      next: (res) => {
        if (this.dog()?.key !== d.key) return;
        const run = res?.data?.theRun;
        this.code.set(typeof run === 'string' ? run : '');
        this.codeState.set('ready');
      },
      error: () => this.dog()?.key === d.key && this.codeState.set('error'),
    });
  }

  private reset(d: DogCatalogEntry | null): void {
    this.tab.set('overview');
    this.usage.set(null);
    this.code.set(null);
    this.codeState.set('idle');
    this.version.set(null);
    if (!d) return;
    this.loadUsage();
    if (d.canReadCode) {
      this.dogService.getVersions(d.key).subscribe({
        next: (res) => this.dog()?.key === d.key && this.version.set(res?.data?.length || null),
        error: () => undefined,
      });
    }
  }
}
