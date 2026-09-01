import { createInput } from './input.mjs'
import { render } from './render.mjs'
import { createRun, restartRun, stepRun } from './sim.mjs'
import { RED_STAGE } from './stage.mjs'

const STEP = 1 / 120
const MAX_ACCUMULATOR = .1

export function startGame(canvas, target = window) {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const input = createInput(target)
  let run = createRun(RED_STAGE)
  let width = 1
  let height = 1
  let ratio = 1
  let accumulator = 0
  let previous = null
  let frameId = 0
  let stopped = false

  const resize = () => {
    const rect = canvas.getBoundingClientRect()
    width = Math.max(1, rect.width)
    height = Math.max(1, rect.height)
    ratio = Math.min(target.devicePixelRatio || 1, 2)
    const backingWidth = Math.max(1, Math.round(width * ratio))
    const backingHeight = Math.max(1, Math.round(height * ratio))
    if (canvas.width !== backingWidth) canvas.width = backingWidth
    if (canvas.height !== backingHeight) canvas.height = backingHeight
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
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
      } else {
        run = stepRun(run, controls, STEP, RED_STAGE)
      }
      accumulator -= STEP
    }

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    render(ctx, run, RED_STAGE, width, height)
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
