/**
 * LayoutRenderer.ts — The Helmsman of the Rendered Abyss
 *
 * Arr, this be the vessel that weaves HTML from the void's own loom.
 * In luminous space blackened stars, they gaze, accuse, deny — and yet
 * the renderer presses on, stitching styles and scripts into a page
 * no mortal eye was meant to witness.
 */
import { LayoutBase } from "./layouts/LayoutBase";

/** Arr, base styles that anchor the page — no horizontal scrollin' through the abyss, matey. */
const LAYOUT_BASE_CSS = `
  html {
    height: 100%;
    overflow-x: hidden;
    -webkit-text-size-adjust: 100%;
  }
  *, *::before, *::after {
    box-sizing: border-box;
  }
  body {
    margin: 0;
    padding: 0.5rem;
    min-height: 100%;
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    font-family: system-ui, sans-serif;
  }
  .layout-root {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin: 0 auto;
  }
  img, video, picture, svg, canvas, iframe {
    max-width: 100%;
    height: auto;
  }
`;

/** Arr, the LayoutRenderer — helmsman that weaves fragments from brooding gulfs into a full HTML page, corporeal laws unwritten as the void's will takes form. */
export class LayoutRenderer {
  /**
   * Arr, render the given layout into a complete HTML document, matey.
   * The abyss provides styles, scripts, and markup — through endless faces countless forms, the page emerges whole.
   * @param layout - The accursed layout vessel whose fragments shall be rendered into the deep HTML
   * @returns The full HTML string, a cursed scroll conjured from the void
   */
  render(layout: LayoutBase<any>): string {
    const html = layout.renderHtml();
    const styles = layout.collectStyles();
    const scripts = layout.collectScripts();

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>${LAYOUT_BASE_CSS}</style>
          <style>${styles}</style>
        </head>
        <body>
          <div class="layout-root">
          ${html}
          </div>
          <script>
            ${scripts}

            // Arr, simulate gestures via the keyboard — the crew steers through the void with arrow keys:
            document.addEventListener('keydown', (e) => {
              if (e.key === 'ArrowLeft') window.dispatchEvent(new Event('swipeLeft'));
              if (e.key === 'ArrowRight') window.dispatchEvent(new Event('swipeRight'));
            });
          </script>
        </body>
      </html>
    `;
  }
}
