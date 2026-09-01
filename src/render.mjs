import { clamp, projectPoint, roadEdges } from './math.mjs'

const INK = '#31051b'
const ROAD = '#790b24'
const SKY = '#d51d24'
const ORANGE = '#ff641e'
const YELLOW = '#ffd34d'
const COBALT = '#0877d1'
const NAVY = '#071f70'
const WHITE = '#fff'
const RAINBOW = [SKY, ORANGE, YELLOW, WHITE, COBALT, NAVY]

const NEAR = 34
const FAR = 440
const PLAYER_DEPTH = 40
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
  const barHeight = Math.max(5, flameHeight * base.scale)
  const top = base.y - barHeight

  ctx.fillStyle = INK
  ctx.fillRect(left, base.y, right - left, Math.max(2, base.scale * 1.2))
  ctx.fillStyle = ORANGE
  ctx.fillRect(left, top, right - left, barHeight)
  ctx.fillStyle = YELLOW
  ctx.fillRect(left, top, right - left, Math.max(2, barHeight * .35))

  const tipWidth = (right - left) / 3
  for (let i = 0; i < 3; i++) {
    const x0 = left + tipWidth * i
    polygon(ctx, i === 1 ? YELLOW : ORANGE, [
      [x0, top], [x0 + tipWidth * .48, top - barHeight * (i === 1 ? .9 : .6)], [x0 + tipWidth, top]
    ])
  }
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

  projectedQuad(ctx, color, x - tileSpan / 2, x + tileSpan / 2, near, far, width, height)
  projectedQuad(ctx, COBALT, x - tileSpan * .06, x + tileSpan * .06, near, far, width, height)
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

  const checks = 8
  const cell = (right - left + column) / checks
  for (let i = 0; i < checks; i++) {
    ctx.fillStyle = i % 2 ? INK : YELLOW
    ctx.fillRect(left - column / 2 + i * cell, top, cell, column * 1.1)
  }
}

function drawObstacle(ctx, item, run, width, height) {
  const { obstacle, index, distance } = item
  if (obstacle[0] === 0) drawFlame(ctx, obstacle, distance, width, height)
  else if (obstacle[0] === 1) drawGap(ctx, obstacle, distance, width, height)
  else if (obstacle[0] === 2) drawBridge(ctx, obstacle, index, distance, run, width, height)
  else drawFinish(ctx, obstacle, distance, width, height)
}

function drawLimb(ctx, color, x, y, width, length, angle) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.fillStyle = color
  ctx.fillRect(-width / 2, 0, width, length)
  ctx.restore()
}

function drawRunner(ctx, run, width, height) {
  const point = projectPoint(run.x, run.y, PLAYER_DEPTH, width, height)
  const size = Math.min(height * .22, width * .18, 112)
  const footY = clamp(point.y, height * .58, height * .95)
  const stride = run.grounded ? Math.sin(run.anim) * 8 : 0
  const counter = run.grounded ? Math.cos(run.anim) * 7 : 0

  ctx.save()
  ctx.translate(point.x, footY)
  ctx.scale(size / 100, size / 100)

  for (let i = 0; i < RAINBOW.length; i++) {
    const y = -54 + i * 2.8
    polygon(ctx, RAINBOW[i], [[-24, y], [-42 - i * 1.2, y + 8], [-23, y + 4]])
  }

  if (run.grounded) {
    drawLimb(ctx, NAVY, -11, -35, 13, 31 + stride, -.08 - counter * .01)
    drawLimb(ctx, WHITE, 11, -35, 13, 31 - stride, .08 + counter * .01)
  } else {
    drawLimb(ctx, NAVY, -12, -37, 13, 23, -.58)
    drawLimb(ctx, WHITE, 12, -37, 13, 23, .58)
    drawLimb(ctx, WHITE, -22, -20, 11, 18, .75)
    drawLimb(ctx, WHITE, 22, -20, 11, 18, -.75)
  }

  polygon(ctx, COBALT, [[-22, -46], [22, -46], [18, -29], [-18, -29]])
  ctx.fillStyle = NAVY
  ctx.fillRect(-22, -43, 8, 13)

  drawLimb(ctx, NAVY, -23, -72, 15, 37, -.18 + counter * .012)
  drawLimb(ctx, WHITE, 23, -72, 15, 37, .18 - counter * .012)
  ctx.fillStyle = WHITE
  ctx.fillRect(-25, -78, 50, 36)
  polygon(ctx, NAVY, [[-25, -78], [-8, -78], [-12, -42], [-25, -42]])
  polygon(ctx, WHITE, [[-28, -75], [-18, -84], [18, -84], [29, -74], [24, -61], [-24, -61]])

  polygon(ctx, NAVY, [[-7, -87], [12, -91], [26, -84], [24, -69], [4, -66], [-10, -75]])
  polygon(ctx, WHITE, [[-11, -91], [8, -100], [24, -94], [31, -84], [21, -72], [-4, -74], [-15, -83]])
  polygon(ctx, WHITE, [[18, -94], [36, -89], [28, -81], [18, -82]])
  polygon(ctx, NAVY, [[13, -98], [24, -103], [21, -93]])
  polygon(ctx, YELLOW, [[2, -99], [10, -116], [14, -97]])
  ctx.fillStyle = NAVY
  ctx.fillRect(23, -89, 4, 4)

  for (let i = 0; i < RAINBOW.length; i++) {
    ctx.fillStyle = RAINBOW[i]
    ctx.fillRect(-14 - (i % 2) * 2, -96 + i * 3.1, 7, 4)
  }
  ctx.restore()
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
  drawRunner(ctx, run, width, height)
  for (const item of visible) if (item.distance < FOREGROUND) drawObstacle(ctx, item, run, width, height)
  drawHud(ctx, run, width, height)
}
