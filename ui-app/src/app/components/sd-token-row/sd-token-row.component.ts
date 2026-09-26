import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { IPersonalToken } from '../../services/token.service';

/**
 * One personal access token as a tracklist row (6.5 `sd-token-row`): number, the first eight of its
 * id, the state chip, created and expiry dates, `[Revoke]` with a second tap to confirm. The value is
 * never listed — it was shown once, when it was made.
 */
@Component({
  selector: 'sd-token-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row" role="listitem" [class.busy]="busy()" [class.dead]="token().status !== 'active'">
      <span class="n">{{ number() }}</span>
      <span class="main">
        <span class="l1"><span class="sd-data id">{{ token().jti.slice(0, 8) }}…</span>
          <span class="sd-chip" [class.sd-chip--live]="token().status === 'active'" [class.sd-chip--soft]="token().status !== 'active'">{{ token().status }}</span></span>
        <span class="sd-small sd-muted l2">created {{ day(token().createdAt) }} · {{ token().status === 'revoked' ? 'revoked ' + day(token().revokedAt) : 'expires ' + day(token().expiresAt) }}</span>
      </span>
      @if (token().status === 'active') {
        @if (asking()) {
          <span class="ask">
            <button type="button" class="sd-btn sd-btn--sm sd-btn--danger" [disabled]="busy()" (click)="asking.set(false); revoke.emit(token())">Revoke</button>
            <button type="button" class="sd-btn sd-btn--sm sd-btn--bare" (click)="asking.set(false)">Keep</button>
          </span>
        } @else {
          <button type="button" class="sd-btn sd-btn--sm" [disabled]="busy()" (click)="asking.set(true)">Revoke</button>
        }
      }
    </div>
  `,
  styles: [`
    .row { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; align-items: center; gap: 0 var(--s2);
      min-height: 56px; padding: var(--s1) 0; border-bottom: 1px solid var(--line); }
    .row.busy { opacity: .6; }
    .row.dead .id { color: var(--ink-3); text-decoration: line-through; }
    .n { font: 400 20px/1 var(--font-display); color: var(--ink-3); }
    .main { min-width: 0; }
    .l1, .l2 { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .id { margin-right: var(--s2); }
    .ask { display: flex; gap: var(--s1); }
  `],
})
export class SdTokenRowComponent {
  readonly token = input.required<IPersonalToken>();
  readonly index = input(0);
  readonly busy = input(false);
  readonly revoke = output<IPersonalToken>();

  readonly asking = signal(false);
  readonly number = computed(() => String(this.index() + 1).padStart(2, '0'));

  day(iso: string | null): string {
    return iso ? String(iso).slice(0, 10) : '—';
  }
}
