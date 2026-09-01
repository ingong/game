import test from 'node:test'
import assert from 'node:assert/strict'
import { RED_STAGE, validateStage, surfaceAt, hazardAt, bridgeIndexAt } from '../src/stage.mjs'

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

test('flame hazards use each tuple height as their upper boundary', () => {
  const stage = { timeLimit:45, length:100, obstacles:[[0,20,0,24,3],[0,40,0,24,5],[3,100,0,24,0]] }
  assert.equal(hazardAt(stage, { x:0, y:2.99, z:20 }), 'FIRE')
  assert.equal(hazardAt(stage, { x:0, y:3, z:20 }), null)
  assert.equal(hazardAt(stage, { x:0, y:4.99, z:40 }), 'FIRE')
  assert.equal(hazardAt(stage, { x:0, y:5, z:40 }), null)
})

test('stage validation rejects non-enum obstacle types', () => {
  for (const type of [1.5, NaN, 'flame']) {
    const stage = { timeLimit:45, length:100, obstacles:[[type,20,0,24,0],[3,100,0,24,0]] }
    assert.ok(validateStage(stage).includes('unknown obstacle type'))
  }
})

test('gaps and collapsed bridges do not support the runner', () => {
  const gap = { timeLimit:45, length:100, obstacles:[[1,20,0,24,10],[3,100,0,24,0]] }
  const bridge = { timeLimit:45, length:100, obstacles:[[2,20,0,12,.5],[3,100,0,24,0]] }
  assert.equal(surfaceAt(gap, 0, 25), null)
  assert.equal(surfaceAt(gap, 0, 31), 0)
  assert.equal(surfaceAt(bridge, 0, 20, { index:0, timer:.49 }), 0)
  assert.equal(surfaceAt(bridge, 0, 20, { index:0, timer:.5 }), null)
})

test('unsupported grounded contact reports lava', () => {
  const stage = { timeLimit:45, length:100, obstacles:[[1,20,0,24,10],[3,100,0,24,0]] }
  assert.equal(hazardAt(stage, { x:0, y:0, z:25 }), 'LAVA')
})

test('the final bridge tile has its own contact range', () => {
  const finalBridge = RED_STAGE.obstacles.findLastIndex(obstacle => obstacle[0] === 2)
  assert.equal(bridgeIndexAt(RED_STAGE, 0, 850), finalBridge)
})
