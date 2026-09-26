# SlopDogs -- The Lodge

> By that which bears no name we're drawn
> to glowing screens, to darkened halls.
> The dogs return before the dawn --
> their spoils line these silent walls.

The Angular frontend for [SlopDogs](../README.md). From here you assemble packs, loose them into the wild, and sift through everything they drag back.

**Angular 18** | **Monaco Editor** | **vis-network** | **TypeScript**

---

## The Wilderness

Out there, data lives scattered across APIs, databases, endpoints, request bodies. No structure. No mercy. That's where your dogs go.

This UI is the lodge. Dark. Warm. Glowing screens in the void. From here you breed new dogs, train them with custom TypeScript, chain them to the ones that ran before, and watch the whole pack tear through the wilderness wave by wave. Everything they bring back -- you see it here. Every dependency, every bite of data, every trail they followed.

**Waves** = who runs when (dependency graph + Pacts). **Lead** = first entry in `dogIds` = whose result the public Kennel URL returns. The graph commands the order. The lead commands the answer. Details in the [root README](../README.md).

---

## The Grounds

### The Kennel List -- `/`

Your kennel yard. Every pack you've assembled, waiting in the dark.

- **Breed** a new Kennel -- give it a name, a purpose, a pack.
- **Unleash** any Kennel with one click -- the spoils open in a new tab.
- **Inspect** the pack composition or watch the Waves from here.
- **Swagger UI** / **swagger.json** -- two buttons per Kennel. They open directly on the backend and conjure a live OpenAPI spec from a real hunt. The truth of what the pack returns, laid bare.

Some packs carry provisions (a default body). Those go out as POST hunts. The rest run light -- a simple GET and they're off.

---

### The Waves Viewer -- `/kennel/:id`

The hunt, live.

A **dependency graph** maps out every dog in the pack. Nodes cluster by wave -- first wave hits the ground, second wave follows their trails, third wave picks the bones. Lines between them show who depends on whose catch.

**Lead dog** -- A **Lead** strip lists `dogIds` in config order. Only the **first** entry is the lead: the one whose yield answers the public URL. Use **Lead werden** to promote another dog. The graph remains unchanged -- only the voice changes. Details: [Lead dog](../README.md#lead-dog).

Click any dog. The **Side Panel** cracks open and you see everything: what they brought back, the code that drives them, who they depend on, who feeds off their haul.

From the top bar:
- **Query / Body** -- Toggle the inline params panel. Edit query key/value pairs and body JSON without leaving the Waves view. Changes ride with the next reload. Hit "Speichern & Neu laden" to persist them. A dirty dot shows unsaved tweaks.
- **Draft** an existing dog into the pack
- **Breed** a new one on the spot
- **Re-run** the whole hunt for fresh spoils
- **Reconfigure** the Kennel

---

### The Kennel Config -- `/kennel/:id/edit`

Where you assemble the pack before the hunt.

- **BaseDogs** -- Ancient breeds. Toggle them on: RandomRecipesRetriever, QueryRetriever, BodyRetriever, and more. They know their purpose.
- **Pack list (`dogIds`)** -- One ordered list. The **first** row is the [lead dog](../README.md#lead-dog). Reorder to change who speaks.
- **Default Query Params** -- Scent markers. Key/value pairs baked into every hunt.
- **Default Body** -- Provisions for the pack. A Monaco JSON editor for POST body data, fed straight to BodyRetriever.

Lock it in. Go watch the Waves.

---

### The Dog Side Panel

Click a dog in the Waves Viewer. Everything about that animal, in collapsible sections:

**Save Bar** -- Pinned at the top. One button saves the dog's code and its bloodline in a single shot. **Lead** promotes this dog to first in `dogIds`; delete retires it from the pack.

**Version Selector** -- Dogs evolve. Every save breeds a new version. The dropdown lets you look back at any ancestor -- load its code, its dependencies, see how it used to hunt. Saving from an old version breeds a new one. Through endless faces, countless forms -- no lineage is ever severed.

**Code** -- The dog's instincts, written in TypeScript. A full Monaco editor with IntelliSense -- type definitions are generated from the dog's hunting context, so autocomplete knows exactly what parent data lies in reach. BaseDogs show their raw catch as read-only JSON.

**Result** -- The spoils. JSON renders raw. HTML -- like TalkingDog's rendered layouts -- fires up a sandboxed iframe and renders live. A toggle cycles between Auto, Raw, and HTML mode.

**Parents** -- The bloodline. Checkboxes for every other dog in the Kennel. Mark each as Required (must hunt first) or Optional (used if available, ignored if not). This is what shapes the Waves.

**Read Tracking** -- Collapsed by default. The trail log. Which properties did this dog read from other dogs' catches? Which dogs came after and picked through this one's haul? In luminous space blackened stars -- they gaze, accuse, deny.

---

## Architecture

```
AppComponent
  +-- KennelListComponent           /
  +-- WavesViewerComponent          /kennel/:id
  |     +-- DogToolbarComponent          (drag & drop dog selection)
  |     +-- VisNetworkComponent          (dependency graph)
  |     +-- Inline Params Panel          (query/body editing)
  |     +-- DogSidePanelComponent
  |           +-- VersionTimelineComponent (version history)
  |           +-- EditSectionComponent     (reusable collapsible wrapper)
  |           +-- DogEditorComponent       (Monaco)
  |           +-- HTML Result Preview      (sandboxed iframe for HTML results)
  +-- KennelConfigComponent         /kennel/:id/edit
```

All components are **standalone** -- no NgModules. State is managed with **Angular signals**. Routes are lazy-loaded.

### Design Decisions

- **Monaco via CDN**, not bundled. Loaded in `index.html` before Angular bootstraps. Keeps the build lean and the dogs fast.
- **Dark lodge aesthetic**. Courier New. Black backgrounds. Green for action, blue for navigation. The kind of terminal a hunter would use if hunters used terminals.
- **Reusable EditSectionComponent**. Every collapsible section in the side panel uses the same frame -- title bar, collapse toggle, content projection. One pattern for every view.
- **Save logic lives in the Side Panel**, not the editor. The panel knows the full picture -- code, parents, version -- and fires one request that captures it all.

### Services

| Service | Purpose |
|---------|---------|
| `DogService` | Breed, save, version, and retire dogs |
| `KennelService` | Assemble kennels, unleash hunts, fetch spoils |

### Proxy

`/api` and `/save` are forwarded to the backend at `http://localhost:3000`. Configured in [`proxy.conf.js`](proxy.conf.js) (liest `PUBLIC_API_BASE_URL` / `PORT` aus der Repo-Root-`.env`).

---

## Getting Started

### UI Only (backend must already be running)

```bash
cd ui-app
npm install
npx ng serve --proxy-config proxy.conf.js
```

Opens at `http://localhost:4300` (see `angular.json` → `serve.options.port`). The lodge is warm.

**Kennel list — copy & paste:** **📋** imports bundle JSON from the clipboard (`POST /api/kennels/import`). On each card, **Kopieren** in the action fan copies that Kennel’s export JSON (`GET …/export`). Same flow as documented in the [root README](../README.md#kennel-list-copy-and-paste).

### Full Pack (from project root)

```bash
npm run dev
```

Backend wakes on `:3000`, UI on `:4300`. The dogs are ready. The wilderness is waiting.

---

## Build

```bash
cd ui-app
npx ng build
```

Output lands in `dist/ui-app`. Deploy it anywhere. Point it at a backend. Loose the pack.

---

## License

[MIT](../LICENSE) — Copyright (c) 2026 Martin.

> We end as we began.
