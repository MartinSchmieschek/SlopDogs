import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { KennelService } from '../../services/kennel.service';
import { AuthService } from '../../services/auth.service';
import { ToastService, pinnedToast } from '../../services/toast.service';
import { escapeLayerWhile } from '../../utils/escape-layers';
import type { IKennelConfig } from '../../models/kennel-config.model';
import type { DogCatalogEntry } from '../../models/dog-catalog';

type PickerState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * `[USE IN KENNEL ▾]` (8.24 v1, 6.5 `sd-kennel-picker`): the kennels the caller may edit and that are not
 * frozen; a pick appends the dog to the kennel's dogIds. A run-only dog goes in as its version GUID —
 * the server refuses a lineageId (`pin_required`, P3.5) — and the toast says so. A kennel that already
 * holds the dog is a link (`Open in kennel`). Anonymous: the button leads to the login and back.
 */
@Component({
  selector: 'sd-kennel-picker',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="sd-btn sd-btn--primary use" [attr.aria-expanded]="open()" aria-haspopup="true"
      (click)="toggle()">Use in kennel ▾</button>
    @if (open()) {
      <span class="scrim" (click)="open.set(false)" aria-hidden="true"></span>
      <div class="menu sd-lift sd-rise" role="menu" aria-label="Your kennels">
        <p class="sd-label cap">{{ dog().runOnly ? 'pin to a kennel you edit' : 'add to a kennel you edit' }}</p>
        @switch (state()) {
          @case ('loading') { <p class="sd-small note">loading …</p> }
          @case ('error') { <p class="sd-small note err">Couldn't load your kennels. <button type="button" class="sd-btn sd-btn--sm" (click)="load()">Retry</button></p> }
          @default {
            @for (k of kennels(); track k.id) {
              @if (holds(k)) {
                <a class="it in" role="menuitem" [routerLink]="['/kennels', ref(k)]">
                  <span class="em" aria-hidden="true">{{ k.emoji || '🐕' }}</span><span class="kn">{{ k.name || ref(k) }}</span>
                  <span class="sd-small tag">Open in kennel</span>
                </a>
              } @else {
                <button type="button" class="it" role="menuitem" [disabled]="busy() !== null" (click)="pick(k)">
                  <span class="em" aria-hidden="true">{{ k.emoji || '🐕' }}</span><span class="kn">{{ k.name || ref(k) }}</span>
                  <span class="sd-small tag">{{ busy() === k.id ? (dog().runOnly ? 'pinning …' : 'adding …') : '' }}</span>
                </button>
              }
            } @empty {
              <p class="sd-small note">No kennel you can edit.</p>
            }
          }
        }
      </div>
    }
  `,
  styles: [`
    :host { position: relative; display: inline-block; }
    .scrim { position: fixed; inset: 0; z-index: calc(var(--z-drawer) + 2); }
    .menu { position: absolute; bottom: calc(100% + 6px); left: 0; z-index: calc(var(--z-drawer) + 3); width: min(320px, calc(100vw - 32px));
      max-height: min(360px, 60dvh); overflow: auto; padding: var(--s2) 0; background: var(--paper-2); }
    .cap { padding: 0 var(--s3); margin-bottom: var(--s1); color: var(--ink-2); }
    .note { padding: var(--s2) var(--s3); margin: 0; color: var(--ink-2); }
    .err { color: var(--danger-ink); display: flex; gap: var(--s2); align-items: center; }
    .it { display: flex; align-items: center; gap: var(--s2); width: 100%; min-height: var(--touch); padding: 0 var(--s3);
      border: 0; background: none; color: var(--ink); font: inherit; text-align: left; text-decoration: none; cursor: pointer; }
    .it:hover:not(:disabled) { background: var(--paper-3); }
    .it:disabled { cursor: progress; }
    .em { width: 20px; text-align: center; }
    .kn { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tag { color: var(--ink-2); white-space: nowrap; }
    .in .tag { text-decoration: underline; text-decoration-color: var(--line-strong); text-underline-offset: 3px; }
    /* In the sheet the menu would be clipped by the scrolling body: it floats above the footer instead. */
    @media (max-width: 767px) { .menu { position: fixed; left: var(--s4); right: var(--s4); bottom: 84px; width: auto; max-height: 55dvh; } }
  `],
})
export class SdKennelPickerComponent {
  private readonly kennelService = inject(KennelService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly dog = input.required<DogCatalogEntry>();
  /** Where the login comes back to — the browser with this dog's preview open. */
  readonly returnTo = input('/dogs');

  readonly open = signal(false);
  readonly state = signal<PickerState>('idle');
  readonly busy = signal<string | null>(null);
  private readonly all = signal<IKennelConfig[]>([]);

  /** Editable and not frozen (8.25); your own first, then the most recently changed. */
  readonly kennels = computed(() => {
    const userId = this.auth.user()?.id ?? null;
    const own = (k: IKennelConfig) => (k.myRights?.own ?? k.ownerId === userId) ? 0 : 1;
    return this.all()
      .filter((k) => (k.myRights ? k.myRights.edit : true) && !(k.frozen ?? k.myRights?.frozen))
      .sort((a, b) => own(a) - own(b));
  });

  toggle(): void {
    if (!this.auth.isReady()) return;
    if (!this.auth.user()) {
      this.auth.login(this.returnTo());
      return;
    }
    this.open.update((v) => !v);
    if (this.open() && this.state() !== 'ready') this.load();
  }

  load(): void {
    this.state.set('loading');
    this.kennelService.getPage({ limit: 200, sort: 'updatedAt', dir: 'desc' }).subscribe({
      next: (res) => {
        this.all.set(res.data ?? []);
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }

  ref(k: IKennelConfig): string {
    return k.lineageId || k.id;
  }

  holds(k: IKennelConfig): boolean {
    const refs = this.dog().kennelRefs;
    return (k.dogIds ?? []).some((id) => refs.includes(id));
  }

  /** Reads the kennel fresh (another tab may have changed it), then appends the dog. */
  pick(k: IKennelConfig): void {
    const dog = this.dog();
    const ref = this.ref(k);
    const name = k.name || ref;
    this.busy.set(k.id);
    this.kennelService.getById(ref).subscribe({
      next: (res) => {
        const ids = res.data?.dogIds ?? k.dogIds ?? [];
        if (ids.some((id) => dog.kennelRefs.includes(id))) {
          this.finish(`${dog.name} is already in ${name}.`);
          return;
        }
        this.kennelService.update(ref, { dogIds: [...ids, dog.ref] }).subscribe({
          next: (put) => {
            if (put && put.ok === false) {
              this.finish(`Couldn't add ${dog.name}: ${put.error ?? 'refused'}.`);
              return;
            }
            this.all.update((list) => list.map((x) => (x.id === k.id ? { ...x, dogIds: [...ids, dog.ref] } : x)));
            this.finish(dog.runOnly
              ? pinnedToast(dog.version)
              : `Added ${dog.name} to ${name}.`);
          },
          error: (err) => this.finish(`Couldn't add ${dog.name}: ${err?.error?.error ?? err?.status ?? 'network'}.`),
        });
      },
      error: (err) => this.finish(`Couldn't open ${name} (${err?.status ?? 'network'}).`),
    });
  }

  private finish(text: string): void {
    this.busy.set(null);
    this.open.set(false);
    this.toast.show(text);
  }

  constructor() {
    // Esc closes the picker, not the preview under it (the picker is the top layer while open).
    escapeLayerWhile(() => this.open(), () => this.open.set(false));
  }
}
