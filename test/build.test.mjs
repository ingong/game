import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { assertStandaloneHtml, build as buildSubmission } from '../tools/build.mjs'
import { createRun, stepRun } from '../src/sim.mjs'
import { BRIDGE, FIRE, GAP, HURDLE, PISTON, RED_STAGE, obstacleBounds, roadAt } from '../src/stage.mjs'

const STEP = 1 / 120
const SOLIDS = new Set([FIRE, HURDLE, PISTON])

function cleanPlaythrough() {
  let run = { ...createRun(RED_STAGE), mode:'running' }
  const jumped = new Set()
  const doubled = new Set()
  const avoidance = new Map()
  const hits = []

  for (let step = 0; step < RED_STAGE.timeLimit / STEP && run.mode === 'running'; step++) {
    const input = { left:false, right:false, up:true, down:false, jumpPressed:false }
    const road = roadAt(RED_STAGE, run.z)
    const solidIndex = RED_STAGE.obstacles.findIndex(obstacle =>
      SOLIDS.has(obstacle[0]) && obstacle[1] >= run.z - 2 && obstacle[1] - run.z < 45)
    const solid = RED_STAGE.obstacles[solidIndex]

    let targetX = 0
    if (solid) {
      if (!avoidance.has(solidIndex)) {
        const eta = Math.max(0, solid[1] - run.z) / Math.max(run.speed, 12)
        const predicted = obstacleBounds(solid, run.time + eta)
        const halfWidth = (roadAt(RED_STAGE, predicted.z)?.width ?? road?.width ?? 22) / 2
        const target = solid[0] === HURDLE && solid[2] === 0
          ? (run.x >= 0 ? halfWidth - 1 : -halfWidth + 1)
          : (predicted.x >= 0 ? -halfWidth + 1 : halfWidth - 1)
        avoidance.set(solidIndex, target)
      }
      const bounds = obstacleBounds(solid, run.time)
      const halfWidth = (roadAt(RED_STAGE, bounds.z)?.width ?? road?.width ?? 22) / 2
      targetX = Math.max(-halfWidth + 1, Math.min(halfWidth - 1, avoidance.get(solidIndex)))
    }
    if (run.x < targetX - .5) input.right = true
    if (run.x > targetX + .5) input.left = true

    const unsupportedIndex = RED_STAGE.obstacles.findIndex((obstacle, index) => {
      if (obstacle[0] !== GAP && obstacle[0] !== BRIDGE) return false
      const bounds = obstacleBounds(obstacle, run.time)
      return bounds.z + bounds.depth / 2 >= run.z
    })
    if (unsupportedIndex >= 0) {
      const obstacle = RED_STAGE.obstacles[unsupportedIndex]
      const bounds = obstacleBounds(obstacle, run.time)
      const start = bounds.z - bounds.depth / 2
      if (run.grounded && start - run.z <= 6 && !jumped.has(unsupportedIndex)) {
        input.jumpPressed = true
        jumped.add(unsupportedIndex)
      } else if (obstacle[0] === GAP && run.jumps === 1 && run.vy <= 0 &&
        jumped.has(unsupportedIndex) && !doubled.has(unsupportedIndex)) {
        input.jumpPressed = true
        doubled.add(unsupportedIndex)
      }
    }

    const next = stepRun(run, input, STEP, RED_STAGE)
    if (next.stumbleId > run.stumbleId) hits.push(next.hitIndex)
    run = next
  }
  return { run, hits }
}

function build() {
  return execFileSync(process.execPath, ['tools/build.mjs'], { encoding:'utf8' })
}

test('build guard rejects network resources', () => {
  assert.doesNotThrow(() => assertStandaloneHtml('<script>game()</script>'))
  for (const forbidden of ['assets/', 'itch', 'unicorn-runner-sprite-concept', 'http://', 'https://']) {
    assert.throws(() => assertStandaloneHtml(`<script>${forbidden}</script>`), new RegExp(forbidden.replaceAll('/', '\\/')))
  }
})

test('production simulation completes a clean run in the 35 to 40 second target', t => {
  const { run, hits } = cleanPlaythrough()
  assert.equal(run.mode, 'success', `clean route failed with ${run.failReason || 'no result'} at z=${run.z.toFixed(2)}`)
  assert.deepEqual(hits, [], `clean route hit obstacle indexes ${hits.join(', ')}`)
  assert.ok(run.time >= 35 && run.time <= 40, `clean completion took ${run.time.toFixed(3)}s`)
  t.diagnostic(`clean completion: ${run.time.toFixed(3)}s`)
})

test('build rejects an archive over its configured byte limit', async () => {
  await assert.rejects(() => buildSubmission({ maxZipBytes:1 }), /ZIP is \d+ bytes; limit is 1 bytes/)
})

test('build reports a standalone game without runtime assets', () => {
  assert.match(build(), /^Built dist\/index\.html\nZIP \d+\/13312 bytes\n$/)
})

test('submission archive contains only index.html', () => {
  build()
  const listing = execFileSync('unzip', ['-Z1', 'dist/game.zip'], { encoding:'utf8' }).trim().split('\n')
  assert.deepEqual(listing, ['index.html'])
})

test('submission stays within the 13 KiB competition limit and has no forbidden references', () => {
  build()
  assert.ok(statSync('dist/game.zip').size <= 13_312)
  const html = readFileSync('dist/index.html', 'utf8')
  assert.doesNotMatch(html, /assets\/|itch|unicorn-runner-sprite-concept|https?:\/\//)
})
