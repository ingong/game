# Crimson Furnace

Crimson Furnace is a compact, keyboard-only 2.5D chase runner built for the
JS13K size limit. The submission runs offline from one `index.html` file.

## Controls

- `Up`: accelerate
- `Down`: brake
- `Left` / `Right`: steer
- `Space`: start, jump, double jump, or restart after a result

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

## Art And Attribution

All shipped code, character art, obstacle silhouettes, environments, and
effects are original project work. Runtime visuals are drawn with Canvas from
compact geometry, palette masks, stage tuples, and deterministic procedural
patterns. The submission contains no images, third-party game assets, network
resources, audio, fonts, or copied branding.

Development concept images and visual-research references remain outside the
runtime and are not copied into `src/`, `dist/index.html`, or `dist/game.zip`.
