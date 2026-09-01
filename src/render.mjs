import { clamp, projectPoint } from './math.mjs'
import { drawGear, drawLamp, drawRunner, drawSpark, runnerScale } from './art.mjs'
import { BRIDGE, FINISH, FIRE, GAP, HURDLE, PISTON, obstacleBounds, roadAt } from './stage.mjs'

const INK = '#31051b'
const DEEP = '#160315'
const ROAD = '#790b24'
const ROAD_ALT = '#86132a'
const SKY = '#d51d24'
const ORANGE = '#ff641e'
const YELLOW = '#ffd34d'
const COBALT = '#0877d1'
const NAVY = '#071f70'
const WHITE = '#fff'
const STEEL = '#9a8790'
const THEME_MARKERS = ['#b83a2d', '#65162a', '#ff8b20', '#2263a8', '#f7e7c6']
const NEAR = 1
const FAR = 220
const STRIP = 4
const RUNNER_WORLD_TO_ART = .14

export const stageElevation = (stage, z) =>
  roadAt(stage, Math.min(z, stage.length))?.elevation ?? 0

function polygon(ctx, color, points, alpha = 1) {
  if (points.length < 3) return
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1])
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
}

function project(camera, x, y, z, width, height) {
  return projectPoint(camera, x, y, z, width, height)
}

function worldQuad(ctx, color, camera, points, width, height, alpha = 1) {
  polygon(ctx, color, points.map(([x, y, z]) => {
    const point = project(camera, x, y, z, width, height)
    return [point.x, point.y]
  }), alpha)
}

function groundQuad(ctx, color, camera, stage, x0, x1, z0, z1, width, height, lift = .03, alpha = 1) {
  const near = Math.max(camera.z + NEAR, z0)
  if (z1 <= near) return
  const nearRoad = roadAt(stage, near)
  const farRoad = roadAt(stage, z1)
  if (!nearRoad || !farRoad) return
  worldQuad(ctx, color, camera, [
    [x0, farRoad.elevation + lift, z1], [x1, farRoad.elevation + lift, z1],
    [x1, nearRoad.elevation + lift, near], [x0, nearRoad.elevation + lift, near]
  ], width, height, alpha)
}

function drawLine(ctx, color, widthPx, points) {
  if (points.length < 2) return
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, widthPx)
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.stroke()
}

function propBox(ctx, camera, x, y, z, boxWidth, depth, boxHeight, front, top, side, width, height) {
  const x0 = x - boxWidth / 2
  const x1 = x + boxWidth / 2
  const z0 = Math.max(camera.z + NEAR, z - depth / 2)
  const z1 = z + depth / 2
  if (z1 <= z0) return
  worldQuad(ctx, side, camera, [[x1,y,z0],[x1,y,z1],[x1,y+boxHeight,z1],[x1,y+boxHeight,z0]], width, height)
  worldQuad(ctx, front, camera, [[x0,y,z0],[x1,y,z0],[x1,y+boxHeight,z0],[x0,y+boxHeight,z0]], width, height)
  worldQuad(ctx, top, camera, [[x0,y+boxHeight,z0],[x1,y+boxHeight,z0],[x1,y+boxHeight,z1],[x0,y+boxHeight,z1]], width, height)
}

function drawLava(ctx, run, camera, stage, width, height) {
  const farZ = Math.min(stage.length, camera.z + FAR)
  const farRoad = roadAt(stage, Math.max(0, farZ))
  const horizon = farRoad
    ? project(camera, 0, farRoad.elevation - 2, farZ, width, height).y
    : height * camera.horizon
  ctx.fillStyle = ORANGE
  ctx.fillRect(0, horizon, width, height - horizon)

  const bandHeight = Math.max(1, height * .008)
  for (let i = 0; i < 8; i++) {
    const y = horizon + (height - horizon) * (i + 1) / 9
    const offset = Math.sin(run.z * .035 + i * 1.7) * width * .025
    polygon(ctx, i % 3 === 1 ? INK : YELLOW, [
      [0,y], [width*.25+offset,y-bandHeight], [width*.6+offset,y+bandHeight],
      [width,y-bandHeight], [width,y+bandHeight*1.5],
      [width*.58+offset,y+bandHeight*2.5], [width*.22+offset,y+bandHeight], [0,y+bandHeight*2]
    ])
  }
}

function drawRoad(ctx, camera, stage, width, height) {
  const firstZ = Math.max(0, camera.z + NEAR)
  const lastZ = Math.min(stage.length, camera.z + FAR)
  for (let farZ = lastZ; farZ > firstZ; farZ -= STRIP) {
    const nearZ = Math.max(firstZ, farZ - STRIP)
    const farRoad = roadAt(stage, farZ)
    const nearRoad = roadAt(stage, nearZ)
    if (!farRoad || !nearRoad) continue
    const fl = project(camera, -farRoad.width/2, farRoad.elevation, farZ, width, height)
    const fr = project(camera, farRoad.width/2, farRoad.elevation, farZ, width, height)
    const nl = project(camera, -nearRoad.width/2, nearRoad.elevation, nearZ, width, height)
    const nr = project(camera, nearRoad.width/2, nearRoad.elevation, nearZ, width, height)
    const flDown = project(camera, -farRoad.width/2, farRoad.elevation-1.5, farZ, width, height)
    const frDown = project(camera, farRoad.width/2, farRoad.elevation-1.5, farZ, width, height)
    const nlDown = project(camera, -nearRoad.width/2, nearRoad.elevation-1.5, nearZ, width, height)
    const nrDown = project(camera, nearRoad.width/2, nearRoad.elevation-1.5, nearZ, width, height)

    polygon(ctx, DEEP, [[fl.x,fl.y],[flDown.x,flDown.y],[nlDown.x,nlDown.y],[nl.x,nl.y]])
    polygon(ctx, INK, [[fr.x,fr.y],[frDown.x,frDown.y],[nrDown.x,nrDown.y],[nr.x,nr.y]])
    polygon(ctx, (Math.floor(nearZ/8)&1) ? ROAD : ROAD_ALT,
      [[fl.x,fl.y],[fr.x,fr.y],[nr.x,nr.y],[nl.x,nl.y]])

    const farRim = Math.min(1, farRoad.width / 8)
    const nearRim = Math.min(1, nearRoad.width / 8)
    groundQuad(ctx, YELLOW, camera, stage, -farRoad.width/2, -farRoad.width/2+farRim,
      nearZ, farZ, width, height, .05, .8)
    groundQuad(ctx, YELLOW, camera, stage, nearRoad.width/2-nearRim, nearRoad.width/2,
      nearZ, farZ, width, height, .05, .8)
  }
}

const seeded = (index, seed) => (Math.imul(index + seed, 1103515245) >>> 16) & 255

function drawThemeProp(ctx, run, camera, stage, z, index, road, width, height) {
  const value = seeded(index, road.seed)
  const side = value & 1 ? 1 : -1
  const edge = side * (road.width / 2 + 3 + value % 4)
  const elevation = road.elevation
  const point = project(camera, edge, elevation + 4, z, width, height)
  const size = Math.max(1, point.scale)
  const marker = THEME_MARKERS[road.theme]

  if (road.theme === 0) {
    propBox(ctx, camera, edge, elevation, z, 7 + value%4, 5, 8 + value%3,
      marker, ORANGE, INK, width, height)
    const door = project(camera, edge-side*.1, elevation+3.2, z-2.55, width, height)
    ctx.fillStyle = value&2 ? YELLOW : ORANGE
    ctx.fillRect(door.x-size*1.5, door.y-size*2, size*3, size*3)
    drawGear(ctx, point.x + side*size*2, point.y, size*1.7, run.time*1.4 + value, marker)
    groundQuad(ctx, STEEL, camera, stage, side*(road.width/2-2), side*(road.width/2-1), z-10, z+10, width, height)
    groundQuad(ctx, INK, camera, stage, -4, 4, z-1, z+1, width, height)
  } else if (road.theme === 1) {
    propBox(ctx, camera, edge, elevation, z, 5, 18, 10, marker, INK, DEEP, width, height)
    for (let brick = 1; brick < 4; brick++) {
      const a = project(camera, edge-side*2.6, elevation+brick*2.1, z-9, width, height)
      const b = project(camera, edge-side*2.6, elevation+brick*2.1, z+9, width, height)
      drawLine(ctx, ROAD_ALT, size*.3, [a,b])
    }
    const pipeTop = project(camera, edge-side*3, elevation+9, z, width, height)
    const pipeBottom = project(camera, edge-side*3, elevation+1, z, width, height)
    drawLine(ctx, STEEL, size*.8, [pipeTop,pipeBottom])
    drawLamp(ctx, point.x, point.y-size*2, size, ((run.time*3+index)|0)&1, YELLOW)
    for (let puff = 0; puff < 2; puff++) {
      ctx.globalAlpha = .3
      ctx.fillStyle = WHITE
      ctx.beginPath()
      ctx.arc(point.x-side*size*puff, point.y-size*(4+puff*1.3), size*(.8+puff*.25), 0, Math.PI*2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  } else if (road.theme === 2) {
    propBox(ctx, camera, edge, elevation+1.5, z, 10, 9, 1.2, marker, STEEL, INK, width, height)
    groundQuad(ctx, YELLOW, camera, stage, side*(road.width/2+1), side*(road.width/2+7), z-7, z+7, width, height, -1)
    const postBase = project(camera, edge-side*3, elevation+2.7, z-2, width, height)
    const postTop = project(camera, edge-side*3, elevation+8, z-2, width, height)
    drawLine(ctx, WHITE, size*.7, [postBase,postTop])
    const fallTop = project(camera, edge+side*4, elevation+8, z+4, width, height)
    ctx.fillStyle = marker
    ctx.fillRect(fallTop.x-size, fallTop.y, size*2, size*7)
    ctx.fillStyle = YELLOW
    ctx.fillRect(fallTop.x-size*.35, fallTop.y, size*.7, size*7)
  } else if (road.theme === 3) {
    propBox(ctx, camera, edge, elevation, z, 7, 7, 14, marker, STEEL, INK, width, height)
    const housing = project(camera, edge-side*2, elevation+11, z-3.6, width, height)
    ctx.fillStyle = INK
    ctx.fillRect(housing.x-size*2.5, housing.y-size, size*5, size*2)
    for (let stripe = 0; stripe < 3; stripe++) {
      groundQuad(ctx, stripe&1 ? YELLOW : INK, camera, stage,
        edge-side*5, edge+side*1, z-7+stripe*2, z-6+stripe*2, width, height)
    }
    drawLamp(ctx, point.x, point.y-size*4, size*1.2, ((run.time*4+index)|0)&1, YELLOW)
  } else {
    propBox(ctx, camera, edge, elevation-1, z, 4, 5, 12, INK, marker, DEEP, width, height)
    const railA = project(camera, side*(road.width/2-.8), elevation+2.8, z-8, width, height)
    const railB = project(camera, side*(road.width/2-.8), elevation+2.8-(value%3), z+6, width, height)
    drawLine(ctx, marker, size*.45, [railA,railB])
    const lavafall = project(camera, edge+side*2, elevation+9, z+2, width, height)
    ctx.fillStyle = ORANGE
    ctx.fillRect(lavafall.x-size, lavafall.y, size*2, size*9)
    for (let spark = 0; spark < 2; spark++) {
      drawSpark(ctx, point.x-side*size*(spark+1), point.y-size*(spark+1), size*.8, marker)
    }
  }
}

function drawSectionProps(ctx, run, camera, stage, width, height) {
  const first = Math.max(0, camera.z + 8)
  const last = Math.min(stage.length, camera.z + FAR)
  const spacing = 24
  const props = []
  for (let z = Math.ceil(first/spacing)*spacing; z <= last; z += spacing) {
    const road = roadAt(stage, z)
    if (road) props.push({ z, road, index:Math.floor(z/spacing) })
  }
  for (let i = props.length-1; i >= 0; i--) {
    const prop = props[i]
    drawThemeProp(ctx, run, camera, stage, prop.z, prop.index, prop.road, width, height)
  }
}

function drawTelegraph(ctx, bounds, camera, stage, width, height, color = YELLOW) {
  const near = bounds.z - bounds.depth/2
  const length = clamp(bounds.depth*1.8, 4, 12)
  groundQuad(ctx, INK, camera, stage, bounds.x-bounds.width/2, bounds.x+bounds.width/2,
    near-length, near, width, height, .08, .72)
  for (let i = 0; i < 4; i += 2) {
    const z0 = near-length + length*i/4
    const z1 = near-length + length*(i+1)/4
    groundQuad(ctx, color, camera, stage, bounds.x-bounds.width/2, bounds.x+bounds.width/2,
      z0, z1, width, height, .1, .8)
  }
}

function drawFootprint(ctx, bounds, camera, stage, width, height, alpha = .5) {
  groundQuad(ctx, DEEP, camera, stage, bounds.x-bounds.width*.56, bounds.x+bounds.width*.56,
    bounds.z-bounds.depth*.62, bounds.z+bounds.depth*.62, width, height, .045, alpha)
}

function drawSolid(ctx, bounds, camera, stage, width, height, colors = [ROAD, ORANGE, INK]) {
  const z0 = Math.max(camera.z+NEAR, bounds.z-bounds.depth/2)
  const z1 = bounds.z+bounds.depth/2
  if (z1 <= z0) return
  const x0 = bounds.x-bounds.width/2
  const x1 = bounds.x+bounds.width/2
  const y0 = roadAt(stage, bounds.z)?.elevation ?? 0
  const y1 = y0+bounds.height
  const [front, top, side] = colors
  worldQuad(ctx, side, camera, [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]], width, height)
  worldQuad(ctx, INK, camera, [[x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0]], width, height)
  worldQuad(ctx, front, camera, [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]], width, height)
  worldQuad(ctx, top, camera, [[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]], width, height)
  const rim = Math.min(.45, bounds.height*.16)
  worldQuad(ctx, WHITE, camera, [[x0,y1-rim,z0-.02],[x1,y1-rim,z0-.02],[x1,y1,z0-.02],[x0,y1,z0-.02]], width, height)
}

function drawHurdle(ctx, obstacle, run, camera, stage, width, height) {
  const bounds = obstacleBounds(obstacle, run.time)
  drawTelegraph(ctx, bounds, camera, stage, width, height)
  drawFootprint(ctx, bounds, camera, stage, width, height)
  drawSolid(ctx, bounds, camera, stage, width, height, [THEME_MARKERS[0], YELLOW, INK])
  const base = project(camera, bounds.x, (roadAt(stage,bounds.z)?.elevation??0)+bounds.height*.55,
    bounds.z-bounds.depth/2-.02, width, height)
  const unit = Math.max(1, base.scale*.42)
  ctx.fillStyle = INK
  ctx.fillRect(base.x-bounds.width*base.scale*.38, base.y-unit, bounds.width*base.scale*.76, unit*2)
  ctx.fillStyle = YELLOW
  ctx.fillRect(base.x-unit, base.y-unit, unit*2, unit*2)
}

function drawFlame(ctx, obstacle, run, camera, stage, width, height) {
  const bounds = obstacleBounds(obstacle, run.time)
  drawTelegraph(ctx, bounds, camera, stage, width, height, ORANGE)
  drawFootprint(ctx, bounds, camera, stage, width, height, .35)
  const elevation = roadAt(stage, bounds.z)?.elevation ?? 0
  const base = project(camera, bounds.x, elevation, bounds.z, width, height)
  const left = project(camera, bounds.x-bounds.width/2, elevation, bounds.z, width, height).x
  const right = project(camera, bounds.x+bounds.width/2, elevation, bounds.z, width, height).x
  const cell = Math.max(1, Math.round(base.scale*.55))
  const pilotY = Math.round(base.y-cell)
  ctx.fillStyle = INK
  ctx.fillRect(left, pilotY, right-left, cell*2)
  ctx.fillStyle = bounds.active ? ORANGE : ROAD_ALT
  ctx.fillRect(left+cell, pilotY-cell, Math.max(cell,right-left-cell*2), cell*2)
  ctx.fillStyle = YELLOW
  ctx.fillRect(base.x-cell, pilotY-cell*2, cell*2, cell*2)
  if (!bounds.active) return
  const top = base.y-bounds.height*base.scale
  const pulse = 1 + Math.sin(run.time*9+obstacle[7]*4)*.12
  const flameWidth = (right-left)*pulse
  const x0 = base.x-flameWidth/2
  polygon(ctx, SKY, [[x0,base.y],[x0+cell,top+cell*2],[base.x-cell,top],
    [base.x+cell,top+cell*2],[base.x+flameWidth/2-cell,top+cell],[base.x+flameWidth/2,base.y]])
  polygon(ctx, ORANGE, [[x0+cell,base.y],[base.x-cell,top+cell*3],
    [base.x+cell,top+cell*2],[base.x+flameWidth/2-cell,base.y]])
  polygon(ctx, YELLOW, [[base.x-cell,base.y],[base.x,top+cell*4],[base.x+cell,base.y]])
}

function drawGap(ctx, obstacle, run, camera, stage, width, height) {
  const bounds = obstacleBounds(obstacle, run.time)
  drawTelegraph(ctx, bounds, camera, stage, width, height, ORANGE)
  const x0 = bounds.x-bounds.width/2
  const x1 = bounds.x+bounds.width/2
  const z0 = bounds.z-bounds.depth/2
  const z1 = bounds.z+bounds.depth/2
  groundQuad(ctx, DEEP, camera, stage, x0, x1, z0, z1, width, height, .14)
  groundQuad(ctx, ORANGE, camera, stage, x0+bounds.width*.04, x1-bounds.width*.04,
    z0+bounds.depth*.08, z1-bounds.depth*.08, width, height, .17)
  const drift = (Math.sin(run.time*5+bounds.z)*.12+.5)*bounds.depth
  for (let i = 0; i < 2; i++) {
    const band = z0 + (drift+i*bounds.depth*.45)%bounds.depth
    groundQuad(ctx, YELLOW, camera, stage, bounds.x-bounds.width*.34, bounds.x+bounds.width*.34,
      band, Math.min(z1,band+bounds.depth*.09), width, height, .2)
  }
  groundQuad(ctx, WHITE, camera, stage, x0, x1, z1-bounds.depth*.08, z1, width, height, .24)
}

function drawPiston(ctx, obstacle, run, camera, stage, width, height) {
  const bounds = obstacleBounds(obstacle, run.time)
  drawTelegraph(ctx, bounds, camera, stage, width, height)
  drawFootprint(ctx, bounds, camera, stage, width, height)
  drawSolid(ctx, bounds, camera, stage, width, height, [THEME_MARKERS[3], STEEL, INK])
  const elevation = roadAt(stage,bounds.z)?.elevation ?? 0
  const top = project(camera, bounds.x, elevation+bounds.height+4, bounds.z, width, height)
  const ram = project(camera, bounds.x, elevation+bounds.height, bounds.z, width, height)
  const unit = Math.max(1, top.scale)
  ctx.fillStyle = INK
  ctx.fillRect(top.x-unit*3, top.y-unit*2, unit*6, unit*3)
  ctx.fillStyle = STEEL
  ctx.fillRect(ram.x-unit*.65, top.y+unit, unit*1.3, Math.max(unit,ram.y-top.y-unit))
  const cycle = obstacle[6] ? ((run.time+obstacle[7])/obstacle[6]%1+1)%1 : 0
  drawLamp(ctx, top.x-unit*2, top.y-unit*2, unit*.7, cycle>.5)
  drawLamp(ctx, top.x+unit*2, top.y-unit*2, unit*.7, cycle>.5)
}

function drawBridge(ctx, obstacle, index, run, camera, stage, width, height) {
  const bounds = obstacleBounds(obstacle, run.time)
  const active = run.collapse.index === index
  const progress = active ? clamp(run.collapse.timer/(obstacle[6]||1),0,1) : 0
  drawTelegraph(ctx, bounds, camera, stage, width, height, COBALT)
  drawFootprint(ctx, bounds, camera, stage, width, height, .4*(1-progress))
  if (progress > 0) {
    groundQuad(ctx, DEEP, camera, stage, bounds.x-bounds.width/2, bounds.x+bounds.width/2,
      bounds.z-bounds.depth/2, bounds.z+bounds.depth/2, width, height, .06)
    groundQuad(ctx, ORANGE, camera, stage, bounds.x-bounds.width*.43, bounds.x+bounds.width*.43,
      bounds.z-bounds.depth*.42, bounds.z+bounds.depth*.42, width, height, .08, progress*.85)
  }
  const elevation = roadAt(stage,bounds.z)?.elevation ?? 0
  const center = project(camera, bounds.x, elevation, bounds.z, width, height)
  ctx.save()
  ctx.translate(center.x, center.y+progress*center.scale*5)
  ctx.rotate((index&1 ? -1 : 1)*progress*.5)
  ctx.translate(-center.x, -center.y)
  drawSolid(ctx, { ...bounds, height:1.1 }, camera, stage, width, height,
    [progress>.55 ? INK : THEME_MARKERS[4], STEEL, COBALT])
  const crack = project(camera, bounds.x+bounds.width*.18, elevation+1.12,
    bounds.z-bounds.depth*.15, width, height)
  drawSpark(ctx, crack.x, crack.y, Math.max(1,crack.scale), progress ? ORANGE : ROAD)
  ctx.restore()
}

function drawFinish(ctx, obstacle, run, camera, stage, width, height) {
  const bounds = obstacleBounds(obstacle, run.time)
  drawTelegraph(ctx, bounds, camera, stage, width, height, WHITE)
  drawFootprint(ctx, bounds, camera, stage, width, height, .45)
  const elevation = roadAt(stage,bounds.z)?.elevation ?? stageElevation(stage,bounds.z)
  const pillarWidth = bounds.width*.18
  for (const side of [-1,1]) {
    propBox(ctx, camera, bounds.x+side*(bounds.width/2-pillarWidth/2), elevation,
      bounds.z, pillarWidth, bounds.depth, bounds.height, THEME_MARKERS[4], WHITE, INK, width, height)
  }
  const z = bounds.z-bounds.depth/2-.02
  const inner = bounds.width/2-pillarWidth
  worldQuad(ctx, WHITE, camera, [
    [bounds.x-inner,elevation+2,z],[bounds.x+inner,elevation+2,z],
    [bounds.x+inner,elevation+bounds.height-2,z],[bounds.x-inner,elevation+bounds.height-2,z]
  ], width, height, .75+.2*Math.sin(run.time*8))
  worldQuad(ctx, YELLOW, camera, [
    [bounds.x-bounds.width/2,elevation+bounds.height-3,z],
    [bounds.x+bounds.width/2,elevation+bounds.height-3,z],
    [bounds.x+bounds.width/2,elevation+bounds.height,z],
    [bounds.x-bounds.width/2,elevation+bounds.height,z]
  ], width, height)
}

function drawObstacle(ctx, item, run, camera, stage, width, height) {
  const { obstacle, index } = item
  if (obstacle[0] === FIRE) drawFlame(ctx, obstacle, run, camera, stage, width, height)
  else if (obstacle[0] === GAP) drawGap(ctx, obstacle, run, camera, stage, width, height)
  else if (obstacle[0] === BRIDGE) drawBridge(ctx, obstacle, index, run, camera, stage, width, height)
  else if (obstacle[0] === FINISH) drawFinish(ctx, obstacle, run, camera, stage, width, height)
  else if (obstacle[0] === HURDLE) drawHurdle(ctx, obstacle, run, camera, stage, width, height)
  else if (obstacle[0] === PISTON) drawPiston(ctx, obstacle, run, camera, stage, width, height)
}

function drawRunnerShadow(ctx, run, camera, stage, width, height) {
  const elevation = stageElevation(stage, run.z)
  const point = project(camera, run.x, elevation+.05, run.z, width, height)
  const response = clamp(1-run.y/14,.2,1)
  ctx.save()
  ctx.translate(point.x, point.y)
  ctx.scale(point.scale*.8*response, point.scale*.25*response)
  ctx.globalAlpha = .5*response
  ctx.fillStyle = DEEP
  ctx.beginPath()
  ctx.arc(0, 0, 2.4, 0, Math.PI*2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()
}

function drawSpeedStreaks(ctx, run, width, height) {
  if (run.speed <= 24) return
  const strength = (run.speed-24)/10
  for (let i = 0; i < 6; i++) {
    const side = i&1 ? 1 : -1
    const y = height*(.42+(i%3)*.17)
    const x = side>0 ? width*(.75+(i%3)*.06) : width*(.25-(i%3)*.06)
    drawLine(ctx, WHITE, 1, [{x,y},{x:x+side*width*.07*strength,y:y+height*.025}])
  }
}

function drawLandingSparks(ctx, run, player) {
  if (run.landing <= 0) return
  const size = Math.max(2, player.scale*.65)*run.landing
  drawSpark(ctx, player.x-size*2.5, player.y, size, YELLOW)
  drawSpark(ctx, player.x+size*2.5, player.y, size, ORANGE)
}

function drawStumbleImpact(ctx, run, player) {
  if (run.stumble <= 0) return
  const direction = Math.sign(run.vx||1)
  const size = Math.max(3, player.scale*1.4)*clamp(run.stumble/.45,.35,1)
  drawSpark(ctx, player.x+direction*size*2, player.y-player.scale*3.2, size, WHITE)
  drawSpark(ctx, player.x+direction*size*2, player.y-player.scale*3.2, size*.55, SKY)
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`
}

function shadowText(ctx, value, x, y, size, align = 'center') {
  ctx.font = `700 ${Math.round(size)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  const offset = Math.max(1, size*.07)
  ctx.fillStyle = NAVY
  ctx.fillText(value, x+offset, y+offset)
  ctx.fillStyle = WHITE
  ctx.fillText(value, x, y)
}

function drawHud(ctx, run, width, height) {
  const margin = clamp(Math.min(width,height)*.035, 8, 12)
  const hudSize = clamp(Math.min(width,height)*.043, 10, 18)
  const top = margin+hudSize/2
  shadowText(ctx, 'RED 1', margin, top, hudSize, 'left')
  shadowText(ctx, formatTime(run.time), width-margin, top, hudSize, 'right')
  if (run.mode === 'running') shadowText(ctx, `${Math.round(run.speed)} M/S`, margin,
    top+hudSize*.95, Math.max(9,hudSize*.7), 'left')

  let main = ''
  let sub = ''
  if (run.mode === 'title') main = 'CRIMSON FURNACE'
  else if (run.mode === 'countdown') main = run.countdown <= .5 ? 'GO' : String(Math.ceil(run.countdown))
  else if (run.mode === 'success') {
    main = 'CLEAR'
    sub = 'SPACE TO RUN AGAIN'
  } else if (run.mode === 'failure') {
    main = { TIME:'TIME UP', LAVA:'FELL', FIRE:'BURNED' }[run.failReason] || 'FELL'
    sub = 'SPACE TO RUN AGAIN'
  }

  if (main) {
    const byWidth = (width-margin*2)/Math.max(main.length*.62,1)
    const mainSize = clamp(Math.min(byWidth,height*.13), 12, 44)
    const mainY = Math.max(top+hudSize*.7+mainSize*.55, height*.24)
    shadowText(ctx, main, width/2, mainY, mainSize)
    if (sub) {
      const subSize = clamp((width-margin*2)/(sub.length*.62), 9, 18)
      shadowText(ctx, sub, width/2, mainY+mainSize*.72+subSize*.55, subSize)
    }
  }
}

export function obstacleDrawsBeforeRunner(item, run, playerDepth) {
  if (item.depth >= playerDepth) return true
  const bounds = obstacleBounds(item.obstacle, run.time)
  const type = item.obstacle[0]
  const solid = type === HURDLE || type === PISTON || type === FIRE && bounds.active
  return solid && run.y >= bounds.height &&
    Math.abs(run.x-bounds.x) <= bounds.width/2 &&
    Math.abs(run.z-bounds.z) <= bounds.depth/2
}

export function render(ctx, run, camera, stage, width, height) {
  ctx.fillStyle = SKY
  ctx.fillRect(0, 0, width, height)
  drawLava(ctx, run, camera, stage, width, height)
  drawRoad(ctx, camera, stage, width, height)
  drawSectionProps(ctx, run, camera, stage, width, height)
  drawSpeedStreaks(ctx, run, width, height)

  const visible = stage.obstacles
    .map((obstacle,index) => ({ obstacle,index,depth:obstacle[1]-camera.z }))
    .filter(item => item.depth > 0 && item.depth <= FAR)
    .sort((a,b) => b.depth-a.depth)

  const elevation = stageElevation(stage, run.z)
  const player = project(camera, run.x, elevation+run.y, run.z, width, height)
  drawRunnerShadow(ctx, run, camera, stage, width, height)
  for (const item of visible) if (obstacleDrawsBeforeRunner(item,run,player.depth)) {
    drawObstacle(ctx,item,run,camera,stage,width,height)
  }
  drawLandingSparks(ctx, run, player)
  const stumbleOffset = run.stumble > 0 ? -Math.sign(run.vx||1)*run.stumble*8 : 0
  drawRunner(ctx, run, player.x+stumbleOffset, player.y,
    runnerScale(width,height)*player.scale*RUNNER_WORLD_TO_ART)
  drawStumbleImpact(ctx, run, player)
  for (const item of visible) if (!obstacleDrawsBeforeRunner(item,run,player.depth)) {
    drawObstacle(ctx,item,run,camera,stage,width,height)
  }
  drawHud(ctx, run, width, height)
}
