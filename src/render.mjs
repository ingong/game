import { clamp, projectPoint } from './math.mjs'
import { drawRunner, runnerScale } from './art.mjs'
import { FIRE, GAP, BRIDGE, FINISH, roadAt } from './stage.mjs'

const INK = '#31051b'
const ROAD = '#790b24'
const SKY = '#d51d24'
const ORANGE = '#ff641e'
const YELLOW = '#ffd34d'
const COBALT = '#0877d1'
const NAVY = '#071f70'
const WHITE = '#fff'
const NEAR = 1
const FAR = 440

function polygon(ctx, color, points) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1])
  ctx.closePath()
  ctx.fill()
}

function roadPoint(camera, stage, x, z, width, height) {
  const road = roadAt(stage, z)
  return road ? projectPoint(camera, x, road.elevation, z, width, height) : null
}

function projectedQuad(ctx, color, camera, stage, x0, x1, z0, z1, width, height) {
  const farLeft = roadPoint(camera, stage, x0, z1, width, height)
  const farRight = roadPoint(camera, stage, x1, z1, width, height)
  const nearRight = roadPoint(camera, stage, x1, z0, width, height)
  const nearLeft = roadPoint(camera, stage, x0, z0, width, height)
  if (!farLeft || !farRight || !nearRight || !nearLeft) return
  polygon(ctx, color, [
    [farLeft.x, farLeft.y], [farRight.x, farRight.y],
    [nearRight.x, nearRight.y], [nearLeft.x, nearLeft.y]
  ])
}

function drawLava(ctx, run, camera, stage, width, height) {
  const farZ = Math.min(stage.length, camera.z + FAR)
  const horizon = roadPoint(camera, stage, 0, Math.max(0, farZ), width, height)?.y ?? height * camera.horizon
  ctx.fillStyle = ORANGE
  ctx.fillRect(0, horizon, width, height - horizon)

  const bandHeight = Math.max(2, height * .009)
  for (let i = 0; i < 9; i++) {
    const y = horizon + (height - horizon) * (i + 1) / 10
    const offset = Math.sin(run.z * .035 + i * 1.7) * width * .025
    const color = i % 3 === 1 ? INK : YELLOW
    polygon(ctx, color, [
      [0, y], [width * .25 + offset, y - bandHeight],
      [width * .6 + offset, y + bandHeight], [width, y - bandHeight],
      [width, y + bandHeight * 1.5], [width * .58 + offset, y + bandHeight * 2.5],
      [width * .22 + offset, y + bandHeight], [0, y + bandHeight * 2]
    ])
  }
}

function drawRoad(ctx, camera, stage, width, height) {
  const firstZ = Math.max(0, camera.z + NEAR)
  for (let farZ = Math.min(stage.length, camera.z + FAR); farZ > firstZ; farZ -= 10) {
    const nearZ = Math.max(firstZ, farZ - 10)
    const farRoad = roadAt(stage, farZ)
    const nearRoad = roadAt(stage, nearZ)
    if (!farRoad || !nearRoad) continue
    const farLeft = projectPoint(camera, -farRoad.width / 2, farRoad.elevation, farZ, width, height)
    const farRight = projectPoint(camera, farRoad.width / 2, farRoad.elevation, farZ, width, height)
    const nearLeft = projectPoint(camera, -nearRoad.width / 2, nearRoad.elevation, nearZ, width, height)
    const nearRight = projectPoint(camera, nearRoad.width / 2, nearRoad.elevation, nearZ, width, height)
    polygon(ctx, ROAD, [[farLeft.x, farLeft.y], [farRight.x, farRight.y], [nearRight.x, nearRight.y], [nearLeft.x, nearLeft.y]])

    const edge = Math.max(1, (nearRight.x - nearLeft.x) * .018)
    polygon(ctx, INK, [[farLeft.x, farLeft.y], [farLeft.x + edge, farLeft.y], [nearLeft.x + edge, nearLeft.y], [nearLeft.x, nearLeft.y]])
    polygon(ctx, INK, [[farRight.x - edge, farRight.y], [farRight.x, farRight.y], [nearRight.x, nearRight.y], [nearRight.x - edge, nearRight.y]])

    if ((Math.floor(farZ / 40) & 1) === 0) {
      const farCenter = projectPoint(camera, 0, farRoad.elevation, farZ, width, height)
      const nearCenter = projectPoint(camera, 0, nearRoad.elevation, nearZ, width, height)
      const mark = Math.max(1, (nearRight.x - nearLeft.x) * .015)
      polygon(ctx, YELLOW, [[farCenter.x - mark, farCenter.y], [farCenter.x + mark, farCenter.y], [nearCenter.x + mark * 1.5, nearCenter.y], [nearCenter.x - mark * 1.5, nearCenter.y]])
    }
  }
}

function drawFlame(ctx, obstacle, camera, stage, width, height) {
  const [, z, x, span, , flameHeight] = obstacle
  const elevation = roadAt(stage, z)?.elevation ?? 0
  const base = projectPoint(camera, x, elevation, z, width, height)
  const left = projectPoint(camera, x - span / 2, elevation, z, width, height).x
  const right = projectPoint(camera, x + span / 2, elevation, z, width, height).x
  const barHeight = Math.max(6, Math.round(flameHeight * base.scale))
  const cell = Math.max(2, Math.round(base.scale * .7))
  const x0 = Math.round(left)
  const x1 = Math.round(right)
  const y = Math.round(base.y)
  const top = y - barHeight

  ctx.fillStyle = INK
  ctx.fillRect(x0, y, x1 - x0, cell)
  ctx.fillStyle = SKY
  ctx.fillRect(x0, top, x1 - x0, barHeight)
  ctx.fillRect(x0 + cell, top - cell * 2, cell * 2, cell * 2)
  ctx.fillRect(x1 - cell * 3, top - cell * 3, cell * 2, cell * 3)
  ctx.fillRect(Math.round((x0 + x1) / 2) - cell, top - cell * 4, cell * 2, cell * 4)
  ctx.fillStyle = ORANGE
  ctx.fillRect(x0 + cell, top + cell, Math.max(cell, x1 - x0 - cell * 2), barHeight - cell)
  ctx.fillRect(Math.round((x0 + x1) / 2) - cell, top - cell * 2, cell * 2, cell * 3)
  ctx.fillStyle = YELLOW
  ctx.fillRect(x0 + cell * 2, top + cell * 2, Math.max(cell, x1 - x0 - cell * 4), Math.max(cell, barHeight - cell * 2))
  ctx.fillRect(Math.round((x0 + x1) / 2), top - cell, cell, cell * 3)
}

function drawGap(ctx, obstacle, camera, stage, width, height) {
  const [, z, x, span, length] = obstacle
  const near = Math.max(camera.z + NEAR, z - length / 2)
  const far = Math.max(near + 1, z + length / 2)
  projectedQuad(ctx, ORANGE, camera, stage, x - span / 2, x + span / 2, near, far, width, height)

  const inset = span * .08
  projectedQuad(ctx, INK, camera, stage, x - span / 2 + inset, x + span / 2 - inset, near, far, width, height)
  const glowNear = near + (far - near) * .42
  const glowFar = near + (far - near) * .58
  projectedQuad(ctx, YELLOW, camera, stage, x - span * .3, x + span * .3, glowNear, glowFar, width, height)
}

function drawBridge(ctx, obstacle, index, run, camera, stage, width, height) {
  const [, z, x, span, depth, , delay] = obstacle
  const active = run.collapse.index === index
  const progress = active ? clamp(run.collapse.timer / delay, 0, 1) : 0
  const tileSpan = span * (1 - progress * .45)
  const halfDepth = depth / 2 * (1 - progress * .35)
  const near = Math.max(camera.z + NEAR, z - halfDepth)
  const far = Math.max(near + 1, z + halfDepth)
  const color = progress > .45 ? INK : progress > 0 ? ROAD : WHITE
  const edge = progress > .45 ? ROAD : COBALT

  projectedQuad(ctx, color, camera, stage, x - tileSpan / 2, x + tileSpan / 2, near, far, width, height)
  projectedQuad(ctx, edge, camera, stage, x - tileSpan / 2, x + tileSpan / 2, near, near + (far - near) * .12, width, height)
  projectedQuad(ctx, edge, camera, stage, x - tileSpan * .035, x + tileSpan * .035, near, far, width, height)

  const crackZ = (near + far) / 2
  const elevation = roadAt(stage, crackZ)?.elevation ?? 0
  const crack = projectPoint(camera, x + tileSpan * .2, elevation, crackZ, width, height)
  const pixel = Math.max(1, Math.round(crack.scale * .45))
  ctx.fillStyle = progress ? INK : ROAD
  ctx.fillRect(Math.round(crack.x), Math.round(crack.y), pixel * 3, pixel)
  ctx.fillRect(Math.round(crack.x) + pixel * 2, Math.round(crack.y) - pixel, pixel, pixel * 3)
}

function drawFinish(ctx, obstacle, camera, stage, width, height) {
  const [, z, x, span] = obstacle
  const elevation = roadAt(stage, z)?.elevation ?? 0
  const ground = projectPoint(camera, x, elevation, z, width, height)
  const left = projectPoint(camera, x - span / 2, elevation, z, width, height).x
  const right = projectPoint(camera, x + span / 2, elevation, z, width, height).x
  const column = Math.max(3, ground.scale * 2)
  const archHeight = Math.max(18, ground.scale * 15)
  const top = ground.y - archHeight

  ctx.fillStyle = WHITE
  ctx.fillRect(left - column / 2, top, column, archHeight)
  ctx.fillRect(right - column / 2, top, column, archHeight)
  ctx.fillRect(left - column / 2, top, right - left + column, column * 2.2)

  const checks = 10
  const cell = (right - left + column) / checks
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < checks; i++) {
      ctx.fillStyle = (i + row) % 2 ? INK : WHITE
      ctx.fillRect(left - column / 2 + i * cell, top + row * column, cell + 1, column)
    }
  }
}

function drawObstacle(ctx, item, run, camera, stage, width, height) {
  const { obstacle, index } = item
  if (obstacle[0] === FIRE) drawFlame(ctx, obstacle, camera, stage, width, height)
  else if (obstacle[0] === GAP) drawGap(ctx, obstacle, camera, stage, width, height)
  else if (obstacle[0] === BRIDGE) drawBridge(ctx, obstacle, index, run, camera, stage, width, height)
  else if (obstacle[0] === FINISH) drawFinish(ctx, obstacle, camera, stage, width, height)
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function shadowText(ctx, value, x, y, size, align = 'center') {
  ctx.font = `700 ${Math.round(size)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillStyle = NAVY
  ctx.fillText(value, x + Math.max(2, size * .08), y + Math.max(2, size * .08))
  ctx.fillStyle = WHITE
  ctx.fillText(value, x, y)
}

function drawHud(ctx, run, width, height) {
  const margin = Math.max(12, Math.min(width, height) * .035)
  const hudSize = clamp(Math.min(width, height) * .045, 14, 26)
  shadowText(ctx, 'RED 1', margin, margin + hudSize / 2, hudSize, 'left')
  shadowText(ctx, formatTime(run.time), width - margin, margin + hudSize / 2, hudSize, 'right')

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
    const mainSize = clamp(Math.min(width / Math.max(main.length * .66, 5), height * .13), 24, 64)
    shadowText(ctx, main, width / 2, height * .24, mainSize)
  }
  if (sub) shadowText(ctx, sub, width / 2, height * .34, clamp(width * .035, 14, 28))
}

export function render(ctx, run, camera, stage, width, height) {
  ctx.fillStyle = SKY
  ctx.fillRect(0, 0, width, height)
  drawLava(ctx, run, camera, stage, width, height)
  drawRoad(ctx, camera, stage, width, height)

  const visible = stage.obstacles
    .map((obstacle, index) => ({ obstacle, index, depth:obstacle[1] - camera.z }))
    .filter(item => item.depth > 0 && item.depth <= FAR)
    .sort((a, b) => b.depth - a.depth)

  const elevation = roadAt(stage, run.z)?.elevation ?? 0
  const player = projectPoint(camera, run.x, elevation + run.y, run.z, width, height)
  for (const item of visible) if (item.depth >= player.depth) drawObstacle(ctx, item, run, camera, stage, width, height)
  drawRunner(ctx, run, player.x, player.y, runnerScale(width, height) * player.scale)
  for (const item of visible) if (item.depth < player.depth) drawObstacle(ctx, item, run, camera, stage, width, height)
  drawHud(ctx, run, width, height)
}
