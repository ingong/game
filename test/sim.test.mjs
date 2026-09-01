import test from 'node:test'
import assert from 'node:assert/strict'
import { createRun, restartRun, stepRun } from '../src/sim.mjs'

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

test('countdown reaches running after three simulated seconds', () => {
  let run = restartRun(stage)
  assert.equal(run.countdown, 3)
  for (let i = 0; i < 360; i++) run = stepRun(run, idle, 1 / 120, stage)
  assert.equal(run.mode, 'running')
  assert.equal(run.countdown, 0)
  assert.equal(run.time, 0)
  assert.equal(run.z, 0)
})

test('stepping preserves collapse state and does not mutate the input run', () => {
  const collapse = { index: 7, timer: 1.25 }
  const run = { ...createRun(stage), mode:'running', collapse }
  const next = stepRun(run, idle, .1, stage)
  assert.deepEqual(next.collapse, collapse)
  assert.notStrictEqual(next, run)
  assert.equal(run.time, 0)
  assert.equal(run.z, 0)
})
