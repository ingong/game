import { createCamera, stepCamera } from './camera.mjs'
import { createInput } from './input.mjs'
import { logicalViewport } from './math.mjs'
import { render } from './render.mjs'
import { createRun, restartRun, stepRun } from './sim.mjs'
import { RED_STAGE, roadAt } from './stage.mjs'

const STEP = 1 / 120
const MAX_ACCUMULATOR = .1

export function startGame(canvas, target = window) {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const input = createInput(target)
  let run = createRun(RED_STAGE)
  let camera = createCamera(run, roadAt(RED_STAGE, run.z).elevation)
  let accumulator = 0
  let previous = null
  let frameId = 0
  let stopped = false

  const resize = () => {
    const viewport = logicalViewport(target.innerWidth, target.innerHeight)
    if (canvas.width !== viewport.width) canvas.width = viewport.width
    if (canvas.height !== viewport.height) canvas.height = viewport.height
    ctx.imageSmoothingEnabled = false
  }

  const frame = now => {
    if (stopped) return
    if (previous === null) previous = now
    accumulator = Math.min(MAX_ACCUMULATOR, accumulator + Math.max(0, (now - previous) / 1000))
    previous = now

    while (accumulator >= STEP) {
      const controls = input.read()
      if (controls.jumpPressed && (run.mode === 'title' || run.mode === 'success' || run.mode === 'failure')) {
        run = restartRun(RED_STAGE)
        camera = createCamera(run, roadAt(RED_STAGE, run.z).elevation)
      } else {
        run = stepRun(run, controls, STEP, RED_STAGE)
        const elevation = roadAt(RED_STAGE, run.z)?.elevation ?? 0
        camera = stepCamera(camera, run, STEP, elevation)
      }
      accumulator -= STEP
    }

    render(ctx, run, camera, RED_STAGE, canvas.width, canvas.height)
    frameId = target.requestAnimationFrame(frame)
  }

  resize()
  target.addEventListener('resize', resize)
  frameId = target.requestAnimationFrame(frame)

  return {
    destroy() {
      if (stopped) return
      stopped = true
      target.cancelAnimationFrame(frameId)
      target.removeEventListener('resize', resize)
      input.destroy()
    }
  }
}

if (typeof document !== 'undefined') {
  const canvas = document.getElementById('game')
  if (canvas) startGame(canvas)
}
