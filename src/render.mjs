import { clamp, projectPoint, roadEdges } from './math.mjs'
import { drawPixelRunner } from './art.mjs'

const INK = '#31051b'
const ROAD = '#790b24'
const SKY = '#d51d24'
const ORANGE = '#ff641e'
const YELLOW = '#ffd34d'
const COBALT = '#0877d1'
const NAVY = '#071f70'
const WHITE = '#fff'
const NEAR = 34
const FAR = 440
const FOREGROUND = 70

function polygon(ctx, color, points) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1])
  ctx.closePath()
  ctx.fill()
}

function projectedQuad(ctx, color, x0, x1, z0, z1, width, height) {
  const farLeft = projectPoint(x0, 0, z1, width, height)
  const farRight = projectPoint(x1, 0, z1, width, height)
  const nearRight = projectPoint(x1, 0, z0, width, height)
  const nearLeft = projectPoint(x0, 0, z0, width, height)
  polygon(ctx, color, [
    [farLeft.x, farLeft.y], [farRight.x, farRight.y],
    [nearRight.x, nearRight.y], [nearLeft.x, nearLeft.y]
  ])
}

function drawLava(ctx, run, width, height) {
  const horizon = roadEdges(FAR, width, height).y
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

function drawRoad(ctx, run, width, height) {
  for (let far = FAR; far > NEAR; far -= 10) {
    const near = Math.max(NEAR, far - 10)
    const a = roadEdges(far, width, height)
    const b = roadEdges(near, width, height)
    polygon(ctx, ROAD, [[a.left, a.y], [a.right, a.y], [b.right, b.y], [b.left, b.y]])

    const edge = Math.max(1, (b.right - b.left) * .018)
    polygon(ctx, INK, [[a.left, a.y], [a.left + edge, a.y], [b.left + edge, b.y], [b.left, b.y]])
    polygon(ctx, INK, [[a.right - edge, a.y], [a.right, a.y], [b.right, b.y], [b.right - edge, b.y]])

    if ((Math.floor((run.z + far) / 40) & 1) === 0) {
      const center = width / 2
      const mark = Math.max(1, (b.right - b.left) * .015)
      polygon(ctx, YELLOW, [[center - mark, a.y], [center + mark, a.y], [center + mark * 1.5, b.y], [center - mark * 1.5, b.y]])
    }
  }
}

function drawFlame(ctx, obstacle, distance, width, height) {
  const [, , x, span, flameHeight] = obstacle
  const base = projectPoint(x, 0, distance, width, height)
  const left = projectPoint(x - span / 2, 0, distance, width, height).x
  const right = projectPoint(x + span / 2, 0, distance, width, height).x
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

function drawGap(ctx, obstacle, distance, width, height) {
  const [, , x, span, length] = obstacle
  const near = Math.max(NEAR, distance)
  const far = Math.max(near + 1, distance + length)
  projectedQuad(ctx, ORANGE, x - span / 2, x + span / 2, near, far, width, height)

  const inset = span * .08
  projectedQuad(ctx, INK, x - span / 2 + inset, x + span / 2 - inset, near, far, width, height)
  const glowNear = near + (far - near) * .42
  const glowFar = near + (far - near) * .58
  projectedQuad(ctx, YELLOW, x - span * .3, x + span * .3, glowNear, glowFar, width, height)
}

function drawBridge(ctx, obstacle, index, distance, run, width, height) {
  const [, , x, span, delay] = obstacle
  const active = run.collapse.index === index
  const progress = active ? clamp(run.collapse.timer / delay, 0, 1) : 0
  const tileSpan = span * (1 - progress * .45)
  const halfDepth = span * .42 * (1 - progress * .35)
  const near = Math.max(NEAR, distance - halfDepth)
  const far = Math.max(near + 1, distance + halfDepth)
  const color = progress > .45 ? INK : progress > 0 ? ROAD : WHITE
  const edge = progress > .45 ? ROAD : COBALT

  projectedQuad(ctx, color, x - tileSpan / 2, x + tileSpan / 2, near, far, width, height)
  projectedQuad(ctx, edge, x - tileSpan / 2, x + tileSpan / 2, near, near + (far - near) * .12, width, height)
  projectedQuad(ctx, edge, x - tileSpan * .035, x + tileSpan * .035, near, far, width, height)

  const crack = projectPoint(x + tileSpan * .2, 0, (near + far) / 2, width, height)
  const pixel = Math.max(1, Math.round(crack.scale * .45))
  ctx.fillStyle = progress ? INK : ROAD
  ctx.fillRect(Math.round(crack.x), Math.round(crack.y), pixel * 3, pixel)
  ctx.fillRect(Math.round(crack.x) + pixel * 2, Math.round(crack.y) - pixel, pixel, pixel * 3)
}

function drawFinish(ctx, obstacle, distance, width, height) {
  const [, , x, span] = obstacle
  const ground = projectPoint(x, 0, distance, width, height)
  const left = projectPoint(x - span / 2, 0, distance, width, height).x
  const right = projectPoint(x + span / 2, 0, distance, width, height).x
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

function drawObstacle(ctx, item, run, width, height) {
  const { obstacle, index, distance } = item
  if (obstacle[0] === 0) drawFlame(ctx, obstacle, distance, width, height)
  else if (obstacle[0] === 1) drawGap(ctx, obstacle, distance, width, height)
  else if (obstacle[0] === 2) drawBridge(ctx, obstacle, index, distance, run, width, height)
  else drawFinish(ctx, obstacle, distance, width, height)
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

export function render(ctx, run, stage, width, height) {
  ctx.fillStyle = SKY
  ctx.fillRect(0, 0, width, height)
  drawLava(ctx, run, width, height)
  drawRoad(ctx, run, width, height)

  const visible = stage.obstacles
    .map((obstacle, index) => ({ obstacle, index, distance:obstacle[1] - run.z }))
    .filter(item => item.distance + (item.obstacle[0] === 1 ? item.obstacle[4] : item.obstacle[3]) >= NEAR && item.distance <= FAR)
    .sort((a, b) => b.distance - a.distance)

  for (const item of visible) if (item.distance >= FOREGROUND) drawObstacle(ctx, item, run, width, height)
  drawPixelRunner(ctx, run, width, height)
  for (const item of visible) if (item.distance < FOREGROUND) drawObstacle(ctx, item, run, width, height)
  drawHud(ctx, run, width, height)
}
