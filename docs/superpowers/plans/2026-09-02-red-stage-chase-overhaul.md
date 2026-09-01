# RED 1 Chase Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the red vertical slice into a responsive 2.5D chase runner with true forward control, continuous steering, double jump, readable obstacle clearance, five visually distinct course sections, and a compact original unicorn-bodybuilder character.

**Architecture:** Keep deterministic world simulation, stage queries, spring camera, compact character art, Canvas rendering, and browser orchestration in separate ES modules. Development remains readable ES modules; the submission builder emits one offline top-level `index.html` and rejects reference assets or an archive over 13,312 bytes.

**Tech Stack:** HTML5 Canvas 2D, JavaScript ES modules, Node.js built-in test runner, esbuild, Terser, Info-ZIP, and the existing local HTTP development server.

**Spec:** `docs/superpowers/specs/2026-09-02-red-stage-chase-overhaul-design.md`

## Global Constraints

- Preserve keyboard-only controls: arrow keys and Space. Do not add mouse, touch, or letter-key gameplay controls.
- Holding Up must be the cause of forward acceleration; releasing Up must visibly bleed momentum to zero, and Down must brake without reversing.
- Space allows exactly one ground jump and one smaller airborne jump before landing.
- Obstacle contact causes a stumble and speed loss. Only lava contact and timeout fail the run.
- The approximately 1,000-unit course must expose all five approved red-stage sections and remain finishable in 45 seconds.
- Runtime code must not request or package the concept PNG or any file under `assets/references/itch/`.
- Use an original visual vocabulary informed by the references, with no copied TalesRunner art, map layouts, names, or proprietary content.
- Render through a low-resolution logical Canvas and scale with nearest-neighbor sampling.
- Keep simulation and camera deterministic at the existing 1/120-second fixed step.
- Do not weaken the final 13,312-byte ZIP assertion. Visual tuning happens before the final size pass; the size gate remains mandatory before completion.

---

## File Map

- `src/sim.mjs`: runner state, acceleration, braking, steering, jumps, stumble, invulnerability, bridge collapse, finish, and failure transitions.
- `src/camera.mjs`: deterministic spring-follow camera, look-ahead, horizon, and impulse decay; no Canvas dependency.
- `src/math.mjs`: scalar helpers, camera-aware world projection, and logical viewport sizing.
- `src/stage.mjs`: five section tuples, obstacle tuples, road interpolation, moving obstacle bounds, surface, and contact queries.
- `src/art.mjs`: palette masks, articulated unicorn-bodybuilder pieces, pose selection, and pixel motifs; no external image loading.
- `src/render.mjs`: depth-sorted road, environment, obstacles, shadows, particles, runner placement, feedback, and HUD.
- `src/input.mjs`: existing held-arrow state and edge-triggered Space input; behavior remains unchanged.
- `src/main.mjs`: fixed-step simulation/camera wiring, low-resolution Canvas resize, restart flow, and animation loop.
- `src/index.html`: full-viewport Canvas shell and nearest-neighbor CSS.
- `test/sim.test.mjs`: locomotion, jump limits, landing, collisions, failure, finish, and restart.
- `test/camera.test.mjs`: spring convergence, delayed lateral follow, look-ahead, and shake decay.
- `test/math.test.mjs`: camera-relative projection and logical viewport sizing.
- `test/stage.test.mjs`: stage validity, section interpolation, obstacle cycles, surfaces, and contact semantics.
- `test/art.test.mjs`: pose coverage, mask-only runtime art, and drawing contract.
- `test/render.test.mjs`: renderer draw order and support for every obstacle and section family.
- `test/build.test.mjs`: standalone archive contents, reference-asset exclusion, and 13,312-byte limit.
- `tools/build.mjs`: deterministic single-file bundle, minification, ZIP creation, and byte report.

## Shared Contracts

`RunState` is a plain object with these stable fields:

```js
{
  mode, time, countdown,
  x, y, z, vx, vy, speed,
  grounded, jumps, anim,
  stumble, invulnerable, landing,
  landingId, stumbleId, hitIndex,
  collapse: { index, timer },
  failReason
}
```

`RunState.y` is clearance above the local road surface, not absolute world
elevation. Rendering projects the runner at `roadAt(stage,run.z).elevation +
run.y`; collision compares `run.y` with obstacle height, so hills never alter
jump timing.

`InputState` remains:

```js
{ left:false, right:false, up:false, down:false, jumpPressed:false }
```

Section tuples use `[z0,z1,width,y0,y1,theme,seed]`. Obstacle tuples use `[type,z,x,width,depth,height,period,phase]`. Obstacle type constants preserve the current first four numeric values for incremental compatibility:

```js
export const FIRE=0, GAP=1, BRIDGE=2, FINISH=3, HURDLE=4, PISTON=5
```

`CameraState` is:

```js
{
  x, y, z, vx, vy, vz,
  horizon, horizonVelocity, focal,
  shakeX, shakeY,
  lastLandingId, lastStumbleId
}
```

---

### Task 1: Replace Automatic Scrolling With Controlled Locomotion

**Files:**
- Modify: `src/sim.mjs`
- Modify: `test/sim.test.mjs`

**Interfaces:**
- Consumes: existing `InputState`, fixed `dt`, and a stage with `timeLimit`, `length`, and `obstacles`.
- Produces: immutable `RunState` updates through `createRun(stage)`, `restartRun(stage)`, and `stepRun(run,input,dt,stage)`.

- [ ] **Step 1: Replace the old speed assertions with failing control and jump tests**

Use an obstacle-free stage so this task isolates movement:

```js
const stage = { timeLimit:45, length:5000, obstacles:[] }
const idle = { left:false, right:false, up:false, down:false, jumpPressed:false }

test('Up accelerates from rest and releasing Up stops forward travel', () => {
  let run = { ...createRun(stage), mode:'running' }
  for (let i=0;i<240;i++) run=stepRun(run,{...idle,up:true},1/120,stage)
  assert.ok(run.speed > 25)
  const movingZ=run.z
  for (let i=0;i<480;i++) run=stepRun(run,idle,1/120,stage)
  assert.equal(run.speed,0)
  assert.ok(run.z > movingZ)
  const stoppedZ=run.z
  for (let i=0;i<120;i++) run=stepRun(run,idle,1/120,stage)
  assert.equal(run.z,stoppedZ)
})

test('Down brakes harder than rolling friction and never reverses', () => {
  let a={...createRun(stage),mode:'running',speed:30}
  let b={...a}
  for(let i=0;i<60;i++) a=stepRun(a,idle,1/120,stage)
  for(let i=0;i<60;i++) b=stepRun(b,{...idle,down:true},1/120,stage)
  assert.ok(b.speed<a.speed)
  assert.ok(b.speed>=0)
})

test('Space permits one jump and one smaller double jump', () => {
  let run={...createRun(stage),mode:'running'}
  run=stepRun(run,{...idle,jumpPressed:true},1/120,stage)
  const firstVy=run.vy
  run=stepRun(run,{...idle,jumpPressed:true},1/120,stage)
  const secondVy=run.vy
  run=stepRun(run,{...idle,jumpPressed:true},1/120,stage)
  assert.equal(run.jumps,2)
  assert.ok(firstVy>secondVy)
  assert.ok(secondVy>0)
})
```

- [ ] **Step 2: Run the focused test and confirm it fails for the old automatic runner**

Run: `node --test test/sim.test.mjs`

Expected: the acceleration-from-rest, stop, and double-jump assertions fail against the current state shape and movement rules.

- [ ] **Step 3: Add the complete locomotion fields and constants**

Initialize speed at zero and add the shared fields exactly once in `createRun`:

```js
export const MOTION={
  maxSpeed:34, acceleration:24, drag:10, brake:36,
  steerAcceleration:70, steerDrag:8, maxLateralSpeed:18,
  gravity:48, jumpImpulse:18, doubleJumpImpulse:15
}

export const createRun=stage=>({
  mode:'title',time:0,countdown:0,x:0,y:0,z:0,vx:0,vy:0,speed:0,
  grounded:true,jumps:0,anim:0,stumble:0,invulnerable:0,landing:0,
  landingId:0,stumbleId:0,hitIndex:-1,collapse:{index:-1,timer:0},
  failReason:''
})
```

In the running branch, apply these equations in this order:

```js
const drive=input.up?MOTION.acceleration:input.down?-MOTION.brake:-MOTION.drag
n.speed=clamp(n.speed+drive*dt,0,MOTION.maxSpeed)
const steer=(input.right?1:0)-(input.left?1:0)
const grip=.45+.55*(1-n.speed/MOTION.maxSpeed)
n.vx=clamp(n.vx+steer*MOTION.steerAcceleration*grip*dt,
  -MOTION.maxLateralSpeed,MOTION.maxLateralSpeed)
if(!steer)n.vx=Math.sign(n.vx)*Math.max(0,Math.abs(n.vx)-MOTION.steerDrag*dt)
n.x=clamp(n.x+n.vx*dt,-31,31)
n.z+=n.speed*dt
```

Apply `jumpImpulse` only when `jumps===0`; apply `doubleJumpImpulse` only when airborne and `jumps===1`; ignore later presses. Reset `jumps` to zero on landing, set `landing=1`, and increment `landingId` once per airborne-to-ground transition. Decay `landing` toward zero at `5*dt`.

- [ ] **Step 4: Preserve title/countdown/restart/time behavior and update animation distance**

Keep Space restart behavior, but ensure `restartRun` starts from zero speed. Advance `anim` by `speed*dt*.055` so pose cadence follows distance rather than wall-clock time. Continue returning a new object and a new nested `collapse` object on every step.

- [ ] **Step 5: Run all tests and commit**

Run: `npm test`

Expected: all existing tests plus the new movement tests pass; any old assertion that expects minimum speed 12 is removed because it contradicts the approved control model.

```bash
git add src/sim.mjs test/sim.test.mjs
git commit -m "feat: add controlled runner locomotion"
```

---

### Task 2: Add the Deterministic Spring Chase Camera

**Files:**
- Create: `src/camera.mjs`
- Create: `test/camera.test.mjs`

**Interfaces:**
- Consumes: `RunState`, ground elevation, and fixed `dt`.
- Produces: `createCamera(run,ground=0): CameraState` and `stepCamera(camera,run,dt,ground=0): CameraState`.

- [ ] **Step 1: Write failing camera behavior tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createCamera,stepCamera } from '../src/camera.mjs'

const run={x:0,y:0,z:100,speed:20,landingId:0,stumbleId:0,stumble:0}

test('camera converges behind the runner without snapping laterally',()=>{
  let camera=createCamera(run)
  const moved={...run,x:20,z:140,speed:34}
  camera=stepCamera(camera,moved,1/120)
  assert.ok(camera.x>0&&camera.x<moved.x*.55)
  for(let i=0;i<600;i++)camera=stepCamera(camera,moved,1/120)
  assert.ok(Math.abs(camera.x-moved.x*.55)<.05)
  assert.ok(camera.z<moved.z)
})

test('speed increases look-ahead by moving the camera farther back',()=>{
  const slow=createCamera({...run,speed:0})
  const fast=createCamera({...run,speed:34})
  assert.ok(fast.z<slow.z)
  assert.ok(fast.horizon<slow.horizon)
})

test('landing and stumble impulses decay deterministically',()=>{
  let camera=createCamera(run)
  camera=stepCamera(camera,{...run,landingId:1},1/120)
  const landing=Math.abs(camera.shakeY)
  camera=stepCamera(camera,{...run,landingId:1},.5)
  assert.ok(Math.abs(camera.shakeY)<landing)
  camera=stepCamera(camera,{...run,landingId:1,stumbleId:1},1/120)
  assert.notEqual(camera.shakeX,0)
})
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `node --test test/camera.test.mjs`

Expected: FAIL because `src/camera.mjs` does not exist.

- [ ] **Step 3: Implement a stable scalar spring and initial camera placement**

Use the same spring equation for x, y, z, and horizon:

```js
const spring=(p,v,target,k,dt)=>{
  const f=1+2*dt*k,oo=k*k,hoo=dt*oo,hhoo=dt*hoo,inv=1/(f+hhoo)
  return [(f*p+dt*v+hhoo*target)*inv,(v+hoo*(target-p))*inv]
}

export function createCamera(run,ground=0){
  const speed=run.speed||0
  return {
    x:run.x*.55,y:ground+8+(run.y||0)*.18,z:run.z-20-speed*.12,
    vx:0,vy:0,vz:0,horizon:.30-.035*speed/34,horizonVelocity:0,
    focal:.9,shakeX:0,shakeY:0,
    lastLandingId:run.landingId||0,lastStumbleId:run.stumbleId||0
  }
}
```

- [ ] **Step 4: Implement follow targets and one-shot impulses**

In `stepCamera`, clone the camera, spring toward `run.x*.55`, `ground+8+run.y*.18`, `run.z-20-run.speed*.12`, and `.30-.035*run.speed/34`. Use spring frequencies `7`, `5`, `8`, and `4` respectively. A new `landingId` adds `2.2` to `shakeY`; a new `stumbleId` adds `2.6*Math.sign(run.x-camera.x||1)` to `shakeX`. Multiply both impulses by `Math.exp(-12*dt)` every step and update both stored IDs.

- [ ] **Step 5: Run all tests and commit**

Run: `npm test`

Expected: all tests pass, including camera convergence and impulse decay.

```bash
git add src/camera.mjs test/camera.test.mjs
git commit -m "feat: add spring chase camera"
```

---

### Task 3: Replace the Flat Obstacle List With Five Course Sections

**Files:**
- Modify: `src/stage.mjs`
- Modify: `test/stage.test.mjs`

**Interfaces:**
- Produces: `RED_STAGE`, constants `FIRE`, `GAP`, `BRIDGE`, `FINISH`, `HURDLE`, `PISTON`, `validateStage(stage)`, `sectionAt(stage,z)`, `roadAt(stage,z)`, `obstacleBounds(obstacle,time)`, `surfaceAt(stage,x,z,collapse)`, and `contactAt(stage,run)`.
- Temporarily preserves: `hazardAt(stage,run)` and `bridgeIndexAt(stage,x,z)` for the old simulation until Task 4.

- [ ] **Step 1: Write failing tests for section coverage and compact tuple validity**

```js
test('red stage contains five contiguous sets and a finish at 1000',()=>{
  assert.deepEqual(validateStage(RED_STAGE),[])
  assert.equal(RED_STAGE.sections.length,5)
  assert.deepEqual(RED_STAGE.sections.map(s=>[s[0],s[1]]),
    [[0,160],[160,360],[360,600],[600,800],[800,1000]])
  assert.equal(RED_STAGE.length,1000)
  assert.deepEqual(RED_STAGE.obstacles.at(-1).slice(0,2),[FINISH,1000])
})

test('road elevation interpolates and section width changes',()=>{
  const canalStart=roadAt(RED_STAGE,360)
  const canalEnd=roadAt(RED_STAGE,599)
  assert.ok(canalEnd.elevation>canalStart.elevation)
  assert.notEqual(roadAt(RED_STAGE,100).width,roadAt(RED_STAGE,900).width)
})

test('flames and pistons expose deterministic active cycles',()=>{
  const flame=RED_STAGE.obstacles.find(o=>o[0]===FIRE)
  const piston=RED_STAGE.obstacles.find(o=>o[0]===PISTON)
  assert.notEqual(obstacleBounds(flame,0).active,obstacleBounds(flame,1.2).active)
  assert.notEqual(obstacleBounds(piston,0).x,obstacleBounds(piston,.7).x)
})
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test test/stage.test.mjs`

Expected: FAIL because the current stage has no section model, piston type, or camera-ready road query.

- [ ] **Step 3: Install the exact section and obstacle data**

Use these tuples as the red course baseline:

```js
export const FIRE=0,GAP=1,BRIDGE=2,FINISH=3,HURDLE=4,PISTON=5

export const RED_STAGE={
  name:'RED 1',timeLimit:45,length:1000,
  sections:[
    [0,160,36,0,0,0,11],
    [160,360,28,0,1,1,23],
    [360,600,30,1,4,2,37],
    [600,800,26,4,2,3,41],
    [800,1000,22,2,6,4,53]
  ],
  obstacles:[
    [HURDLE,92,0,12,3,4,0,0],
    [FIRE,188,-8,9,4,9,2.4,0],
    [FIRE,236,8,9,4,9,2.4,.8],
    [HURDLE,282,0,15,3,5,0,0],
    [FIRE,328,0,13,4,10,2.8,1.4],
    [GAP,408,0,60,11,0,0,0],
    [HURDLE,454,-7,10,3,4,0,0],
    [GAP,488,0,60,14,0,0,0],
    [HURDLE,536,7,10,3,5,0,0],
    [GAP,570,0,60,18,0,0,0],
    [PISTON,640,-12,12,5,6,2.8,0],
    [PISTON,690,12,12,5,6,2.8,.9],
    [PISTON,742,0,16,6,8,3.2,1.6],
    [HURDLE,782,0,12,3,5,0,0],
    [BRIDGE,830,0,22,17,0,.42,0],
    [BRIDGE,852,0,22,17,0,.38,0],
    [BRIDGE,874,0,22,17,0,.34,0],
    [BRIDGE,896,0,22,17,0,.30,0],
    [BRIDGE,918,0,22,17,0,.28,0],
    [BRIDGE,940,0,22,17,0,.25,0],
    [FINISH,1000,0,28,4,18,0,0]
  ]
}
```

- [ ] **Step 4: Implement all pure stage queries**

`sectionAt` selects the tuple satisfying `z>=z0 && z<z1`, using the final tuple at `z===stage.length`. `roadAt` returns `{width,elevation,theme,seed}` and linearly interpolates `y0` to `y1`. `obstacleBounds` returns `{x,z,width,depth,height,active}`; fire is active while normalized phase is in `[.32,.78]`, and a piston moves across 60% of the local road width using `Math.sin(phase*Math.PI*2)`.

`surfaceAt` returns `null` inside a gap or a bridge whose `collapse.index` matches and whose timer exceeds that bridge tuple's `period`; otherwise it returns `roadAt(stage,z).elevation`. `contactAt` returns `null` or `{kind,index}` where `kind` is `stumble`, `lava`, `bridge`, or `finish`. Keep the compatibility wrappers thin and implemented in terms of these new queries.

- [ ] **Step 5: Validate malformed inputs, run all tests, and commit**

`validateStage` must report noncontiguous sections, invalid tuple lengths, unordered obstacles, obstacle footprints outside the course, a missing final finish, and a finish not equal to `stage.length`.

Run: `npm test`

Expected: all tests pass, and `validateStage(RED_STAGE)` returns an empty array.

```bash
git add src/stage.mjs test/stage.test.mjs
git commit -m "feat: build five-part red course"
```

---

### Task 4: Add Stumbles, Invulnerability, Lava Failure, and Bridge Collapse

**Files:**
- Modify: `src/sim.mjs`
- Modify: `src/stage.mjs`
- Modify: `test/sim.test.mjs`
- Modify: `test/stage.test.mjs`

**Interfaces:**
- Consumes: `contactAt`, `roadAt`, and `surfaceAt` from `src/stage.mjs`.
- Produces: nonterminal obstacle response, terminal lava/time response, collapse state, and success transition.
- Removes: obsolete `hazardAt` and `bridgeIndexAt` exports after every caller is migrated.

- [ ] **Step 1: Write failing collision-state tests**

```js
test('solid obstacle contact stumbles once and preserves the run',()=>{
  const hurdle=RED_STAGE.obstacles.find(o=>o[0]===HURDLE)
  let run={...createRun(RED_STAGE),mode:'running',z:hurdle[1],x:hurdle[2],speed:30}
  run=stepRun(run,idle,1/120,RED_STAGE)
  assert.equal(run.mode,'running')
  assert.ok(run.stumble>0)
  assert.ok(run.invulnerable>0)
  assert.ok(run.speed<20)
  const id=run.stumbleId
  run=stepRun(run,idle,1/120,RED_STAGE)
  assert.equal(run.stumbleId,id)
})

test('jumping above a hurdle preserves speed and does not stumble',()=>{
  const hurdle=RED_STAGE.obstacles.find(o=>o[0]===HURDLE)
  let run={...createRun(RED_STAGE),mode:'running',z:hurdle[1],x:hurdle[2],y:8,speed:30,grounded:false,jumps:1}
  run=stepRun(run,idle,1/120,RED_STAGE)
  assert.equal(run.stumble,0)
  assert.ok(run.speed>29)
})

test('lava is terminal but ordinary obstacle contact is not',()=>{
  const gap=RED_STAGE.obstacles.find(o=>o[0]===GAP)
  let run={...createRun(RED_STAGE),mode:'running',z:gap[1],x:0,y:0}
  run=stepRun(run,idle,1/120,RED_STAGE)
  assert.equal(run.mode,'failure')
  assert.equal(run.failReason,'LAVA')
})

test('bridge plate collapses only after its delay',()=>{
  const index=RED_STAGE.obstacles.findIndex(o=>o[0]===BRIDGE)
  const plate=RED_STAGE.obstacles[index]
  let run={...createRun(RED_STAGE),mode:'running',z:plate[1],x:0,speed:0}
  run=stepRun(run,idle,1/120,RED_STAGE)
  assert.equal(run.collapse.index,index)
  for(let i=0;i<80&&run.mode==='running';i++)run=stepRun(run,idle,1/120,RED_STAGE)
  assert.equal(run.failReason,'LAVA')
})
```

- [ ] **Step 2: Run simulation and stage tests and confirm failure**

Run: `node --test test/sim.test.mjs test/stage.test.mjs`

Expected: FAIL because the old simulation turns fire contact into immediate failure and has no invulnerability or collapse timing.

- [ ] **Step 3: Implement collision response after movement integration**

After updating position and vertical physics, query `contactAt(stage,n)`. For `stumble` when `invulnerable===0`, apply exactly:

```js
n.stumble=.45
n.invulnerable=.75
n.speed*=.45
n.vx*=-.35
n.stumbleId++
n.hitIndex=contact.index
```

Decay `stumble` and `invulnerable` toward zero each step. Do not increment `stumbleId` again while invulnerable. Clear `hitIndex` only after the runner leaves the obstacle footprint. A successful jump over an obstacle makes no state change.

- [ ] **Step 4: Implement bridge, finish, and terminal transitions**

On `bridge`, start `{index:contact.index,timer:0}` and advance only while that same plate remains underfoot. On `lava`, set `mode:'failure'` and `failReason:'LAVA'`. On `finish`, set `mode:'success'` before any later timeout check. Timeout still sets `failReason:'TIME'`. Keep Space restart behavior identical for title, success, and failure.

- [ ] **Step 5: Run all tests and commit**

Run: `npm test`

Expected: all tests pass, including one-shot stumble, obstacle clearance, lava failure, bridge delay, timeout, finish, and restart.

```bash
git add src/sim.mjs src/stage.mjs test/sim.test.mjs test/stage.test.mjs
git commit -m "feat: add runner collision feedback"
```

---

### Task 5: Replace the Megabyte Sprite With Compact Articulated Pixel Art

**Files:**
- Modify: `src/art.mjs`
- Modify: `src/render.mjs`
- Modify: `src/main.mjs`
- Modify: `tools/build.mjs`
- Modify: `test/art.test.mjs`
- Modify: `test/build.test.mjs`
- Delete: `src/assets/unicorn-runner-sprite-concept.png`

**Interfaces:**
- Produces: `runnerPose(run): number`, `runnerScale(width,height): number`, and `drawRunner(ctx,run,x,y,scale): void`.
- Removes: runtime `Image`, `RUNNER_SHEET_SRC`, source PNG copying, and all `drawImage` dependency for the player.

- [ ] **Step 1: Write failing art and build tests before deleting the PNG**

```js
test('runner exposes six run phases and distinct airborne feedback',()=>{
  const phases=new Set(Array.from({length:6},(_,i)=>runnerPose({anim:i/6,grounded:true,jumps:0,stumble:0,landing:0})))
  assert.equal(phases.size,6)
  assert.notEqual(runnerPose({anim:0,grounded:false,jumps:1,stumble:0,landing:0}),
    runnerPose({anim:0,grounded:false,jumps:2,stumble:0,landing:0}))
})

test('runtime art has no external sprite source',async()=>{
  const source=await readFile(new URL('../src/art.mjs',import.meta.url),'utf8')
  assert.doesNotMatch(source,/RUNNER_SHEET_SRC|new Image|drawImage/)
})

test('submission archive contains only index.html',()=>{
  execFileSync(process.execPath,['tools/build.mjs'])
  const listing=execFileSync('unzip',['-Z1','dist/game.zip'],{encoding:'utf8'}).trim().split('\n')
  assert.deepEqual(listing,['index.html'])
})
```

- [ ] **Step 2: Run the focused tests and confirm they fail against the PNG path**

Run: `node --test test/art.test.mjs test/build.test.mjs`

Expected: FAIL because the current renderer and builder load and package `unicorn-runner-sprite-concept.png`.

- [ ] **Step 3: Define the compact palette, articulated pieces, and pose table**

Use palette indexes rather than repeated color strings:

```js
const P=['#24131b','#fff7e8','#e8e1d3','#f4b7c8','#e63f35','#8f151f','#ffcf42','#5a301f','#151018']
const A=Math.PI/12
const POSES=[
  [0,-2,1,2,-1,2,-1,-2,1,0],
  [0,-1,0,1,0,1,0,-1,0,1],
  [1,1,-1,-1,1,-1,2,1,-2,0],
  [0,2,-1,-2,1,-2,1,2,-1,-1],
  [0,1,0,-1,0,-1,0,1,0,0],
  [-1,-1,1,1,-1,1,-2,-1,2,1],
  [-1,-2,-1,2,1,-1,-2,1,-2,-2],
  [1,2,2,-2,-2,2,-1,-2,1,-3],
  [3,-3,2,-1,1,-3,1,-2,0,2],
  [0,1,1,-1,-1,1,1,-1,-1,3]
]
```

Pose rows are `[lean,leftUpperArm,leftForearm,rightUpperArm,rightForearm,leftThigh,leftShin,rightThigh,rightShin,bob]` in 15-degree units. Rows 0-5 are running, 6 is first jump, 7 is double jump, 8 is stumble, and 9 is landing.

Represent each reusable piece as arrays of tiny rectangles `[x,y,w,h,colorIndex]`: torso, head, muzzle, horn, mane, tail, upper arm, forearm, fist, thigh, shin, and boot. Preserve the approved silhouette: broad shoulders, narrow waist, white unicorn head, pink mane, gold horn, red shorts, dark boots. Draw back limbs and tail first, then torso, front limbs, head, muzzle, mane, horn, outline accents, and two bright eye pixels.

- [ ] **Step 4: Implement pose selection and a projection-free drawing API**

`runnerPose` returns row 8 while `stumble>0`, row 9 while `landing>.45`, row 7 when airborne with `jumps===2`, row 6 for the first airborne jump, and otherwise `Math.floor(run.anim*6)%6`. `drawRunner` receives a screen anchor and never imports projection math. Set `ctx.imageSmoothingEnabled=false`, quantize translated piece origins with `Math.round`, and use `ctx.save/translate/rotate/scale/restore` around each joint.

Update `render.mjs` to project the existing anchor and call `drawRunner(ctx,run,p.x,p.y,runnerScale(w,h)*p.scale)`. Remove image loading and readiness state from `main.mjs`.

- [ ] **Step 5: Remove the PNG from source and the builder**

Delete `src/assets/unicorn-runner-sprite-concept.png`. In `tools/build.mjs`, remove `copyFileSync`, asset directory creation, and the second ZIP entry. Keep `assets/concepts/` and `assets/references/itch/` untouched as design provenance outside the runtime.

- [ ] **Step 6: Run all tests, build once, and commit**

Run: `npm test`

Expected: all tests pass; art source contains no runtime image path.

Run: `npm run build`

Expected: `dist/game.zip` lists only `index.html`. Record its current byte count, but reserve the hard size gate for Task 8 after renderer work.

```bash
git add src/art.mjs src/render.mjs src/main.mjs tools/build.mjs test/art.test.mjs test/build.test.mjs
git add -u src/assets/unicorn-runner-sprite-concept.png
git commit -m "feat: draw articulated pixel runner"
```

---

### Task 6: Integrate Camera-Aware Projection and the Logical Pixel Canvas

**Files:**
- Modify: `src/math.mjs`
- Modify: `src/render.mjs`
- Modify: `src/main.mjs`
- Modify: `src/index.html`
- Modify: `test/math.test.mjs`
- Modify: `test/art.test.mjs`
- Create: `test/render.test.mjs`

**Interfaces:**
- Produces: `projectPoint(camera,x,y,z,width,height): {x,y,scale,depth}`, `logicalViewport(cssWidth,cssHeight): {width,height,pixelScale}`, and `render(ctx,run,camera,stage,width,height): void`.
- Consumes: `createCamera`, `stepCamera`, `roadAt`, and projection-free `drawRunner`.

- [ ] **Step 1: Write failing projection and viewport tests**

```js
test('world projection moves the runner while the camera follows late',()=>{
  const camera={x:0,y:8,z:80,horizon:.28,focal:.9,shakeX:0,shakeY:0}
  const center=projectPoint(camera,0,0,100,320,180)
  const right=projectPoint(camera,8,0,100,320,180)
  const high=projectPoint(camera,0,6,100,320,180)
  assert.ok(right.x>center.x)
  assert.ok(high.y<center.y)
  assert.equal(center.depth,20)
})

test('logical viewport chooses stable integer pixel scaling',()=>{
  assert.deepEqual(logicalViewport(1280,720),{width:320,height:180,pixelScale:4})
  assert.deepEqual(logicalViewport(390,844),{width:195,height:422,pixelScale:2})
})
```

Add a recording Canvas context test that calls `render` and verifies at least one road polygon, one runner transform, and HUD text are drawn without a DOM or image object.

- [ ] **Step 2: Run focused tests and confirm signature failures**

Run: `node --test test/math.test.mjs test/art.test.mjs test/render.test.mjs`

Expected: FAIL because projection is fixed-camera, the logical viewport helper is absent, and render does not accept camera state.

- [ ] **Step 3: Replace fixed projection with camera-relative projection**

```js
export function projectPoint(camera,x,y,z,w,h){
  const depth=Math.max(1,z-camera.z)
  const scale=Math.min(w,h)*camera.focal/depth
  return {
    x:w/2+(x-camera.x)*scale+camera.shakeX,
    y:h*camera.horizon-(y-camera.y)*scale+camera.shakeY,
    scale,depth
  }
}

export function logicalViewport(cssW,cssH){
  const pixelScale=clamp(Math.floor(Math.min(cssW,cssH)/180),2,4)
  return {width:Math.ceil(cssW/pixelScale),height:Math.ceil(cssH/pixelScale),pixelScale}
}
```

Update every projection call in `render.mjs` to pass camera and the queried road elevation. Remove the obsolete fixed-camera `roadEdges` API.

- [ ] **Step 4: Wire simulation and camera in the fixed-step loop**

Create camera state beside run state. On restart, recreate it from the new run. During every fixed step, update `run=stepRun(...)`, query `roadAt(RED_STAGE,run.z).elevation`, then update `camera=stepCamera(camera,run,STEP,elevation)`. Render snapshots through `render(ctx,run,camera,RED_STAGE,canvas.width,canvas.height)`.

- [ ] **Step 5: Switch Canvas backing dimensions to the logical viewport**

On resize, call `logicalViewport(innerWidth,innerHeight)`, assign only the returned logical width and height to Canvas backing dimensions, and leave CSS at `width:100vw;height:100vh`. Add `image-rendering:pixelated` and `touch-action:none` to the Canvas. Do not multiply the backing store by `devicePixelRatio`.

- [ ] **Step 6: Run all tests and commit**

Run: `npm test`

Expected: all tests pass at both desktop and narrow logical dimensions.

```bash
git add src/math.mjs src/render.mjs src/main.mjs src/index.html test/math.test.mjs test/art.test.mjs test/render.test.mjs
git commit -m "feat: integrate chase camera projection"
```

---

### Task 7: Build Readable Obstacles and Five Distinct Forge Environments

**Files:**
- Modify: `src/render.mjs`
- Modify: `src/art.mjs`
- Modify: `test/render.test.mjs`

**Interfaces:**
- Consumes: section tuples, `roadAt`, `obstacleBounds`, run collapse state, and camera projection.
- Produces: far-to-near road strips, section landmarks, all six obstacle types, telegraphs, dynamic shadows, landing/stumble particles, and compact HUD.

- [ ] **Step 1: Expand the recording-context tests before renderer changes**

Render one snapshot centered in each section and one snapshot for each obstacle type. Tag test draw calls by passing a tiny recording context whose `fill`, `stroke`, `fillRect`, `arc`, `fillText`, `translate`, `rotate`, and `scale` methods append operation names. Assert:

```js
for(const z of [80,240,480,700,900]){
  const ops=renderOpsAt(z)
  assert.ok(ops.polygons>=12)
  assert.ok(ops.fills>=20)
}
for(const type of [FIRE,GAP,BRIDGE,FINISH,HURDLE,PISTON]){
  assert.ok(renderOpsFor(type).obstacleFaces>=2)
}
```

Also assert that a jumping runner's shadow scale is smaller than a grounded runner's and that a collapse timer changes the bridge plate transform.

- [ ] **Step 2: Run the renderer test and confirm visual-family failures**

Run: `node --test test/render.test.mjs`

Expected: FAIL because current rendering has a flat road, four obstacle shapes, no section landmarks, and no stateful runner shadow.

- [ ] **Step 3: Render the road as elevation-aware depth strips**

Sample from `camera.z+4` to `camera.z+220` in 4-unit strips, far to near. For every strip, query both endpoint widths and elevations, project four corners, and alternate two road colors using `Math.floor(z/8)&1`. Add a one-unit bright rim, dark side face, and lava plane beneath gaps. Clip only objects behind the camera; do not clamp them to the runner anchor.

- [ ] **Step 4: Add deterministic section identities**

Use `theme` and `seed` without runtime random calls:

- Theme 0 Forge Yard: broad furnace doors, rails, floor vents, and moving gear silhouettes.
- Theme 1 Furnace Corridor: close brick side walls, pipes, chains, warning lamps, and smoke puffs.
- Theme 2 Molten Canal: elevated steel platforms, lava river bands, far lavafalls, and guard posts.
- Theme 3 Piston Hall: press columns, ram housings, striped warning plates, and cycling lamps.
- Theme 4 Falling Bridge: narrow plates, broken rails, falling sparks, lavafall landmark, and bright finish portal.

Derive prop side, spacing, and height from `(Math.imul(index+seed,1103515245)>>>16)&255`. Keep every prop as projected quads, short lines, circles, or calls to reusable pixel motifs in `art.mjs`.

- [ ] **Step 5: Draw each obstacle with volume, telegraph, and motion**

Each solid obstacle draws a ground shadow, top face, front face, side face, and high-contrast rim. Flames draw inactive pilot glow plus active columns. Gaps expose moving lava and a visible far ledge. Pistons use `obstacleBounds` for synchronized ram position and flashing lamps. Bridge plates rotate and sink according to `collapse.timer/period`. The finish uses two furnace pillars and a white-hot rectangular portal, never TalesRunner branding.

- [ ] **Step 6: Add runner-to-world feedback**

Project a ground shadow at `(run.x,road.elevation,run.z)` and shrink opacity/scale by `clamp(1-run.y/14,.2,1)`. On `landing>0`, draw sparks behind both boots and squash the runner vertically by `1-.12*landing`. On `stumble>0`, add a red-white impact star and offset the runner opposite `vx`. Add sparse speed streaks only above speed 24. Keep title, countdown, timer, speed, success, and failure HUD compact and free of explanatory feature text.

- [ ] **Step 7: Run tests, visually inspect the red slice, and commit**

Run: `npm test`

Expected: all automated tests pass.

Run: `npm run dev`

At `http://localhost:4173/`, verify at 1280x720 that the runner moves off center before the camera catches up, hurdles pass beneath a jump, gaps reveal lava below, pistons visibly cycle, and all five section identities appear in order.

```bash
git add src/render.mjs src/art.mjs test/render.test.mjs
git commit -m "feat: render dense volcanic chase course"
```

---

### Task 8: Tune the Full Run and Enforce the JS13K Submission Gate

**Files:**
- Modify: `src/sim.mjs` only for measured control constants.
- Modify: `src/stage.mjs` only for measured obstacle positions or cycle timing.
- Modify: `src/render.mjs` and `src/art.mjs` only for measured readability or byte reductions.
- Modify: `tools/build.mjs`
- Modify: `test/build.test.mjs`
- Modify: `README.md` if it already exists; otherwise create it with controls, local run, build, and attribution notes.

**Interfaces:**
- Produces: a completable 45-second red course, offline `dist/index.html`, and `dist/game.zip` containing exactly one file and no more than 13,312 bytes.

- [ ] **Step 1: Add the hard archive and source-reference assertions**

```js
test('submission stays within the 13 KiB competition limit',()=>{
  execFileSync(process.execPath,['tools/build.mjs'])
  assert.ok(statSync('dist/game.zip').size<=13312)
})

test('submission contains no runtime or reference asset paths',async()=>{
  const html=await readFile('dist/index.html','utf8')
  assert.doesNotMatch(html,/assets\/|itch|unicorn-runner-sprite-concept|https?:\/\//)
})
```

Make `tools/build.mjs` throw with both actual and allowed byte counts when the ZIP exceeds 13,312 bytes. The ZIP command must include only `index.html` from inside `dist/`.

- [ ] **Step 2: Run the complete automated suite and submission build**

Run: `npm test`

Expected: all tests pass, including build execution.

Run: `npm run build`

Expected: the command reports a ZIP size at or below 13,312 bytes and `unzip -Z1 dist/game.zip` prints only `index.html`.

- [ ] **Step 3: Apply the fixed byte-reduction order only when the gate fails**

Preserve movement, collision, obstacle silhouettes, and the five section identities. Remove bytes in this order, rebuilding after each item: reduce decorative smoke and chain variants to one shared function; reduce ember and speed-streak counts; merge repeated section palette literals into indexed arrays; collapse repeated projected-face calls into one helper; shorten nonessential HUD copy. Do not remove double jump, chase-camera lag, obstacle telegraphs, collision feedback, section boundaries, or the articulated runner.

- [ ] **Step 4: Complete keyboard playthrough QA at desktop and narrow viewports**

At 1280x720 and 390x844, perform a clean restart and verify:

1. No key pressed means no forward travel.
2. Up accelerates, release coasts to zero, Down brakes, and Left/Right steer continuously.
3. First and second Space presses create visibly different jumps; a third airborne press does nothing.
4. A hurdle, flame, or piston hit stumbles without ending the run.
5. Falling into lava and timeout each show the correct failure state and allow Space restart.
6. The runner, shadow, road elevation, and delayed camera all change screen position coherently.
7. Every obstacle is visibly approached, cleared or struck, and passed behind the camera.
8. Forge Yard, Furnace Corridor, Molten Canal, Piston Hall, and Falling Bridge are recognizable without labels.
9. A practiced run reaches the finish in 35-40 seconds, leaving stumble recovery inside the 45-second limit.
10. No network request, missing image, console error, clipped HUD, overlapping text, or blank Canvas appears.

- [ ] **Step 5: Verify Chromium and Firefox compatibility**

Run the same built `dist/index.html` through the local server in current Chromium and current Firefox. In both engines, verify keyboard edge handling, audio-free startup, Canvas scaling, restart, and successful completion. Capture desktop and narrow screenshots for the implementation review and report any unavailable browser explicitly instead of claiming it was tested.

- [ ] **Step 6: Final regression run and commit**

Run: `npm test`

Expected: every test passes.

Run: `npm run build`

Expected: `dist/game.zip <= 13,312 bytes`, one top-level `index.html`, no external resources.

```bash
git add src/sim.mjs src/stage.mjs src/render.mjs src/art.mjs tools/build.mjs test/build.test.mjs README.md
git commit -m "feat: ship compact red chase vertical slice"
```

---

## Completion Evidence

The implementing worker must return these concrete results with the final handoff:

- Full `npm test` pass count.
- Final `dist/game.zip` byte count and `unzip -Z1` listing.
- Desktop and narrow browser screenshot paths.
- Measured clean-run completion time.
- Browser engines actually tested.
- Any decoration removed during byte reduction.
