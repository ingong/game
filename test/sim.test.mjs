import test from 'node:test'
import assert from 'node:assert/strict'
import { createRun, restartRun, stepRun } from '../src/sim.mjs'

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

test('a collapsing bridge becomes lava after its delay', () => {
  const bridge = { timeLimit:45, length:100, obstacles:[[2,10,0,12,.1],[3,100,0,24,0]] }
  let run = { ...createRun(bridge), mode:'running', z:10, speed:12 }
  run = stepRun(run, idle, .1, bridge)
  assert.equal(run.mode, 'failure')
  assert.equal(run.failReason, 'LAVA')
})

test('a hazard at the finish takes precedence over success', () => {
  const finishFire = { timeLimit:45, length:1, obstacles:[[0,1,0,24,3],[3,1,0,24,0]] }
  let run = { ...createRun(finishFire), mode:'running', speed:30 }
  run = stepRun(run, idle, .1, finishFire)
  assert.equal(run.mode, 'failure')
  assert.equal(run.failReason, 'FIRE')
})
