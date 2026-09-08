import { obstacleRecipe } from './obstacles.mjs'
import { MAP_SETTINGS, STAGE_SETTINGS } from './generated/map-settings.mjs'

export const RED_PALETTE = {
  sky:'#a51f1f', road:'#531919', lava:'#ef4b16', fire:'#ffc22f', bridge:'#8b3430'
}

export const FIRE=0,GAP=1,BRIDGE=2,FINISH=3,HURDLE=4,PISTON=5,SPRING=6

const lengths=[600,700,650,750,800,600,1000]
const limits=[26,29,30,31,33,26,40]
const hints=['JUMP / DODGE','FIND THE OPEN LANE','READ THE CHARGE','CHAIN YOUR JUMPS','WATCH THE MOVEMENT','CHOOSE YOUR LANDING','FINAL MIX']
// [catalog id, distance, lane]. Different sequences, not a recolored template.
const layouts=[
  [[1,100,-6],[9,180,7],[3,250,-6],[13,350],[5,460,-8],[4,540,8]],
  [[2,100,8],[13,205],[3,280,-8],[9,330,7],[7,385,7],[2,465,-8],[1,510,8],[15,555,-7],[10,635,5]],
  [[5,100,-8],[4,155,8],[6,195],[1,265,-7],[8,345],[7,445,-6],[12,480,-7],[13,520],[11,585,6]],
  [[13,120],[1,180,-8],[14,240],[17,315],[15,390,7],[16,480],[16,540],[18,605],[14,665]],
  [[9,120,-5],[10,215,5],[13,290],[17,330],[11,380,-4],[5,470,8],[12,570,5],[15,655,-7],[4,710,8],[3,740]],
  [[19,120],[16,140],[20,180],[16,200],[1,255,-8],[19,300],[16,320],[20,360],[16,380],[5,435,8],[19,480],[16,500],[20,540],[16,560]],
  [[2,92,7],[1,140,-7],[6,188],[13,232],[3,270,-7],[12,305,-6],[7,340,6],[4,380,8],[14,415],[10,490,-5],[18,565],[17,600],[11,640,4],[8,720],[5,770,-8],[20,820],[16,840],[19,900],[16,920],[15,965,8]]
]
export const STAGES=STAGE_SETTINGS.map((settings,index)=>{
  const length=lengths[index]
  return {...settings,id:index+1,length,timeLimit:limits[index],hint:hints[index],
    sections:[[0,length*.3,32,0,0,index,11],[length*.3,length*.7,30,0,2,index,23],[length*.7,length,28,2,3,index,37]],
    obstacles:[...layouts[index].map(([id,z,x])=>obstacleRecipe(id,z,x)),[FINISH,length,0,28,4,18,0,0]]}
})

export const RED_STAGE=STAGES[0]

const types = [FIRE, GAP, BRIDGE, FINISH, HURDLE, PISTON, SPRING]
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
      if (!Array.isArray(obstacle) || ![8,9].includes(obstacle.length) || !obstacle.every(Number.isFinite) ||
        !(obstacle[3] > 0) || obstacle[4] < 0 || obstacle[5] < 0 || obstacle[6] < 0) {
        errors.push('invalid obstacle tuple')
        continue
      }
      const [type, z, , , depth] = obstacle
      if (obstacle.length===9 && (!Number.isInteger(obstacle[8]) || obstacle[8]<1 || obstacle[8]>20)) errors.push('unknown obstacle recipe')
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

export function obstacleBounds(obstacle, time = 0, stage = RED_STAGE) {
  if (isLegacy(obstacle)) return legacyBounds(obstacle)
  const [type, z, x, width, depth, height, period, phase] = obstacle
  const cycle = period > 0 ? ((time + phase) / period % 1 + 1) % 1 : 0
  const id=obstacle[8]||0
  const pulse=id===6?(cycle*2)%1:cycle
  const active = type === FIRE ? pulse >= (id===8?.18:.32) && pulse <= (id===8?.86:.78) : true
  const roadWidth = roadAt(stage, z)?.width ?? width
  const wave=id===10?1-4*Math.abs(cycle-.5):Math.sin(cycle*Math.PI*2)
  const pistonX=x+((type===PISTON&&id!==12)||id===7?wave*roadWidth*.3:0)
  return { x:pistonX,z,width:id===11?width*(.65+.35*Math.abs(wave)):width,depth,
    height:id===4?height*Math.max(0,(Math.abs(wave)-.2)/.8):height,
    bottom:id===12?height*(.5+.5*wave):0,active }
}

const obstacleAt = (stage, x, z, type, time = 0) =>
  stage.obstacles?.findIndex(obstacle => obstacle[0] === type && spans(obstacleBounds(obstacle, time, stage), x, z)) ?? -1

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
    const bounds = obstacleBounds(obstacle, time, stage)
    return [FIRE, HURDLE, PISTON].includes(type) && bounds.active &&
      spans(bounds, run.x, run.z) && run.y+2.5>(bounds.bottom||0) &&
      run.y < (bounds.bottom||0)+bounds.height*(obstacle[8]===3?Math.min(3,1+Math.floor((run.x-bounds.x+bounds.width/2)/bounds.width*3))/3:1)
  }) ?? -1
  if (solidIndex >= 0) return { kind:'stumble', index:solidIndex }

  const finishIndex = stage.obstacles?.findIndex(obstacle => obstacle[0] === FINISH) ?? -1
  if (finishIndex >= 0 && run.z >= stage.length) return { kind:'finish', index:finishIndex }

  const unsupportedIndex = unsupportedIndexAt(stage, run.x, run.z, run.collapse)
  if (run.y <= 0 && (unsupportedIndex >= 0 || surfaceAt(stage, run.x, run.z, run.collapse) === null)) {
    return { kind:'lava', index:unsupportedIndex }
  }

  const springIndex=obstacleAt(stage,run.x,run.z,SPRING)
  if(run.y<=0 && springIndex>=0)return {kind:'spring',index:springIndex}

  const bridgeIndex = obstacleAt(stage, run.x, run.z, BRIDGE)
  if (run.y <= 0 && bridgeIndex >= 0) return { kind:'bridge', index:bridgeIndex }
  return null
}
