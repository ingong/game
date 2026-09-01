import { clamp } from './math.mjs'
import { contactAt, obstacleBounds, roadAt, surfaceAt } from './stage.mjs'

const makeCollapse = () => ({ index:-1, timer:0 })

const contains = (bounds, run) =>
  Math.abs(run.x - bounds.x) <= bounds.width / 2 && Math.abs(run.z - bounds.z) <= bounds.depth / 2

export const MOTION={
  maxSpeed:29.2, acceleration:18, drag:10, brake:36,
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
  next.z+=next.speed*dt
  const road=roadAt(stage,next.z)
  const halfWidth=road ? road.width/2 : 31
  next.x=clamp(next.x+next.vx*dt,-halfWidth,halfWidth)

  if (input.jumpPressed && run.grounded && run.jumps === 0) {
    next.vy=MOTION.jumpImpulse
    next.grounded=false
    next.jumps=1
  } else if (input.jumpPressed && !run.grounded && run.jumps === 1) {
    next.vy=MOTION.doubleJumpImpulse
    next.jumps=2
  }
  next.vy-=MOTION.gravity*dt
  next.y=run.y+next.vy*dt
  next.landing=Math.max(0,next.landing-5*dt)
  const surface=surfaceAt(stage,next.x,next.z,run.collapse)
  if(next.y<=0 && surface!==null){
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
  next.stumble=Math.max(0,run.stumble-dt)
  next.invulnerable=Math.max(0,run.invulnerable-dt)

  if(next.hitIndex>=0 && !contains(obstacleBounds(stage.obstacles[next.hitIndex],next.time),next)) {
    next.hitIndex=-1
  }

  const contact=contactAt(stage,next)
  if(contact?.kind==='bridge') {
    next.collapse=run.collapse.index===contact.index
      ? { index:contact.index,timer:run.collapse.timer+dt }
      : { index:contact.index,timer:0 }
  } else if(contact?.kind!=='lava') {
    next.collapse=makeCollapse()
  }

  if(contact?.kind==='finish' || next.z>=stage.length) {
    next.mode='success'
  } else if(contact?.kind==='stumble' && next.invulnerable===0 && next.hitIndex!==contact.index) {
    next.stumble=.45
    next.invulnerable=.75
    next.speed*=.45
    next.vx*=-.35
    next.stumbleId++
    next.hitIndex=contact.index
  } else if(contact?.kind==='lava') {
    next.mode = 'failure'
    next.failReason = 'LAVA'
  } else if(next.time>=stage.timeLimit) {
    next.mode='failure'
    next.failReason='TIME'
  }
  return next
}
