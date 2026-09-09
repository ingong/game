import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { assertStandaloneHtml, build as buildSubmission } from '../tools/build.mjs'
import { createRun, stepRun } from '../src/sim.mjs'
import { BRIDGE, FIRE, GAP, HURDLE, PISTON, RED_STAGE, STAGES, obstacleBounds, roadAt } from '../src/stage.mjs'

const STEP = 1 / 120
const SOLIDS = new Set([FIRE, HURDLE, PISTON])

function cleanPlaythrough(stage=RED_STAGE,options={}) {
  let run = { ...createRun(stage), mode:'running' }
  const jumped = new Set()
  const doubled = new Set()
  const avoidance = new Map()
  const hits = []
  let brakingFrames=0,jumps=0

  for (let step = 0; step < stage.timeLimit / STEP && run.mode === 'running'; step++) {
    const input = { left:false, right:false, up:true, down:false, jumpPressed:false }
    const road = roadAt(stage, run.z)
    const solidIndex = stage.obstacles.findIndex(obstacle =>
      SOLIDS.has(obstacle[0]) && obstacle[1] >= run.z - 2 && obstacle[1] - run.z < 45)
    const solid = stage.obstacles[solidIndex]

    let targetX = 0
    if (solid) {
      if (!avoidance.has(solidIndex)) {
        const eta = Math.max(0, solid[1] - run.z) / Math.max(run.speed, 12)
        const predicted = obstacleBounds(solid, run.time + eta,stage)
        const halfWidth = (roadAt(stage, predicted.z)?.width ?? road?.width ?? 22) / 2
        const target = solid[0] === HURDLE && solid[2] === 0
          ? (run.x >= 0 ? halfWidth - 1 : -halfWidth + 1)
          : (predicted.x >= 0 ? -halfWidth + 1 : halfWidth - 1)
        avoidance.set(solidIndex, target)
      }
      const bounds = obstacleBounds(solid, run.time,stage)
      const halfWidth = (roadAt(stage, bounds.z)?.width ?? road?.width ?? 22) / 2
      targetX = Math.max(-halfWidth + 1, Math.min(halfWidth - 1, avoidance.get(solidIndex)))
    }
    if (run.x < targetX - .5) input.right = true
    if (run.x > targetX + .5) input.left = true

    const unsupportedIndex = stage.obstacles.findIndex((obstacle, index) => {
      if (obstacle[0] !== GAP && obstacle[0] !== BRIDGE) return false
      const bounds = obstacleBounds(obstacle, run.time,stage)
      return bounds.z + bounds.depth / 2 >= run.z
    })
    if (unsupportedIndex >= 0) {
      const obstacle = stage.obstacles[unsupportedIndex]
      const bounds = obstacleBounds(obstacle, run.time,stage)
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

    if(solid?.[0]===FIRE && solid[3]>=(road?.width??62)) {
      // Forecast crossing using the actual acceleration and hazard clock. Only input changes are allowed.
      let z=run.z,speed=run.speed,time=run.time,safe=true
      for(let n=0;n<720&&z<=solid[1]+solid[4]/2;n++) {
        speed=Math.min(29.2,speed+18*STEP);z+=speed*STEP;time+=STEP
        if(Math.abs(z-solid[1])<=solid[4]/2&&obstacleBounds(solid,time,stage).active){safe=false;break}
      }
      if(!safe){input.up=false;input.down=true;brakingFrames++}
    }
    // A low hurdle can be jumped when a preceding moving hazard keeps us in its lane.
    if(solid?.[0]===HURDLE&&solid[5]<=3&&run.grounded&&solid[1]-run.z>0&&solid[1]-run.z<9&&Math.abs(run.x-solid[2])<solid[3]/2+2)input.jumpPressed=true
    if(options.steer===false){input.left=false;input.right=false}
    if(options.jump===false)input.jumpPressed=false
    if(input.jumpPressed)jumps++
    const next = stepRun(run, input, STEP, stage)
    if (next.stumbleId > run.stumbleId) hits.push(next.hitIndex)
    run = next
  }
  return { run, hits, brakingFrames, jumps }
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

test('intro course completes cleanly within its shorter deadline', t => {
  const { run, hits } = cleanPlaythrough()
  assert.equal(run.mode, 'success', `clean route failed with ${run.failReason || 'no result'} at z=${run.z.toFixed(2)}`)
  assert.deepEqual(hits, [], `clean route hit obstacle indexes ${hits.join(', ')}`)
  assert.ok(run.time >= 20 && run.time < RED_STAGE.timeLimit, `clean completion took ${run.time.toFixed(3)}s`)
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
  assert.doesNotMatch(html, /tools\/|\/api\/|map-editor|PISKEL SOURCE/)
})

test('all seven distinct courses are valid and cleanly completable within their deadline', t => {
  assert.equal(STAGES.length,7)
  for(const stage of STAGES) {
    const {run,hits}=cleanPlaythrough(stage)
    assert.equal(run.mode,'success',`${stage.name} failed at ${run.z}: ${run.failReason}`)
    assert.deepEqual(hits,[],`${stage.name} had unexpected collisions`)
    assert.ok(run.time<stage.timeLimit)
    t.diagnostic(`${stage.name}: ${run.time.toFixed(3)}s`)
  }
})

test('specialist courses require timing, jumping and spring launches',()=>{
  const storm=cleanPlaythrough(STAGES[2])
  assert.ok(storm.brakingFrames>0,'storm course must require a timing adjustment')
  assert.equal(storm.run.mode,'success')
  assert.ok(cleanPlaythrough(STAGES[3]).jumps>=5)
  assert.equal(cleanPlaythrough(STAGES[5]).run.springId,6)
})


test('stage one already requires jumping, steering and a timing adjustment',()=>{
  const clean=cleanPlaythrough(RED_STAGE)
  assert.equal(clean.run.mode,'success')
  assert.deepEqual(clean.hits,[])
  assert.ok(clean.jumps>=4)
  assert.ok(clean.brakingFrames>0)
  const straight=cleanPlaythrough(RED_STAGE,{steer:false})
  assert.ok(straight.hits.length>0||straight.run.mode==='failure','running only down the center must not clear cleanly')
  const grounded=cleanPlaythrough(RED_STAGE,{jump:false})
  assert.equal(grounded.run.mode,'failure')
  assert.equal(grounded.run.failReason,'LAVA')
})
