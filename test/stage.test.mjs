import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RED_STAGE, FIRE, GAP, BRIDGE, FINISH, HURDLE, PISTON,
  validateStage, sectionAt, roadAt, obstacleBounds, surfaceAt,
  contactAt, hazardAt, bridgeIndexAt
} from '../src/stage.mjs'

test('red stage contains five contiguous sets and a finish at 1000', () => {
  assert.deepEqual(validateStage(RED_STAGE), [])
  assert.equal(RED_STAGE.sections.length, 5)
  assert.deepEqual(RED_STAGE.sections.map(s => [s[0], s[1]]),
    [[0, 160], [160, 360], [360, 600], [600, 800], [800, 1000]])
  assert.equal(RED_STAGE.length, 1000)
  assert.deepEqual(RED_STAGE.obstacles.at(-1).slice(0, 2), [FINISH, 1000])
})

test('road elevation interpolates and section width changes', () => {
  const canalStart = roadAt(RED_STAGE, 360)
  const canalEnd = roadAt(RED_STAGE, 599)
  assert.ok(canalEnd.elevation > canalStart.elevation)
  assert.notEqual(roadAt(RED_STAGE, 100).width, roadAt(RED_STAGE, 900).width)
})

test('flames and pistons expose deterministic active cycles', () => {
  const flame = RED_STAGE.obstacles.find(o => o[0] === FIRE)
  const piston = RED_STAGE.obstacles.find(o => o[0] === PISTON)
  assert.notEqual(obstacleBounds(flame, 0).active, obstacleBounds(flame, 1.2).active)
  assert.notEqual(obstacleBounds(piston, 0).x, obstacleBounds(piston, .7).x)
})

test('sectionAt selects the final section at the course endpoint', () => {
  assert.equal(sectionAt(RED_STAGE, 800), RED_STAGE.sections[4])
  assert.equal(sectionAt(RED_STAGE, 1000), RED_STAGE.sections[4])
  assert.equal(sectionAt(RED_STAGE, 1000.01), null)
})

test('surface uses road elevation except for gaps and expired bridge plates', () => {
  const gap = RED_STAGE.obstacles.find(o => o[0] === GAP)
  const bridgeIndex = RED_STAGE.obstacles.findIndex(o => o[0] === BRIDGE)
  const bridge = RED_STAGE.obstacles[bridgeIndex]
  assert.equal(surfaceAt(RED_STAGE, gap[2], gap[1]), null)
  assert.equal(surfaceAt(RED_STAGE, bridge[2], bridge[1], { index:bridgeIndex, timer:bridge[6] }),
    roadAt(RED_STAGE, bridge[1]).elevation)
  assert.equal(surfaceAt(RED_STAGE, bridge[2], bridge[1], { index:bridgeIndex, timer:bridge[6] + .001 }), null)
})

test('contact reports stumbles, lava, bridges, and the finish', () => {
  const hurdleIndex = RED_STAGE.obstacles.findIndex(o => o[0] === HURDLE)
  const hurdle = RED_STAGE.obstacles[hurdleIndex]
  const gapIndex = RED_STAGE.obstacles.findIndex(o => o[0] === GAP)
  const gap = RED_STAGE.obstacles[gapIndex]
  const bridgeIndex = RED_STAGE.obstacles.findIndex(o => o[0] === BRIDGE)
  const bridge = RED_STAGE.obstacles[bridgeIndex]
  assert.deepEqual(contactAt(RED_STAGE, { x:hurdle[2], y:0, z:hurdle[1], time:0 }),
    { kind:'stumble', index:hurdleIndex })
  assert.equal(contactAt(RED_STAGE, { x:hurdle[2], y:hurdle[5], z:hurdle[1], time:0 }), null)
  assert.deepEqual(contactAt(RED_STAGE, { x:gap[2], y:0, z:gap[1], time:0 }), { kind:'lava', index:gapIndex })
  assert.deepEqual(contactAt(RED_STAGE, { x:bridge[2], y:0, z:bridge[1], time:0 }),
    { kind:'bridge', index:bridgeIndex })
  assert.deepEqual(contactAt(RED_STAGE, { x:0, y:0, z:RED_STAGE.length, time:0 }),
    { kind:'finish', index:RED_STAGE.obstacles.length - 1 })
})

test('compatibility wrappers delegate dynamic fire and bridge queries', () => {
  const fire = RED_STAGE.obstacles.find(o => o[0] === FIRE)
  const bridgeIndex = RED_STAGE.obstacles.findIndex(o => o[0] === BRIDGE)
  const bridge = RED_STAGE.obstacles[bridgeIndex]
  assert.equal(hazardAt(RED_STAGE, { x:fire[2], y:0, z:fire[1], time:.9 }), 'FIRE')
  assert.equal(bridgeIndexAt(RED_STAGE, bridge[2], bridge[1]), bridgeIndex)
})

test('stage validation reports malformed section and obstacle tuples', () => {
  const valid = {
    timeLimit:45,
    length:100,
    sections:[[0, 100, 20, 0, 0, 0, 1]],
    obstacles:[[FINISH, 100, 0, 20, 4, 1, 0, 0]]
  }
  const cases = [
    [{ ...valid, sections:[[0, 40, 20, 0, 0, 0, 1], [50, 100, 20, 0, 0, 0, 2]] }, 'sections are not contiguous'],
    [{ ...valid, sections:[[0, 100, 20, 0, 0, 0]] }, 'invalid section tuple'],
    [{ ...valid, obstacles:[[HURDLE, 20, 0, 12, 3, 4, 0], valid.obstacles[0]] }, 'invalid obstacle tuple'],
    [{ ...valid, obstacles:[[HURDLE, 60, 0, 12, 3, 4, 0, 0], [HURDLE, 20, 0, 12, 3, 4, 0, 0], valid.obstacles[0]] }, 'obstacle positions are not sorted'],
    [{ ...valid, obstacles:[[HURDLE, 2, 0, 12, 8, 4, 0, 0], valid.obstacles[0]] }, 'obstacle footprint is outside the course'],
    [{ ...valid, obstacles:[[HURDLE, 20, 0, 12, 3, 4, 0, 0]] }, 'missing final finish'],
    [{ ...valid, obstacles:[[FINISH, 99, 0, 20, 4, 1, 0, 0]] }, 'finish gate does not match stage length']
  ]
  for (const [stage, error] of cases) assert.ok(validateStage(stage).includes(error))
})
