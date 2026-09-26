---
name: cleanup-after-storm
description: Recon and plan first (void tone), then asks before acting; restores a shippable repo, English comments, syncs root README, ARCHITECTURE, and .env examples to Git. Use for cleanup, after a storm, doc/env sync, or when the user invokes cleanup-after-storm.
---

# Cleanup after storm

**"Storm"** = high churn: many files touched, half-resolved merges, broken `node_modules`, stale `dist/`, or abandoned scratch changes. Goal: **safe, minimal, verifiable** cleanup — not drive-by refactors.

**Always include:** English comments in scope, root **README.md**, **ARCHITECTURE.md**, and **root `.env*.example` files** (not committed secrets like `.env` or `.env.integration` unless the user says otherwise).

## Phases (mandatory)

**No destructive or broad edits before the user agrees.** The flow is two beats: recon, then pack.

### 1) Scout the wreckage (read-only)

Run only inspection: `git status`, `git log` / `git diff` for **BASE** and in-scope paths (per [Git scope](#git-scope--since-last-root-doc-update) below), scan for non-English comments, skim anchor docs for drift. **Do not** delete `dist/`, nuke `node_modules`, run Prisma reset, or write files in this step.

**Deliver to the user in *Void tongue*:** terse, hungry, a little grim—this is the expanse, the trail, what the storm left behind, what must be hauled from the muck and what can wait. It is *not* the full slopdogs kennel spiel. Every proposed action needs a **one-line “why”** in that voice (e.g. why the README is stale, why a comment pass matters, what the diff demands).

- **The tally:** what the pack would do (grouped: comments, docs, env examples, trash/build/deps/Prisma/UI, verify), each with reason tied to the Git scope or the mess observed.
- **Risks:** e.g. destructive Prisma, lockfile churn, wide comment surface—call those out at the end.

### 2) Wait at the treeline (ask)

Stop and **ask** whether to proceed, or with what subset (e.g. “docs only,” “no `node_modules` reinstall,” “Prisma is off the table”).

- **Default:** if the user does not confirm, **do not** run the [Checklist](#checklist); deliver only the recon summary.
- After **explicit yes** (or a narrowed scope they approve), run the Checklist in order, respecting that scope.

## Principles

- **Recon first, act second** — never skip [Phases](#phases-mandatory).
- **Do not delete** user data, real env files, DBs, or `store/` without explicit user consent.
- **Prefer** `git` inspection over mass deletes; **remove** only clear build artifacts and obvious temp files.
- **Run** project checks at the end (after the user said go) so "clean" is proven, not assumed.
- **Comments in source** that are not English: translate to **clear English**; do not change runtime strings unless they are dev-only and clearly mistaken (focus on `//`, `/* */`, `/** */`).

## Git scope — "since last root doc update"

**Anchor files** (repo root):

- `README.md`, `ARCHITECTURE.md`
- `AISkill.md`, `BACKLOG.md`, `SOCKETDOG-PLAN.md` — include in baseline **when** the diff touches their topics; at minimum do not leave them obviously stale next to the same `BASE` (see below).
- **Env templates:** `.env.example`, `.env.development.example`, `.env.production.example`, `.env.integration.example` (if present; never copy real secret values from `.env` into examples)

**Baseline `BASE`:** For each anchor file above that exists in Git history, run `git log -1 --format=%H -- <file>`. Skip files with no history. Pick the **commit for the file whose most recent change is the oldest in time** (stalest doc: compare author dates, e.g. `git log -1 --format=%cI -- <file>`). Set **BASE** to that commit. If no anchor has history, use `HEAD` as BASE and still review working tree. Then:

- `git diff BASE..HEAD` — all **committed** changes after the least-recently-updated anchor.
- `git status` and unstaged work — all **uncommitted** paths.

**In-scope file set** = union of paths from the diff, working tree, and always re-read the anchor `.md` / `.env*.example` themselves for consistency.

**Behavior:** If code or config changed in ways that affect environment variables, public setup, or system shape, **update** README, ARCHITECTURE, and the relevant `*.env*.example` **placeholders/keys and comments** in English so a new developer can start without the storm context.

## Checklist

*Execute in order; skip what does not apply. Only after the user approves the [Phases](#phases-mandatory) plan.*

1. **Git state**
   - `git status` — note tracked vs untracked, conflict markers, `.orig` files.
   - Compute **BASE** and list in-scope paths (see above).
   - If merge/rebase in progress: finish or abort per user direction.

2. **Comments → English (in scope)**
   - In every in-scope code file (e.g. `.ts`, `.tsx`, `.js`, `.cjs`, `.mjs`, `.prisma` comment blocks, `.sh` with comments, CSS where project uses comments for architecture): ensure comments are **English**; keep tone concise and match the file’s style.
   - Skip **third-party** `node_modules` and **generated** artifacts under common output dirs unless the user explicitly includes them.

3. **Root documentation & env examples (mandatory pass)**
   - **README.md** — install, run, test, important URLs/ports, env file names; must match current `package.json` scripts and reality.
   - **ARCHITECTURE.md** — high-level flow, main packages, server/UI/store if changed.
   - **`.env*.example` in root** — list keys with **no real secrets**; English descriptions for each important variable; align with `load-env` / `scripts` / `prisma` as needed.

4. **Obvious junk (repo root and packages)**
   - Remove editor/OS trash if present: `*.log` at project root, etc.
   - **Do not** remove `store/`, or Prisma data without the user asking.

5. **SlopDogs: build outputs**
   - `dist/`, per-package `dist/`, `out/` — only remove when safe to rebuild; then run a **targeted** `npm run build:*` for affected scope.

6. **Dependencies (only if broken)**
   - Reinstall `node_modules` / lock only with user agreement; then `npm install` at root.

7. **Prisma (only if DB/schema was "stormy")**
   - `prisma:sync`, `prisma:sync:integration`, or reset variants only with explicit confirmation for destructive steps.

8. **UI (`ui-app/`)**
   - If Angular build is flaky, clear `.angular/` then `ui:build` (or the variant the user needs).

9. **Verify**
   - `npm test` (this repo: **typecheck** — `package.json` `scripts.test`).
   - Optional: `dev` / `start:integration` when runtime proof is required.

## Reporting back

- **Recon (always):** Void-tongue tally, BASE/stalest anchor, proposed work + why, risks, **and** the question whether to run it.
- **If executed:** same as after-action list—**BASE** (short) and stalest anchor; in-scope highlights (comments, **README** / **ARCHITECTURE** / which **`.env*.example`**, cleanup, commands); what remains.
