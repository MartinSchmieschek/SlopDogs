import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { KENNEL_ID_PATTERN, publicKennelPath } from '../../config/public-paths';
import { KENNEL_EMOJI_PRESETS } from '../../data/kennel-emoji-presets';
import type { KennelVisibility } from '../../models/kennel-config.model';
import { SdBannerComponent } from '../sd-banner/sd-banner.component';
import { escapeLayerWhile } from '../../utils/escape-layers';

export interface KennelCreateData {
  id: string;
  name: string;
  description: string;
  emoji: string;
  visibility: KennelVisibility;
}

/** The segment rule, live and in English (P3 2.6): one URL segment, 1-64 characters. */
export function kennelIdProblem(id: string): string | null {
  if (!id) return null;
  if (id.length > 64) return `At most 64 characters (${id.length}).`;
  if (id === '.' || id === '..' || !KENNEL_ID_PATTERN.test(id)) {
    return /^[._-]/.test(id) && KENNEL_ID_PATTERN.test('a' + id.slice(1))
      ? 'Start with a letter or a digit.'
      : 'IDs are one URL segment: letters, digits, . _ -';
  }
  return null;
}

const VISIBILITIES: readonly { value: KennelVisibility; label: string; hint: string }[] = [
  { value: 'public', label: 'public', hint: 'anyone can run and read' },
  { value: 'run-only', label: 'run only', hint: 'anyone can run, code private' },
  { value: 'private', label: 'private', hint: 'only you and the people you add' },
];

/**
 * The create sheet (6.1 row 8, U2): a right drawer on desktop, a bottom sheet on mobile. ID with the
 * segment rule live, name, description, emoji as a field popover, visibility in three steps (P3.5).
 */
@Component({
  selector: 'sd-kennel-sheet',
  standalone: true,
  imports: [SdBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sd-kennel-sheet.component.html',
  styleUrls: ['./sd-kennel-sheet.component.scss'],
})
export class SdKennelSheetComponent {
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly submitted = output<KennelCreateData>();
  readonly cancelled = output<void>();

  readonly presets = KENNEL_EMOJI_PRESETS;
  readonly visibilities = VISIBILITIES;

  readonly id = signal('');
  readonly name = signal('');
  readonly description = signal('');
  readonly emoji = signal('');
  readonly visibility = signal<KennelVisibility>('private');
  readonly emojiOpen = signal(false);
  readonly touched = signal(false);

  readonly idProblem = computed(() => kennelIdProblem(this.id().trim()));
  readonly idMissing = computed(() => this.touched() && !this.id().trim());
  readonly publicPath = computed(() => (this.id().trim() && !this.idProblem() ? publicKennelPath(this.id().trim()) : ''));
  readonly canSubmit = computed(() => !!this.id().trim() && !this.idProblem() && !this.busy());

  private readonly idBox = viewChild<ElementRef<HTMLInputElement>>('idBox');

  constructor() {
    afterNextRender(() => this.idBox()?.nativeElement.focus());
    escapeLayerWhile(() => true, () => this.onEscape());
  }

  pickEmoji(e: string): void {
    this.emoji.set(e);
    this.emojiOpen.set(false);
  }

  submit(): void {
    this.touched.set(true);
    if (!this.canSubmit()) return;
    this.submitted.emit({
      id: this.id().trim(),
      name: this.name().trim(),
      description: this.description().trim(),
      emoji: this.emoji().trim(),
      visibility: this.visibility(),
    });
  }

  /** Esc: the emoji popover first, then the sheet — while nothing else sits on top (escape layers). */
  private onEscape(): void {
    if (this.emojiOpen()) this.emojiOpen.set(false);
    else if (!this.busy()) this.cancelled.emit();
  }
}
