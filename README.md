# Crimson Furnace

Crimson Furnace is a compact, keyboard-only 2.5D chase runner built for the
JS13K size limit. The submission runs offline from one `index.html` file.

## Controls

- `Up`: accelerate
- `Down`: brake
- `Left` / `Right`: steer
- `Space`: start, jump, double jump, advance after a clear, retry after failure, or replay after stage seven

## Local Run

Install the development dependencies and start the source-module server:

```sh
npm install
npm run dev
```

Open `http://localhost:4173/` in a browser.

## Test And Build

```sh
npm test
npm run build
```

The build writes `dist/index.html` and `dist/game.zip`. The builder rejects an
archive over 13,312 bytes, external URLs, runtime asset paths, reference paths,
or any ZIP layout other than the single top-level `index.html` entry enforced
by the test suite.

## Map Asset Workspace

Run `npm run maps:serve` and open `http://127.0.0.1:4175/tools/map-editor/index.html`.
The workspace shows actual map assets, previews stage-specific visuals, and saves
colors and decoration settings for seven playable prototype stages.
It imports/exports the editable Piskel runner source and builds the submission ZIP.
Seven distinct courses specialize in introductory crystals, slalom, lightning timing, gap jumps, moving stars, spring chains, and a final mixed challenge. Geometry and art code remain shared. See [the workspace guide](docs/map-asset-workspace.md).

The seven-stage build is checked against the **13,312-byte ZIP limit** on every build.
See [the course and budget report](docs/stage-design.md) for prototype scope and validation.

## Asset Management

`assets/manifest.json` is the development inventory for runtime images,
procedural art, concepts, and reference files. It records stable IDs, source
and license notes, image dimensions, and the runtime atlas frame contract.

```sh
npm run assets:check     # Validate inventory and detect stale generated data
npm run assets:generate  # Export Piskel and stage settings, then embed the runtime PNG
npm run assets:audit     # Print sizes, SHA-256, PNG metrics, and review notes as JSON
npm run assets:serve     # Generate the visual catalog and serve it on localhost
```

Open `http://127.0.0.1:4174/reports/assets/` for the searchable catalog and
animated runner preview. `npm run assets:catalog` generates the HTML and JSON
without starting a server. Generated reports stay outside the submission.

Tests and builds check the inventory and generated data. The development server
regenerates the data when starting; restart it or run `assets:generate` after
editing an asset. See [the maintenance guide](docs/asset-management.md) and
[the asset review](docs/asset-audit-2026-09-07.md).

## Art And Attribution

Shipped code, character art, obstacle silhouettes, environments, and effects
are recorded as original project work. Detailed creator/tool records for the
concept images and the historical atlas conversion are incomplete; the asset
inventory identifies those gaps rather than treating the inventory as proof
of provenance.

Runtime visuals combine an original 160 × 56 indexed PNG runner atlas embedded
as a data URI with Canvas geometry, palette masks, stage tuples, and
deterministic procedural patterns. The current game uses a bright rainbow skyway palette and 20 original obstacle recipes. The original restyle used ImageGen; the editable character source is now
`assets/concepts/unicorn-runner.piskel`. The Piskel project preserves the prior
atlas pixels and replaces the high-resolution resampling workflow. The runtime
still uses a generated indexed PNG. Backgrounds now use a quiet, single decoration
system with most decoration off by default. See [the current workflow](docs/map-asset-workspace.md),
[the earlier visual change record](docs/prismatic-assets.md), and
[the previous compliance check](docs/js13k-asset-compliance-2026-09-07.md).
The submission contains no external image files, third-party reference assets,
network resources, audio files, bundled font files, or copied branding.

Development concept images and visual-research references remain outside the
runtime and are not copied into `src/`, `dist/index.html`, or `dist/game.zip`.
Reference terms are recorded in `assets/references/itch/SOURCES.md` and the
manifest; those records include restrictions for the muscle-runner reference.


## Obstacle Atlas

Open `http://127.0.0.1:4175/tools/map-editor/obstacles.html` after `npm run maps:serve`
to compare the 20 animated obstacle recipes and their crossing strategies. Placement
links select the actual stage and asset in the map editor. Recipes live in
`src/obstacles.mjs`; the seven authored courses live in `src/stage.mjs`.
See [current stage design and verified byte budget](docs/stage-design.md).
