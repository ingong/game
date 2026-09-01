import { clamp } from './math.mjs'
import { bridgeIndexAt, hazardAt } from './stage.mjs'

const makeCollapse = () => ({ index:-1, timer:0 })

export const MOTION={
  maxSpeed:34, acceleration:24, drag:10, brake:36,
  steerAcceleration:70, steerDrag:8, maxLateralSpeed:18,
  gravity:48, jumpImpulse:18, doubleJumpImpulse:15
}

export const createRun = stage => ({
  mode:'title',time:0,countdown:0,x:0,y:0,z:0,vx:0,vy:0,speed:0,
  grounded:true,jumps:0,anim:0,stumble:0,invulnerable:0,landing:0,
  landingId:0,stumbleId:0,hitIndex:-1,
  failReason:'',
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

  const drive=input.down?-MOTION.brake:input.up?MOTION.acceleration:-MOTION.drag
  next.speed=clamp(run.speed+drive*dt,0,MOTION.maxSpeed)
  const steer=(input.right?1:0)-(input.left?1:0)
  const grip=.45+.55*(1-next.speed/MOTION.maxSpeed)
  next.vx=clamp(next.vx+steer*MOTION.steerAcceleration*grip*dt,
    -MOTION.maxLateralSpeed,MOTION.maxLateralSpeed)
  if(!steer)next.vx=Math.sign(next.vx)*Math.max(0,Math.abs(next.vx)-MOTION.steerDrag*dt)
  next.x=clamp(next.x+next.vx*dt,-31,31)
  next.z+=next.speed*dt

  if (input.jumpPressed && run.jumps === 0) {
    next.vy=MOTION.jumpImpulse
    next.grounded=false
    next.jumps=1
  } else if (input.jumpPressed && !run.grounded && run.jumps === 1) {
    next.vy=MOTION.doubleJumpImpulse
    next.jumps=2
  }
  next.vy-=MOTION.gravity*dt
  next.y=run.y+next.vy*dt
  if(next.y<=0){
    const landed=!run.grounded
    next.y=0
    next.vy=0
    next.grounded=true
    if(landed){
      next.jumps=0
      next.landing=1
      next.landingId+=1
    }
  } else {
    next.grounded=false
  }

  next.time = run.time + dt
  next.anim = run.anim + next.speed * dt * .055
  next.landing=Math.max(0,next.landing-5*dt)
  if (next.time >= stage.timeLimit) {
    next.mode = 'failure'
    next.failReason = 'TIME'
  }
  const bridge = next.grounded ? bridgeIndexAt(stage, next.x, next.z) : -1
  if (bridge < 0) next.collapse = makeCollapse()
  else if (next.collapse.index === bridge) next.collapse.timer += dt
  else next.collapse = { index:bridge, timer:dt }

  const hazard = hazardAt(stage, next)
  if (hazard) {
    next.mode = 'failure'
    next.failReason = hazard
  } else if (next.mode === 'running' && next.z >= stage.length) next.mode = 'success'
  return next
}
