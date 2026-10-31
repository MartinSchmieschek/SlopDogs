# slopdogs-base-dogs

The Base-Dogs of [SlopDogs](https://github.com/MartinSchmieschek/SlopDogs): every Dog package, plus `geo-pact` (the shared GeoPoint pact) and `dogs-demo`, each in its own folder under `packages/`, each with its own build, version and release. They build against the contract of [`@martinschmieschek/slopdogs-core`](https://github.com/MartinSchmieschek/slopdogs-core) — never against its runtime.

Package name = `@martinschmieschek/slopdogs-<folder>`, e.g. `packages/dogs-weather` is `@martinschmieschek/slopdogs-dogs-weather`.

## Install

Pick **one** way per project and use it for every SlopDogs package there.

**From the registry (GitHub Packages)** — what the server does. Add to the project's `.npmrc`:

```
@martinschmieschek:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

`NPM_TOKEN` is a token with `read:packages`. Then pin exact versions:

```bash
npm install --save-exact @martinschmieschek/slopdogs-dogs-weather@0.3.0
```

**From the release tarball** — no registry. npm cannot install from a subfolder of a Git repository, so every release (tag `<package>@<version>`) carries the built `npm pack` tarball:

```bash
# link of the asset martinschmieschek-slopdogs-dogs-weather-0.3.0.tgz on the release page
# of the tag @martinschmieschek/slopdogs-dogs-weather@0.3.0
npm install <tarball-url>
```

The tarball is already built (`dist/` with `type-defs.json` and `surface.json`); nothing runs at install time.

### One copy of core, geo-pact and dogs-demo — always

Every package lists `@martinschmieschek/slopdogs-core` as a **peer dependency**; packages that build on `geo-pact` or `dogs-demo` list those as peers too. The server must hold exactly one copy of each: parents are matched by class identity (`instanceof`), `dogs-demo` and `geo-pact` are parents themselves, and core keeps singletons (slot gate, capability registry). A second copy matches no parent — silently.

- Install core, `geo-pact` and `dogs-demo` **once, at the root** of the project, next to the Dog packages.
- Use the **identical specification** for each of them everywhere it appears. Mixing a Git tag or tarball URL in one place with a registry version in another is two copies.
- Check: `npm ls @martinschmieschek/slopdogs-core` (and `-geo-pact`, `-dogs-demo`) lists one version, deduped everywhere else.

## Develop

```bash
npm ci            # installs and builds all packages (prepare of the root)
npm run build     # tsc -b over packages/, then dist/type-defs.json and dist/surface.json per package
npm test          # package tests (node:test) against the built packages and one core
npm run lint      # ESLint for all packages; inherited findings are tolerated via eslint-suppressions.json
npm run format:check
```

Packages do not build through their own `prepare` inside this repository: npm runs `prepare` of all workspaces in parallel and in no order. Each package detects the workspace and does nothing there; the root builds them in dependency order.

Rules for a package:

- Import only `@martinschmieschek/slopdogs-core`, never `@martinschmieschek/slopdogs-core/runtime` (ESLint refuses it under `packages/`).
- core, `geo-pact`, `dogs-demo`: `peerDependencies` (`^0.3.0`, one minor while `0.x`) plus the same range in `devDependencies` so the package builds.
- Environment variables a package reads are listed in `src/env.ts` and exported as `./env`.
- `tsconfig.json` stands alone (no `../`); references to sibling packages live in `tsconfig.monorepo.json` and in `tsconfig.packages.json` at the root.

To try a change in the server: `npm link` the package folder here and `npm link @martinschmieschek/slopdogs-<name>` in the server, then rebuild here (`npm run build`). The linked package must see the server's core, not one of its own — see the server README, section *Working on a Dog package*.

## Release

1. `npx changeset` with every change and pick the packages; `npm run version-packages` bumps versions, internal ranges and changelogs. Commit.
2. `npx changeset tag` creates one tag per bumped package, `<package>@<version>`. Push the tags **one by one** (`git push origin <tag>`): GitHub starts no workflow when more than three tags arrive in one push. A tag that did not trigger a run can be released via *Run workflow* with the tag name.
3. `.github/workflows/release.yml` builds all packages, tests, runs the surface check of that package against its last published version, publishes it to GitHub Packages and attaches its `npm pack` tarball to the GitHub release. It uses only `GITHUB_TOKEN` (`packages: write`, `contents: write`).

The surface check fails a release when an export, a class or a pact was removed or renamed, or a pact type changed, without a major bump. Changing the *shape of a result* without changing the pact type is not caught — user code in Kennels reads results directly, so treat it as breaking.

## License

MIT
