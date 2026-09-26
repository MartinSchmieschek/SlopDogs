import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import type { HttpErrorResponse } from '@angular/common/http';
import { UserKeyService } from '../../services/user-key.service';
import type { IUserKey } from '../../models/user-key.model';
import {
  aliasProblem,
  grantProblem,
  keyErrorText,
  keyFormInput,
  normalizeDomain,
  secretProblem,
  type KeyField,
} from '../../utils/user-keys';
import { SdDrawerComponent } from '../sd-drawer/sd-drawer.component';
import { SdBannerComponent } from '../sd-banner/sd-banner.component';

/**
 * The add-key sheet (6.4 S9, 6.5 `sd-key-form`): alias with the rule live, the value in a password
 * field (`Shown once. Never again.` — after the save it is dropped from memory and never shown),
 * allowed domains as chips, and folded away `Grant to kennels` with the daily quota it requires (8.8).
 * An existing alias is replaced (the server upserts per alias).
 */
@Component({
  selector: 'sd-key-form',
  standalone: true,
  imports: [SdDrawerComponent, SdBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sd-key-form.component.html',
  styleUrls: ['./sd-key-form.component.scss'],
})
export class SdKeyFormComponent {
  private readonly keys = inject(UserKeyService);

  readonly open = input(false);
  readonly closed = output<void>();
  readonly saved = output<IUserKey>();

  readonly alias = signal('');
  readonly secret = signal('');
  readonly domainDraft = signal('');
  readonly domains = signal<string[]>([]);
  readonly grantsOpen = signal(false);
  readonly grantDraft = signal('');
  readonly grants = signal<string[]>([]);
  readonly quota = signal('');
  readonly saving = signal(false);
  readonly errors = signal<Partial<Record<KeyField, string>>>({});

  readonly aliasHint = computed(() => aliasProblem(this.alias().trim()));
  readonly secretHint = computed(() => secretProblem(this.secret()));
  /** How a dog names the key: `{{key:<alias>}}` inside `keys.fetch`. */
  readonly aliasRef = computed(() => `{{key:${this.alias().trim()}}}`);

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.reset());
    }, { allowSignalWrites: true });
  }

  private reset(): void {
    this.alias.set('');
    this.secret.set('');
    this.domainDraft.set('');
    this.domains.set([]);
    this.grantsOpen.set(false);
    this.grantDraft.set('');
    this.grants.set([]);
    this.quota.set('');
    this.errors.set({});
  }

  /** Enter, comma or blur turns the draft into a chip — or says why it can't. */
  commitDomain(): boolean {
    const parts = this.domainDraft().split(/[\s,]+/).filter(Boolean);
    if (!parts.length) return true;
    const bad = parts.find((p) => !normalizeDomain(p));
    if (bad) {
      this.errors.update((e) => ({ ...e, domains: `"${bad}" is not a hostname. Use api.example.com or *.example.com.` }));
      return false;
    }
    const next = new Set(this.domains());
    for (const p of parts) next.add(normalizeDomain(p)!);
    this.domains.set([...next]);
    this.domainDraft.set('');
    this.errors.update((e) => ({ ...e, domains: undefined }));
    return true;
  }

  removeDomain(d: string): void {
    this.domains.update((list) => list.filter((x) => x !== d));
  }

  commitGrant(): boolean {
    const parts = this.grantDraft().split(/[\s,]+/).filter(Boolean);
    if (!parts.length) return true;
    const bad = parts.find((p) => grantProblem(p));
    if (bad) {
      this.errors.update((e) => ({ ...e, quota: `"${bad}": ${grantProblem(bad)}` }));
      return false;
    }
    this.grants.set([...new Set([...this.grants(), ...parts])]);
    this.grantDraft.set('');
    this.errors.update((e) => ({ ...e, quota: undefined }));
    return true;
  }

  removeGrant(g: string): void {
    this.grants.update((list) => list.filter((x) => x !== g));
  }

  onChipKey(event: KeyboardEvent, which: 'domain' | 'grant'): void {
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();
    if (which === 'domain') this.commitDomain();
    else this.commitGrant();
  }

  submit(): void {
    if (this.saving() || !this.commitDomain() || !this.commitGrant()) return;
    const result = keyFormInput({
      alias: this.alias(),
      secret: this.secret(),
      domains: this.domains(),
      grants: this.grants(),
      quota: this.quota(),
    });
    if (!result.ok) {
      this.errors.set({ [result.field]: result.error });
      return;
    }
    this.saving.set(true);
    this.errors.set({});
    this.keys.set(result.input).subscribe({
      next: (res) => {
        this.saving.set(false);
        // The value leaves the page with the request: never shown again, not even kept in the form.
        this.secret.set('');
        this.saved.emit(res.key);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const e = keyErrorText(err.status, err.error?.error);
        this.errors.set({ [e.field]: e.text });
      },
    });
  }
}
