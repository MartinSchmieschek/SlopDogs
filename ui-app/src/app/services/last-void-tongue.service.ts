import { Injectable, signal } from '@angular/core';
import type { RequiemLoadingQuote } from '../data/requiem-loading';

/** v2: enthält iconSrc/name für die Requiem-Glyphe */
const STORAGE_KEY = 'jsonAggregator.lastVoidTongue.v2';

export type VoidTongueSnapshot = Pick<
  RequiemLoadingQuote,
  'keyword' | 'line1' | 'line2' | 'iconSrc' | 'name'
>;

/**
 * Zuletzt im Lade-Overlay gezeigte Void-Tongue inkl. Requiem-Glyphe (Icon-Pfad).
 */
@Injectable({ providedIn: 'root' })
export class LastVoidTongueService {
  readonly snapshot = signal<VoidTongueSnapshot | null>(null);

  constructor() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as Partial<VoidTongueSnapshot>;
      if (
        typeof p.keyword === 'string' &&
        typeof p.line1 === 'string' &&
        typeof p.line2 === 'string' &&
        typeof p.iconSrc === 'string' &&
        typeof p.name === 'string'
      ) {
        this.snapshot.set({
          keyword: p.keyword,
          line1: p.line1,
          line2: p.line2,
          iconSrc: p.iconSrc,
          name: p.name,
        });
      }
    } catch {
      /* ignore */
    }
  }

  remember(quote: RequiemLoadingQuote): void {
    const v: VoidTongueSnapshot = {
      keyword: quote.keyword,
      line1: quote.line1,
      line2: quote.line2,
      iconSrc: quote.iconSrc,
      name: quote.name,
    };
    this.snapshot.set(v);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  }
}
