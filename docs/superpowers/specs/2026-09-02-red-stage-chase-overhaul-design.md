# RED 1 Chase Overhaul Design

## Purpose

Replace the current screen-anchored pseudo-runner with an original 2.5D foot
race that has the readable movement, jump rhythm, and obstacle density expected
from a chase-camera platform racer. The red vertical slice remains a single
player, keyboard-only course and does not copy TalesRunner art, maps, names, or
proprietary content.

## Player Experience

The runner starts from rest inside a volcanic forge fortress. Holding Up makes
him accelerate through the world, releasing Up lets momentum decay, Down brakes,
and Left or Right steers continuously across the road. The runner is no longer
painted at a fixed screen coordinate: his world position is projected through a
spring-follow chase camera, so steering, jumping, landing, and road elevation
all visibly move both the character and camera.

A clean run should take 35 to 40 seconds. The 45-second limit allows a few
stumbles but still rewards maintaining speed. Falling into lava or running out
of time ends the attempt. Striking a hurdle, piston, or flame causes a short
stumble, speed loss, and brief invulnerability instead of an immediate failure.

## Controls And Movement

- Up accelerates forward while held. Maximum speed is reached gradually.
- Releasing Up applies rolling friction and can bring the runner to a stop.
- Down applies a stronger brake and never reverses the runner.
- Left and Right apply lateral acceleration in world space. Steering remains
  continuous rather than lane-based and becomes slightly less sharp at top
  speed.
- Space performs the first jump. Pressing Space once more while airborne
  performs one smaller double jump. A third press has no effect until landing.
- Space restarts from title, success, or failure screens.

The simulation remains fixed-step and deterministic. Player state adds jump
count, stumble time, invulnerability time, landing impulse, and previous-ground
state. Collision uses world coordinates rather than screen pixels.

## Chase Camera

The camera owns a world-space lateral position, height, follow distance, pitch,
look-ahead, and shake impulse. It follows the runner with a damped spring instead
of snapping directly to him.

- Lateral steering shifts the runner on screen first; the camera catches up a
  fraction later.
- Speed increases look-ahead and lowers the horizon slightly, making more road
  visible while strengthening forward motion.
- Jumping lifts the runner relative to the road while the camera follows only a
  portion of the vertical movement.
- Landing produces a short downward camera impulse, runner squash, sparks, and a
  shadow that reconnects with the road.
- Stumbles kick the camera sideways and temporarily reduce look-ahead.

Projection accepts camera state and road elevation. World objects pass the
camera and leave the frame instead of merely shrinking toward a fixed runner.

## Obstacle Feedback

Every obstacle has a world-space footprint, visible height, cast shadow, and a
telegraph zone. The renderer must make its top, front, and side planes readable
before collision.

1. **Slag hurdles:** waist-high steel and furnace-brick barriers teach the first
   jump. Their front faces expand toward the camera and pass beneath the runner.
2. **Flame gates:** floor vents and side pipes emit rhythmic flame columns. A
   glow and rising pilot flame telegraph each burst. Contact causes a stumble.
3. **Molten canal gaps:** broken road sections expose animated lava below.
   Landing position, shadow, and the far ledge make the required jump distance
   legible.
4. **Forge pistons:** large side-mounted rams cross part of the road on a fixed,
   visible cycle. Players may steer around them or double-jump over low arms.
5. **Collapsing bridge plates:** cracked steel plates tilt and fall shortly after
   contact. Their state is visualized by sparks, separation, and downward motion.

Successful clearance triggers a short whoosh, shadow separation, and a small
speed-preserving landing burst. Only lava contact and timeout are terminal.

## Course Structure

The approximately 1,000-unit course is divided into five distinct sets.

1. **Forge Yard, 0-160:** broad runway, accelerating machinery, one slag hurdle,
   and a wide furnace gate establish movement and scale.
2. **Furnace Corridor, 160-360:** brick walls close in, pipes and chains create
   parallax, and alternating flame gates combine steering with jumps.
3. **Molten Canal, 360-600:** the road breaks into elevated steel platforms over
   a visible lava river, ending with a double-jump gap.
4. **Piston Hall, 600-800:** giant press machinery creates side-to-side routes,
   with moving silhouettes and warning lamps telegraphing cycles.
5. **Falling Bridge, 800-1000:** narrow plates collapse in sequence while a lava
   waterfall and the bright finish portal frame the final sprint.

The environment includes cavern silhouettes, lavafalls, furnace doors, pipes,
rails, vents, chains, smoke, embers, and warning lamps. Repetition is broken by
section palettes, prop seeds, road width, road elevation, and landmark placement.

## Rendering And Asset Strategy

Canvas 2D renders a deliberately low-resolution logical scene and scales it to
the viewport with nearest-neighbor sampling. Geometry is depth-sorted and drawn
far to near using projected quads, reusable billboards, and small particle pools.

The approved high-resolution unicorn runner remains a development reference and
may be used temporarily while tuning movement. The submission character is an
articulated pixel hybrid: reusable torso, unicorn head, mane, tail, limb, and
boot pieces are assembled from compact palette masks and a small table of joint
angles. This provides six run phases, two airborne poses, a stumble pose, and a
landing squash without storing ten full raster frames.

The itch.io files under `assets/references/itch/` are visual research only. The
runtime recreates selected motifs with original compact geometry and palette
data. Reference PNG, ASEPRITE, and ZIP files never enter `src/` or `dist/`.

Road surfaces use tiny repeatable patterns. Cavern walls, lava bands, smoke,
sparks, and distant machinery are generated from equations and deterministic
seeds. Stage tuples store only section boundaries, road parameters, obstacle
parameters, and landmark seeds.

## Architecture

- `sim.mjs` owns acceleration, friction, steering, double jump, stumble,
  invulnerability, and fixed-step transitions.
- `camera.mjs` updates a deterministic spring camera from runner state and
  exposes projection parameters without knowing about Canvas.
- `stage.mjs` describes sections, road elevation/width, obstacles, and compact
  prop seeds; it also owns world-space collision queries.
- `render.mjs` draws the world, obstacles, feedback, and HUD from simulation and
  camera snapshots.
- `art.mjs` draws the compact articulated runner and reusable pixel motifs.

Simulation, camera, stage queries, and rendering helpers remain independently
testable. The renderer does not determine collision and the simulation does not
depend on viewport dimensions.

## Size Strategy

The 2026 submission limit remains 13,312 bytes zipped. The current megabyte PNG
build is a development build only and is not eligible for submission.

The target zipped budget is:

- Movement, collision, and state machine: 3.0 KB
- Camera and projection: 1.2 KB
- World and obstacle renderer: 3.0 KB
- Articulation, pixel masks, and particles: 2.2 KB
- Seven-stage data and shared palettes: 1.4 KB
- HUD, synthesized sound, shell, and reserve: 2.0 KB

These are design targets, not guarantees. Gameplay and visual readability are
tuned first in the red slice; compact-build measurement follows each completed
system, and nonessential decoration is removed before core feedback.

## Testing And Acceptance

Automated tests cover acceleration and stopping, high-speed steering bounds,
single and double jump limits, landing transitions, nonterminal obstacle hits,
terminal lava falls, camera convergence, landing shake decay, road elevation,
obstacle cycles, stage validity, restart, and finish timing.

Browser acceptance uses desktop and narrow viewports and verifies:

- Holding Up visibly advances the runner and increases speed cues.
- Steering changes both world position and delayed camera framing.
- Both jumps show clear ascent, apex, descent, shadow separation, and landing.
- Obstacles have readable depth and are visibly passed under or beside the
  runner.
- The five course sets are visually and mechanically distinct.
- The complete course is learnable and finishable using only arrows and Space.
- No reference asset is requested by the compact submission build.
