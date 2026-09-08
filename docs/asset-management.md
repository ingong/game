# Asset management

The inventory is development tooling. The game still runs offline from a
single HTML file, and the submission budget remains **13,312 bytes**.

## Layout and source of truth

| Location | Purpose | In the submission? |
| --- | --- | --- |
| `assets/manifest.json` | IDs, roles, provenance, license records, dimensions, frame contract, review notes | No |
| `assets/runtime/` | Compact runtime PNG output from the recorded export recipe | Their generated data URIs only |
| `assets/concepts/` | Editable Piskel project and historical design/source images | No |
| `assets/references/` | Third-party research images, original archives, and terms | No |
| `src/generated/assets.mjs` | Deterministic output; checked into Git for immediate source-module use | Referenced constants only |
| `src/art.mjs`, `src/render.mjs`, `src/stage.mjs` | Procedural runtime art and level geometry | Bundled code |
| `src/palette.mjs` | Shared runner and environment colors | Referenced constants only |
| `tools/runner-export.mjs`, `tools/piskel.mjs` | Piskel source decoding and palette packing | No |
| `config/map-settings.json` | Seven-stage visual settings | No |
| `src/generated/map-settings.mjs` | Active stage visual settings | Referenced data only |
| `tools/map-editor/` | Map asset previews and controls | No |
| `reports/assets/` | Generated HTML catalog and machine-readable audit | No; Git-ignored |

Edit `assets/concepts/unicorn-runner.piskel` in Piskel and use the map workspace
for `config/map-settings.json`. `assets:generate` compiles the Piskel project into
the runtime PNG, embeds it, and generates active-stage settings. Historical source
images remain preserved but are no longer sampled on every export.
See [the current workspace guide](map-asset-workspace.md).

## Commands

```sh
npm run assets:check
npm run assets:generate
npm run assets:audit
npm run assets:catalog
npm run assets:serve
npm run maps:serve
```

- **check:** verify the packed PNG against its source and recipe, audit files,
  and compare the generated module against the PNG. It never writes files. Errors return a nonzero exit status;
  review notes are informational and do not fail CI.
- **generate:** pack the recorded source into the runtime PNG, then audit the
  inventory and emit stable Base64 and frame constants. The source-to-PNG export
  uses the palette in `tools/piskel.mjs`; the lower-level
  `node tools/assets.mjs generate` only embeds the existing PNG. No timestamps
  or absolute paths are emitted into the generated module.
- **audit:** print JSON with file bytes, SHA-256, dimensions, palette size,
  transparency counts, errors, and review notes. It can inspect a stale generated
  module's sources; use **check** to verify both export and module freshness.
- **catalog:** write `reports/assets/index.html` and `reports/assets/audit.json`.
  It can show audit errors; its exit status still indicates failure.
- **serve:** regenerate the catalog and serve the repository on the loopback
  interface, port 4174. Open `http://127.0.0.1:4174/reports/assets/`; stop with
  Ctrl-C. This is a local development tool.

The catalog supports text search, role filters, local image links, expandable
provenance, and runner frames on checkerboard, white, dark, or game backgrounds.
Its preview illustrates the current runner frame sequence and right-stride
mirroring; it is not a generic animation editor or an exact game-camera preview.
It respects reduced-motion preferences. Rebuild the catalog after edits.

`npm test` runs **check** before the tests; the build independently runs the same
check, including when called directly through its JavaScript API. The existing
GitHub Pages workflow therefore checks assets through both its test and build
steps. `npm run dev` regenerates at startup. There is no file watcher.

## Registering or replacing assets

1. Keep a stable kebab-case `id`, descriptive `title`, and repository-relative
   `path`. A file appears only once in the manifest. Classify its `kind` as
   `image`, `archive`, `document`, or `procedural`, and its `role` as `runtime`,
   `concept`, or `reference`. Use the matching directory in the table above.
2. Record `source.kind` (`project` or `external`), `source.author`, and
   `source.evidence`. External sources require a `source.url`. Record the
   license ID and a contextual note. Use an explicit “not recorded” statement
   when evidence is missing, plus a `review` note; do not invent attribution.
3. For an image, record its measured `width` and `height`. For a runtime image,
   also set a positive `budgetBytes`, a unique uppercase `exportName`, and
   `frames.width`, `frames.height`, and `frames.names`. The supported atlas is
   one horizontal row with no padding or gaps. `width = frame width × count`.
4. Use `derivedFrom` IDs to record an actual source relationship, such as an
   extracted archive or a source sheet. Mere visual inspiration is not a
   derivation. The current submission policy allows only project-original
   runtime assets and prohibits reference or non-project sources anywhere in
   their derivation ancestry.
5. Run **generate**, review the PNG and generated diff, then run **check**,
   **catalog**, `npm test`, and `npm run build`. Commit the source, manifest, and
   generated module together when you choose to commit the change.

The current Piskel project contains five 32 × 56 frames. Import validates the
project and chunk geometry before decoding; layers are composited and packed into
13 opaque colors plus transparency without the previous white matte key. The
high-resolution RGB source and crop recipe are historical, described in
[the earlier restyle record](prismatic-assets.md).

For example, the current runner uses `exportName: "RUNNER"`; the generated
module exports `RUNNER_SHEET_SRC`, `RUNNER_FRAME_WIDTH`, `RUNNER_FRAME_HEIGHT`,
and `RUNNER_FRAME_COUNT`. The drawing code consumes the source URI and frame
dimensions. The audit additionally enforces the current runner's five 32 × 56
frames in order: `contact`, `stride-left`, `stride-right-mirrored`, `jump`,
`impact`. Changing this contract requires updating `runnerFrame` and
`runnerMirror` in `src/art.mjs`, the validator, and the drawing tests together.

## What is validated

- Missing/unregistered files, duplicate IDs or paths, incomplete source/license
  records, invalid roles/paths, symlinks, unknown derivations, and cycles.
- PNG signature/chunk CRC, dimensions, decoded size, frame-grid coverage, and
  the per-image source byte budget. Decoding is limited to 8-bit,
  non-interlaced PNGs and at most 64 MiB of decoded scanline data. Unsupported
  encodings fail explicitly; convert them deliberately before registration.
- Manually embedded image/audio/font data URIs outside the generated module,
  loose common media files in `src/`, and source/reference imports in the build.
- Generated content drift, the existing standalone-HTML guards, the single-file
  ZIP layout in tests, and the final ZIP limit in the builder.

SHA-256 is measured for traceability and exact-file duplicate detection; it is
not a signed provenance record or a requirement to keep an image's bytes forever.
ZIP contents are not inventoried recursively. The tools do not infer ownership,
verify current external license terms, discover every dynamic resource URL, or
identify unused procedural drawing functions. Keep code review and the final
offline build check as part of the workflow.

The runtime source-byte budget is **3,000 bytes** for the current atlas. It is
independent of the final archive budget: Base64, minification, and ZIP compression
change contribution sizes. The report's role totals count physical asset files,
excluding procedural JavaScript to avoid describing source-code bytes as image
storage. A procedural entry's own card still displays its source-file size.


## Node / zlib 버전 호환성

PNG 생성 결과는 zlib 버전에 따라 압축 바이트가 달라질 수 있다. `runner-export --check`는 PNG를 검증·디코딩한 뒤 가로·세로·RGBA 픽셀을 비교한다. 픽셀이 같으면 저장된 작은 PNG를 유지하며, 픽셀 변경이나 손상된 PNG는 계속 거부한다. 임베딩과 실제 PNG 파일의 바이트 일치 검사 및 파일·ZIP 예산 검사는 별도로 유지한다. Node 23과 CI의 Node 24.20.0에서 전체 테스트를 검증했다.
