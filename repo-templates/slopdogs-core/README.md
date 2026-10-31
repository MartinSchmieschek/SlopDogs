# slopdogs-core

The core of [SlopDogs](https://github.com/MartinSchmieschek/SlopDogs): the contract every Dog package builds against, and the runtime the server runs Kennels with. One package, two entry points:

| Import | For | Contains |
|---|---|---|
| `@martinschmieschek/slopdogs-core` | Dog packages | `Dog`, `createPact`, entity types and interfaces, `FetchBaseDog`, cache and geo helpers, `DogEnvVar` |
| `@martinschmieschek/slopdogs-core/runtime` | the server only | `KennelRun`, `SerializedDog` (sandbox), `DogWorkerGate` (slot cap, memory guard), `MimicDog`, `QueryRetriever`, `BodyRetriever`, WebSocket lobby, capability registry (`jsonStore`, `keys`) |

The same repository also ships the type tool `@martinschmieschek/slopdogs-typedefs` (folder `typedefs/`, same version as core): the CLI `slopdogs-typedefs` writes `dist/type-defs.json` and `dist/surface.json` for a package, and `tsconfig.base.json` is the compiler base of every SlopDogs package.

## Install

Pick **one** way per project and use it for every SlopDogs package there.

**From the registry (GitHub Packages)** — what the server does. Add to the project's `.npmrc`:

```
@martinschmieschek:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

`NPM_TOKEN` is a token with `read:packages`. Then pin the exact version:

```bash
npm install --save-exact @martinschmieschek/slopdogs-core@0.3.0
```

**From the Git tag** — no registry, no token for a public repository. npm clones the tag, installs the dev dependencies and builds through `prepare`:

```bash
npm install github:MartinSchmieschek/slopdogs-core#v0.3.0
```

The type tool is not installable from Git: npm does not install from a subfolder of a repository. Take it from the registry or from the tarball attached to the GitHub release (`martinschmieschek-slopdogs-typedefs-<version>.tgz`). Dog packages need it only as a dev dependency.

### One copy of core — always

The server must hold **exactly one** copy of core. Parents are matched by class identity (`instanceof Dog`), and core keeps singletons: the slot gate (`DogWorkerGate.shared`) and the capability registry for `jsonStore`/`keys`. A second copy matches no parent — silently — and doubles the slot cap.

- Dog packages list core as a **peer dependency**, never as a dependency (the same holds for `geo-pact` and `dogs-demo`).
- Whoever installs packages from Git or tarballs must name core with the **identical specification** everywhere it appears (root `dependencies`, `overrides`, workspaces). A tag in one place and a registry version in another is two copies.
- Check: `npm ls @martinschmieschek/slopdogs-core` lists one version, deduped everywhere else.

## Versions and the contract

- Releases are tagged `v<version>`; core and the type tool always carry the same version.
- `dist/surface.json` describes the contract of the main entry point (exports, classes, a hash per pact type). The release fails when something was removed, renamed or a pact type changed without a major bump (`npm run surface:check`). While core is `0.x`, a breaking contract change is a **minor** bump, and Dog packages declare their peer range within one minor (`^0.3.0`).
- The runtime entry point is not part of the checked contract: a fix in sandbox, gate or memory guard is a patch that Dog packages accept through their peer range without a release of their own.

## Develop

```bash
npm ci            # installs and builds (prepare)
npm run build     # typedefs, core, then dist/type-defs.json and dist/surface.json
npm test          # package tests (node:test) against dist/
npm run lint      # ESLint, the inherited findings are tolerated via eslint-suppressions.json
npm run format:check
```

To try a change in the server before releasing it: `npm link` here, `npm link @martinschmieschek/slopdogs-core` in the server, rebuild here after each change (`npm run build`). The server must then link the Dog packages it uses from their repository as well, or point them at the same linked core — otherwise there are two copies (see above).

## Release

1. `npx changeset` with every change; `npm run version-packages` bumps core and `typedefs/` together and writes the changelog. Commit.
2. `npx changeset tag` creates `v<version>`; `git push origin v<version>`.
3. `.github/workflows/release.yml` builds, tests, runs the surface check against the last published version, publishes core and the type tool to GitHub Packages and attaches both `npm pack` tarballs to the GitHub release. It uses only `GITHUB_TOKEN` (`packages: write`, `contents: write`). A tag that did not trigger a run can be released via *Run workflow* with the tag name.

## License

MIT
