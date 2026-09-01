import test from 'node:test'
import assert from 'node:assert/strict'
import * as art from '../src/art.mjs'
import {
  RUNNER_WIDTH,
  RUNNER_HEIGHT,
  RUNNER_FRAMES,
  RUNNER_SHEET_SRC,
  RUNNER_SHEET_FRAMES,
  runnerFrameIndex,
  runnerDisplayHeight,
  runnerScale,
  createRunnerSheet,
  drawRunner,
  drawPixelRunner
} from '../src/art.mjs'

const WHITE = 7
const COBALT = 5
const NAVY = 6
const RAINBOW = [2, 3, 4, 8, 5, 9]

test('runner palette is exactly the ten approved runtime colors', () => {
  assert.deepEqual(art.RUNNER_PALETTE, [
    '#31051b', '#790b24', '#d51d24', '#ff641e', '#ffd34d',
    '#0877d1', '#071f70', '#fff', '#36b44a', '#7042c1'
  ])
})

test('runner frames are valid authored rectangles with substantial coverage', () => {
  assert.equal(RUNNER_WIDTH, 48)
  assert.equal(RUNNER_HEIGHT, 72)
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
    assert.ok(covered.size >= 520)
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

test('approved sheet exposes five tight source crops in animation order', () => {
  assert.equal(RUNNER_SHEET_SRC, './assets/unicorn-runner-sprite-concept.png')
  assert.deepEqual(RUNNER_SHEET_FRAMES, [
    [21, 50, 323, 727],
    [399, 64, 360, 713],
    [841, 63, 322, 714],
    [1217, 81, 332, 696],
    [1581, 0, 391, 592]
  ])
  for (const [x, y, width, height] of RUNNER_SHEET_FRAMES) {
    assert.ok(x >= 0 && y >= 0)
    assert.ok(width > 0 && height > 0)
    assert.ok(x + width <= 1983)
    assert.ok(y + height <= 793)
  }
})

test('runner sheet loader requests only the local approved asset', () => {
  const image = { src:'', decoding:'' }
  const document = {
    createElement(tag) {
      assert.equal(tag, 'img')
      return image
    }
  }

  assert.equal(createRunnerSheet(document), image)

  assert.equal(image.decoding, 'async')
  assert.equal(image.src, RUNNER_SHEET_SRC)
})

test('ready sheet renders the selected crop near 180 pixels tall', () => {
  const drawCalls = []
  const fillCalls = []
  const ctx = {
    imageSmoothingEnabled:true,
    drawImage(...args) { drawCalls.push(args) },
    fillRect(...args) { fillCalls.push(args) }
  }
  const image = { complete:true, naturalWidth:1983 }

  drawRunner(ctx, { x:0, y:0, grounded:false, anim:0 }, 1280, 720, image)

  assert.equal(drawCalls.length, 1)
  assert.equal(fillCalls.length, 0)
  assert.equal(drawCalls[0][0], image)
  assert.deepEqual(drawCalls[0].slice(1, 5), RUNNER_SHEET_FRAMES[4])
  assert.equal(drawCalls[0][8], 180)
})

test('loading or failed sheet uses the code-native fallback', () => {
  const drawCalls = []
  const fillCalls = []
  const ctx = {
    imageSmoothingEnabled:true,
    fillStyle:'',
    drawImage(...args) { drawCalls.push(args) },
    fillRect(...args) { fillCalls.push(args) }
  }

  drawRunner(ctx, { x:0, y:0, grounded:true, anim:0 }, 1280, 720, {
    complete:false,
    naturalWidth:0
  })

  assert.equal(drawCalls.length, 0)
  assert.equal(fillCalls.length, RUNNER_FRAMES[0].length)
})

test('sheet display height stays within the approved gameplay range', () => {
  assert.equal(runnerDisplayHeight(720), 180)
  assert.equal(runnerDisplayHeight(844), 190)
  for (const height of [480, 720, 844, 1080]) {
    assert.ok(runnerDisplayHeight(height) >= 180)
    assert.ok(runnerDisplayHeight(height) <= 190)
  }
})

test('runner scale is integral, bounded, and 144 pixels tall at target heights', () => {
  assert.equal(runnerScale(720), 2)
  assert.equal(runnerScale(844), 2)
  for (const height of [720, 844, 1080, 1440]) {
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
