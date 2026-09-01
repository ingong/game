import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as art from '../src/art.mjs'

const POSES = [
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

test('runner uses the exact articulated pose table', () => {
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

test('articulated runner draws required identity colors at a quantized screen anchor', () => {
  const ctx = recordingContext()
  art.drawRunner(ctx, { anim:0, grounded:true, jumps:0, stumble:0, landing:0 }, 100.4, 200.6, 3)

  assert.equal(ctx.imageSmoothingEnabled, false)
  assert.deepEqual(ctx.calls[1], ['translate', 100, 201])
  assert.ok(ctx.calls.filter(call => call[0] === 'translate').every(([, x, y]) => Number.isInteger(x) && Number.isInteger(y)))

  const colors = new Set(ctx.calls.filter(call => call[0] === 'fillRect').map(call => call[1]))
  for (const color of art.RUNNER_PALETTE) assert.ok(colors.has(color), `missing ${color}`)
  assert.ok(ctx.calls.filter(call => call[0] === 'fillRect' && call[1] === '#fff7e8' && call[4] === 1 && call[5] === 1).length >= 2)
})

test('runtime art has no external sprite source or projection dependency', async () => {
  const source = await readFile(new URL('../src/art.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /RUNNER_SHEET_SRC|new Image|drawImage|projectPoint/)
})
