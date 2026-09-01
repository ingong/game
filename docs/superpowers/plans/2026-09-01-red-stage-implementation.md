# RED 1: Crimson Furnace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable, offline, 45-second 2.5D red-stage runner that uses only arrow keys and Space and produces a size-checked JS13K submission ZIP.

**Architecture:** Keep deterministic simulation, compact stage data, Canvas rendering, and browser orchestration in separate ES modules during development. Bundle them into one top-level `index.html` for submission; the megabyte concept PNGs remain development references and never enter `dist/`.

**Tech Stack:** HTML5 Canvas 2D, JavaScript ES modules, Node.js built-in test runner, esbuild, Terser, Info-ZIP.

**Spec:** `docs/superpowers/specs/2026-09-01-red-stage-design.md`

## Global Constraints

- The complete red course must be finishable within exactly 45 seconds using only arrow keys and Space.
- The game must work offline in current Chrome and Firefox with no external runtime resources.
- The generated ZIP must contain a top-level `index.html` and be at most 13,312 bytes.
- The concept PNGs under `assets/concepts/` must be excluded from `dist/` and the ZIP.
- The first slice implements only the red stage; later colors receive a data extension point, not speculative systems.
- Runtime graphics use Canvas shapes and compact palette data, never the concept PNGs.

---

## File Map

- `package.json`: test, development server, build, and size-check commands.
- `src/math.mjs`: 2.5D projection and scalar helpers with no browser dependency.
- `src/sim.mjs`: player physics, timer, and run-state transitions.
- `src/stage.mjs`: red-stage obstacle tuples, validation, and stage interactions.
- `src/render.mjs`: Canvas environment, obstacle, character, and HUD drawing.
- `src/input.mjs`: keyboard state and one-shot jump handling.
- `src/main.mjs`: fixed-step loop and module wiring.
- `src/index.html`: development shell with the single gameplay canvas.
- `test/math.test.mjs`: projection behavior.
- `test/sim.test.mjs`: speed, jump, timer, and state behavior.
- `test/stage.test.mjs`: stage tuple validity and deterministic interactions.
- `test/build.test.mjs`: archive content and size guard.
- `tools/build.mjs`: deterministic bundle, minify, HTML assembly, ZIP, and byte report.
- `dist/index.html`: generated standalone game.
- `dist/game.zip`: generated submission candidate.

---

### Task 1: Project Setup and Projection Math

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `src/math.mjs`
- Create: `test/math.test.mjs`

**Interfaces:**
- Consumes: none
- Produces: `clamp(value, min, max): number`, `projectPoint(x, y, z, width, height): {x, y, scale}`, and `roadEdges(z, width, height): {left, right, y}`

- [ ] **Step 1: Create the package scripts and ignore generated files**

```json
{
  "name": "crimson-furnace",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "dev": "python3 -m http.server 4173 -d src",
    "build": "node tools/build.mjs"
  }
}
```

`.gitignore` must contain `node_modules/` and `dist/`. Then run `npm install --save-dev esbuild terser` so `package-lock.json` pins the resolved versions.

- [ ] **Step 2: Write failing projection tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { clamp, projectPoint, roadEdges } from '../src/math.mjs'

test('clamp limits a scalar', () => {
  assert.equal(clamp(-2, 0, 1), 0)
  assert.equal(clamp(.4, 0, 1), .4)
  assert.equal(clamp(3, 0, 1), 1)
})

test('near points project larger and lower than far points', () => {
  const near = projectPoint(0, 0, 30, 960, 540)
  const far = projectPoint(0, 0, 300, 960, 540)
  assert.ok(near.scale > far.scale)
  assert.ok(near.y > far.y)
})

test('road narrows toward the horizon', () => {
  const near = roadEdges(30, 960, 540)
  const far = roadEdges(300, 960, 540)
  assert.ok(near.right - near.left > far.right - far.left)
})
```

- [ ] **Step 3: Run the test and confirm the expected failure**

Run: `npm test -- test/math.test.mjs`

Expected: FAIL because `src/math.mjs` does not exist or lacks the named exports.

- [ ] **Step 4: Implement the projection helpers**

```js
export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v

export function projectPoint(x, y, z, w, h) {
  const d = Math.max(12, z)
  const scale = 220 / d
  return { x: w / 2 + x * scale, y: h * .28 + 58 * scale - y * scale, scale }
}

export function roadEdges(z, w, h) {
  const a = projectPoint(-34, 0, z, w, h)
  const b = projectPoint(34, 0, z, w, h)
  return { left: a.x, right: b.x, y: a.y }
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- test/math.test.mjs`

Expected: 3 tests pass.

```bash
git add package.json package-lock.json .gitignore src/math.mjs test/math.test.mjs
git commit -m "feat: add projection math"
```

---

### Task 2: Deterministic Runner Simulation

**Files:**
- Create: `src/sim.mjs`
- Create: `test/sim.test.mjs`

**Interfaces:**
- Consumes: `clamp` from `src/math.mjs`
- Produces: `createRun(stage): RunState`, `stepRun(run, input, dt, stage): RunState`, and `restartRun(stage): RunState`
- `InputState` is `{left:boolean,right:boolean,up:boolean,down:boolean,jumpPressed:boolean}`
- `RunState` contains `{mode,time,x,y,z,vx,vy,speed,grounded,anim,failReason}`

- [ ] **Step 1: Write failing simulation tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRun, stepRun } from '../src/sim.mjs'

const stage = { timeLimit: 45, length: 900, obstacles: [] }
const idle = { left:false, right:false, up:false, down:false, jumpPressed:false }

test('forward speed remains within the designed limits', () => {
  let run = createRun(stage)
  run.mode = 'running'
  for (let i = 0; i < 600; i++) run = stepRun(run, { ...idle, up:true }, 1 / 120, stage)
  assert.ok(run.speed <= 30)
  for (let i = 0; i < 600; i++) run = stepRun(run, { ...idle, down:true }, 1 / 120, stage)
  assert.ok(run.speed >= 12)
})

test('jump is one impulse and lands back on the road', () => {
  let run = createRun(stage)
  run.mode = 'running'
  run = stepRun(run, { ...idle, jumpPressed:true }, 1 / 120, stage)
  assert.ok(run.vy > 0)
  for (let i = 0; i < 240; i++) run = stepRun(run, idle, 1 / 120, stage)
  assert.equal(run.y, 0)
  assert.equal(run.grounded, true)
})

test('timer expiry enters failure state', () => {
  let run = { ...createRun(stage), mode:'running', time:44.99 }
  run = stepRun(run, idle, .02, stage)
  assert.equal(run.mode, 'failure')
  assert.equal(run.failReason, 'TIME')
})
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `npm test -- test/sim.test.mjs`

Expected: FAIL because the simulation module does not exist.

- [ ] **Step 3: Implement fixed-step player physics**

Implement `createRun` with `mode:'title'`, zeroed position, `speed:18`, and `grounded:true`. In `stepRun`, clone the state, clamp horizontal position to `[-30, 30]`, clamp speed to `[12, 30]`, apply jump impulse `18`, gravity `-42`, advance `z` by `speed * dt`, advance `time` only in `running`, and set `failure/TIME` at `stage.timeLimit`.

```js
import { clamp } from './math.mjs'

export const createRun = stage => ({
  mode:'title', time:0, x:0, y:0, z:0, vx:0, vy:0,
  speed:18, grounded:true, anim:0, failReason:''
})

export const restartRun = stage => ({ ...createRun(stage), mode:'countdown', countdown:3 })
```

`stepRun` must return a new object so tests can compare previous and next state without hidden mutation.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- test/sim.test.mjs`

Expected: 3 tests pass.

```bash
git add src/sim.mjs test/sim.test.mjs
git commit -m "feat: add runner simulation"
```

---

### Task 3: Red Stage Data and Interactions

**Files:**
- Create: `src/stage.mjs`
- Create: `test/stage.test.mjs`
- Modify: `src/sim.mjs`
- Modify: `test/sim.test.mjs`

**Interfaces:**
- Consumes: `RunState` from `src/sim.mjs`
- Produces: `RED_STAGE`, `validateStage(stage): string[]`, `surfaceAt(stage,x,z): number|null`, and `hazardAt(stage,run): string|null`
- Obstacles use tuples `[type,z,x,width,param]`, where type `0` is a flame bar, type `1` is a gap, type `2` is a collapsing bridge tile, and type `3` is the finish gate.

- [ ] **Step 1: Write failing stage-data tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { RED_STAGE, validateStage, hazardAt } from '../src/stage.mjs'

test('red stage is valid and ends at its finish gate', () => {
  assert.deepEqual(validateStage(RED_STAGE), [])
  assert.equal(RED_STAGE.timeLimit, 45)
  assert.equal(RED_STAGE.obstacles.at(-1)[0], 3)
  assert.equal(RED_STAGE.obstacles.at(-1)[1], RED_STAGE.length)
})

test('a grounded runner touching a flame bar is hit', () => {
  const flame = RED_STAGE.obstacles.find(o => o[0] === 0)
  assert.equal(hazardAt(RED_STAGE, { x:flame[2], y:0, z:flame[1] }), 'FIRE')
  assert.equal(hazardAt(RED_STAGE, { x:flame[2], y:8, z:flame[1] }), null)
})
```

- [ ] **Step 2: Run the stage test and confirm failure**

Run: `npm test -- test/stage.test.mjs`

Expected: FAIL because `src/stage.mjs` does not exist.

- [ ] **Step 3: Define the deterministic course**

Create `RED_STAGE` with `timeLimit:45`, `length:900`, and ordered tuples that encode one teaching bar near `z=100`, three furnace-bar challenges from `z=170` to `360`, gap/platform sequences from `z=410` to `650`, collapsing bridge tiles from `z=700` to `850`, and `[3,900,0,24,0]` as the final tuple.

`validateStage` returns messages for an invalid time limit, unsorted obstacle positions, unknown type, non-positive width, or finish mismatch. `hazardAt` uses forgiving world-space bounds: flame contact requires `y < 4`, gap contact requires `y <= 0`, and finish never reports a hazard.

- [ ] **Step 4: Connect stage interactions to simulation**

At the end of a running simulation step, call `hazardAt(stage,next)`. Set `{mode:'failure',failReason:hazard}` for `FIRE` or `LAVA`. Set `mode:'success'` when `next.z >= stage.length`, unless a failure was already detected in the same step.

Add this assertion to `test/sim.test.mjs`:

```js
test('crossing the finish enters success state', () => {
  const short = { timeLimit:45, length:1, obstacles:[[3,1,0,24,0]] }
  let run = { ...createRun(short), mode:'running', speed:30 }
  run = stepRun(run, idle, .1, short)
  assert.equal(run.mode, 'success')
})
```

- [ ] **Step 5: Run all tests and commit**

Run: `npm test`

Expected: all math, simulation, and stage tests pass.

```bash
git add src/sim.mjs src/stage.mjs test/sim.test.mjs test/stage.test.mjs
git commit -m "feat: define crimson furnace course"
```

---

### Task 4: Canvas Game, Character, and Controls

**Files:**
- Create: `src/input.mjs`
- Create: `src/render.mjs`
- Create: `src/main.mjs`
- Create: `src/index.html`

**Interfaces:**
- Consumes: `RED_STAGE`, `createRun`, `restartRun`, `stepRun`, and projection helpers
- Produces: `createInput(target): {read():InputState,destroy():void}`, `render(ctx,run,stage,width,height): void`, and a browser entry point in `src/main.mjs`

- [ ] **Step 1: Implement keyboard input with one-shot jumping**

`createInput(window)` tracks `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, and `Space`. It calls `preventDefault()` only for those codes. `read()` returns held arrow states and consumes `jumpPressed` once. `destroy()` removes both listeners.

```js
const handled = new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'])
export function createInput(target) {
  const held = new Set()
  let jumpPressed = false
  const down = e => {
    if (!handled.has(e.code)) return
    e.preventDefault()
    if (e.code === 'Space' && !held.has('Space')) jumpPressed = true
    held.add(e.code)
  }
  const up = e => { if (handled.has(e.code)) { e.preventDefault(); held.delete(e.code) } }
  target.addEventListener('keydown', down)
  target.addEventListener('keyup', up)
  return {
    read() {
      const input = { left:held.has('ArrowLeft'), right:held.has('ArrowRight'), up:held.has('ArrowUp'), down:held.has('ArrowDown'), jumpPressed }
      jumpPressed = false
      return input
    },
    destroy() { target.removeEventListener('keydown', down); target.removeEventListener('keyup', up) }
  }
}
```

- [ ] **Step 2: Implement the environment renderer**

`render` clears to scarlet sky, draws a dark red road as projected quadrilaterals, lava bands with deterministic sine offsets, and obstacles from far to near. Flame bars are orange/yellow rectangles with three triangular flame tips; gaps expose lava; bridge tiles shrink and darken after contact; the finish uses a bright arch with a small checker pattern.

Use only the stage palette `['#31051b','#790b24','#d51d24','#ff641e','#ffd34d','#0877d1','#071f70','#fff']`. Do not load fonts or images.

- [ ] **Step 3: Implement the runtime character**

Draw the runner from layered Canvas primitives at the projected player position: navy shadow legs, white calves and torso, cobalt shorts, broad white arms, a rear three-quarter unicorn head, one horn, and six compact rainbow mane/tail stripes. Derive the run cycle from `sin(run.anim)` and `cos(run.anim)` limb offsets; use a tucked-leg pose while `!run.grounded`.

The character must occupy no more than 28% of canvas height and must not cover the nearest actionable obstacle.

- [ ] **Step 4: Add HUD and state overlays**

Draw `RED 1` at the upper left and `MM:SS` at the upper right using the system monospace font. Title copy is `CRIMSON FURNACE`; countdown is `3`, `2`, `1`, `GO`; results are `CLEAR` or `TIME UP`/`FELL` and `SPACE TO RUN AGAIN`.

Text uses a navy shadow and white foreground. Keep overlays unframed so the course remains visible.

- [ ] **Step 5: Wire the fixed-step browser loop**

In `src/main.mjs`, acquire `#game`, resize its backing store to `min(devicePixelRatio,2)`, and run simulation at `1/120` seconds with an accumulator capped at `0.1` seconds. Title Space starts the countdown; the countdown becomes running after three seconds; result Space calls `restartRun`.

`src/index.html` contains one canvas, inline page CSS, `<meta name="viewport" content="width=device-width,initial-scale=1">`, and `<script type="module" src="./main.mjs"></script>`.

- [ ] **Step 6: Run tests and manually smoke-test the source build**

Run: `npm test`

Run: `npm run dev`

Open: `http://localhost:4173`

Verify that Space starts, all four arrows affect the run, Space jumps only once per press, failure and success restart without reload, resizing preserves the layout, and the console remains clear.

- [ ] **Step 7: Commit the playable source slice**

```bash
git add src/input.mjs src/render.mjs src/main.mjs src/index.html
git commit -m "feat: add playable crimson furnace"
```

---

### Task 5: Submission Build, Size Guard, and Browser Verification

**Files:**
- Create: `tools/build.mjs`
- Create: `test/build.test.mjs`
- Generate: `dist/index.html`
- Generate: `dist/game.zip`

**Interfaces:**
- Consumes: browser entry point `src/main.mjs` and shell `src/index.html`
- Produces: standalone `dist/index.html`, `dist/game.zip`, and stdout lines `HTML: N bytes` and `ZIP: N / 13312 bytes`

- [ ] **Step 1: Write the failing archive test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'

test('submission ZIP has one top-level index and fits the limit', () => {
  execFileSync('node', ['tools/build.mjs'], { stdio:'pipe' })
  const names = execFileSync('unzip', ['-Z1', 'dist/game.zip'], { encoding:'utf8' }).trim().split('\n')
  assert.deepEqual(names, ['index.html'])
  assert.ok(statSync('dist/game.zip').size <= 13312)
})
```

- [ ] **Step 2: Run the build test and confirm failure**

Run: `npm test -- test/build.test.mjs`

Expected: FAIL because `tools/build.mjs` does not exist.

- [ ] **Step 3: Implement deterministic assembly and size reporting**

Use esbuild's JavaScript API to bundle `src/main.mjs` as an IIFE in memory. Pass the bundle through Terser with `module:false`, `toplevel:true`, `compress:{passes:3,unsafe_math:true}`, and `mangle:true`. Replace the development module script in `src/index.html` with one inline classic script, collapse inter-tag whitespace, write `dist/index.html`, remove only the old generated `dist/game.zip`, and execute `zip -9 -j dist/game.zip dist/index.html`.

After writing, print exact HTML and ZIP sizes. Throw an error when the ZIP is above `13312` or when the HTML contains `assets/`, `http://`, or `https://`.

- [ ] **Step 4: Run the complete verification suite**

Run: `npm test`

Run: `npm run build`

Run: `unzip -l dist/game.zip`

Expected: all tests pass; the archive lists only top-level `index.html`; reported ZIP size is at most 13,312 bytes.

- [ ] **Step 5: Verify the standalone build in Chrome and Firefox**

Serve `dist/` at `http://localhost:4174`. In each browser, complete one run, intentionally hit a flame bar, intentionally fall into lava, allow one minimum-speed run to reach the 45-second timeout, restart after each result, resize to `1280x720` and `390x844`, and inspect the console.

Expected: every path produces the correct state, no on-screen text overlaps, the course remains readable at both sizes, the Canvas is nonblank, and there are no console errors.

- [ ] **Step 6: Record final evidence and commit**

Record the passing test count, exact ZIP byte count, browser versions, and any residual visual limitation in the task handoff.

```bash
git add package.json package-lock.json tools/build.mjs test/build.test.mjs
git commit -m "build: add js13k submission pipeline"
```

Do not add `dist/` or `assets/concepts/` to the commit unless the user explicitly requests generated artifacts in version control.
