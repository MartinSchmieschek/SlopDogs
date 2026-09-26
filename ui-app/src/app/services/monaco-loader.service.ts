import { Injectable } from '@angular/core';
import { registerInlayTheme } from '../monaco/inlay-theme';

const MONACO_BASE = '/assets/monaco/vs';
const LOADER_SRC = `${MONACO_BASE}/loader.js`;
const EDITOR_MODULE = 'vs/editor/editor.main';

/**
 * Laedt Monaco erst, wenn ein Editor ihn wirklich braucht — vorher kostet er nichts.
 * Nach dem Laden ist das Theme "inlay" registriert (Registrierungs-Hook, P6 U1).
 *
 * Der Vertrag der frueheren index.html bleibt erhalten: `window.monaco` wird gesetzt
 * und das Ereignis `monaco-ready` auf `window` gefeuert. Geladen wird hoechstens einmal;
 * schlaegt das Laden fehl, wird der gemerkte Zustand verworfen, damit ein spaeterer
 * Versuch erneut laden kann.
 */
@Injectable({ providedIn: 'root' })
export class MonacoLoaderService {
  private pending: Promise<unknown> | null = null;

  ensureMonaco(): Promise<any> {
    const existing = this.globalMonaco;
    if (existing) {
      registerInlayTheme(existing);
      return Promise.resolve(existing);
    }

    this.pending ??= this.load().catch((err) => {
      this.pending = null;
      throw err;
    });
    return this.pending;
  }

  private get globalMonaco(): any {
    return typeof window === 'undefined' ? null : (window as any).monaco ?? null;
  }

  private async load(): Promise<any> {
    if (typeof document === 'undefined') {
      throw new Error('Monaco braucht ein Dokument — auf dem Server nicht verfuegbar.');
    }
    await this.loadAmdLoader();
    return this.requireEditor();
  }

  private loadAmdLoader(): Promise<void> {
    if (typeof (window as any).require === 'function') return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = LOADER_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        reject(new Error(`Monaco-Loader nicht ladbar: ${LOADER_SRC}`));
      };
      document.head.appendChild(script);
    });
  }

  private requireEditor(): Promise<any> {
    const amdRequire = (window as any).require;
    amdRequire.config({ paths: { vs: MONACO_BASE } });

    return new Promise<any>((resolve, reject) => {
      amdRequire(
        [EDITOR_MODULE],
        (loaded: any) => {
          const monaco = (window as any).monaco ?? loaded;
          if (!monaco) {
            reject(new Error('Monaco wurde geladen, stellt aber keine API bereit.'));
            return;
          }
          (window as any).monaco = monaco;
          registerInlayTheme(monaco);
          window.dispatchEvent(new Event('monaco-ready'));
          resolve(monaco);
        },
        (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))),
      );
    });
  }
}
