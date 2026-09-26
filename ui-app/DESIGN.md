# SlopDogs app — design: the Mixtape inlay

Source: `docs/slopdogs/PLAN.md` P6 6.2 (Follie revision 2, decisions 8.18-8.27). The landing is the cassette
cover (big Bebas, hard offset shadows, marquee, tilted covers — `seed-data/kennels/slopdogs-landing/skin_c.js`).
The app is the **inlay card and the deck**: the folded paper in the case, the tracklist typed with a label maker,
running times written by hand, and the machine that plays it. A tool, not a poster.

## What the app takes from the cover, and how much

| Landing element | In the app | Dose |
|---|---|---|
| Cream `#f0e6c8` / cream 2 `#f7f0da`, ink `#1b1712` | page, surfaces, text | everywhere |
| Tape orange `#ff6a00` | the one action: primary button, focus ring | at most two visible uses per screen |
| Inlay teal `#117f7f` | semantic only: live, ok, cached, "yours" | state words and fills, never decoration |
| Bebas Neue | chapter cards and kennel names | chapter card, track titles, kennel head |
| Courier Prime | UI body, data, labels, code | everywhere (8.23) |
| Pirata One | the SD emblem in the top bar | one place |
| Label maker (ink chip, cream mono uppercase) | status, role, visibility, wave labels, frozen | the badge language |
| Chapter card (ink band, kicker, Bebas title) | page heads `side A · kennels`, kennel head | one per page |
| Tracklist (number, title, length) | kennel list, dog browser, palette | the list language |
| Hard `5px 5px 0` shadows | `4px 4px 0` only on drawers, sheets, dialogs, toasts, the lead card (`.sd-lift`) | turned down |
| Tape deck with turning reels | run indicator and the veil | one motif |
| Tilted covers, marquee, vignette | not in the app | none |

## Tokens (`src/styles.scss`, `@layer tokens`)

```css
--paper: #f0e6c8;  --paper-2: #f7f0da;  --paper-3: #e6dbb8;
--ink: #1b1712;    --ink-2: #5a5142;    --ink-3: #9c917a;   --ink-soft: #bfb595;
--line: rgba(27,23,18,.18);  --line-strong: rgba(27,23,18,.40);  --grid: rgba(27,23,18,.14);
--accent: #ff6a00;  --accent-ink: #1b1712;  --accent-soft: rgba(255,106,0,.16);
--live: #117f7f;    --live-ink: #0d6666;    --live-soft: rgba(17,127,127,.12);
--warn-ink: #8a5a00;  --warn-soft: rgba(138,90,0,.12);
--danger-ink: #b3261e;  --danger-soft: rgba(179,38,30,.12);
--focus: var(--accent);
```

`[data-theme="dark"]` ("tape shell") holds overrides only; it is v2 (8.27) and not switched on.

Contrast (Follie, computed by hand — measure with a tool, R28): ink on paper 14.3:1, ink-2 on paper 6.3:1,
ink on accent 6.2:1, accent on paper 2.3:1 (fails: orange is never text on paper, only a fill or a 3 px
underline), ink-3 on paper 2.5:1 (decoration and placeholders only), paper-2 on live 4.2:1 (teal chips at
12 px 700 or larger, otherwise `--live-soft` with `--live-ink` text).

Accent budget per screen: **two** visible uses (primary button, focus ring). Links are ink with a 1 px
`--line-strong` underline; the active sort is an ink chip, never orange. Stars are ink outlines, empty in
`--ink-3`; orange only as the hover preview.

## Type

Display **Bebas Neue** (400, uppercase) · body and mono **Courier Prime** (400, 700) · emblem **Pirata One**.
Self-hosted woff2 under `public/fonts/` (Latin subsets, `OFL.txt`); no font CDN.

| Role | Size / line | Cut | Tracking | Where |
|---|---|---|---|---|
| Chapter | 40/36 desktop, 28/26 mobile | Bebas 400 | .03em | chapter card title, kennel name in the head |
| Chapter kicker | 11/14 | Courier 400 uppercase | .22em | `side A · 42 tracks` |
| H1 | 18/24 | Courier 700 | 0 | drawer and dialog titles |
| H2 | 14/20 | Courier 700 uppercase | .06em | sections in inspectors and forms |
| Body | 14/21 | Courier 400 | 0 | everything |
| Small | 12/17 | Courier 400 | 0 | meta lines, hints |
| Label | 11/14 | Courier 700 uppercase | .16em | chips |
| Data | 13/19 | Courier 400 tabular-nums | 0 | URLs, counters, times, IDs |
| Code | 13/20 | Courier 400 | 0 | Monaco, JSON, results |

700 only for H1, H2 and label chips; emphasis in running text is `--ink` against `--ink-2`, never bold.

## Primitives (`@layer primitives`, global)

- `.sd-btn` — quiet by default (transparent, 2 px ink, no radius, 36/44 px, Courier 700 13 uppercase .06em,
  hover lifts 1 px with `3px 3px 0` ink). Modifiers: `--primary` (orange fill, ink text), `--ink`
  (chapter cards and dark drawer heads), `--danger` (2 px danger ink, never a red fill), `--icon` (36×36),
  `--sm` (32), `--lg` (44), `--bare`.
- `.sd-field`, `.sd-textarea` — `--paper-2` fill, 2 px ink underline only (typewriter line), focus
  `outline: 3px var(--focus)`; `.sd-label`, `.sd-hint`, `.sd-hint--error`.
- `.sd-chip` — label maker: ink fill, paper text. `--live` (teal, 12 px), `--soft` (paper-3 / ink-2),
  `--frozen` (paper-3 / ink), `--outline` (filters; `aria-pressed="true"` = ink fill).
- `.sd-switch` — a checkbox styled as a typewriter toggle; the ink square slides.
- `.sd-tabs` / `.sd-tab` — labels, active = 3 px ink underline.
- `.sd-lift` — the one hard shadow (2 px ink, `4px 4px 0`).
- `.sd-skel` — skeleton bar, paper-3, no shimmer.

Component styles carry layout only (no `@use` of primitives); small parts use inline `styles` (≤ 2 kB,
OnPush); component stylesheets aim at ≤ 8 kB, cap 12 kB (`anyComponentStyle` warns at 20 kB).

## Monaco theme "inlay"

`src/app/monaco/inlay-theme.ts`, registered by `MonacoLoaderService` after loading. Background `--paper-2`,
text `--ink`, comments `--ink-3` italic, keywords ink 700, strings `--live-ink`, numbers `--warn-ink`,
errors `--danger-ink`, line numbers `--ink-3`, current line `--paper-3`, selection `--accent-soft`, cursor ink
2 px, Courier Prime 13/20, no ligatures (`INLAY_EDITOR_OPTIONS`).

## Canvas "ruled inlay" (8.22, built in U3)

Cream canvas with a 24 px dot grid in `--grid`; each wave a band (cream, cream 2, …) separated by a 1 px
dashed ink line, a label-maker chip `wave 01` on the left. Foreign run-only dogs and silhouettes are the only
ink-filled cards.

## Layout and motion

Spacing on a 4 pt grid (`--s1` 4 … `--s8` 64); **no radius tokens** — corners are square like paper; gutter
`clamp(16px, 4vw, 40px)`; list and browser max 1120 px. Three levels: ground (`--paper`, z 0), sheet
(`--paper-2`, 1 px line or 2 px ink, z 1), floating (drawer, sheet, menu, dialog, toast: 2 px ink,
`4px 4px 0`, z 80/100/200). No soft shadows.

`--ease-out cubic-bezier(.16,1,.3,1)`; `--ease-slam cubic-bezier(.22,1.5,.36,1)` for exactly two moments
(status chip at the end of a run, a star being set); `--dur-fast 120ms`, `--dur-base 200ms`,
`--dur-slow 320ms`. Reels `3s linear infinite` while running. Row stagger 24 ms (fade, 4 px rise), max 12 rows.
`prefers-reduced-motion`: reels static, stagger and slam .01 ms — per class, never `*`. Breakpoints
`sm 640, md 768, lg 1024, xl 1440`; touch targets 44 px mobile / 36 px desktop; nothing hover-only.

## Toast, dialog, keys (U8)

- **Toast** (`sd-toast`, `ToastService`): one line of ink with paper text, bottom centre (above the bottom bar on
  a phone), 4 s, a new line replaces the old; optional link. Once in the app shell; pages call
  `ToastService.show()`. Say what happened: `Link copied.`, `Pinned to v7. Output flows, code never.`
- **Dialog** (`sd-confirm`, `ConfirmService.ask()`): paper, `.sd-lift`, H1 title, one message line, optional
  projected field, `[Cancel]` and the confirm button (quiet, primary for a form, danger for loss). Focus goes to
  the field or Cancel and comes back on close; Tab stays inside. No `window.confirm` anywhere.
- **Unsaved changes. Leave anyway?** — one wording (`LEAVE_UNSAVED`) for the settings drawer, the dog code in
  the inspector and the brief: asked on close, on `‹ kennel`, on another dog, on route change (guard) and by the
  browser on tab close.
- **Escape layers** (`utils/escape-layers.ts`): drawers, sheets, menus, pickers, dialogs, the key help and the
  cinema register while open; `Esc` closes only the top one. A field that uses `Esc` itself calls
  `preventDefault()`.
- **Keys**: `?` key help (outside fields) · `/` search on kennels and dogs · `Esc` top layer ·
  `Ctrl/⌘+Enter` run · `Ctrl/⌘+S` save the open editor (settings, dog code, brief) on the kennel page.
- **Motion**: `.sd-rise` (fade, 4 px rise, 200 ms ease-out) for menus, dialogs, toasts; `.sd-fade` for scrims;
  drawers slide 24 px from their side, sheets 48 px up. Reduced motion: .01 ms, per class.

## Underground, dosed

Chapter card on top of every page; label-maker chips; reels that turn while a kennel runs; one requiem verse
on the veil and the login; the void cinema after a click on an error banner and the iris on the veil (8.18).
That is the whole list.

- **Veil** (`sd-veil`): nothing for 3 s, then paper at 92 %, the 96 px tape deck, `WAKING THE KENNEL 0:42`,
  a 2 px ink progress line (deterministic ease-out over 120 s up to 90 %), one verse; from 10 s
  `Cold starts take up to two minutes.`; from 150 s `[RETRY]`. The hub of the left reel is the **iris**:
  a 12 px ink disc, 44 px hit area, `aria-label="void"`, opens the cinema with the loading video.
- **Void cinema** (`sd-void-cinema`): full screen ink at 96 %, the YouTube frame in 2 px paper with a
  `6px 6px 0` orange shadow (the landing's `.cmd`), head label in paper, whisper lines small italic
  `#bfb595`, `×` and Escape. Nothing else in the app references the videos.

## Do and don't

Do: one chapter card per page; label-maker chips for every state word; tracklist rows (in the kennel list the
name opens `/k/:id` in a new tab, the rest of the row the kennel page; the kennel opened last carries a 4 px ink bar
on the left, the `last opened` chip and `aria-current`); ink on orange, never
orange on paper; teal only for live/yours; hard shadows only on floating panels; frozen, run only, private,
pinned always as a chip, never as colour alone.

Don't: tilted cards, marquee, vignette, soft shadows, radius; emoji as icons in controls; yellow stars; bold
in running text; exclamation marks; two accents; German and English mixed.

## Agent prompt guide

"Mixtape inlay as a tool, not a poster. Page `#f0e6c8`, surfaces `#f7f0da`, ink `#1b1712`, hairlines
`rgba(27,23,18,.18)`, square corners. One accent, tape orange `#ff6a00`, always with ink text on it, at most
twice per screen (primary button, focus). Teal `#117f7f` only for live/ok/yours. Courier Prime 14/21 for all
text, tabular numbers; Bebas Neue only on the chapter card and the kennel name. State words are ink
label-maker chips (11 px 700 uppercase tracked .16em). Lists are tracklist rows: number, title, length. Hard
`4px 4px 0` ink shadow on drawers and dialogs only, nothing else. Reels turn while a kennel runs. Copy in
English, short, no exclamation marks."
