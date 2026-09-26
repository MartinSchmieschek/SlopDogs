import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import type { HttpErrorResponse } from '@angular/common/http';
import { AclService, type AclEntity } from '../../services/acl.service';
import type { KennelVisibility } from '../../models/kennel-config.model';
import type { AclRole, IAclUpdate, IAclView } from '../../models/user.model';
export type { AclEntity } from '../../services/acl.service';
import {
  ACCESS_RIGHTS,
  LIST_ROLES,
  RIGHTS_OF_ROLE,
  VISIBILITY_OPTIONS,
  accessErrorText,
  accessRows,
  listsWith,
  looksLikeEmail,
  rightsOfEveryone,
  type AccessRow,
} from '../../utils/access-roles';

import { escapeLayerWhile } from '../../utils/escape-layers';

type PanelState = 'loading' | 'ready' | 'hidden' | 'error';

/**
 * Access panel (6.4 S8, 6.5 `sd-access-panel`) for a kennel (settings drawer) or a dog (inspector,
 * preview): visibility in three steps, people with roles owner / editor / reader / runner and their
 * rights chips `run · read · edit` (W16: copy = read, no copy switch), freeze (owner; community only
 * the super-user), transfer and release. Only the owner changes anything; editors see it read-only;
 * everyone else gets 404 from the server and sees the visibility with a note. Every change saves on
 * its own (`PUT …/acl`), the row it touches dims while it saves and carries its own error line.
 */
@Component({
  selector: 'sd-access-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sd-access-panel.component.html',
  styleUrls: ['./sd-access-panel.component.scss'],
})
export class SdAccessPanelComponent {
  private readonly acl = inject(AclService);

  readonly entity = input.required<AclEntity>();
  readonly entityId = input.required<string>();
  /** What the caller already knows, for the read-only fallback when the ACL is not theirs to see. */
  readonly visibility = input<KennelVisibility | null | undefined>(null);
  readonly frozenChange = output<boolean>();
  /** Ownership moved away (transfer or release): the caller's rights changed, reload them. */
  readonly ownershipChanged = output<void>();
  readonly visibilityChange = output<KennelVisibility>();

  readonly state = signal<PanelState>('loading');
  readonly view = signal<IAclView | null>(null);
  readonly loadError = signal<string | null>(null);
  /** The row (person id, `visibility`, `add`, `freeze`) that is saving right now. */
  readonly busy = signal<string | null>(null);
  readonly rowError = signal<{ key: string; text: string } | null>(null);
  readonly newPerson = signal('');
  readonly newRole = signal<Exclude<AclRole, 'owner'>>('reader');
  readonly transferOpen = signal(false);
  readonly transferTo = signal('');
  readonly releaseAsk = signal(false);

  readonly visibilityOptions = VISIBILITY_OPTIONS;
  readonly listRoles = LIST_ROLES;
  readonly allRights = ACCESS_RIGHTS;
  readonly noun = computed(() => (this.entity() === 'kennel' ? 'kennel' : 'dog'));

  readonly rows = computed<AccessRow[]>(() => {
    const v = this.view();
    return v ? accessRows(v) : [];
  });
  readonly frozen = computed(() => !!this.view()?.frozen);
  readonly own = computed(() => !!this.view()?.myRights.own);
  /** The owner changes visibility and people; nobody does while it is frozen (8.25). */
  readonly manage = computed(() => this.own() && !this.frozen());
  readonly community = computed(() => {
    const v = this.view();
    return !!v && !v.ownerId;
  });
  readonly currentVisibility = computed<KennelVisibility>(() => this.view()?.visibility ?? this.visibility() ?? 'private');
  readonly everyone = computed(() => rightsOfEveryone(this.currentVisibility()));
  readonly addProblem = computed(() => {
    const p = this.newPerson().trim();
    if (!p || looksLikeEmail(p)) return null;
    return 'An email address, like name@example.com.';
  });

  constructor() {
    // The transfer dialog sits over the drawer: Esc closes the dialog, the drawer stays.
    escapeLayerWhile(() => this.transferOpen(), () => this.transferOpen.set(false));
    effect(() => {
      const entity = this.entity();
      const id = this.entityId();
      untracked(() => this.load(entity, id));
    }, { allowSignalWrites: true });
  }

  rights(role: AclRole): readonly string[] {
    return RIGHTS_OF_ROLE[role];
  }

  initial(row: AccessRow): string {
    return (row.label.trim().charAt(0) || '?').toUpperCase();
  }

  reload(): void {
    this.load(this.entity(), this.entityId());
  }

  private load(entity: AclEntity, id: string): void {
    if (!id) return;
    this.state.set('loading');
    this.rowError.set(null);
    this.acl.get(entity, id).subscribe({
      next: (v) => {
        if (id !== this.entityId()) return;
        this.view.set(v);
        this.state.set('ready');
      },
      error: (err: HttpErrorResponse) => {
        if (id !== this.entityId()) return;
        this.view.set(null);
        if (err.status === 404 || err.status === 401) {
          this.state.set('hidden');
          return;
        }
        this.loadError.set(`Couldn't load access (${err.status || 'network'}).`);
        this.state.set('error');
      },
    });
  }

  setVisibility(v: KennelVisibility): void {
    if (!this.manage() || v === this.currentVisibility()) return;
    this.save('visibility', { visibility: v }, () => this.visibilityChange.emit(v));
  }

  setRole(row: AccessRow, role: string): void {
    const view = this.view();
    if (!view || !this.manage() || row.role === 'owner') return;
    if (role === 'owner') {
      this.openTransfer(row.email ?? row.id);
      return;
    }
    this.save(row.id, listsWith(view, row.id, role as Exclude<AclRole, 'owner'>));
  }

  remove(row: AccessRow): void {
    const view = this.view();
    if (!view || !this.manage() || row.role === 'owner') return;
    this.save(row.id, listsWith(view, row.id, null));
  }

  add(): void {
    const view = this.view();
    const who = this.newPerson().trim();
    if (!view || !this.manage() || !who || this.addProblem()) return;
    // The server resolves the email to a user id (400 invalid_user when nobody has that address).
    this.save('add', listsWith(view, who, this.newRole()), () => this.newPerson.set(''));
  }

  toggleFreeze(on: boolean): void {
    const view = this.view();
    if (!view || !this.own() || on === view.frozen) return;
    const call = on ? this.acl.freeze(this.entity(), this.entityId()) : this.acl.unfreeze(this.entity(), this.entityId());
    this.busy.set('freeze');
    this.rowError.set(null);
    call.subscribe({
      next: () => {
        this.view.update((v) => (v ? { ...v, frozen: on, myRights: { ...v.myRights, frozen: on } } : v));
        this.busy.set(null);
        this.frozenChange.emit(on);
      },
      error: (err: HttpErrorResponse) => this.fail('freeze', err),
    });
  }

  openTransfer(prefill = ''): void {
    if (!this.manage()) return;
    this.transferTo.set(prefill);
    this.transferOpen.set(true);
  }

  confirmTransfer(): void {
    const to = this.transferTo().trim();
    if (!to || !this.manage()) return;
    this.busy.set('transfer');
    this.rowError.set(null);
    this.acl.transfer(this.entity(), this.entityId(), to).subscribe({
      next: () => {
        this.busy.set(null);
        this.transferOpen.set(false);
        this.ownershipChanged.emit();
        this.reload();
      },
      error: (err: HttpErrorResponse) => this.fail('transfer', err),
    });
  }

  release(): void {
    if (!this.manage() || this.community()) return;
    this.busy.set('release');
    this.rowError.set(null);
    this.acl.release(this.entity(), this.entityId()).subscribe({
      next: (r) => {
        this.busy.set(null);
        this.releaseAsk.set(false);
        if (r?.error) {
          this.rowError.set({ key: 'release', text: typeof r.error === 'string' ? r.error : "Couldn't release ownership." });
          return;
        }
        this.ownershipChanged.emit();
        this.reload();
      },
      error: (err: HttpErrorResponse) => this.fail('release', err),
    });
  }

  private save(key: string, patch: IAclUpdate, done?: () => void): void {
    this.busy.set(key);
    this.rowError.set(null);
    this.acl.update(this.entity(), this.entityId(), patch).subscribe({
      next: (v) => {
        this.busy.set(null);
        this.view.set(v);
        done?.();
      },
      error: (err: HttpErrorResponse) => this.fail(key, err),
    });
  }

  private fail(key: string, err: HttpErrorResponse): void {
    this.busy.set(null);
    this.rowError.set({ key, text: accessErrorText(err.status, err.error?.error, err.error?.error_description) });
  }
}
