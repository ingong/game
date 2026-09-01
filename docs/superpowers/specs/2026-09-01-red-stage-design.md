# RED 1: Crimson Furnace Design

## Purpose

Build a playable vertical slice for a JS13K 2026 entry: an original muscular unicorn-headed runner crossing one red, fire-themed obstacle course from a third-person 2.5D view. This slice validates the controls, projection, obstacle readability, art direction, and compressed-size strategy before the other six color stages are designed.

## Scope

The slice contains one 45-second course, keyboard controls, a five-frame-equivalent running character, three obstacle families, a timer, success and failure states, and instant restart.

The other orange through violet stages, multiplayer, mobile controls, items, combat, character selection, progression, and persistent scores are out of scope. The engine must leave a compact data-driven extension point for later stages, but no unused systems will be built now.

## Player Experience

The player sees the runner from behind near the lower center of the screen. The course advances toward the camera while the character remains in a stable screen region. Upcoming obstacles must be visible early enough to react using only the arrow keys and Space.

The intended run lasts 30 to 40 seconds for a clean attempt. The 45-second limit permits a few slowdowns without making waiting optimal. Falling into lava or running out of time fails the run. Reaching the finish gate succeeds.

## Controls

- Left and Right move between continuous horizontal positions rather than fixed lanes.
- Up accelerates to the maximum running speed.
- Down brakes to a safe minimum speed but never reverses direction.
- Space jumps. Holding Space does not produce repeated jumps; the key must be released and pressed again after landing.
- Enter or Space restarts from the result screen.

Keyboard input uses `KeyboardEvent.code` so arrow and Space behavior is independent of the keyboard language. Browser scrolling is prevented only for the handled gameplay keys.

## Course Layout

The stage is approximately 900 abstract world units long and divided into four beats.

1. **Runway, 0-120:** A safe opening teaches steering and acceleration. One low flame bar introduces jump timing.
2. **Furnace Bars, 120-390:** Three flame bars alternate between low full-width jumps and offset bars that combine steering with jumping.
3. **Lava Steps, 390-680:** A sequence of broad cracked platforms creates gaps. Platform spacing increases gradually; the final gap requires near-full speed.
4. **Collapsing Bridge, 680-900:** Bridge tiles fall shortly after contact. A straight sprint and two final jumps lead to a bright finish gate.

No obstacle moves unpredictably. Difficulty comes from spacing, approach speed, and combining horizontal movement with jump timing. The first slice uses deterministic layouts so failures are learnable.

## Game Model

World simulation uses a small fixed timestep. The player state is position `(x, y, z)`, lateral velocity, forward speed, vertical velocity, grounded state, and run state. Obstacles are compact numeric tuples containing type, forward position, lateral position, width, and one optional parameter.

The stage advances along positive `z`. A simple projection converts lateral offset and distance from the camera into screen position and scale. Objects are sorted by depth and drawn far-to-near. Collision uses world-space rectangles for solid ground and horizontal/vertical intervals for hazards; visual pixels do not participate in collision.

The simulation has five states: title, countdown, running, success, and failure. State transitions reset all transient input and physics values to prevent stuck keys or inherited momentum.

## Rendering

The game uses a single HTML Canvas with nearest-neighbor rendering. There are no runtime image, font, library, or network requests.

The approved concept images are mood and proportion references only and are excluded from the submission ZIP. The runtime character is rebuilt from a very small palette and mirrored pixel/shape data. Four running poses are produced primarily by changing limb offsets; the jump pose changes the torso and leg silhouette. This preserves the concept's white body, cobalt shadows, blue shorts, and rainbow accents without embedding the megabyte PNG.

The environment uses flat polygons, repeated tile patterns, and procedural flame shapes. Red and vermilion dominate the stage; orange-yellow hazards and cobalt/cyan accents preserve readability. The road remains darker and less saturated than active hazards.

## Audio

Audio is optional for the first playable build and must never block gameplay. If size allows, WebAudio oscillators synthesize a jump chirp, impact burst, countdown ticks, and finish chord. No audio files are included.

## Size Strategy

The final archive must be at most 13,312 bytes and contain a top-level `index.html`. The development source remains readable and separate from the generated submission artifact.

The compressed target for the complete seven-stage game is 12.5 KB or less. During the red-stage slice, the build reports both raw and ZIP sizes but does not treat temporary headroom as permission to add speculative systems. Shared renderer and physics code, procedural graphics, numeric stage tuples, minification, and ZIP compression provide the main savings.

The concept PNG files stay under `assets/concepts/` and are explicitly excluded by the build.

## Project Structure

- `src/index.html`: readable development shell and canvas
- `src/game.js`: simulation, renderer, input, state machine, and red-stage data
- `tools/build.mjs`: deterministic minification, HTML assembly, ZIP creation, and size report
- `dist/index.html`: generated standalone submission file
- `dist/game.zip`: generated contest package
- `test/`: deterministic tests for projection, physics boundaries, stage data, and state transitions

Only generated files under `dist/` are considered for the submission size.

## Verification

Automated checks cover projection monotonicity, speed limits, jump landing, hazard collision, finish detection, timer expiry, and valid obstacle tuples. The build fails when the ZIP exceeds 13,312 bytes or lacks a top-level `index.html`.

Browser verification covers the latest Chrome and Firefox at desktop and narrow viewport sizes. The run must be completable using only arrow keys and Space, have no console errors, make every obstacle readable before it is actionable, and restart without reloading the page.

## Acceptance Criteria

- The complete red course can be finished within 45 seconds using only arrow keys and Space.
- The three course sections are visually and mechanically distinct.
- The character matches the approved silhouette and palette at gameplay scale.
- Failure and success are unambiguous, and restart takes one key press.
- The game works offline with no external resources.
- The submission build contains a top-level `index.html` and reports its exact ZIP size.
- The red-stage implementation establishes a compact data format that can add six stages without rewriting the engine.
