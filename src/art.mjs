export const RUNNER_PALETTE = ['#1b1844','#fff4dd','#b9c8ea','#0e58d6','#07348f','#f04432','#ff7a1a','#ffd43b','#4ecb55','#24b8ea','#7b42d6']
const A = Math.PI / 14

export const RUNNER_POSES = [
  [0,2,-1,-2,1,3,-2,-2,1,0],
  [-1,1,-1,-1,1,2,-1,-1,1,-1],
  [-1,0,1,0,-1,0,1,0,-1,0],
  [0,-2,1,2,-1,-2,1,3,-2,1],
  [1,-1,1,1,-1,-1,1,2,-1,0],
  [1,0,-1,0,1,0,-1,0,1,-1],
  [-1,3,-2,-3,2,2,2,-2,-2,-2],
  [0,4,-2,-4,2,3,-3,-3,3,-4],
  [3,3,-2,-1,0,2,-2,-1,2,2],
  [0,1,-1,-1,1,3,-3,-3,3,4]
]

// Rectangles are [x, y, width, height, palette index] in a tiny model grid.
const TORSO = [
  [-12,-14,24,2,0],[-16,-12,32,3,0],[-18,-9,36,4,0],[-16,-5,32,4,0],[-13,-1,26,4,0],[-10,3,20,5,0],
  [-11,-13,22,2,1],[-15,-11,30,3,1],[-16,-8,32,3,1],[-14,-4,28,3,1],[-11,0,22,3,1],[-8,4,16,3,1],
  [-12,-8,4,4,2],[8,-8,4,4,2],[-2,-10,4,10,2],[-9,-3,5,3,2],[4,-3,5,3,2]
]
const SHORTS = [
  [-10,6,20,8,0],[-9,6,18,7,3],[-8,6,16,2,9],[-8,10,7,5,4],[1,10,7,5,4],[-1,8,2,6,4]
]
const HEAD = [
  [-11,-18,4,3,0],[7,-18,4,3,0],[-12,-16,6,9,0],[6,-16,6,9,0],
  [-5,-14,10,2,0],[-8,-12,16,2,0],[-10,-10,20,8,0],[-9,-2,18,6,0],[-7,4,14,6,0],
  [-10,-17,2,2,1],[8,-17,2,2,1],[-11,-15,3,7,1],[8,-15,3,7,1],
  [-4,-13,8,2,1],[-7,-11,14,2,1],[-9,-9,18,7,1],[-8,-2,16,5,1],[-6,3,12,5,1],
  [-8,-7,3,6,2],[5,-7,3,6,2],[-6,0,3,4,2],[3,0,3,4,2],[-3,5,6,3,1]
]
const NECK = [[-7,-9,14,12,0],[-6,-8,12,11,1],[-5,-7,4,9,2],[1,-7,4,9,1],[-1,-5,2,8,2]]
const HORN = [
  [-2,-13,4,14,0],[-1,-12,2,12,7],[0,-11,1,4,1],[0,-6,1,3,6]
]
const MANE = [
  [-8,0,14,5,0],[-11,4,16,5,0],[-14,8,17,5,0],[-16,12,17,5,0],[-17,16,16,5,0],[-16,20,14,6,0],
  [-14,1,20,4,5],[-15,5,20,4,6],[-13,9,15,4,7],[-15,13,15,4,8],[-16,17,14,4,9],[-15,21,12,4,10]
]
const TAIL = [
  [-11,0,15,5,0],[-14,3,18,5,0],[-15,6,19,5,0],[-19,9,22,5,0],[-22,12,23,5,0],[-23,15,20,6,0],
  [-10,1,13,4,5],[-13,4,16,4,6],[-14,7,17,4,7],[-18,10,20,4,8],[-21,13,21,4,9],[-22,16,17,4,10]
]
const UPPER_ARM = [
  [-3,0,6,8,0],[-2,0,4,7,1],[-2,4,2,3,2],[1,1,1,4,2]
]
const FOREARM = [
  [-3,0,6,6,0],[-2,0,4,5,1],[-2,2,2,3,2],[1,1,1,3,2]
]
const FIST = [
  [-3,-1,6,5,0],[-2,0,4,3,1],[-1,0,1,2,2]
]
const THIGH = [
  [-4,0,8,7,0],[-3,0,6,6,1],[-3,3,3,3,2],[2,1,1,4,2]
]
const SHIN = [
  [-3,0,6,5,0],[-2,0,4,4,1],[-2,2,2,2,2]
]
const BOOT = [
  [-5,-1,10,6,0],[-4,0,8,4,3],[-5,2,9,4,4],[-1,0,5,2,9]
]
const TORSO_ACCENTS = [
  [-1,-11,2,10,2],[-12,-8,8,2,2],[4,-8,8,2,2],[-9,-4,7,2,2],[2,-4,7,2,2],[-7,0,5,2,2],[2,0,5,2,2],[-1,2,2,4,2]
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
  ctx.translate(0, 5)
  paint(ctx, FIST, back)
  ctx.restore()
}

function leg(ctx, x, upper, lower, back) {
  ctx.save()
  ctx.translate(Math.round(x), 13)
  ctx.rotate(upper * A)
  paint(ctx, THIGH, back)
  ctx.translate(0, 5)
  ctx.rotate(lower * A)
  paint(ctx, SHIN, back)
  ctx.translate(0, 4)
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
  ctx.translate(0, Math.round(-29 + bob))
  ctx.rotate(lean * A)

  arm(ctx, 16, rua, rfa, true)
  leg(ctx, 6, rt, rs, true)
  at(ctx, -1, -39, -.08-lean*A/5, MANE)

  paint(ctx, TORSO)
  paint(ctx, SHORTS)
  const tailLift = run.grounded ? 0 : run.jumps === 2 ? -.32 : -.18
  at(ctx, -5, 8, .08+tailLift-lean*A/5, TAIL, true)

  leg(ctx, -6, lt, ls, false)
  arm(ctx, -16, lua, lfa, false)

  at(ctx, 0, -18, -lean*A/5, NECK)
  at(ctx, 0, -28, -lean*A/5, HEAD)
  at(ctx, 0, -42, A/2, HORN)

  paint(ctx, TORSO_ACCENTS)
  ctx.restore()
}
