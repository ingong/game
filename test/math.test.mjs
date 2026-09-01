import test from 'node:test'
import assert from 'node:assert/strict'
import { clamp, logicalViewport, projectPoint } from '../src/math.mjs'

test('clamp limits a scalar', () => {
  assert.equal(clamp(-2, 0, 1), 0)
  assert.equal(clamp(.4, 0, 1), .4)
  assert.equal(clamp(3, 0, 1), 1)
})

test('world projection moves the runner while the camera follows late', () => {
  const camera = { x:0, y:8, z:80, horizon:.28, focal:.9, shakeX:0, shakeY:0 }
  const center = projectPoint(camera, 0, 0, 100, 320, 180)
  const right = projectPoint(camera, 8, 0, 100, 320, 180)
  const high = projectPoint(camera, 0, 6, 100, 320, 180)
  assert.ok(right.x > center.x)
  assert.ok(high.y < center.y)
  assert.equal(center.depth, 20)
})

test('logical viewport chooses stable integer pixel scaling', () => {
  assert.deepEqual(logicalViewport(1280, 720), { width:640, height:360, pixelScale:2 })
  assert.deepEqual(logicalViewport(390, 844), { width:195, height:422, pixelScale:2 })
})
