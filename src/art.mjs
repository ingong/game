import { clamp, projectPoint } from './math.mjs'

export const RUNNER_WIDTH = 32
export const RUNNER_HEIGHT = 48

const COLORS = [
  '#31051b', '#790b24', '#d51d24', '#ff641e', '#ffd34d',
  '#0877d1', '#071f70', '#fff', '#36b44a', '#7042c1'
]

const upper = (bob, mane, tail) => [
  // Rainbow tail, behind the hips.
  [2, 1, 28 + bob + tail, 9, 3], [3, 0, 31 + bob + tail, 10, 3],
  [4, 1, 34 + bob + tail, 9, 3], [8, 2, 37 + bob + tail, 8, 3],
  [5, 3, 40 + bob + tail, 7, 3], [9, 5, 42 + bob + tail, 5, 3],

  // Mane cascading behind the three-quarter head.
  [2, 9 + mane, 5 + bob, 8, 3], [3, 8 + mane, 8 + bob, 9, 3],
  [4, 8 + mane, 11 + bob, 9, 3], [8, 9 + mane, 14 + bob, 8, 3],
  [5, 10 + mane, 17 + bob, 7, 3], [9, 11 + mane, 20 + bob, 6, 3],

  // Horn, ear, head, muzzle, and facial shadow.
  [6, 21, 1 + bob, 3, 8], [3, 22, 2 + bob, 1, 5], [4, 23, 1 + bob, 1, 4],
  [6, 17, 5 + bob, 5, 7], [7, 18, 5 + bob, 3, 5],
  [6, 14, 7 + bob, 13, 11], [7, 16, 6 + bob, 10, 10],
  [7, 23, 11 + bob, 7, 6], [5, 24, 13 + bob, 5, 4],
  [6, 25, 11 + bob, 2, 2], [7, 27, 14 + bob, 3, 2],

  // Broad shoulders, tapered back, and separated arms.
  [6, 4, 16 + bob, 24, 16], [7, 6, 16 + bob, 20, 14],
  [7, 3, 19 + bob, 7, 11], [7, 24, 19 + bob, 7, 11],
  [5, 4, 25 + bob, 5, 6], [5, 25, 25 + bob, 5, 6],
  [6, 3, 29 + bob, 6, 3], [6, 25, 29 + bob, 6, 3],
  [5, 7, 18 + bob, 3, 10], [5, 22, 18 + bob, 3, 10],
  [7, 10, 17 + bob, 12, 12], [5, 10, 26 + bob, 4, 4],
  [5, 18, 26 + bob, 4, 4], [6, 15, 19 + bob, 2, 10],
  [7, 12, 19 + bob, 3, 4], [7, 17, 19 + bob, 3, 4],

  // Cobalt shorts and navy waistband/seat shadows.
  [6, 8, 28 + bob, 17, 3], [5, 8, 30 + bob, 17, 6],
  [6, 8, 34 + bob, 5, 3], [6, 20, 34 + bob, 5, 3],
  [6, 15, 31 + bob, 3, 5], [5, 12, 29 + bob, 9, 2]
]

const frame = (bob, mane, tail, limbs) => [...upper(bob, mane, tail), ...limbs]

export const RUNNER_FRAMES = [
  frame(0, 0, 0, [
    [6, 8, 35, 8, 13], [7, 9, 35, 6, 9], [5, 9, 41, 6, 3], [7, 10, 42, 5, 3],
    [6, 10, 45, 7, 3], [6, 19, 35, 7, 8], [7, 20, 35, 5, 6],
    [5, 22, 40, 5, 5], [6, 23, 44, 6, 3]
  ]),
  frame(1, -1, -1, [
    [6, 6, 36, 8, 9], [7, 7, 36, 6, 7], [5, 4, 41, 7, 5], [6, 3, 45, 8, 3],
    [6, 18, 36, 8, 12], [7, 19, 36, 6, 9], [5, 20, 43, 6, 3],
    [7, 21, 43, 5, 2], [6, 20, 46, 8, 2]
  ]),
  frame(0, 1, 0, [
    [6, 7, 35, 7, 8], [7, 8, 35, 5, 6], [5, 5, 40, 6, 5], [6, 4, 44, 7, 3],
    [6, 18, 35, 8, 13], [7, 19, 35, 6, 9], [5, 20, 41, 6, 3],
    [7, 20, 42, 5, 3], [6, 18, 45, 8, 3]
  ]),
  frame(-1, 0, 1, [
    [6, 8, 34, 8, 13], [7, 9, 34, 6, 9], [5, 10, 40, 6, 3],
    [7, 10, 41, 5, 3], [6, 8, 44, 8, 3], [6, 20, 34, 7, 8],
    [7, 21, 34, 5, 6], [5, 23, 39, 5, 5], [6, 23, 43, 7, 3]
  ]),
  frame(-1, -1, 0, [
    [6, 5, 34, 10, 8], [7, 6, 34, 8, 5], [5, 5, 39, 7, 4],
    [6, 3, 42, 9, 3], [6, 18, 34, 10, 8], [7, 19, 34, 8, 5],
    [5, 21, 39, 7, 4], [6, 22, 42, 9, 3]
  ])
]

export const runnerFrameIndex = run => run.grounded ? Math.floor(run.anim / 2) & 3 : 4

export const runnerScale = height => clamp(Math.floor(height / 220), 2, 5)

export function drawPixelRunner(ctx, run, width, height) {
  const scale = runnerScale(height)
  const point = projectPoint(run.x, run.y, 40, width, height)
  const footY = Math.round(clamp(point.y, height * .58, height * .95))
  const left = Math.round(point.x - RUNNER_WIDTH * scale / 2)
  const top = footY - RUNNER_HEIGHT * scale

  ctx.imageSmoothingEnabled = false
  for (const [color, x, y, w, h] of RUNNER_FRAMES[runnerFrameIndex(run)]) {
    ctx.fillStyle = COLORS[color]
    ctx.fillRect(left + x * scale, top + y * scale, w * scale, h * scale)
  }
}
