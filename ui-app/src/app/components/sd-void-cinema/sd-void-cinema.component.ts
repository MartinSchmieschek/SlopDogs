import {
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { escapeLayerWhile } from '../../utils/escape-layers';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';
import { bindYoutubePlayerEnded } from '../../utils/youtube-embed';

/**
 * The void cinema (8.18, was `error-video-popup`): opened by a click on an error banner (error video)
 * or on the iris of the veil (loading video) through {@link ErrorVideoPopupService}. Behaviour as before:
 * a click anywhere or Escape closes it, the end of the video closes it, whisper lines from the last verse.
 * Look: ink at 96 %, the frame in 2 px paper with the landing's `.cmd` shadow in tape orange.
 */
@Component({
  selector: 'sd-void-cinema',
  standalone: true,
  template: `
    @if (popup.open()) {
      <div
        class="cinema"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="headLabel()"
        [attr.aria-describedby]="describedBy()"
        (click)="close()">
        <span id="sd-cinema-hint" class="sd-sr-only">Click anywhere or press Escape to close.</span>
        <p class="head">{{ headLabel() }}</p>
        <button type="button" class="x" aria-label="Close" (click)="close(); $event.stopPropagation()">×</button>
        <div class="frame">
          <iframe
            id="sd-void-yt-iframe"
            [src]="safeEmbed()"
            title="YouTube"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen></iframe>
          <div class="sheet" aria-hidden="true"></div>
        </div>
        @if (lines().length) {
          <div id="sd-cinema-lines" class="lines" aria-live="polite">
            @for (line of lines(); track $index) {
              <p>{{ line }}</p>
            }
          </div>
        }
      </div>
    }
  `,
  styleUrls: ['./sd-void-cinema.component.scss'],
})
export class SdVoidCinemaComponent {
  readonly popup = inject(ErrorVideoPopupService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly injector = inject(Injector);

  private player: { destroy: () => void } | null = null;
  /** Raised on every close or switch, so a pending attach from before is dropped. */
  private bindOp = 0;

  readonly safeEmbed = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.popup.embedUrl()));
  readonly headLabel = computed(() => this.popup.headLabel()?.trim() || 'Distant signal');
  readonly lines = computed(() =>
    (this.popup.voidSubtitleLines() ?? []).map((l) => l.trim()).filter((l) => l.length > 0),
  );
  readonly describedBy = computed(() =>
    this.lines().length ? 'sd-cinema-hint sd-cinema-lines' : 'sd-cinema-hint',
  );

  constructor() {
    escapeLayerWhile(() => this.popup.open(), () => this.close());
    effect(() => {
      const open = this.popup.open();
      void this.popup.embedUrl();
      if (!open) {
        this.teardown();
        return;
      }
      afterNextRender(() => void this.attachEndedHandler(), { injector: this.injector });
    });
  }

  close(): void {
    this.popup.closePopup();
  }

  private teardown(): void {
    this.bindOp++;
    try {
      this.player?.destroy();
    } catch {
      /* ignore */
    }
    this.player = null;
  }

  /** Closes the cinema when the video ends (YouTube IFrame API). */
  private async attachEndedHandler(): Promise<void> {
    this.teardown();
    const op = this.bindOp;
    try {
      const player = await bindYoutubePlayerEnded('sd-void-yt-iframe', () => this.popup.closePopup());
      if (op !== this.bindOp || !this.popup.open()) {
        player?.destroy();
        return;
      }
      this.player = player;
    } catch {
      /* no IFrame API — closing stays manual */
    }
  }
}
