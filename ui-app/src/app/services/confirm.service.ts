import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'quiet' | 'primary' | 'danger';
}

interface OpenRequest extends ConfirmRequest {
  resolve: (ok: boolean) => void;
}

/** "Unsaved changes. Leave anyway?" — the one wording for every editor that can lose work (6.4 S2/S3). */
export const LEAVE_UNSAVED: ConfirmRequest = {
  title: 'Unsaved changes. Leave anyway?',
  message: 'What you changed here is not saved.',
  confirmLabel: 'Leave',
  cancelLabel: 'Keep editing',
  variant: 'danger',
};

/**
 * Asks with `sd-confirm` from anywhere — a route guard, a list row, a drawer — and answers with a promise.
 * One question at a time: a second ask while one is open answers the first with `false`.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly pending = signal<OpenRequest | null>(null);

  readonly request = this.pending.asReadonly();

  ask(request: ConfirmRequest): Promise<boolean> {
    this.pending()?.resolve(false);
    return new Promise<boolean>((resolve) => this.pending.set({ ...request, resolve }));
  }

  answer(ok: boolean): void {
    const open = this.pending();
    if (!open) return;
    this.pending.set(null);
    open.resolve(ok);
  }
}
