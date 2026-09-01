import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RUNNER_WIDTH,
  RUNNER_HEIGHT,
  RUNNER_FRAMES,
  runnerFrameIndex,
  runnerScale,
  drawPixelRunner
} from '../src/art.mjs'

const WHITE = 7
const COBALT = 5
const NAVY = 6
const RAINBOW = [2, 3, 4, 8, 5, 9]

test('runner frames are valid authored rectangles with substantial coverage', () => {
  assert.equal(RUNNER_WIDTH, 32)
  assert.equal(RUNNER_HEIGHT, 48)
  assert.equal(RUNNER_FRAMES.length, 5)

  for (const frame of RUNNER_FRAMES) {
    const covered = new Set()
    for (const run of frame) {
      assert.equal(run.length, 5)
      assert.ok(run.every(Number.isInteger))
      const [, x, y, width, height] = run
      assert.ok(width > 0 && height > 0)
      assert.ok(x >= 0 && y >= 0)
      assert.ok(x + width <= RUNNER_WIDTH)
      assert.ok(y + height <= RUNNER_HEIGHT)
      for (let yy = y; yy < y + height; yy++) {
        for (let xx = x; xx < x + width; xx++) covered.add(`${xx},${yy}`)
      }
    }
    assert.ok(covered.size >= 260)
  }
})

test('all five frames have distinct authored signatures', () => {
  assert.equal(new Set(RUNNER_FRAMES.map(JSON.stringify)).size, 5)
})

test('every frame preserves the white, blue, navy, and six-hue identity', () => {
  for (const frame of RUNNER_FRAMES) {
    const colors = new Set(frame.map(run => run[0]))
    assert.ok(colors.has(WHITE))
    assert.ok(colors.has(COBALT))
    assert.ok(colors.has(NAVY))
    for (const color of RAINBOW) assert.ok(colors.has(color))
  }
})

test('grounded animation cycles four poses and airborne animation uses the tuck', () => {
  const grounded = new Set()
  for (let anim = 0; anim < 8; anim += .25) {
    grounded.add(runnerFrameIndex({ grounded:true, anim }))
  }
  assert.deepEqual([...grounded].sort(), [0, 1, 2, 3])
  for (const anim of [0, 1, 99]) {
    assert.equal(runnerFrameIndex({ grounded:false, anim }), 4)
  }
})

test('runner scale is integral, bounded, and 144 pixels tall at target heights', () => {
  assert.equal(runnerScale(720), 3)
  assert.equal(runnerScale(844), 3)
  for (const height of [480, 600, 720, 844, 1080, 1440]) {
    const scale = runnerScale(height)
    assert.ok(Number.isInteger(scale))
    assert.ok(scale >= 2 && scale <= 5)
    assert.ok(scale * RUNNER_HEIGHT <= height * .22)
  }
})

test('pixel runner disables smoothing and renders the selected frame with fillRect', () => {
  const calls = []
  const ctx = {
    imageSmoothingEnabled:true,
    fillStyle:'',
    fillRect(...rect) { calls.push([this.fillStyle, ...rect]) }
  }
  const run = { x:0, y:0, grounded:false, anim:0 }

  drawPixelRunner(ctx, run, 1280, 720)

  assert.equal(ctx.imageSmoothingEnabled, false)
  assert.equal(calls.length, RUNNER_FRAMES[4].length)
  assert.ok(calls.every(([, x, y, width, height]) => [x, y, width, height].every(Number.isInteger)))
  assert.ok(calls.every(([, , , width, height]) => width > 0 && height > 0))
})
