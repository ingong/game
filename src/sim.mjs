import { clamp } from './math.mjs'

const makeCollapse = () => ({ index:-1, timer:0 })

export const createRun = stage => ({
  mode:'title', time:0, x:0, y:0, z:0, vx:0, vy:0,
  speed:18, grounded:true, anim:0, failReason:'', countdown:0,
  collapse:makeCollapse()
})

export const restartRun = stage => ({ ...createRun(stage), mode:'countdown', countdown:3 })

export function stepRun(run, input, dt, stage) {
  const next = { ...run, collapse: { ...run.collapse } }

  if (run.mode === 'countdown') {
    next.countdown = Math.max(0, run.countdown - dt)
    if (next.countdown <= 1e-9) {
      next.countdown = 0
      next.mode = 'running'
    }
    return next
  }

  if (run.mode !== 'running') return next

  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  next.vx = clamp(run.vx + direction * 180 * dt, -24, 24)
  if (!direction) next.vx *= Math.max(0, 1 - 8 * dt)
  next.x = clamp(run.x + next.vx * dt, -30, 30)

  const speedInput = (input.up ? 1 : 0) - (input.down ? 1 : 0)
  next.speed = clamp(run.speed + speedInput * 18 * dt, 12, 30)

  if (input.jumpPressed && run.grounded) {
    next.vy = 18
    next.grounded = false
  }
  next.vy -= 42 * dt
  next.y = run.y + next.vy * dt
  if (next.y <= 0) {
    next.y = 0
    next.vy = 0
    next.grounded = true
  }

  next.z = run.z + next.speed * dt
  next.time = run.time + dt
  next.anim = run.anim + next.speed * dt
  if (next.time >= stage.timeLimit) {
    next.mode = 'failure'
    next.failReason = 'TIME'
  }
  return next
}
