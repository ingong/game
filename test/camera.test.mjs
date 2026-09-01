import test from 'node:test'
import assert from 'node:assert/strict'
import { createCamera, stepCamera } from '../src/camera.mjs'

const run = { x:0, y:0, z:100, speed:20, landingId:0, stumbleId:0, stumble:0 }

test('camera converges behind the runner without snapping laterally', () => {
  let camera = createCamera(run)
  const moved = { ...run, x:20, z:140, speed:34 }
  camera = stepCamera(camera, moved, 1 / 120)
  assert.ok(camera.x > 0 && camera.x < moved.x * .55)
  for (let i = 0; i < 600; i++) camera = stepCamera(camera, moved, 1 / 120)
  assert.ok(Math.abs(camera.x - moved.x * .55) < .05)
  assert.ok(camera.z < moved.z)
})

test('speed increases look-ahead by moving the camera farther back', () => {
  const slow = createCamera({ ...run, speed:0 })
  const fast = createCamera({ ...run, speed:34 })
  assert.ok(fast.z < slow.z)
  assert.ok(fast.horizon < slow.horizon)
})

test('landing and stumble impulses decay deterministically', () => {
  let camera = createCamera(run)
  camera = stepCamera(camera, { ...run, landingId:1 }, 1 / 120)
  const landing = Math.abs(camera.shakeY)
  camera = stepCamera(camera, { ...run, landingId:1 }, .5)
  assert.ok(Math.abs(camera.shakeY) < landing)
  camera = stepCamera(camera, { ...run, landingId:1, stumbleId:1 }, 1 / 120)
  assert.notEqual(camera.shakeX, 0)
})
