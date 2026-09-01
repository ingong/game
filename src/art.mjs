import { clamp, projectPoint } from './math.mjs'

export const RUNNER_WIDTH = 48
export const RUNNER_HEIGHT = 72
export const RUNNER_SHEET_SRC = './assets/unicorn-runner-sprite-concept.png'
export const RUNNER_SHEET_FRAMES = [
  [21, 50, 323, 727],
  [399, 64, 360, 713],
  [841, 63, 322, 714],
  [1217, 81, 332, 696],
  [1581, 0, 391, 592]
]

export const RUNNER_PALETTE = [
  '#31051b', '#790b24', '#d51d24', '#ff641e', '#ffd34d',
  '#0877d1', '#071f70', '#fff', '#36b44a', '#7042c1'
]

const back = (mane, tail) => [
  // Broad, curved six-band tail.
  [2, 6, 27 + tail, 6, 2], [2, 3, 29 + tail, 9, 2],
  [3, 1, 31 + tail, 11, 2], [3, 0, 33 + tail, 11, 2],
  [4, 0, 35 + tail, 11, 2], [4, 1, 37 + tail, 10, 2],
  [8, 1, 39 + tail, 10, 2], [5, 2, 41 + tail, 10, 2],
  [9, 4, 43 + tail, 9, 2], [9, 6, 45 + tail, 7, 2],
  [6, 0, 33 + tail, 1, 4], [6, 3, 43 + tail, 1, 2],

  // Layered mane, large enough to read behind the neck.
  [2, 5 + mane, 4, 9, 3], [3, 4 + mane, 7, 10, 3],
  [4, 4 + mane, 10, 11, 3], [8, 5 + mane, 13, 10, 3],
  [5, 6 + mane, 16, 9, 3], [9, 7 + mane, 19, 8, 4]
]

const body = [
  // Long striped horn with navy outline.
  [6, 27, 0, 2, 2], [6, 25, 2, 4, 2], [6, 23, 4, 4, 2],
  [6, 21, 6, 4, 3], [4, 28, 0, 1, 2], [3, 26, 2, 2, 2],
  [4, 24, 4, 2, 2], [3, 22, 6, 2, 2], [4, 22, 8, 1, 1],

  // Two ears and a rear three-quarter horse profile.
  [6, 13, 3, 5, 8], [7, 14, 4, 3, 5],
  [6, 18, 2, 6, 9], [7, 20, 3, 3, 6],
  [6, 16, 8, 10, 2], [6, 15, 10, 13, 3], [6, 16, 13, 16, 4],
  [6, 18, 17, 13, 3], [6, 14, 18, 12, 5],
  [7, 17, 9, 8, 2], [7, 16, 11, 10, 2], [7, 17, 13, 14, 3],
  [7, 19, 16, 11, 2], [7, 16, 18, 9, 4],
  [5, 16, 14, 4, 5], [5, 24, 16, 7, 2], [5, 19, 18, 6, 3],
  [6, 24, 10, 2, 2], [6, 29, 14, 2, 1], [7, 30, 13, 2, 2],

  // Navy silhouette and stepped white V-shaped upper back.
  [6, 4, 18, 24, 1], [6, 2, 19, 28, 2], [6, 3, 21, 26, 1],
  [6, 5, 22, 22, 1], [6, 6, 23, 20, 1], [6, 7, 24, 18, 1],
  [6, 8, 25, 16, 1], [6, 9, 26, 14, 1], [6, 10, 27, 12, 3],
  [7, 7, 18, 18, 1], [7, 4, 19, 24, 2], [7, 5, 21, 22, 1],
  [7, 7, 22, 18, 1], [7, 8, 23, 16, 1], [7, 9, 24, 14, 1],
  [7, 10, 25, 12, 1], [7, 11, 26, 10, 1], [7, 11, 27, 10, 2],
  [5, 4, 20, 4, 2], [5, 24, 20, 4, 2], [5, 7, 22, 3, 3],
  [5, 22, 22, 3, 3], [5, 10, 25, 3, 3], [5, 19, 25, 3, 3],
  [6, 15, 21, 2, 7], [7, 12, 20, 3, 3], [7, 17, 20, 3, 3],

  // Narrow waist and shaped cobalt shorts.
  [6, 9, 29, 14, 2], [6, 8, 31, 16, 5],
  [5, 10, 31, 12, 1], [5, 9, 32, 14, 3],
  [6, 15, 32, 2, 4], [6, 8, 34, 5, 2], [6, 19, 34, 5, 2],
  [5, 11, 30, 10, 1]
]

const arms = [
  [
    [6, 3, 19, 6, 6], [7, 4, 20, 4, 4], [5, 3, 23, 4, 3],
    [6, 0, 23, 5, 9], [7, 1, 24, 3, 5], [5, 1, 28, 3, 3], [6, 0, 30, 5, 2],
    [6, 23, 19, 6, 6], [7, 24, 20, 4, 4], [5, 25, 23, 4, 3],
    [6, 27, 23, 5, 9], [7, 28, 24, 3, 5], [5, 28, 28, 3, 3], [6, 27, 30, 5, 2]
  ],
  [
    [6, 3, 19, 6, 6], [7, 4, 20, 4, 4], [5, 3, 23, 4, 3],
    [6, 0, 15, 5, 7], [7, 1, 16, 3, 4], [5, 1, 19, 3, 3], [6, 0, 14, 5, 2],
    [6, 23, 20, 6, 6], [7, 24, 21, 4, 4], [5, 25, 24, 4, 3],
    [6, 27, 24, 5, 9], [7, 28, 25, 3, 5], [5, 28, 29, 3, 3], [6, 27, 31, 5, 2]
  ],
  [
    [6, 3, 20, 6, 6], [7, 4, 21, 4, 4], [5, 3, 24, 4, 3],
    [6, 0, 24, 5, 9], [7, 1, 25, 3, 5], [5, 1, 29, 3, 3], [6, 0, 31, 5, 2],
    [6, 23, 19, 6, 6], [7, 24, 20, 4, 4], [5, 25, 23, 4, 3],
    [6, 27, 15, 5, 7], [7, 28, 16, 3, 4], [5, 28, 19, 3, 3], [6, 27, 14, 5, 2]
  ],
  [
    [6, 2, 18, 7, 6], [7, 3, 19, 5, 4], [5, 2, 22, 4, 3],
    [6, 0, 22, 5, 9], [7, 1, 23, 3, 5], [5, 1, 27, 3, 3], [6, 0, 29, 5, 2],
    [6, 23, 20, 7, 6], [7, 24, 21, 5, 4], [5, 26, 24, 4, 3],
    [6, 27, 24, 5, 9], [7, 28, 25, 3, 5], [5, 28, 29, 3, 3], [6, 27, 31, 5, 2]
  ],
  [
    [6, 0, 15, 9, 7], [7, 1, 16, 7, 5], [5, 2, 20, 6, 3],
    [6, 0, 12, 5, 6], [7, 1, 13, 3, 4],
    [6, 23, 15, 9, 7], [7, 24, 16, 7, 5], [5, 24, 20, 6, 3],
    [6, 27, 12, 5, 6], [7, 28, 13, 3, 4]
  ]
]

const legs = [
  [
    [6, 8, 34, 8, 8], [7, 9, 35, 6, 7], [5, 9, 40, 3, 5],
    [6, 9, 41, 7, 7], [7, 11, 42, 4, 4], [6, 8, 46, 9, 2],
    [6, 18, 34, 8, 6], [7, 19, 35, 6, 4], [5, 23, 38, 4, 3],
    [6, 23, 38, 8, 5], [7, 24, 39, 5, 2], [6, 25, 41, 7, 3]
  ],
  [
    [6, 7, 34, 8, 7], [7, 8, 35, 6, 5], [5, 5, 38, 5, 4],
    [6, 3, 38, 8, 7], [7, 4, 39, 5, 3], [6, 1, 43, 9, 3],
    [6, 18, 34, 8, 8], [7, 19, 35, 6, 7], [5, 22, 40, 3, 5],
    [6, 18, 41, 7, 7], [7, 19, 42, 4, 4], [6, 17, 46, 9, 2]
  ],
  [
    [6, 8, 34, 8, 7], [7, 9, 35, 6, 5], [5, 12, 39, 4, 5],
    [6, 12, 39, 7, 9], [7, 13, 40, 5, 5], [6, 11, 46, 9, 2],
    [6, 18, 34, 8, 6], [7, 19, 35, 6, 4], [5, 18, 38, 5, 4],
    [6, 16, 38, 8, 7], [7, 17, 39, 5, 3], [6, 14, 43, 9, 3]
  ],
  [
    [6, 7, 34, 8, 6], [7, 8, 35, 6, 4], [5, 7, 38, 5, 4],
    [6, 5, 38, 8, 7], [7, 6, 39, 5, 3], [6, 3, 43, 9, 3],
    [6, 18, 34, 8, 7], [7, 19, 35, 6, 5], [5, 23, 39, 4, 5],
    [6, 22, 39, 7, 9], [7, 23, 40, 5, 5], [6, 21, 46, 9, 2]
  ],
  [
    [6, 6, 34, 9, 7], [7, 7, 35, 7, 5], [5, 7, 39, 5, 4],
    [6, 9, 39, 8, 6], [7, 10, 40, 5, 3], [6, 12, 43, 7, 3],
    [6, 18, 34, 9, 7], [7, 19, 35, 7, 5], [5, 22, 39, 5, 4],
    [6, 16, 39, 8, 6], [7, 18, 40, 5, 3], [6, 14, 43, 7, 3]
  ]
]

const details = [
  // Fine horn, face, and muzzle marks.
  [7, 42, 1, 1, 2], [4, 39, 5, 1, 2], [3, 36, 9, 1, 2],
  [7, 29, 14, 6, 1], [6, 38, 15, 2, 2], [7, 40, 19, 6, 1],
  [6, 45, 21, 1, 1], [5, 37, 23, 8, 2], [7, 43, 20, 3, 1],

  // Shoulder caps, lat shadows, spine, waist, and shorts highlights.
  [7, 12, 29, 7, 2], [7, 29, 29, 7, 2],
  [5, 8, 31, 4, 2], [5, 36, 31, 4, 2],
  [5, 13, 35, 2, 7], [5, 33, 35, 2, 7],
  [6, 23, 33, 2, 10], [7, 19, 38, 4, 1], [7, 26, 38, 4, 1],
  [7, 20, 42, 8, 1], [5, 17, 47, 5, 2], [5, 27, 47, 5, 2],
  [6, 23, 48, 2, 6], [7, 20, 46, 3, 1], [7, 25, 46, 3, 1]
]

const upscale = runs => runs.map(([color, x, y, width, height]) => {
  const left = Math.round(x * 1.5)
  const top = Math.round(y * 1.5)
  return [
    color, left, top,
    Math.round((x + width) * 1.5) - left,
    Math.round((y + height) * 1.5) - top
  ]
})

const frame = (index, mane, tail) => [
  ...upscale([...legs[index], ...body, ...arms[index], ...back(mane, tail)]),
  ...details
]

export const RUNNER_FRAMES = [
  frame(0, 0, 0), frame(1, -1, -1), frame(2, 1, 0),
  frame(3, 0, 1), frame(4, -1, 0)
]

export const runnerFrameIndex = run => run.grounded ? Math.floor(run.anim / 2) & 3 : 4

export const runnerScale = height => clamp(Math.floor(height / 300), 2, 5)

export const runnerDisplayHeight = height => Math.round(clamp(height * .25, 180, 190))

export function createRunnerSheet(document) {
  const image = document.createElement('img')
  image.decoding = 'async'
  image.src = RUNNER_SHEET_SRC
  return image
}

const runnerSheet = typeof document === 'undefined' ? null : createRunnerSheet(document)

export function drawPixelRunner(ctx, run, width, height) {
  const scale = runnerScale(height)
  const point = projectPoint(run.x, run.y, 40, width, height)
  const footY = Math.round(clamp(point.y, height * .58, height * .95))
  const left = Math.round(point.x - RUNNER_WIDTH * scale / 2)
  const top = footY - RUNNER_HEIGHT * scale

  ctx.imageSmoothingEnabled = false
  for (const [color, x, y, w, h] of RUNNER_FRAMES[runnerFrameIndex(run)]) {
    ctx.fillStyle = RUNNER_PALETTE[color]
    ctx.fillRect(left + x * scale, top + y * scale, w * scale, h * scale)
  }
}

export function drawRunner(ctx, run, width, height, image = runnerSheet) {
  if (!image?.complete || !image.naturalWidth) {
    drawPixelRunner(ctx, run, width, height)
    return
  }

  const [sourceX, sourceY, sourceWidth, sourceHeight] = RUNNER_SHEET_FRAMES[runnerFrameIndex(run)]
  const displayHeight = runnerDisplayHeight(height)
  const displayWidth = Math.round(displayHeight * sourceWidth / sourceHeight)
  const point = projectPoint(run.x, run.y, 40, width, height)
  const footY = Math.round(clamp(point.y, height * .58, height * .95))
  const left = Math.round(point.x - displayWidth / 2)
  const top = footY - displayHeight

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    image,
    sourceX, sourceY, sourceWidth, sourceHeight,
    left, top, displayWidth, displayHeight
  )
}
