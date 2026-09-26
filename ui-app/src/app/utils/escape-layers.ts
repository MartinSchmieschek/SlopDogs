import { DestroyRef, effect, inject, untracked } from '@angular/core';

/**
 * `Esc` closes the topmost layer, and only that one (6.3): drawers, sheets, menus, pickers, dialogs,
 * the shortcut help and the void cinema register here while they are open, newest last. One document
 * listener asks the top layer to close; a picker over a preview closes the picker, a dialog over a
 * drawer closes the dialog.
 */
interface EscapeLayer {
  close: () => void;
}

const layers: EscapeLayer[] = [];
let listening = false;

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented || !layers.length) return;
  event.preventDefault();
  layers[layers.length - 1].close();
}

/** Puts a layer on top; the returned function takes it off again (idempotent). */
export function pushEscapeLayer(close: () => void): () => void {
  if (!listening && typeof document !== 'undefined') {
    document.addEventListener('keydown', onKeydown);
    listening = true;
  }
  const layer: EscapeLayer = { close };
  layers.push(layer);
  return () => {
    const i = layers.indexOf(layer);
    if (i >= 0) layers.splice(i, 1);
  };
}

/** True while any layer is open — global shortcuts stay quiet under a dialog. */
export function hasEscapeLayer(): boolean {
  return layers.length > 0;
}

/**
 * Registers a layer for as long as `isOpen()` is true (injection context: a constructor or field).
 * Reopening puts it on top again; destroying the component takes it off.
 */
export function escapeLayerWhile(isOpen: () => boolean, close: () => void): void {
  let release: (() => void) | null = null;
  effect(() => {
    const open = isOpen();
    untracked(() => {
      if (open && !release) release = pushEscapeLayer(close);
      else if (!open && release) {
        release();
        release = null;
      }
    });
  });
  inject(DestroyRef).onDestroy(() => release?.());
}
