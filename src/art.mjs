export const RUNNER_PALETTE = ['#24131b','#fff7e8','#e8e1d3','#f4b7c8','#e63f35','#8f151f','#ffcf42','#5a301f','#151018']
const A = Math.PI / 12

export const RUNNER_POSES = [
  [0,-2,1,2,-1,2,-1,-2,1,0],
  [0,-1,0,1,0,1,0,-1,0,1],
  [1,1,-1,-1,1,-1,2,1,-2,0],
  [0,2,-1,-2,1,-2,1,2,-1,-1],
  [0,1,0,-1,0,-1,0,1,0,0],
  [-1,-1,1,1,-1,1,-2,-1,2,1],
  [-1,-2,-1,2,1,-1,-2,1,-2,-2],
  [1,2,2,-2,-2,2,-1,-2,1,-3],
  [3,-3,2,-1,1,-3,1,-2,0,2],
  [0,1,1,-1,-1,1,1,-1,-1,3]
]

// Rectangles are [x, y, width, height, palette index] in a tiny model grid.
const TORSO = [
  [-8,-12,16,2,0],[-11,-10,22,4,0],[-9,-6,18,4,0],[-7,-2,14,4,0],[-5,2,10,2,0],
  [-7,-11,14,2,1],[-10,-9,20,3,1],[-8,-6,16,4,1],[-6,-2,12,4,1],[-4,2,8,1,1],
  [-7,-8,3,4,2],[5,-8,3,4,2],[-2,-6,4,6,2],[-5,0,3,2,2],[2,0,3,2,2]
]
const SHORTS = [
  [-8,3,16,6,0],[-7,3,14,5,4],[-6,3,12,1,1],[-6,7,5,3,5],[1,7,5,3,5],[-1,4,2,5,5]
]
const HEAD = [
  [-4,-7,9,10,0],[-4,-10,3,4,0],[2,-10,3,4,0],
  [-3,-6,7,8,1],[-3,-9,1,3,1],[3,-9,1,3,1],[-2,0,6,3,2],[-3,-4,2,4,2]
]
const MUZZLE = [
  [-1,-1,6,7,0],[0,0,4,5,1],[1,4,4,2,2],[3,4,1,1,7]
]
const HORN = [
  [-1,-9,3,10,0],[0,-8,1,8,6],[1,-6,1,5,6],[0,-5,2,1,1]
]
const MANE = [
  [-5,-4,6,15,0],[-7,0,4,13,0],[-4,-3,4,4,3],[-5,1,4,4,3],[-6,5,4,4,3],[-6,9,3,3,3],[-5,11,2,2,5]
]
const TAIL = [
  [-2,0,5,4,0],[-4,2,7,5,0],[-7,5,9,5,0],[-9,9,9,5,0],[-10,13,7,4,0],
  [-1,1,3,3,3],[-3,3,5,3,3],[-6,6,7,3,3],[-8,10,7,3,3],[-9,14,5,2,3],[-8,15,3,1,5]
]
const UPPER_ARM = [
  [-4,0,8,7,0],[-3,0,6,6,1],[-3,4,3,2,2],[-4,1,1,3,7]
]
const FOREARM = [
  [-3,0,7,7,0],[-2,0,5,6,1],[-2,1,2,3,2],[2,3,1,2,7]
]
const FIST = [
  [-3,-1,6,5,0],[-2,0,4,3,1],[-1,0,1,2,2]
]
const THIGH = [
  [-4,0,9,8,0],[-3,0,7,7,1],[-3,4,3,3,2],[3,1,1,3,7]
]
const SHIN = [
  [-3,0,6,7,0],[-2,0,4,6,1],[-2,3,2,3,2]
]
const BOOT = [
  [-3,-1,7,5,0],[-2,0,5,3,8],[-3,2,6,2,8],[1,0,2,1,2]
]
const TORSO_ACCENTS = [
  [-1,-10,2,7,2],[-7,-6,5,1,7],[2,-6,5,1,7],[-5,-2,4,1,2],[1,-2,4,1,2],[-1,0,2,3,7]
]
const EYES = [
  [0,-3,2,2,0],[3,-3,2,2,0],[0,-3,1,1,1],[3,-3,1,1,1]
]

function paint(ctx, piece, back = false) {
  for (const [x,y,w,h,color] of piece) {
    ctx.fillStyle = RUNNER_PALETTE[back && color === 1 ? 2 : color]
    ctx.fillRect(x,y,w,h)
  }
}

function at(ctx, x, y, angle, piece, back = false) {
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))
  ctx.rotate(angle)
  paint(ctx, piece, back)
  ctx.restore()
}

function arm(ctx, x, upper, lower, back) {
  ctx.save()
  ctx.translate(Math.round(x), -9)
  ctx.rotate(upper * A)
  paint(ctx, UPPER_ARM, back)
  ctx.translate(0, 6)
  ctx.rotate(lower * A)
  paint(ctx, FOREARM, back)
  ctx.translate(0, 6)
  paint(ctx, FIST, back)
  ctx.restore()
}

function leg(ctx, x, upper, lower, back) {
  ctx.save()
  ctx.translate(Math.round(x), 8)
  ctx.rotate(upper * A)
  paint(ctx, THIGH, back)
  ctx.translate(0, 7)
  ctx.rotate(lower * A)
  paint(ctx, SHIN, back)
  ctx.translate(0, 6)
  paint(ctx, BOOT, back)
  ctx.restore()
}

export function runnerPose(run) {
  if (run.stumble > 0) return 8
  if (run.landing > .45) return 9
  if (!run.grounded) return run.jumps === 2 ? 7 : 6
  return Math.floor(run.anim * 6) % 6
}

export function runnerScale(width, height) {
  return Math.max(.8, Math.min(1.25, Math.min(width / 1280, height / 720)))
}

export function drawGear(ctx, x, y, radius, phase, color, core = '#31051b') {
  const tooth = Math.max(1, radius * .28)
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))
  ctx.rotate(phase)
  ctx.fillStyle = color
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4)
    ctx.fillRect(-tooth / 2, -radius - tooth, tooth, tooth * 1.8)
  }
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(0, 0, radius * .42, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawLamp(ctx, x, y, size, lit, color = '#ffd34d') {
  const s = Math.max(1, size)
  ctx.fillStyle = '#31051b'
  ctx.fillRect(Math.round(x - s), Math.round(y - s * 1.4), Math.round(s * 2), Math.round(s * 2.2))
  ctx.fillStyle = lit ? color : '#790b24'
  ctx.fillRect(Math.round(x - s * .55), Math.round(y - s), Math.max(1, Math.round(s * 1.1)), Math.max(1, Math.round(s)))
  if (lit) {
    ctx.globalAlpha = .3
    ctx.beginPath()
    ctx.arc(Math.round(x), Math.round(y - s * .5), s * 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

export function drawSpark(ctx, x, y, size, color = '#ffd34d') {
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, size * .18)
  ctx.beginPath()
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + Math.PI / 4
    ctx.moveTo(x + Math.cos(angle) * size * .3, y + Math.sin(angle) * size * .3)
    ctx.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size)
  }
  ctx.stroke()
}

export function drawRunner(ctx, run, x, y, scale) {
  const poseIndex = runnerPose(run)
  const [lean,lua,lfa,rua,rfa,lt,ls,rt,rs,bob] = RUNNER_POSES[poseIndex]

  ctx.imageSmoothingEnabled = false
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))
  ctx.scale(scale, scale)
  if (run.landing > 0) ctx.scale(1 + .12 * run.landing, 1 - .12 * run.landing)
  ctx.translate(0, Math.round(-23 + bob))
  ctx.rotate(lean * A)

  arm(ctx, 8, rua, rfa, true)
  leg(ctx, 3, rt, rs, true)
  at(ctx, -4, 3, .65 - lean * A / 3, TAIL, true)

  paint(ctx, TORSO)
  paint(ctx, SHORTS)

  leg(ctx, -3, lt, ls, false)
  arm(ctx, -8, lua, lfa, false)

  at(ctx, 2, -17, -lean * A / 4, HEAD)
  at(ctx, 5, -14, -lean * A / 4, MUZZLE)
  at(ctx, -2, -19, -lean * A / 4, MANE)
  at(ctx, 3, -24, A, HORN)

  paint(ctx, TORSO_ACCENTS)
  at(ctx, 2, -17, -lean * A / 4, EYES)
  ctx.restore()
}
