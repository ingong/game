import test from 'node:test'
import assert from 'node:assert/strict'
import { createCamera } from '../src/camera.mjs'
import * as renderer from '../src/render.mjs'
import { createRun } from '../src/sim.mjs'
import { BRIDGE, FINISH, FIRE, GAP, HURDLE, PISTON, RED_STAGE } from '../src/stage.mjs'

const { render } = renderer

function recordingContext() {
  const calls = []
  return {
    calls,
    fillStyle:'',
    font:'',
    textAlign:'',
    textBaseline:'',
    strokeStyle:'',
    lineWidth:1,
    globalAlpha:1,
    imageSmoothingEnabled:true,
    beginPath() { calls.push(['beginPath']) },
    moveTo(x, y) { calls.push(['moveTo', x, y]) },
    lineTo(x, y) { calls.push(['lineTo', x, y]) },
    closePath() { calls.push(['closePath']) },
    fill() { calls.push(['fill', this.fillStyle, this.globalAlpha]) },
    stroke() { calls.push(['stroke', this.strokeStyle, this.lineWidth, this.globalAlpha]) },
    arc(x, y, radius, start, end) { calls.push(['arc', x, y, radius, start, end]) },
    fillRect(x, y, width, height) { calls.push(['fillRect', this.fillStyle, x, y, width, height, this.globalAlpha]) },
    fillText(value, x, y) { calls.push(['fillText', value, x, y, this.font, this.textAlign]) },
    save() { calls.push(['save']) },
    restore() { calls.push(['restore']) },
    translate(x, y) { calls.push(['translate', x, y]) },
    rotate(angle) { calls.push(['rotate', angle]) },
    scale(x, y) { calls.push(['scale', x, y]) }
  }
}

const runnerScaleIndex = calls => calls.findIndex(call =>
  call[0] === 'scale' && call[1] === call[2] && call[1] >= .5 && call[1] <= 1.2)

const runnerAnchor = calls => {
  const scale = runnerScaleIndex(calls)
  for (let i = scale - 1; i >= 0; i--) if (calls[i][0] === 'translate') return i
  return -1
}

const renderAt = (z, overrides = {}, stage = RED_STAGE, width = 320, height = 180) => {
  const run = { ...createRun(stage), mode:'running', time:4, speed:28, z, ...overrides }
  const camera = { ...createCamera(run), z:z - 24 }
  const ctx = recordingContext()
  render(ctx, run, camera, stage, width, height)
  return ctx.calls
}

const drawCount = calls => calls.filter(call => call[0] === 'fill' || call[0] === 'fillRect').length
const polygonCount = calls => calls.filter(call => call[0] === 'fill').length
const operationCount = (calls, operation) => calls.filter(call => call[0] === operation).length
const obstacleDelta = (type, operation, overrides = {}) => {
  const obstacle = RED_STAGE.obstacles.find(item => item[0] === type)
  const z = obstacle[1] - 20
  const withObstacle = renderAt(z, overrides, { ...RED_STAGE, obstacles:[obstacle] })
  const withoutObstacle = renderAt(z, overrides, { ...RED_STAGE, obstacles:[] })
  return operationCount(withObstacle, operation) - operationCount(withoutObstacle, operation)
}
const obstacleColorDelta = (type, operation, color, overrides = {}) => {
  const obstacle = RED_STAGE.obstacles.find(item => item[0] === type)
  const z = obstacle[1] - 20
  const count = calls => calls.filter(call => call[0] === operation && call[1] === color).length
  return count(renderAt(z, overrides, { ...RED_STAGE, obstacles:[obstacle] })) -
    count(renderAt(z, overrides, { ...RED_STAGE, obstacles:[] }))
}

test('runner display scale keeps the course readable around the character', () => {
  assert.equal(renderer.RUNNER_WORLD_TO_ART, .095)
})

test('cleared overlapping solids draw before the airborne runner', () => {
  const fixtures = [
    [RED_STAGE.obstacles.find(obstacle => obstacle[0] === HURDLE), 0],
    [RED_STAGE.obstacles.find(obstacle => obstacle[0] === FIRE), 1.2],
    [RED_STAGE.obstacles.find(obstacle => obstacle[0] === PISTON), 0]
  ]

  for (const [obstacle, time] of fixtures) {
    const run = { ...createRun(RED_STAGE), x:obstacle[2], z:obstacle[1]+1, y:obstacle[5], time }
    const item = { obstacle, index:0, depth:23 }
    assert.equal(renderer.obstacleDrawsBeforeRunner?.(item, run, 24), true,
      `solid ${obstacle[0]} did not stay behind the cleared runner`)
  }
})

test('near overlapping solids draw after a grounded or low runner', () => {
  for (const type of [HURDLE, PISTON]) {
    const obstacle = RED_STAGE.obstacles.find(item => item[0] === type)
    const run = { ...createRun(RED_STAGE), x:obstacle[2], z:obstacle[1]+1, y:obstacle[5]-.1, time:0 }
    const item = { obstacle, index:0, depth:23 }
    assert.equal(renderer.obstacleDrawsBeforeRunner?.(item, run, 24), false,
      `low runner incorrectly cleared solid ${type}`)
  }
})

test('normal near-depth order resumes after leaving a solid footprint', () => {
  const obstacle = RED_STAGE.obstacles.find(item => item[0] === HURDLE)
  const run = {
    ...createRun(RED_STAGE),
    x:obstacle[2], z:obstacle[1]+obstacle[4]/2+.1, y:obstacle[5], time:0
  }
  const item = { obstacle, index:0, depth:22.4 }

  assert.equal(renderer.obstacleDrawsBeforeRunner?.(item, run, 24), false)
})

test('render draws road, projected runner, and HUD without DOM or images', () => {
  const run = { ...createRun(RED_STAGE), mode:'running', x:4, y:3, z:200 }
  const camera = createCamera({ ...run, x:0, y:0 })
  const ctx = recordingContext()

  render(ctx, run, camera, RED_STAGE, 320, 180)

  assert.ok(ctx.calls.some(call => call[0] === 'fill' && call[1] === '#790b24'))
  const anchor = runnerAnchor(ctx.calls)
  assert.ok(anchor >= 0)
  assert.ok(ctx.calls.slice(anchor + 1).some(call => call[0] === 'scale'))
  assert.ok(ctx.calls.some(call => call[0] === 'fillText' && call[1] === 'RED 1'))
})

test('runner root scale stays readable in the default logical chase view', () => {
  const run = { ...createRun(RED_STAGE), mode:'running', z:200 }
  const ctx = recordingContext()

  render(ctx, run, createCamera(run), RED_STAGE, 320, 180)

  const anchor = runnerAnchor(ctx.calls)
  const rootScale = ctx.calls.slice(anchor + 1).find(call => call[0] === 'scale')
  assert.ok(rootScale[1] >= .58 && rootScale[1] <= .68, `runner root scale ${rootScale[1]}`)
  assert.equal(rootScale[1], rootScale[2])
})

test('runner world anchor responds to steering and jumping against a fixed camera', () => {
  const base = { ...createRun(RED_STAGE), mode:'running', z:200 }
  const camera = createCamera(base)
  const anchors = [base, { ...base, x:6, y:5 }].map(run => {
    const ctx = recordingContext()
    render(ctx, run, camera, RED_STAGE, 320, 180)
    return ctx.calls[runnerAnchor(ctx.calls)].slice(1)
  })

  assert.ok(anchors[1][0] > anchors[0][0])
  assert.ok(anchors[1][1] < anchors[0][1])
})

test('obstacle art disappears after its world plane passes behind the camera', () => {
  const run = { ...createRun(RED_STAGE), mode:'running', z:200 }
  const camera = { ...createCamera(run), z:189 }
  const emptyStage = { ...RED_STAGE, obstacles:[] }
  const flameStage = { ...RED_STAGE, obstacles:[RED_STAGE.obstacles.find(obstacle => obstacle[0] === 0)] }
  const empty = recordingContext()
  const behind = recordingContext()

  render(empty, run, camera, emptyStage, 320, 180)
  render(behind, run, camera, flameStage, 320, 180)

  assert.deepEqual(behind.calls, empty.calls)
})

test('all six obstacle families add substantial visible geometry', () => {
  const minimumDraws = new Map([
    [FIRE, 7], [GAP, 4], [BRIDGE, 7], [FINISH, 8], [HURDLE, 7], [PISTON, 7]
  ])

  for (const [type, minimum] of minimumDraws) {
    const obstacle = RED_STAGE.obstacles.find(item => item[0] === type)
    const z = obstacle[1] - 20
    const withObstacle = renderAt(z, {}, { ...RED_STAGE, obstacles:[obstacle] })
    const withoutObstacle = renderAt(z, {}, { ...RED_STAGE, obstacles:[] })
    const delta = drawCount(withObstacle) - drawCount(withoutObstacle)
    assert.ok(delta >= minimum, `obstacle ${type} added ${delta} draw operations`)
  }
})

test('hurdle projects a top rail, striped face, and two planted feet', () => {
  assert.ok(obstacleDelta(HURDLE, 'fillRect') >= 7)
})

test('flame projects a slatted floor vent beneath its clean flame column', () => {
  assert.ok(obstacleDelta(FIRE, 'fillRect', { time:1.2 }) >= 7)
  assert.ok(obstacleColorDelta(FIRE, 'fill', '#d51d24', { time:1.2 }) >= 3,
    'active flame needs three readable outer lobes')
  assert.ok(obstacleColorDelta(FIRE, 'fill', '#ff641e', { time:1.2 }) >= 3,
    'active flame needs layered orange cores')
  assert.ok(obstacleDelta(FIRE, 'lineTo', { time:1.2 }) >= 90,
    'flame tongues need stepped shoulders instead of triangular cones')
  assert.ok(obstacleDelta(FIRE, 'stroke', { time:1.2 }) >= 2,
    'active flame needs separate rising embers')
})

test('gap projects cracked near and far road lips over animated lava', () => {
  assert.ok(obstacleDelta(GAP, 'stroke') >= 2)
})

test('piston projects a mechanical cylinder and bolted warning face', () => {
  assert.ok(obstacleDelta(PISTON, 'arc') >= 6)
})

test('bridge plate projects four bolts plus its crack and edge thickness', () => {
  assert.ok(obstacleDelta(BRIDGE, 'arc') >= 4)
  assert.ok(obstacleDelta(BRIDGE, 'stroke') >= 1)
})

test('finish projects a bright layered arch portal', () => {
  assert.ok(obstacleDelta(FINISH, 'arc') >= 3)
})

test('all five section centers render dense deterministic identities', () => {
  const centers = [80, 260, 480, 700, 900]
  const expectedMarkers = ['#b83a2d', '#65162a', '#ff8b20', '#2263a8', '#f7e7c6']

  for (let i = 0; i < centers.length; i++) {
    const first = renderAt(centers[i], {}, { ...RED_STAGE, obstacles:[] })
    const second = renderAt(centers[i], {}, { ...RED_STAGE, obstacles:[] })
    assert.deepEqual(first, second, `section ${i} rendering is not deterministic`)
    assert.ok(polygonCount(first) >= 12, `section ${i} has too few projected polygons`)
    assert.ok(drawCount(first) >= 20, `section ${i} has too few filled shapes`)
    assert.ok(first.some(call =>
      (call[0] === 'fill' || call[0] === 'fillRect') && call[1] === expectedMarkers[i]
    ), `section ${i} identity marker is missing`)
  }
})

test('section dressing combines curved machinery with structural linework', () => {
  for (const z of [80, 260, 480, 700, 900]) {
    const calls = renderAt(z, {}, { ...RED_STAGE, obstacles:[] })
    assert.ok(operationCount(calls, 'arc') >= 6, `section at ${z} lacks curved machinery`)
    assert.ok(operationCount(calls, 'stroke') >= 10, `section at ${z} lacks structural linework`)
  }
})

test('every section identity is mounted on the same steel and warning-light framework', () => {
  for (let theme=0; theme<5; theme++) {
    const stage = { ...RED_STAGE, sections:[[0,1000,30,0,0,theme,theme+11]], obstacles:[] }
    const calls = renderAt(100, {}, stage)
    assert.ok(calls.some(call => call[0] === 'stroke' && call[1] === '#9a8790'),
      `section ${theme} is missing its steel framework`)
    assert.ok(calls.some(call => call[0] === 'stroke' && call[1] === '#ffd34d'),
      `section ${theme} is missing its shared warning rail`)
  }
})

test('runner ground shadow shrinks and fades with jump altitude', () => {
  const stage = { ...RED_STAGE, obstacles:[] }
  const grounded = renderAt(200, { y:0, grounded:true }, stage)
  const jumping = renderAt(200, { y:10, grounded:false, jumps:1 }, stage)
  const groundRoot = runnerScaleIndex(grounded)
  const jumpRoot = runnerScaleIndex(jumping)
  const groundShadow = grounded.slice(0, groundRoot).findLast(call => call[0] === 'scale')
  const jumpShadow = jumping.slice(0, jumpRoot).findLast(call => call[0] === 'scale')
  const groundFill = grounded.slice(0, groundRoot).findLast(call => call[0] === 'fill')
  const jumpFill = jumping.slice(0, jumpRoot).findLast(call => call[0] === 'fill')

  assert.ok(groundShadow && jumpShadow, 'runner shadow transform is missing')
  assert.ok(groundShadow[1] >= 3 && groundShadow[1] <= 8,
    `ground shadow footprint scale ${groundShadow[1]}`)
  assert.ok(jumpShadow[1] < groundShadow[1], 'jump shadow did not shrink')
  assert.ok(jumpFill[2] < groundFill[2], 'jump shadow did not fade')
})

test('bridge collapse timer rotates the projected plate', () => {
  const bridge = RED_STAGE.obstacles.find(item => item[0] === BRIDGE)
  const stage = { ...RED_STAGE, obstacles:[bridge] }
  const z = bridge[1] - 20
  const stable = renderAt(z, { collapse:{ index:-1, timer:0 } }, stage)
  const falling = renderAt(z, { collapse:{ index:0, timer:bridge[6] * .75 } }, stage)
  const stableRotations = stable.slice(0, runnerScaleIndex(stable)).filter(call => call[0] === 'rotate')
  const fallingRotations = falling.slice(0, runnerScaleIndex(falling)).filter(call => call[0] === 'rotate')

  assert.notDeepEqual(fallingRotations, stableRotations)
  assert.ok(fallingRotations.some(call => Math.abs(call[1]) > .1))
  assert.ok(falling.some(call => (call[0] === 'fill' || call[0] === 'fillRect') && call[1] === '#9a8790'),
    'bridge plate steel plane is missing')
  const orangeFills = calls => calls.filter(call =>
    (call[0] === 'fill' || call[0] === 'fillRect') && call[1] === '#ff641e').length
  assert.ok(orangeFills(falling) > orangeFills(stable), 'collapse did not expose lava below the plate')
})

test('HUD and state text fit the 320x180 and 195x422 logical canvases', () => {
  const modes = [
    { mode:'title' },
    { mode:'countdown', countdown:3 },
    { mode:'success' },
    { mode:'failure', failReason:'TIME' }
  ]

  for (const [width, height] of [[320, 180], [195, 422]]) {
    for (const state of modes) {
      const calls = renderAt(80, state, { ...RED_STAGE, obstacles:[] }, width, height)
      for (const call of calls.filter(item => item[0] === 'fillText')) {
        const [, value, x, y, font, align] = call
        const size = Number.parseInt(font.match(/\d+px/)[0], 10)
        const textWidth = value.length * size * .6
        const left = align === 'left' ? x : align === 'right' ? x - textWidth : x - textWidth / 2
        const right = left + textWidth
        assert.ok(left >= 0 && right <= width, `${value} clips horizontally at ${width}x${height}`)
        assert.ok(y - size / 2 >= 0 && y + size / 2 <= height, `${value} clips vertically at ${width}x${height}`)
      }
    }
  }
})

test('every section and obstacle renders without runtime randomness or browser globals', () => {
  const random = Math.random
  Math.random = () => { throw new Error('runtime random call') }
  try {
    assert.doesNotThrow(() => {
      for (const z of [80, 260, 480, 700, 900]) renderAt(z)
      for (const type of [FIRE, GAP, BRIDGE, FINISH, HURDLE, PISTON]) {
        const obstacle = RED_STAGE.obstacles.find(item => item[0] === type)
        renderAt(obstacle[1] - 20, {}, { ...RED_STAGE, obstacles:[obstacle] }, 195, 422)
      }
    })
  } finally {
    Math.random = random
  }
})

test('a run beyond the finish keeps the final section elevation', () => {
  const run = { ...createRun(RED_STAGE), mode:'success', z:1001 }
  const camera = { x:0, y:0, z:980, horizon:.3, focal:.9, shakeX:0, shakeY:0 }
  const ctx = recordingContext()

  render(ctx, run, camera, RED_STAGE, 320, 180)

  assert.deepEqual(ctx.calls[runnerAnchor(ctx.calls)], ['translate', 160, 8])
})
