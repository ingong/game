# Map Asset Workspace Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for the independent Piskel converter; integrate the tightly coupled editor/rendering locally. Track completion below.

**Goal:** Edit sprites in Piskel and manage simple map visuals across seven stage slots.
**Architecture:** Editable `.piskel` → indexed runtime PNG → embedded module. Project map JSON → generated stage-1 visuals → game renderer. Local editor uses the same renderer and validated save endpoints.
**Tech Stack:** Node.js, browser modules, Canvas, existing PNG inspector/exporter; no dependencies added.
**Spec:** `docs/superpowers/specs/2026-09-08-map-assets-design.md`

## Global Constraints

- ZIP maximum 13,312 bytes; only stage 1 playable, six draft slots clearly labeled.
- Keep current stage geometry, controls, collisions and five 32×56 sprite frames.
- Piskel and editor are development-only; no runtime HTTP calls.
- Preserve earlier uncommitted work and original images; no git commits or publication.

### Task 1: Piskel conversion (independent worker)

Files: new `tools/piskel.mjs`, `test/piskel.test.mjs`, `assets/concepts/unicorn-runner.piskel`.
Interfaces: `encodePiskel(png, {name,width,height,frameCount,fps}) -> string`,
`decodePiskel(text) -> {width,height,frameCount,fps,rgba}`, where rgba is the horizontal
atlas; `compilePiskel(text) -> indexed PNG Buffer`, with strict runner contract.

- [x] Write roundtrip tests comparing RGBA bytes, chunk layouts, layers/alpha, invalid dimensions and missing frames.
- [x] Confirm tests fail without module; implement Piskel modelVersion 2 using official chunk layout specification.
- [x] Create editable project from current atlas, verify compile keeps pixels; report tests and integration needs.

### Task 2: Shared settings and simple renderer

Files: `tools/map-settings.mjs`, `config/map-settings.json`, `src/generated/map-settings.mjs`, `src/render.mjs`, `src/stage.mjs`, tests.
Interfaces: `validateMapSettings(data) -> errors[]`, `runtimeMapSource(data) -> string`,
`generateMapSettings({root,check})`; stage.visual holds validated configuration.

- [x] Test seven ordered IDs, one playable stage, color/range/type rejection and draft settings excluded from runtime.
- [x] Implement strict settings schema and stage-1 generator.
- [x] Test toggling tile seams/ripples/landmarks affects drawing, while obstacles remain present.
- [x] Replace ornate props and skyline; wire scene controls and stage-aware HUD.

### Task 3: Local workspace and integration

Files: `tools/map-editor-server.mjs`, `tools/map-editor/index.html`, `editor.mjs`, `style.css`, package scripts, exporter/manifest and docs.
Interfaces: GET `/api/settings` -> `{data,revision}`; PUT same endpoint with `{data,revision}`;
GET `/api/piskel` downloads source; PUT same endpoint with `{text,revision}` validates before write;
GET `/api/status` reports asset bytes, revisions and last ZIP size.

- [x] Test invalid saves, revision conflict, origin rejection and fixed file paths in temporary roots.
- [x] Implement bounded local server with atomic writes and fresh generated settings/runner data.
- [x] Build responsive stage navigation, real preview and live asset cards, controls, save/reload/import/download feedback.
- [x] Integrate Piskel as export source, update provenance and retain PNG as generated runtime output.
- [x] Run full tests/build and browser checks, review final changes and record final ZIP size.

## Decisions and progress

Continue in the existing authorized workspace to retain the prior uncommitted art changes.
Recommended Piskel-source workflow used unless user steers otherwise. No new playable
stage layouts invented; six slots contain visual settings and an explicitly labeled test preview.
Task interfaces are disjoint until root integration: worker writes only Piskel module/test/source.
