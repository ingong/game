# Piskel and map asset workspace

The current game is stage 1 of a planned seven-stage game. Build an authoring page
for reusable map visuals; prepare six draft stage slots without claiming six new courses.
Keep the existing playable stage geometry, controls and collision behavior.

Use Piskel as the character's editable source. Convert the existing five-frame atlas
losslessly into a `.piskel` project; subsequent exports read that source, retaining the
32×56 five-frame contract. The runtime can still use a compact indexed PNG internally:
Piskel is an authoring format, not a replacement browser image codec. Support import
and download in the local authoring page. Preserve the previous ImageGen source.

Replace the five ornate decoration families and busy skyline with a simple optional
landmark. Default stage 1: flat sky/void, no horizon towers, no moving background bands,
sparse optional landmarks disabled, quiet tile seams and thin road edges. Hazards,
telegraphs and finish geometry stay readable and retain their gameplay behavior.

The development page has seven stage tabs, a live preview rendered by the real game,
an asset inventory including each obstacle family, and controls for environment colors,
tile seams, edge lighting, ripple count, landmark visibility/spacing/size. Stage 2–7
previews explicitly use the stage-1 test course until new layouts are authored.
The page saves seven-stage settings to a project JSON file through a localhost-only
Node server. Generated runtime settings contain only stage 1; draft slots, editor code,
Piskel source and HTTP endpoints never enter the ZIP. Unsaved changes, conflicts and
validation errors are visible. A save does not falsely claim the submission ZIP rebuilt.

No new dependencies. ZIP maximum 13,312 bytes. Save endpoints accept fixed file targets,
bounded JSON bodies, same-origin requests and revision checks. Invalid imports and stale
saves must leave existing assets intact. Tests cover conversion, malformed files,
settings bounds, persistence/conflicts, actual renderer changes and build exclusions.
