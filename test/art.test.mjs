import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as art from '../src/art.mjs'

const POSES = [
  [0,2,-2,-2,2,2,-2,-2,1,0],
  [-1,1,-1,-1,1,1,-1,-1,2,-1],
  [-1,0,2,0,-2,0,2,0,-2,0],
  [0,3,-2,-3,2,2,1,-2,-2,1],
  [1,2,-1,-2,1,1,-2,-1,1,0],
  [1,1,1,-1,-1,0,-1,0,1,-1],
  [-1,4,-3,-3,2,1,3,-1,-3,-2],
  [0,5,-2,-5,2,4,-3,-4,3,-4],
  [3,5,-3,-1,-2,3,-2,-1,3,2],
  [0,2,-2,-2,2,4,-4,-4,4,4]
]

const rainbow = ['#f04432','#ff7a1a','#ffd43b','#4ecb55','#24b8ea','#7b42d6']

function recordingContext() {
  const calls = []
  return {
    calls,
    imageSmoothingEnabled:true,
    fillStyle:'',
    save() { calls.push(['save']) },
    restore() { calls.push(['restore']) },
    translate(x, y) { calls.push(['translate', x, y]) },
    rotate(angle) { calls.push(['rotate', angle]) },
    scale(x, y) { calls.push(['scale', x, y]) },
    fillRect(x, y, width, height) {
      calls.push(['fillRect', this.fillStyle, x, y, width, height])
    }
  }
}

test('runner uses the approved athletic action pose table', () => {
  assert.deepEqual(art.RUNNER_POSES, POSES)
})

test('runner exposes six run phases and distinct airborne feedback', () => {
  const phases = new Set(Array.from({ length:6 }, (_, i) =>
    art.runnerPose({ anim:i / 6, grounded:true, jumps:0, stumble:0, landing:0 })
  ))
  assert.equal(phases.size, 6)
  assert.notEqual(
    art.runnerPose({ anim:0, grounded:false, jumps:1, stumble:0, landing:0 }),
    art.runnerPose({ anim:0, grounded:false, jumps:2, stumble:0, landing:0 })
  )
})

test('stumble and landing feedback take priority over locomotion poses', () => {
  assert.equal(art.runnerPose({ anim:0, grounded:false, jumps:2, stumble:.1, landing:1 }), 8)
  assert.equal(art.runnerPose({ anim:0, grounded:true, jumps:0, stumble:0, landing:.46 }), 9)
  assert.equal(art.runnerPose({ anim:0, grounded:false, jumps:2, stumble:0, landing:0 }), 7)
  assert.equal(art.runnerPose({ anim:0, grounded:false, jumps:1, stumble:0, landing:0 }), 6)
})

test('runner scale responds to the smaller screen dimension and stays bounded', () => {
  assert.equal(art.runnerScale(1280, 720), 1)
  assert.equal(art.runnerScale(375, 667), .8)
  assert.equal(art.runnerScale(2560, 1440), 1.25)
})

test('runner paints a broad white back, blue gear, and complete rainbow identity', () => {
  const ctx = recordingContext()
  art.drawRunner(ctx, { anim:0, grounded:true, jumps:0, stumble:0, landing:0 }, 100.4, 200.6, 3)

  assert.equal(ctx.imageSmoothingEnabled, false)
  assert.deepEqual(ctx.calls[1], ['translate', 100, 201])
  assert.ok(ctx.calls.filter(call => call[0] === 'translate').every(([, x, y]) => Number.isInteger(x) && Number.isInteger(y)))

  const rects = ctx.calls.filter(call => call[0] === 'fillRect')
  const colors = new Set(rects.map(call => call[1]))
  for (const color of art.RUNNER_PALETTE) assert.ok(colors.has(color), `missing ${color}`)
  for (const color of rainbow) {
    assert.ok(colors.has(color), `missing rainbow color ${color}`)
  }
  assert.ok(rects.some(call => call[1] === '#fff4dd' && call[4] >= 24), 'broad back plane is missing')
  assert.ok(rects.filter(call => call[1] === '#0e58d6' || call[1] === '#07348f').length >= 8,
    'blue shorts and boots are not visually established')
})

test('runner joins a large head and neck to outside arms and separated legs', () => {
  const ctx = recordingContext()
  art.drawRunner(ctx, { anim:0, grounded:true, jumps:0, stumble:0, landing:0 }, 0, 0, 1)
  const translations = ctx.calls.filter(call => call[0] === 'translate')
  for (const anchor of [[17,-10],[-17,-10],[6,13],[-6,13],[0,-18],[0,-28]]) {
    assert.ok(translations.some(call => call[1] === anchor[0] && call[2] === anchor[1]),
      `missing anchor ${anchor}`)
  }

  const piece = (x, y) => {
    const start = ctx.calls.findIndex(call => call[0] === 'translate' && call[1] === x && call[2] === y)
    const end = ctx.calls.findIndex((call, index) => index > start && call[0] === 'restore')
    return ctx.calls.slice(start, end)
  }
  assert.ok(piece(0,-18).some(call => call[0] === 'fillRect' && call[4] >= 12), 'neck is too narrow')
  assert.ok(piece(0,-28).some(call => call[0] === 'fillRect' && call[4] >= 16), 'head is too small')
  assert.ok(piece(0,-28).some(call => call[0] === 'fillRect' && call[2] >= 8 && call[4] >= 4),
    'three-quarter muzzle is missing')
})

test('mane and tail each carry a complete readable rainbow', () => {
  const ctx = recordingContext()
  art.drawRunner(ctx, { anim:0, grounded:true, jumps:0, stumble:0, landing:0 }, 0, 0, 1)
  const rectsAt = (x, y) => {
    const start = ctx.calls.findIndex(call => call[0] === 'translate' && call[1] === x && call[2] === y)
    const end = ctx.calls.findIndex((call, index) => index > start && call[0] === 'restore')
    return ctx.calls.slice(start,end).filter(call => call[0] === 'fillRect')
  }

  const mane = rectsAt(-1,-39)
  const tail = rectsAt(-5,8)
  for (const colors of [new Set(mane.map(call => call[1])), new Set(tail.map(call => call[1]))]) {
    for (const color of rainbow) assert.ok(colors.has(color), `missing ${color}`)
  }
  assert.ok(mane.filter(call => rainbow.includes(call[1])).every(call => call[2] <= -10),
    'mane bands do not clear the head silhouette')
  assert.ok(tail.some(call => call[1] === '#f04432' && call[4] >= 12),
    'red tail band is hidden at the hip')
})

test('run, first jump, double jump, stumble, and landing draw distinct silhouettes', () => {
  const states = [
    { anim:0, grounded:true, jumps:0, stumble:0, landing:0 },
    { anim:0, grounded:false, jumps:1, stumble:0, landing:0 },
    { anim:0, grounded:false, jumps:2, stumble:0, landing:0 },
    { anim:0, grounded:true, jumps:0, stumble:.2, landing:0 },
    { anim:0, grounded:true, jumps:0, stumble:0, landing:1 }
  ]
  const signatures = states.map(run => {
    const ctx = recordingContext()
    art.drawRunner(ctx, run, 0, 0, 1)
    return JSON.stringify(ctx.calls.filter(call => call[0] === 'rotate' || call[0] === 'scale'))
  })

  assert.equal(new Set(signatures).size, states.length)
})

test('double jump mirrors its knees and streams the tail upward', () => {
  const ctx = recordingContext()
  art.drawRunner(ctx, { anim:0, grounded:false, jumps:2, stumble:0, landing:0 }, 0, 0, 1)
  const rotations = ctx.calls.filter(call => call[0] === 'rotate').map(call => call[1])

  assert.ok(rotations[6] < -.2, `tail angle ${rotations[6]}`)
})

test('runtime art has no external sprite source or projection dependency', async () => {
  const source = await readFile(new URL('../src/art.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /RUNNER_SHEET_SRC|new Image|drawImage|projectPoint/)
})
