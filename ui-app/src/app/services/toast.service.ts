import { Injectable, signal } from '@angular/core';

/** How long a toast stays (6.2: one line, 4 s). */
export const TOAST_MS = 4000;

/** One toast: a line, optionally a link after it (`with-link`, 6.5). */
export interface SdToastMessage {
  readonly id: number;
  readonly text: string;
  readonly link?: { label: string; href: string };
}

/**
 * The one toast of the app (6.5 `sd-toast`): every page says what happened through here; `sd-toast`
 * in the app shell shows it. A new line replaces the old one and restarts the 4 s.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly current = signal<SdToastMessage | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  readonly message = this.current.asReadonly();

  show(text: string, link?: SdToastMessage['link']): void {
    this.current.set({ id: ++this.seq, text, link });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.dismiss(), TOAST_MS);
  }

  dismiss(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.current.set(null);
  }
}

/** The pin toast (8.15, 6.8 test 7): the palette, the picker and `Update pin` say it the same way. */
export function pinnedToast(version: number | null | undefined): string {
  return `Pinned to v${version ?? '?'}. Output flows, code never.`;
}
