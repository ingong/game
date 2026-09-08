import { MAP_SETTINGS } from './generated/map-settings.mjs'
import { clamp, projectPoint } from './math.mjs'
import { drawGear, drawLamp, drawRunnerSprite as drawRunner, drawSpark, runnerScale } from './art.mjs'
import { BRIDGE, FINISH, FIRE, GAP, HURDLE, PISTON, SPRING, obstacleBounds, roadAt } from './stage.mjs'
import { INK, DEEP, ROAD, ROAD_ALT, SKY, ORANGE, YELLOW, COBALT, NAVY, WHITE, STEEL, EMBER, RUNE, THEME_MARKERS, RAINBOW } from './palette.mjs'
const NEAR = 1
const FAR = 220
const STRIP = 4
export const RUNNER_WORLD_TO_ART = .095

const renderRoadAt=(stage,z)=>roadAt(stage,Math.max(0,z))

export const stageElevation = (stage, z) =>
  renderRoadAt(stage, Math.min(z, stage.length))?.elevation ?? 0

function polygon(ctx, color, points, alpha = 1) {
  if (points.length < 3) return
  const previousAlpha=ctx.globalAlpha
  ctx.globalAlpha = previousAlpha*alpha
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(Math.round(points[0][0]), Math.round(points[0][1]))
  for (let i = 1; i < points.length; i++) ctx.lineTo(Math.round(points[i][0]), Math.round(points[i][1]))
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = previousAlpha
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
  const nearRoad = renderRoadAt(stage, near)
  const farRoad = renderRoadAt(stage, z1)
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

function disc(ctx, color, x, y, radius) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, Math.max(1, radius), 0, Math.PI*2)
  ctx.fill()
}

function ring(ctx, color, x, y, radius, widthPx = 1) {
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, widthPx)
  ctx.beginPath()
  ctx.arc(x, y, Math.max(1, radius), 0, Math.PI*2)
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

export function drawLava(ctx, run, camera, stage, width, height) {
  const farZ = Math.min(stage.length, camera.z + FAR)
  const farRoad = renderRoadAt(stage, Math.max(0, farZ))
  const horizon = farRoad
    ? project(camera, 0, farRoad.elevation - 2, farZ, width, height).y
    : height * camera.horizon
  const visual = stage.visual ?? MAP_SETTINGS.visual
  ctx.fillStyle = visual.void
  ctx.fillRect(0, horizon, width, height - horizon)

  // Layered, stepped cloud lobes share the same projection inside road gaps.
  for (let i=0;i<6;i++) {
    const layer=Math.floor(i/2),scale=width*(.095+layer*.035+(i%2)*.018),u=scale/12
    const x=(i%2?width-scale*.9:-scale*.35)+Math.sin(run.z*(.001+layer*.0004)+run.time*.04+i)*scale*.22
    const y=horizon+(height-horizon)*(.12+layer*.25+(i%2)*.055)
    const alpha=.6+layer*.16
    const shape=[[0,5],[2,5],[2,3],[4,3],[4,2],[7,2],[7,0],[11,0],[11,1],
      [13,1],[13,3],[15,3],[15,2],[18,2],[18,3],[20,3],[20,5],[23,5],
      [23,7],[21,7],[21,8],[3,8],[3,7],[0,7]]
    const points=(dy)=>shape.map(([px,py])=>[x+(i%2?23-px:px)*u,y+(py+dy)*u])
    polygon(ctx,'#c3c2e5',points(1),alpha)
    polygon(ctx,'#edf1ff',points(0),alpha)
    ctx.globalAlpha=alpha
    ctx.fillStyle='#fffdf4'
    for(const [px,py,w] of [[7,1,4],[4,3,3],[15,3,3]])
      ctx.fillRect(Math.round(x+(i%2?23-px-w:px)*u),Math.round(y+py*u),Math.round(w*u),Math.max(1,Math.round(u)))
  }
  ctx.globalAlpha=1

  const bandHeight = Math.max(1, height * .005)
  for (let i = 0; i < visual.ripples; i++) {
    const y = horizon + (height - horizon) * (i + 1) / (visual.ripples+1)
    const offset = Math.sin(run.z * .035 + i * 1.7) * width * .025
    polygon(ctx, i % 3 === 1 ? INK : ORANGE, [
      [0,y], [width*.25+offset,y-bandHeight], [width*.6+offset,y+bandHeight],
      [width,y-bandHeight], [width,y+bandHeight*1.5],
      [width*.58+offset,y+bandHeight*2.5], [width*.22+offset,y+bandHeight], [0,y+bandHeight*2]
    ])
  }
}

export function drawRoad(ctx, camera, stage, width, height) {
  const visual = stage.visual ?? MAP_SETTINGS.visual
  const firstZ = camera.z + NEAR
  const lastZ = Math.min(stage.length, camera.z + FAR)
  for (let endZ = Math.ceil(lastZ/STRIP)*STRIP; endZ > firstZ; endZ -= STRIP) {
    const startZ = endZ-STRIP
    const farZ = Math.min(lastZ,endZ)
    const nearZ = Math.max(firstZ,startZ)
    const farRoad = renderRoadAt(stage, farZ)
    const nearRoad = renderRoadAt(stage, nearZ)
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
    polygon(ctx, visual.road,
      [[fl.x,fl.y],[fr.x,fr.y],[nr.x,nr.y],[nl.x,nl.y]])

    // Staggered stone joints, chipped insets, and sparse luminous seams.
    if (visual.tiles) {
    const row = startZ/STRIP
    const half = nearRoad.width/2
    groundQuad(ctx, NAVY, camera, stage, -half, half, startZ, Math.min(farZ,startZ+.12), width, height)
    const joint = row%2 ? -half*.34 : half*.34
    groundQuad(ctx, NAVY, camera, stage, joint, joint+.12, nearZ, farZ, width, height)
    if (row%3 === 0) groundQuad(ctx, STEEL, camera, stage, joint+.4, joint+1.1,
      startZ+.4, Math.min(farZ,startZ+.65), width, height, .04, .6)

    }
    if (!visual.edges) continue
    const band=Math.min(3.5,nearRoad.width*.14)/7
    for (let i=0;i<7;i++) for (const side of [-1,1]) {
      const outer=side*nearRoad.width/2
      const a=outer-side*(i+1)*band,b=outer-side*i*band
      groundQuad(ctx,RAINBOW[i],camera,stage,Math.min(a,b),Math.max(a,b),nearZ,farZ,width,height,.05)
    }
    groundQuad(ctx,visual.accent,camera,stage,-nearRoad.width/2,-nearRoad.width/2+.12,nearZ,farZ,width,height,.06)

  }
}

// One small, optional landmark replaces the five ornate scenery families.
export function drawSectionProps(ctx, run, camera, stage, width, height) {
  const visual = stage.visual ?? MAP_SETTINGS.visual
  if (!visual.landmarks) return
  const spacing = visual.spacing
  const first = Math.max(0,camera.z+8), last = Math.min(stage.length,camera.z+FAR)
  for (let z = Math.floor(last/spacing)*spacing; z >= first; z -= spacing) {
    const road = renderRoadAt(stage,z)
    if (!road) continue
    const side = Math.round(z/spacing)%2 ? -1 : 1
    const point = project(camera,side*(road.width/2+4),road.elevation,z,width,height)
    const size = point.scale*visual.scale
    const x = Math.round(point.x), y = Math.round(point.y)
    ctx.fillStyle = INK
    ctx.fillRect(x-size*2,y-size*7,size*4,size*7)
    ctx.fillStyle = STEEL
    ctx.fillRect(x-size*1.5,y-size*6.5,size*2.5,size*6.5)
    ctx.fillStyle = visual.accent
    ctx.fillRect(x-size*.75,y-size*5,size,size*1.5)
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
  const y0 = renderRoadAt(stage, bounds.z)?.elevation ?? 0
  const y1 = y0+bounds.height
  const [front, top, side] = colors
  worldQuad(ctx, side, camera, [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]], width, height)
  worldQuad(ctx, INK, camera, [[x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0]], width, height)
  worldQuad(ctx, front, camera, [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]], width, height)
  worldQuad(ctx, top, camera, [[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]], width, height)
  const rim = Math.min(.45, bounds.height*.16)
  worldQuad(ctx, WHITE, camera, [[x0,y1-rim,z0-.02],[x1,y1-rim,z0-.02],[x1,y1,z0-.02],[x0,y1,z0-.02]], width, height)
}

// Shared faceting gives each small sculpture the same light and edge language.
function jewel(ctx,points,color) {
  polygon(ctx,color,points)
  const center=points.reduce((p,q)=>[p[0]+q[0]/points.length,p[1]+q[1]/points.length],[0,0])
  polygon(ctx,WHITE,[points[0],points[1],center],.6)
  polygon(ctx,INK,[points.at(-2),points.at(-1),center],.35)
  drawLine(ctx,INK,2,[...points,points[0]].map(([x,y])=>({x,y})))
}
function drawHurdle(ctx,obstacle,run,camera,stage,width,height) {
  const b=obstacleBounds(obstacle,run.time,stage),id=obstacle[8]||1
  drawTelegraph(ctx,b,camera,stage,width,height)
  drawFootprint(ctx,b,camera,stage,width,height)
  const p=project(camera,b.x,renderRoadAt(stage,b.z)?.elevation??0,b.z,width,height)
  const w=b.width*p.scale,h=Math.max(1,b.height*p.scale),color=stage.visual?.accent||ORANGE
  if(id===3) {
    for(let i=0;i<3;i++)drawSolid(ctx,{...b,x:b.x+b.width*(i-1)/3,width:b.width/3,height:b.height*(i+1)/3},camera,stage,width,height,[color,WHITE,INK])
  } else {
    const count=id===2?2:id===4?5:1
    for(let i=0;i<count;i++) {
      const x=p.x+w*((i+.5)/count-.5),r=w/count*.46
      jewel(ctx,[[x,p.y-h],[x+r,p.y-h*.65],[x+r,p.y-2],[x-r,p.y-2],[x-r,p.y-h*.65]],color)
      drawLine(ctx,WHITE,Math.max(1,p.scale*.15),[{x,y:p.y-h*.85},{x:x-r*.5,y:p.y-h*.55}])
    }
    if(id===2)drawSolid(ctx,{...b,height:b.height*.38},camera,stage,width,height,[color,WHITE,INK])
  }
}
function drawFlame(ctx,obstacle,run,camera,stage,width,height) {
  const b=obstacleBounds(obstacle,run.time,stage),id=obstacle[8]||5
  b.width=Math.min(b.width,renderRoadAt(stage,b.z)?.width??b.width)
  drawTelegraph(ctx,b,camera,stage,width,height,b.active?ORANGE:YELLOW)
  drawFootprint(ctx,b,camera,stage,width,height)
  const p=project(camera,b.x,renderRoadAt(stage,b.z)?.elevation??0,b.z,width,height)
  const w=b.width*p.scale,h=b.height*p.scale,top=p.y-h
  const count=id===6?2:id===8?5:1
  for(let i=0;i<count;i++) {
    const x=p.x+w*((i+.5)/count-.5),r=w/count*.47
    // Overlapping lobes form one rounded silhouette, with a shaded underside.
    ctx.save();ctx.translate(x,top);ctx.scale(1,.7)
    for(const inset of [0,.12]) {
      const color=inset?(b.active?'#9c86c9':STEEL):INK
      for(const [a,b,c] of [[-.48,0,.5],[0,-.23,.65],[.48,0,.5]])
        disc(ctx,color,a*r,b*r,r*(c-inset))
      ctx.fillStyle=color;ctx.fillRect((-1+inset)*r,0,(2-2*inset)*r,(.45-inset)*r)
    }
    ctx.fillStyle=b.active?'#76659e':'#969eb8';ctx.fillRect(-r*.8,r*.18,r*1.6,r*.14)
    drawLine(ctx,WHITE,Math.max(1,r*.08),[{x:-r*.23,y:-r*.62},{x:r*.1,y:-r*.62}])
    ctx.restore()
    if(b.active) {
      const sway=Math.sin(run.time*20+i)*r*.08
      const bolt=[[x+r*.12,top+r*.22],[x+r*.4,top+r*.22],[x+sway,top+h*.52],[x+r*.2,top+h*.52],[x-r*.25,p.y],[x-r*.06,top+h*.65],[x-r*.3,top+h*.65]]
      polygon(ctx,YELLOW,bolt);drawLine(ctx,WHITE,Math.max(1,p.scale*.2),[{x:x+r*.2,y:top},{x:x-r*.1,y:top+h*.55}])
      drawSpark(ctx,x,p.y,p.scale*.8,WHITE)
    }
  }
  const cycle=((run.time+obstacle[7])/obstacle[6]*(id===6?2:1))%1
  // A grounded charge bar is visible in both active and resting states.
  groundQuad(ctx,INK,camera,stage,b.x-b.width/2,b.x+b.width/2,b.z-b.depth/2,b.z+b.depth/2,width,height,.09)
  groundQuad(ctx,b.active?ORANGE:YELLOW,camera,stage,b.x-b.width/2,b.x-b.width/2+b.width*(b.active?1:((cycle+(id===8?.14:.22))%1)/(id===8?.32:.54)),b.z-b.depth/2,b.z+b.depth/2,width,height,.1)
}

function drawGap(ctx, obstacle, run, camera, stage, width, height) {
  const bounds=obstacleBounds(obstacle,run.time,stage)
  const z0=Math.max(camera.z+NEAR,bounds.z-bounds.depth/2),z1=bounds.z+bounds.depth/2
  if(z1<=z0)return
  const road0=renderRoadAt(stage,z0),road1=renderRoadAt(stage,z1)
  if(!road0||!road1)return
  const left0=Math.max(-road0.width/2,bounds.x-bounds.width/2),right0=Math.min(road0.width/2,bounds.x+bounds.width/2)
  const left1=Math.max(-road1.width/2,bounds.x-bounds.width/2),right1=Math.min(road1.width/2,bounds.x+bounds.width/2)
  const corners=[[left1,road1.elevation,z1],[right1,road1.elevation,z1],[right0,road0.elevation,z0],[left0,road0.elevation,z0]]
    .map(([x,y,z])=>project(camera,x,y,z,width,height))
  ctx.save()
  ctx.beginPath()
  corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y))
  ctx.closePath();ctx.clip()
  drawLava(ctx,run,camera,stage,width,height)
  // The far slab's exposed face gives the opening depth without filling it.
  worldQuad(ctx,INK,camera,[[left1,road1.elevation,z1],[right1,road1.elevation,z1],
    [right1,road1.elevation-1.5,z1],[left1,road1.elevation-1.5,z1]],width,height)
  ctx.restore()
  for (const [a,b] of [[corners[0],corners[1]],[corners[3],corners[2]]]) {
    drawLine(ctx,INK,3,[a,b]);drawLine(ctx,WHITE,1,[a,b])
  }
  if(obstacle[8]===14||obstacle[8]===16)for(let i=0;i<3;i++) {
    const x=left1+(right1-left1)*(i+.5)/3
    groundQuad(ctx,RAINBOW[i*2],camera,stage,x-.5,x+.5,z1,z1+2,width,height,.1)
  }
  drawTelegraph(ctx,{...bounds,x:(left0+right0)/2,width:right0-left0},camera,stage,width,height,YELLOW)
}

function drawPiston(ctx,obstacle,run,camera,stage,width,height) {
  const b=obstacleBounds(obstacle,run.time,stage),id=obstacle[8]||9
  drawTelegraph(ctx,b,camera,stage,width,height,COBALT)
  drawFootprint(ctx,b,camera,stage,width,height)
  const p=project(camera,b.x,(renderRoadAt(stage,b.z)?.elevation??0)+(b.bottom||0)+b.height/2,b.z,width,height)
  const rx=b.width*p.scale/2,ry=Math.max(1,b.height*p.scale/2)
  const n=id===11?8:10,angle=id===12?0:run.time*(id===10?.7:2)
  const shape=id===10?[[-1,0],[-.2,-1],[1,-.5],[.5,0],[1,.5],[-.2,1]]:
    id===12?[[.6,-1],[-.5,-.7],[-1,0],[-.5,.7],[.6,1],[.1,.4],[0,0],[.1,-.4]]:
    Array.from({length:n},(_,i)=>{const a=i*Math.PI*2/n+angle,r=i%2?.38:1;return [Math.cos(a)*r,Math.sin(a)*r]})
  jewel(ctx,shape.map(([x,y])=>[p.x+x*rx,p.y+y*ry]),id===12?YELLOW:id===11?RAINBOW[4]:RAINBOW[1])
  if(id!==12){disc(ctx,INK,p.x,p.y,ry*.2);disc(ctx,WHITE,p.x,p.y,ry*.11)}
  for(const side of [-1,1])drawLine(ctx,WHITE,2,[{x:p.x+side*rx*.4,y:p.y+ry+4},{x:p.x+side*rx,y:p.y+ry+4},{x:p.x+side*rx*.8,y:p.y+ry}])
}

function drawBridge(ctx, obstacle, index, run, camera, stage, width, height) {
  const bounds = obstacleBounds(obstacle, run.time,stage)
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
  const elevation = renderRoadAt(stage,bounds.z)?.elevation ?? 0
  const center = project(camera, bounds.x, elevation, bounds.z, width, height)
  ctx.save()
  ctx.translate(center.x, center.y+progress*center.scale*5)
  ctx.rotate((index&1 ? -1 : 1)*progress*.5)
  ctx.translate(-center.x, -center.y)
  if(obstacle[8]!==18)drawSolid(ctx, { ...bounds, height:1.1 }, camera, stage, width, height,
    [progress>.55 ? INK : RAINBOW[5], STEEL, COBALT])
  if(obstacle[8]===18)for(let i=0;i<6;i++) {
    const a=i*Math.PI/3,r=bounds.width*center.scale*.48
    const x=center.x+Math.cos(a+.3)*r*progress*.4,y=center.y+Math.sin(a+.3)*r*progress*.2
    jewel(ctx,[[x,y],[x+Math.cos(a)*r,y+Math.sin(a)*r*.4],[x+Math.cos(a+.9)*r,y+Math.sin(a+.9)*r*.4]],RAINBOW[i])
  }
  for (const x of [-.34,.34]) for (const z of [-.28,.28]) {
    const bolt = project(camera, bounds.x+bounds.width*x, elevation+1.2,
      bounds.z+bounds.depth*z, width, height)
    ring(ctx, WHITE, bolt.x, bolt.y, Math.max(1,bolt.scale*.5),1)
  }
  const crack = project(camera, bounds.x+bounds.width*.18, elevation+1.12,
    bounds.z-bounds.depth*.15, width, height)
  drawSpark(ctx, crack.x, crack.y, Math.max(1,crack.scale)*(1+progress*3), progress ? ORANGE : INK)
  groundQuad(ctx,progress?ORANGE:WHITE,camera,stage,bounds.x-bounds.width*.4,bounds.x+bounds.width*(.4-.8*progress),bounds.z-bounds.depth*.35,bounds.z-bounds.depth*.3,width,height,1.15)
  ctx.restore()
}

function drawSpring(ctx,obstacle,run,camera,stage,width,height) {
  const b=obstacleBounds(obstacle,run.time,stage)
  drawSolid(ctx,{...b,height:.8},camera,stage,width,height,[INK,RAINBOW[5],COBALT])
  for(let i=0;i<7;i++)groundQuad(ctx,RAINBOW[i],camera,stage,
    b.x-b.width/2+i*b.width/7,b.x-b.width/2+(i+1)*b.width/7,
    b.z-b.depth*.4,b.z+b.depth*.4,width,height,.85)
  const p=project(camera,b.x,(renderRoadAt(stage,b.z)?.elevation??0)+1,b.z,width,height)
  const size=p.scale*2
  if(obstacle[8]===20)drawSpark(ctx,p.x,p.y,size*2,WHITE)
  for(let i=0;i<(obstacle[8]===20?3:2);i++)drawLine(ctx,WHITE,Math.max(1,p.scale*.5),[
    {x:p.x-size,y:p.y+i*size*.6},{x:p.x,y:p.y-size+i*size*.6},{x:p.x+size,y:p.y+i*size*.6}])
}

function drawFinish(ctx, obstacle, run, camera, stage, width, height) {
  const bounds = obstacleBounds(obstacle, run.time,stage)
  drawTelegraph(ctx, bounds, camera, stage, width, height, WHITE)
  drawFootprint(ctx, bounds, camera, stage, width, height, .45)
  const elevation = renderRoadAt(stage,bounds.z)?.elevation ?? stageElevation(stage,bounds.z)
  const pillarWidth = bounds.width*.18
  for (const side of [-1,1]) {
    propBox(ctx, camera, bounds.x+side*(bounds.width/2-pillarWidth/2), elevation,
      bounds.z, pillarWidth, bounds.depth, bounds.height, THEME_MARKERS[4], WHITE, INK, width, height)
  }
  const z = bounds.z-bounds.depth/2-.02
  const inner = bounds.width/2-pillarWidth
  const center = project(camera, bounds.x, elevation+bounds.height*.48, z, width, height)
  const left = project(camera, bounds.x-inner, elevation, z, width, height)
  const radius = Math.max(2, Math.abs(center.x-left.x))
  ctx.globalAlpha = .75+.2*Math.sin(run.time*8)
  for (const [i,color] of RAINBOW.entries()) {
    const scale=1-i*.1
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(1, radius*.105)
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius*scale, Math.PI, Math.PI*2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  polygon(ctx, WHITE, [[center.x-radius*.48,center.y],[center.x+radius*.48,center.y],
    [center.x+radius*.36,center.y+radius*.9],[center.x-radius*.36,center.y+radius*.9]], .5)
  worldQuad(ctx, YELLOW, camera, [
    [bounds.x-bounds.width/2,elevation+bounds.height-3,z],
    [bounds.x+bounds.width/2,elevation+bounds.height-3,z],
    [bounds.x+bounds.width/2,elevation+bounds.height,z],
    [bounds.x-bounds.width/2,elevation+bounds.height,z]
  ], width, height)
}

export const obstacleOpacity=distance=>.22+.78*clamp((distance+5)/23,0,1)

export function drawObstacle(ctx, item, run, camera, stage, width, height) {
  const { obstacle, index } = item
  // Keep the complete silhouette. Ease opacity over distance instead of slicing
  // its top or deleting it on the exact frame the player passes the collider.
  ctx.save()
  if([FIRE,HURDLE,PISTON].includes(obstacle[0]))
    ctx.globalAlpha=obstacleOpacity(obstacle[1]-run.z)
  if (obstacle[0] === FIRE) drawFlame(ctx, obstacle, run, camera, stage, width, height)
  else if (obstacle[0] === GAP) drawGap(ctx, obstacle, run, camera, stage, width, height)
  else if (obstacle[0] === SPRING) drawSpring(ctx,obstacle,run,camera,stage,width,height)
  else if (obstacle[0] === BRIDGE) drawBridge(ctx, obstacle, index, run, camera, stage, width, height)
  else if (obstacle[0] === FINISH) drawFinish(ctx, obstacle, run, camera, stage, width, height)
  else if (obstacle[0] === HURDLE) drawHurdle(ctx, obstacle, run, camera, stage, width, height)
  else if (obstacle[0] === PISTON) drawPiston(ctx, obstacle, run, camera, stage, width, height)
  ctx.restore()
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
  drawSpark(ctx, player.x+direction*size*2, player.y-player.scale*3.2, size*.55, RUNE)
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
  ctx.fillStyle = WHITE
  ctx.fillText(value, x+offset, y+offset)
  ctx.fillStyle = INK
  ctx.fillText(value, x, y)
}

function fitHudText(ctx, value, maxWidth, size) {
  const minSize = Math.max(8,Math.floor(size*.75))
  const widthAt = (text,fontSize) => {
    ctx.font = `700 ${Math.round(fontSize)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
    return ctx.measureText ? ctx.measureText(text).width : Array.from(text).length*fontSize*.6
  }
  for (let fontSize=size;fontSize>=minSize;fontSize--) {
    if (widthAt(value,fontSize)<=maxWidth)return [value,fontSize]
  }
  let fitted=value
  while(fitted && widthAt(`${fitted}…`,minSize)>maxWidth)fitted=fitted.slice(0,-1)
  return [fitted ? `${fitted}…` : '',minSize]
}

function drawHud(ctx, run, stage, width, height) {
  const margin = clamp(Math.min(width,height)*.035, 8, 12)
  const hudSize = clamp(Math.min(width,height)*.043, 10, 18)
  const top = margin+hudSize/2
  const remaining=Math.max(0,stage.timeLimit-run.time)
  const time=`${Math.ceil(remaining)}s LEFT`
  ctx.font = `700 ${Math.round(hudSize)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
  const timeWidth=ctx.measureText ? ctx.measureText(time).width : time.length*hudSize*.6
  const [stageName,stageSize]=fitHudText(ctx,stage.name,Math.max(0,width-margin*2-timeWidth-hudSize*.5),hudSize)
  shadowText(ctx, stageName, margin, top, stageSize, 'left')
  shadowText(ctx, time, width-margin, top, hudSize, 'right')

  const barY=top+hudSize*2,barWidth=width-margin*2
  ctx.fillStyle=INK;ctx.fillRect(margin,barY,barWidth,5)
  ctx.fillStyle=remaining<=10?ORANGE:COBALT
  ctx.fillRect(margin+1,barY+1,(barWidth-2)*clamp(remaining/stage.timeLimit,0,1),3)

  let main = ''
  let sub = ''
  if (run.mode === 'title') {main = 'CRIMSON FURNACE';sub=`FINISH IN ${stage.timeLimit}s`}
  else if (run.mode === 'countdown') main = run.countdown <= .5 ? 'GO' : String(Math.ceil(run.countdown))
  else if (run.mode === 'success') {
    main = stage.id===7?'ALL 7 CLEAR':'CLEAR'
    sub = stage.id===7?'SPACE TO REPLAY':'SPACE: NEXT STAGE'
  } else if (run.mode === 'failure') {
    main = { TIME:'TIME UP', LAVA:'FELL', FIRE:'BURNED' }[run.failReason] || 'FELL'
    sub = 'SPACE TO RUN AGAIN'
  }

  if (main) {
    const byWidth = (width-margin*2)/Math.max(main.length*.62,1)
    const mainSize = clamp(Math.min(byWidth,height*.13), 12, 44)
    const mainY = Math.max(barY+8+mainSize*.55, height*.24)
    shadowText(ctx, main, width/2, mainY, mainSize)
    if (sub) {
      const subSize = clamp((width-margin*2)/(Math.max(sub.length,stage.hint?.length||0)*.62), 9, 18)
      shadowText(ctx, sub, width/2, mainY+mainSize*.72+subSize*.55, subSize)
      if(run.mode==='title'&&stage.hint)shadowText(ctx,stage.hint,width/2,mainY+mainSize*.72+subSize*1.85,subSize)
    }
  }
}

export function render(ctx, run, camera, stage, width, height) {
  ctx.fillStyle = (stage.visual ?? MAP_SETTINGS.visual).sky
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
  for (const item of visible) {
    drawObstacle(ctx,item,run,camera,stage,width,height)
  }
  drawLandingSparks(ctx, run, player)
  const stumbleOffset = run.stumble > 0 ? -Math.sign(run.vx||1)*run.stumble*8 : 0
  drawRunner(ctx, run, player.x+stumbleOffset, player.y,
    runnerScale(width,height)*player.scale*RUNNER_WORLD_TO_ART)
  drawStumbleImpact(ctx, run, player)
  if(run.shock>0) {
    const flash=(Math.floor(run.shock*24)%2)?YELLOW:WHITE
    const size=player.scale*3
    for(let i=0;i<3;i++)drawSpark(ctx,player.x+(i-1)*size,player.y-size*(1+i%2),size*.5,flash)
    shadowText(ctx,'ZAP!',player.x,player.y-size*3,Math.max(10,size))
  }
  if(run.spring>0)shadowText(ctx,'BOING!',player.x,player.y-player.scale*8,12)
  drawHud(ctx, run, stage, width, height)
}
