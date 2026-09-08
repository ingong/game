import {REFERENCE_STAGE as RED_STAGE} from './fixtures/reference-course.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRun, restartRun, stepRun } from '../src/sim.mjs'
import { BRIDGE, GAP, HURDLE, FIRE, SPRING } from '../src/stage.mjs'

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
  assert.equal(run.speed,0)
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

test('an airborne run with no jumps ignores a ground jump press', () => {
  const run={...createRun(stage),mode:'running',grounded:false,jumps:0,y:1}
  const next=stepRun(run,{...idle,jumpPressed:true},1/120,stage)
  assert.equal(next.jumps,0)
  assert.equal(next.grounded,false)
  assert.ok(next.vy<0)
})

test('the first ground-contact transition exposes landing and increments landingId once', () => {
  const run={...createRun(stage),mode:'running',grounded:false,jumps:1,y:.1,vy:-20}
  const landed=stepRun(run,idle,1/120,stage)
  assert.equal(landed.landing,1)
  assert.equal(landed.landingId,1)
  const settled=stepRun(landed,idle,1/120,stage)
  assert.equal(settled.landingId,1)
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

test('timer expiry enters failure state', () => {
  let run = { ...createRun(stage), mode:'running', time:44.99 }
  run = stepRun(run, idle, .02, stage)
  assert.equal(run.mode, 'failure')
  assert.equal(run.failReason, 'TIME')
})

test('countdown reaches running after three simulated seconds', () => {
  let run = restartRun(stage)
  assert.equal(run.countdown, 3)
  for (let i = 0; i < 360; i++) run = stepRun(run, idle, 1 / 120, stage)
  assert.equal(run.mode, 'running')
  assert.equal(run.countdown, 0)
  assert.equal(run.time, 0)
  assert.equal(run.z, 0)
})

test('stepping resets off-bridge collapse state without mutating the input run', () => {
  const collapse = { index: 7, timer: 1.25 }
  const run = { ...createRun(stage), mode:'running', collapse }
  const next = stepRun(run, idle, .1, stage)
  assert.deepEqual(next.collapse, { index:-1, timer:0 })
  assert.notStrictEqual(next, run)
  assert.deepEqual(run.collapse, collapse)
  assert.equal(run.time, 0)
  assert.equal(run.z, 0)
})

test('crossing the finish enters success state', () => {
  const short = { timeLimit:45, length:1, obstacles:[[3,1,0,24,0]] }
  let run = { ...createRun(short), mode:'running', speed:30 }
  run = stepRun(run, idle, .1, short)
  assert.equal(run.mode, 'success')
})

test('solid obstacle contact stumbles once and preserves the run', () => {
  const hurdle = RED_STAGE.obstacles.find(obstacle => obstacle[0] === HURDLE)
  let run = { ...createRun(RED_STAGE), mode:'running', z:hurdle[1], x:hurdle[2], speed:30 }
  run = stepRun(run, idle, 1 / 120, RED_STAGE)
  assert.equal(run.mode, 'running')
  assert.ok(run.stumble > 0)
  assert.ok(run.invulnerable > 0)
  assert.ok(run.speed < 20)
  const id = run.stumbleId
  run = stepRun(run, idle, 1 / 120, RED_STAGE)
  assert.equal(run.stumbleId, id)
})

test('a stumble hit is retained until the runner leaves its obstacle footprint', () => {
  const index = RED_STAGE.obstacles.findIndex(obstacle => obstacle[0] === HURDLE)
  const hurdle = RED_STAGE.obstacles[index]
  const hit = stepRun(
    { ...createRun(RED_STAGE), mode:'running', z:hurdle[1], x:hurdle[2], speed:0 },
    idle, 1 / 120, RED_STAGE
  )
  const clear = stepRun(
    { ...hit, z:hurdle[1] + hurdle[4] / 2 + .1, speed:0 },
    idle, 1 / 120, RED_STAGE
  )
  assert.equal(hit.hitIndex, index)
  assert.equal(clear.hitIndex, -1)
})

test('jumping above a hurdle preserves speed and does not stumble', () => {
  const hurdle = RED_STAGE.obstacles.find(obstacle => obstacle[0] === HURDLE)
  let run = {
    ...createRun(RED_STAGE), mode:'running', z:hurdle[1], x:hurdle[2],
    y:8, speed:30, grounded:false, jumps:1
  }
  run = stepRun(run, idle, 1 / 120, RED_STAGE)
  assert.equal(run.stumble, 0)
  assert.ok(run.speed > 29)
})

test('lava is terminal but ordinary obstacle contact is not', () => {
  const gap = RED_STAGE.obstacles.find(obstacle => obstacle[0] === GAP)
  let run = { ...createRun(RED_STAGE), mode:'running', z:gap[1], x:0, y:0 }
  run = stepRun(run, idle, 1 / 120, RED_STAGE)
  assert.equal(run.mode, 'failure')
  assert.equal(run.failReason, 'LAVA')
})

test('bridge plate collapses only after its delay', () => {
  const index = RED_STAGE.obstacles.findIndex(obstacle => obstacle[0] === BRIDGE)
  const plate = RED_STAGE.obstacles[index]
  let run = { ...createRun(RED_STAGE), mode:'running', z:plate[1], x:0, speed:0 }
  run = stepRun(run, idle, 1 / 120, RED_STAGE)
  assert.equal(run.collapse.index, index)
  for (let i = 0; i < 80 && run.mode === 'running'; i++) run = stepRun(run, idle, 1 / 120, RED_STAGE)
  assert.equal(run.failReason, 'LAVA')
})

test('reaching the finish on the time boundary succeeds', () => {
  const short = { timeLimit:.1, length:1, obstacles:[[3, 1, 0, 24, 0]] }
  let run = { ...createRun(short), mode:'running', speed:30 }
  run = stepRun(run, idle, .1, short)
  assert.equal(run.mode, 'success')
})

test('a stumble at the finish cannot turn into a timeout failure', () => {
  const short = {
    timeLimit:.1, length:1,
    obstacles:[[0, 1, 0, 24, 3], [3, 1, 0, 24, 0]]
  }
  let run = { ...createRun(short), mode:'running', speed:30 }
  run = stepRun(run, idle, .1, short)
  assert.equal(run.mode, 'success')
})

test('active lightning produces a visible shock and temporarily blocks acceleration', () => {
  const stage={...RED_STAGE,obstacles:[[FIRE,100,0,12,12,10,2.4,0]]}
  let run={...createRun(stage),mode:'running',time:1.2,z:100,speed:29}
  run=stepRun(run,{...idle,up:true},1/120,stage)
  assert.ok(run.shock>0)
  assert.equal(run.speed,0)
  const id=run.stumbleId
  run=stepRun(run,{...idle,up:true,jumpPressed:true},.1,stage)
  assert.equal(run.speed,0)
  assert.equal(run.stumbleId,id)
  assert.equal(run.jumps,0)
})

test('final spring sequence launches a grounded runner across all three gaps', () => {
  assert.equal(RED_STAGE.obstacles.filter(o=>o[0]===SPRING).length,3)
  let run={...createRun(RED_STAGE),mode:'running',time:30,z:842,speed:29.2}
  let launches=0
  for(let i=0;i<900&&run.mode==='running'&&run.z<980;i++) {
    const next=stepRun(run,{...idle,up:true},1/120,RED_STAGE)
    if(next.springId>run.springId)launches++
    run=next
  }
  assert.equal(run.mode,'running',`failed at ${run.z}`)
  assert.ok(run.z>=980)
  assert.equal(launches,3)
})

test('inactive lightning is safe and shock recovery does not repeatedly hit the same emitter', () => {
  const stage={...RED_STAGE,obstacles:[[FIRE,100,0,12,12,10,2.4,0]]}
  const inactive={...createRun(stage),mode:'running',time:2.2,z:100,speed:10}
  assert.equal(stepRun(inactive,{...idle,up:true},1/120,stage).shock,0)
  let run=stepRun({...inactive,time:1.2},{...idle,up:true},1/120,stage)
  const hits=run.stumbleId
  for(let i=0;i<84;i++)run=stepRun(run,{...idle,up:true},1/120,stage)
  assert.equal(run.shock,0)
  assert.ok(run.speed>0)
  assert.equal(run.stumbleId,hits)
})
