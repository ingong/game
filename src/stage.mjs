export const RED_PALETTE = {
  sky:'#a51f1f', road:'#531919', lava:'#ef4b16', fire:'#ffc22f', bridge:'#8b3430'
}

export const RED_STAGE = {
  timeLimit:45,
  length:900,
  obstacles:[
    [0,100,0,56,3],
    [0,170,0,56,4], [0,230,-14,28,5], [0,300,14,28,5], [0,360,0,56,4],
    [1,410,0,56,30], [1,480,0,56,40], [1,560,0,56,50], [1,650,0,56,40],
    [2,700,0,20,.5], [2,735,0,20,.45], [2,770,0,20,.4],
    [2,805,0,20,.35], [2,850,0,20,.3],
    [3,900,0,24,0]
  ]
}

const spansX = (obstacle, x) => Math.abs(x - obstacle[2]) <= obstacle[3] / 2
const spansTile = (obstacle, x, z) => spansX(obstacle, x) && Math.abs(z - obstacle[1]) <= obstacle[3] / 2

export function validateStage(stage) {
  const errors = []
  if (!(stage.timeLimit > 0)) errors.push('invalid time limit')
  let previous = -Infinity
  for (const obstacle of stage.obstacles) {
    const [type, z, , width] = obstacle
    if (z < previous) errors.push('obstacle positions are not sorted')
    if (type < 0 || type > 3) errors.push('unknown obstacle type')
    if (!(width > 0)) errors.push('obstacle width must be positive')
    previous = z
  }
  const finish = stage.obstacles.at(-1)
  if (!finish || finish[0] !== 3 || finish[1] !== stage.length) errors.push('finish gate does not match stage length')
  return errors
}

export function bridgeIndexAt(stage, x, z) {
  return stage.obstacles.findIndex(obstacle => obstacle[0] === 2 && spansTile(obstacle, x, z))
}

export function surfaceAt(stage, x, z, collapse) {
  for (const obstacle of stage.obstacles) {
    if (obstacle[0] === 1 && spansX(obstacle, x) && z >= obstacle[1] && z <= obstacle[1] + obstacle[4]) return null
  }
  const index = bridgeIndexAt(stage, x, z)
  if (index >= 0 && collapse?.index === index && collapse.timer >= stage.obstacles[index][4]) return null
  return 0
}

export function hazardAt(stage, run) {
  for (const obstacle of stage.obstacles) {
    if (obstacle[0] === 0 && spansX(obstacle, run.x) && Math.abs(run.z - obstacle[1]) <= 3 && run.y < 4) return 'FIRE'
  }
  return run.y <= 0 && surfaceAt(stage, run.x, run.z, run.collapse) === null ? 'LAVA' : null
}
