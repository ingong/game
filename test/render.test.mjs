import test from 'node:test'
import assert from 'node:assert/strict'
import { createCamera } from '../src/camera.mjs'
import { render } from '../src/render.mjs'
import { createRun } from '../src/sim.mjs'
import { RED_STAGE } from '../src/stage.mjs'

function recordingContext() {
  const calls = []
  return {
    calls,
    fillStyle:'',
    font:'',
    textAlign:'',
    textBaseline:'',
    imageSmoothingEnabled:true,
    beginPath() { calls.push(['beginPath']) },
    moveTo(x, y) { calls.push(['moveTo', x, y]) },
    lineTo(x, y) { calls.push(['lineTo', x, y]) },
    closePath() { calls.push(['closePath']) },
    fill() { calls.push(['fill', this.fillStyle]) },
    fillRect(x, y, width, height) { calls.push(['fillRect', this.fillStyle, x, y, width, height]) },
    fillText(value, x, y) { calls.push(['fillText', value, x, y]) },
    save() { calls.push(['save']) },
    restore() { calls.push(['restore']) },
    translate(x, y) { calls.push(['translate', x, y]) },
    rotate(angle) { calls.push(['rotate', angle]) },
    scale(x, y) { calls.push(['scale', x, y]) }
  }
}

const runnerAnchor = calls => calls.findIndex(call =>
  call[0] === 'translate' && Number.isInteger(call[1]) && Number.isInteger(call[2]))

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
