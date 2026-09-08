# Seven-stage minimum build and budget

Authorized scope: establish seven playable prototype courses and progression under 13,312 ZIP bytes, preserving existing art and physics. These are pattern variants, not seven finished level designs.

- [x] Generate seven stage settings, with shared authoring defaults and ZIP-compressed repeated settings.
- [x] Reuse one course template; vary orientation and hazard phase without copying geometry arrays.
- [x] Advance on clear, retry on failure, restart after stage seven; HUD explains transitions.
- [x] Connect editor previews and saves to actual seven-stage data.
- [x] Test all seven clean playthroughs, progression, isolation, settings regeneration and ZIP size.
- [x] Inspect browser, record byte baseline and remaining budget; no commit or deployment.

Files: src/stage.mjs owns shared course generation; src/main.mjs owns orchestration; new src/progression.mjs owns transitions; src/render.mjs owns clear prompts; tools/map-settings-model.mjs generates runtime settings; config/map-settings.json stores authoring settings; tools/map-editor/* previews the actual selected course. Existing build guard remains mandatory.

Stage one remains unchanged. Stages two to seven are deterministic palette / mirror / hazard phase variants. Minimum prototype geometry remains 1000 m with a 45-second deadline. Validate every variant with production simulation. Preserve all earlier uncommitted work.
