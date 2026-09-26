import { Injectable, inject, signal } from '@angular/core';
import {
  ERROR_FLASH_VIDEO_EMBED_URL,
  LOADING_EASTER_EGG_EMBED_URL,
  type VideoPopupConfig,
} from '../data/video-popup';
import { VOID_PHILOSOPHY_LINES } from '../data/void-philosophy';
import { LastVoidTongueService } from './last-void-tongue.service';
import { ensureYoutubeIframeApiParams } from '../utils/youtube-embed';

@Injectable({ providedIn: 'root' })
export class ErrorVideoPopupService {
  private lastVoid = inject(LastVoidTongueService);

  readonly open = signal(false);
  readonly embedUrl = signal<string>(LOADING_EASTER_EGG_EMBED_URL);
  readonly headLabel = signal<string | undefined>(undefined);
  readonly voidSubtitleLines = signal<string[] | undefined>(undefined);

  /** Void-Kino — z. B. angepasstes Embed oder Texte. */
  openWithConfig(config: VideoPopupConfig): void {
    this.embedUrl.set(ensureYoutubeIframeApiParams(config.embedUrl));
    this.headLabel.set(config.headLabel);
    this.voidSubtitleLines.set(config.voidSubtitleLines);
    this.open.set(true);
  }

  /**
   * Klick auf Fehlermeldung: gleiches Void-Kino, **anderes** Video als Lade-Iris
   * ({@link ERROR_FLASH_VIDEO_EMBED_URL}).
   */
  openPopup(_errorText?: string | null): void {
    this.openWithConfig({
      embedUrl: ERROR_FLASH_VIDEO_EMBED_URL,
      headLabel: 'Distant signal',
      voidSubtitleLines: this.voidLinesForEasterEgg(),
    });
  }

  /** Ladebildschirm-Iris — eigenes Video ({@link LOADING_EASTER_EGG_EMBED_URL}). */
  openLoadingEasterEgg(): void {
    this.openWithConfig({
      embedUrl: LOADING_EASTER_EGG_EMBED_URL,
      headLabel: 'Distant signal',
      voidSubtitleLines: this.voidLinesForEasterEgg(),
    });
  }

  closePopup(): void {
    this.open.set(false);
    this.reset();
  }

  private voidLinesForEasterEgg(): string[] {
    const snap = this.lastVoid.snapshot();
    if (snap) {
      return [snap.keyword, snap.line1, snap.line2];
    }
    return [...VOID_PHILOSOPHY_LINES];
  }

  private reset(): void {
    this.embedUrl.set(LOADING_EASTER_EGG_EMBED_URL);
    this.headLabel.set(undefined);
    this.voidSubtitleLines.set(undefined);
  }
}
