export const RED_PALETTE = {
  sky:'#a51f1f', road:'#531919', lava:'#ef4b16', fire:'#ffc22f', bridge:'#8b3430'
}

export const FIRE=0,GAP=1,BRIDGE=2,FINISH=3,HURDLE=4,PISTON=5

export const RED_STAGE={
  name:'RED 1',timeLimit:45,length:1000,
  sections:[
    [0,160,36,0,0,0,11],
    [160,360,28,0,1,1,23],
    [360,600,30,1,4,2,37],
    [600,800,26,4,2,3,41],
    [800,1000,22,2,6,4,53]
  ],
  obstacles:[
    [HURDLE,92,0,12,3,4,0,0],
    [FIRE,188,-8,9,4,9,2.4,0],
    [FIRE,236,8,9,4,9,2.4,.8],
    [HURDLE,282,0,15,3,5,0,0],
    [FIRE,328,0,13,4,10,2.8,1.4],
    [GAP,408,0,60,11,0,0,0],
    [HURDLE,454,-7,10,3,4,0,0],
    [GAP,488,0,60,14,0,0,0],
    [HURDLE,536,7,10,3,5,0,0],
    [GAP,570,0,60,18,0,0,0],
    [PISTON,640,-12,12,5,6,2.8,0],
    [PISTON,690,12,12,5,6,2.8,.9],
    [PISTON,742,0,16,6,8,3.2,1.6],
    [HURDLE,782,0,12,3,5,0,0],
    [BRIDGE,830,0,22,17,0,.42,0],
    [BRIDGE,852,0,22,17,0,.38,0],
    [BRIDGE,874,0,22,17,0,.34,0],
    [BRIDGE,896,0,22,17,0,.30,0],
    [BRIDGE,918,0,22,17,0,.28,0],
    [BRIDGE,940,0,22,17,0,.25,0],
    [FINISH,1000,0,28,4,18,0,0]
  ]
}

const types = [FIRE, GAP, BRIDGE, FINISH, HURDLE, PISTON]
const isLegacy = obstacle => obstacle.length < 8

const legacyBounds = obstacle => {
  const [type, z, x, width, value] = obstacle
  if (type === FIRE) return { x, z, width, depth:6, height:value, active:true }
  if (type === GAP) return { x, z:z + value / 2, width, depth:value, height:0, active:true }
  if (type === BRIDGE) return { x, z, width, depth:width, height:0, active:true }
  return { x, z, width, depth:width, height:0, active:true }
}

const spans = (bounds, x, z) =>
  Math.abs(x - bounds.x) <= bounds.width / 2 && Math.abs(z - bounds.z) <= bounds.depth / 2

const bridgePeriod = obstacle => obstacle[6] ?? obstacle[4]

export function validateStage(stage) {
  const errors = []
  if (!(stage.timeLimit > 0)) errors.push('invalid time limit')
  if (!Array.isArray(stage.sections)) errors.push('invalid sections')
  else {
    let previousEnd = 0
    for (const section of stage.sections) {
      if (!Array.isArray(section) || section.length !== 7 || !section.every(Number.isFinite) ||
        !(section[1] > section[0]) || !(section[2] > 0)) {
        errors.push('invalid section tuple')
        continue
      }
      if (section[0] !== previousEnd) errors.push('sections are not contiguous')
      previousEnd = section[1]
    }
    if (previousEnd !== stage.length) errors.push('sections are not contiguous')
  }
  if (!Array.isArray(stage.obstacles)) errors.push('invalid obstacles')
  else {
    let previousZ = -Infinity
    for (const obstacle of stage.obstacles) {
      if (!Array.isArray(obstacle) || obstacle.length !== 8 || !obstacle.every(Number.isFinite) ||
        !(obstacle[3] > 0) || obstacle[4] < 0 || obstacle[5] < 0 || obstacle[6] < 0) {
        errors.push('invalid obstacle tuple')
        continue
      }
      const [type, z, , , depth] = obstacle
      if (!types.includes(type)) errors.push('unknown obstacle type')
      if (z < previousZ) errors.push('obstacle positions are not sorted')
      if (type !== FINISH && (z - depth / 2 < 0 || z + depth / 2 > stage.length)) {
        errors.push('obstacle footprint is outside the course')
      }
      previousZ = z
    }
    const finish = stage.obstacles.at(-1)
    if (!finish || finish[0] !== FINISH) errors.push('missing final finish')
    else if (finish[1] !== stage.length) errors.push('finish gate does not match stage length')
  }
  return errors
}

export function sectionAt(stage, z) {
  const sections = stage.sections
  if (!Array.isArray(sections)) return null
  if (z === stage.length) return sections.at(-1) ?? null
  return sections.find(section => z >= section[0] && z < section[1]) ?? null
}

export function roadAt(stage, z) {
  const section = sectionAt(stage, z)
  if (!section) {
    if (!stage.sections && z >= 0 && z <= stage.length) return { width:62, elevation:0, theme:0, seed:0 }
    return null
  }
  const [z0, z1, width, y0, y1, theme, seed] = section
  const progress = (z - z0) / (z1 - z0)
  return { width, elevation:y0 + (y1 - y0) * progress, theme, seed }
}

export function obstacleBounds(obstacle, time = 0) {
  if (isLegacy(obstacle)) return legacyBounds(obstacle)
  const [type, z, x, width, depth, height, period, phase] = obstacle
  const cycle = period > 0 ? ((time + phase) / period % 1 + 1) % 1 : 0
  const active = type === FIRE ? cycle >= .32 && cycle <= .78 : true
  const roadWidth = roadAt(RED_STAGE, z)?.width ?? width
  const pistonX = x + (type === PISTON ? Math.sin(cycle * Math.PI * 2) * roadWidth * .3 : 0)
  return { x:pistonX, z, width, depth, height, active }
}

const obstacleAt = (stage, x, z, type, time = 0) =>
  stage.obstacles?.findIndex(obstacle => obstacle[0] === type && spans(obstacleBounds(obstacle, time), x, z)) ?? -1

const unsupportedIndexAt = (stage, x, z, collapse) => {
  const gapIndex = obstacleAt(stage, x, z, GAP)
  if (gapIndex >= 0) return gapIndex
  const bridgeIndex = obstacleAt(stage, x, z, BRIDGE)
  if (bridgeIndex < 0 || collapse?.index !== bridgeIndex) return -1
  const obstacle = stage.obstacles[bridgeIndex]
  const collapsed = isLegacy(obstacle)
    ? collapse.timer >= bridgePeriod(obstacle)
    : collapse.timer > bridgePeriod(obstacle)
  return collapsed ? bridgeIndex : -1
}

export function surfaceAt(stage, x, z, collapse) {
  const road = roadAt(stage, z)
  if (!road || unsupportedIndexAt(stage, x, z, collapse) >= 0) return null
  return road.elevation
}

export function contactAt(stage, run) {
  const time = run.time ?? 0
  const solidIndex = stage.obstacles?.findIndex(obstacle => {
    const type = obstacle[0]
    const bounds = obstacleBounds(obstacle, time)
    return [FIRE, HURDLE, PISTON].includes(type) && bounds.active &&
      spans(bounds, run.x, run.z) && run.y < bounds.height
  }) ?? -1
  if (solidIndex >= 0) return { kind:'stumble', index:solidIndex }

  const finishIndex = stage.obstacles?.findIndex(obstacle => obstacle[0] === FINISH) ?? -1
  if (finishIndex >= 0 && run.z >= stage.length) return { kind:'finish', index:finishIndex }

  const unsupportedIndex = unsupportedIndexAt(stage, run.x, run.z, run.collapse)
  if (run.y <= 0 && (unsupportedIndex >= 0 || surfaceAt(stage, run.x, run.z, run.collapse) === null)) {
    return { kind:'lava', index:unsupportedIndex }
  }

  const bridgeIndex = obstacleAt(stage, run.x, run.z, BRIDGE)
  if (run.y <= 0 && bridgeIndex >= 0) return { kind:'bridge', index:bridgeIndex }
  return null
}
