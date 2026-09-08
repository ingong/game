# Image generation record — 2026-09-07

Tool: built-in `image_gen` (not the CLI/API fallback).

Selected generated source: `assets/concepts/unicorn-prismatic-source.png`.
The first edit used the original runtime atlas and larger project source sheet.
The second edit used the first generated result. Both outputs were RGB with a
near-white matte despite the transparency request. The checked-in runtime
export recipe handles that matte explicitly; the source file is retained as
received. The generative steps are not deterministic. Export from the selected
source to the runtime PNG is deterministic.

## Style edit prompt

> Use case: style-transfer
> Asset type: production game sprite atlas for an offline JS13K Canvas game.
> Primary request: restyle this project's unicorn runner sprite atlas as closely as possible to the pixel-art aesthetic of Hyper Light Drifter.
> Input images: Image 1 is the EDIT TARGET: the exact 160x56 horizontal five-frame runtime atlas. Image 2 is identity/anatomy support only, showing the original unicorn in larger form.
> Keep the unicorn identity (single horn, rear-view upright running humanoid unicorn, mane, tail, short boots), rear-view perspective, five distinct poses, exact left-to-right frame order, all five equally sized 32x56 frame cells, placement, baseline and frame separation of Image 1. No sword, no new protagonist, no text, no outlines around the sheet.
> Restyle the actual character pixels: much simpler deliberate angular pixel clusters, confident broken dark-indigo silhouette edges, 2-3 flat tone planes per material, ivory/pale lavender body, navy-indigo shorts and boots, coral-magenta mane and tail with restrained mint-cyan highlight streaks, pale gold horn. Dusk palette: #16152c #253451 #395b78 #8f91b5 #f5eed6 #f05b78 #ff9a83 #f9d98f #58d8ce #9df7e5 #9966aa. Avoid smooth shaded muscles, noisy dithering, gradients, glow blur, and excessive tiny detail. The character should remain immediately legible at 32x56 pixels.
> Frames must be: 0 neutral planted feet; 1 one lifted leg running; 2 the other running stride prepared for in-game mirroring; 3 airborne jump knees up; 4 low impact/landing crouch. Keep the existing body proportions and similar occupied bounds so the game anchoring stays correct.
> Background must be REAL FULL TRANSPARENCY (alpha 0), absolutely no checkerboard artwork, ground, cast shadow, backdrop or colored fill. Sprite interiors should be fully opaque (alpha 255), with hard pixel edges, not semitransparent.
> Output a single PNG sprite sheet with total canvas aspect ratio 160:56, five equal cells and nothing else. Target exactly 160x56 logical pixels. If delivering at a larger resolution, make it an exact nearest-neighbor integer enlargement of the pixel grid, retaining the five-cell layout. This is a sprite asset, not an illustration of a sprite sheet.

## Background correction prompt

> Use case: background-extraction. Edit target is the supplied five-pose unicorn pixel-art atlas. KEEP ALL EXISTING SPRITE PIXELS, COLORS, POSES, SPACING, AND OVERALL 2120:742 CANVAS ASPECT RATIO EXACTLY. The previous output incorrectly has an opaque white/gray checkerboard painted into RGB pixels. Remove that entire checkerboard background and replace it with actual alpha-0 transparency. This is a technical transparent game sprite export, not an illustration of transparency. Do not draw a checkerboard in the output. Use transparent-background output so the actual PNG contains an alpha channel. Keep body whites and pale lavender shading opaque. Five frames only; do not rearrange, add or remove any sprite or detail. Hard pixel edges. No glow, no shadow, no backdrop. Output the transparent PNG asset.
