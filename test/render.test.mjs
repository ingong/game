import {REFERENCE_STAGE as RED_STAGE} from './fixtures/reference-course.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {obstacleRecipe} from '../src/obstacles.mjs'
import { createCamera } from '../src/camera.mjs'
import * as renderer from '../src/render.mjs'
import { createRun } from '../src/sim.mjs'
import { projectPoint } from '../src/math.mjs'
import { NAVY, EMBER, ORANGE, STEEL, YELLOW, COBALT } from '../src/palette.mjs'
import { VISUAL_DEFAULTS } from '../tools/map-settings-model.mjs'
import { BRIDGE, FINISH, FIRE, GAP, HURDLE, PISTON, SPRING, STAGES } from '../src/stage.mjs'

const { render } = renderer

function recordingContext() {
  const calls = []
  return {
    calls,
    fillStyle:'',
    font:'',
    textAlign:'',
    textBaseline:'',
    strokeStyle:'',
    lineWidth:1,
    globalAlpha:1,
    imageSmoothingEnabled:true,
    beginPath() { calls.push(['beginPath']) },
    moveTo(x, y) { calls.push(['moveTo', x, y]) },
    lineTo(x, y) { calls.push(['lineTo', x, y]) },
    closePath() { calls.push(['closePath']) },
    clip() { calls.push(['clip']) },
    rect(...args) {calls.push(['rect',...args])},
    fill() { calls.push(['fill', this.fillStyle, this.globalAlpha]) },
    stroke() { calls.push(['stroke', this.strokeStyle, this.lineWidth, this.globalAlpha]) },
    arc(x, y, radius, start, end) { calls.push(['arc', x, y, radius, start, end]) },
    fillRect(x, y, width, height) { calls.push(['fillRect', this.fillStyle, x, y, width, height, this.globalAlpha]) },
    fillText(value, x, y) { calls.push(['fillText', value, x, y, this.font, this.textAlign]) },
    save() { calls.push(['save']) },
    restore() { calls.push(['restore']) },
    translate(x, y) { calls.push(['translate', x, y]) },
    rotate(angle) { calls.push(['rotate', angle]) },
    scale(x, y) { calls.push(['scale', x, y]) },
    measureText(value) {
      const size = Number.parseInt(this.font.match(/\d+px/)?.[0] ?? '10', 10)
      return { width:Array.from(value).reduce((sum, character) =>
        sum + (/[^\x00-\xff]/.test(character) ? size : size*.6), 0) }
    }
  }
}

const runnerScaleIndex = calls => calls.findIndex(call =>
  call[0] === 'scale' && call[1] === call[2] && call[1] >= .5 && call[1] <= 1.2)

const runnerAnchor = calls => {
  const scale = runnerScaleIndex(calls)
  for (let i = scale - 1; i >= 0; i--) if (calls[i][0] === 'translate') return i
  return -1
}

const renderAt = (z, overrides = {}, stage = RED_STAGE, width = 320, height = 180) => {
  const run = { ...createRun(stage), mode:'running', time:4, speed:28, z, ...overrides }
  const camera = { ...createCamera(run), z:z - 24 }
  const ctx = recordingContext()
  render(ctx, run, camera, stage, width, height)
  return ctx.calls
}

const drawCount = calls => calls.filter(call => call[0] === 'fill' || call[0] === 'fillRect').length
const polygonCount = calls => calls.filter(call => call[0] === 'fill').length
const operationCount = (calls, operation) => calls.filter(call => call[0] === operation).length
const obstacleDelta = (type, operation, overrides = {}) => {
  const obstacle = RED_STAGE.obstacles.find(item => item[0] === type)
  const z = obstacle[1] - 20
  const withObstacle = renderAt(z, overrides, { ...RED_STAGE, obstacles:[obstacle] })
  const withoutObstacle = renderAt(z, overrides, { ...RED_STAGE, obstacles:[] })
  return operationCount(withObstacle, operation) - operationCount(withoutObstacle, operation)
}
const obstacleColorDelta = (type, operation, color, overrides = {}) => {
  const obstacle = RED_STAGE.obstacles.find(item => item[0] === type)
  const z = obstacle[1] - 20
  const count = calls => calls.filter(call => call[0] === operation && call[1] === color).length
  return count(renderAt(z, overrides, { ...RED_STAGE, obstacles:[obstacle] })) -
    count(renderAt(z, overrides, { ...RED_STAGE, obstacles:[] }))
}

test('runner display scale keeps the course readable around the character', () => {
  assert.equal(renderer.RUNNER_WORLD_TO_ART, .095)
})

test('near and passed solids retain their complete silhouette without cutaways',()=>{
  const obstacle=obstacleRecipe(2,100)
  const stage={...RED_STAGE,obstacles:[obstacle]}
  const frames=[75,85,95,100,103,110].map(z=>renderAt(z,{},stage))
  for(const [i,calls] of frames.entries()) {
    assert.equal(operationCount(calls,'clip'),0)
    const z=[75,85,95,100,103,110][i]
    assert.ok(polygonCount(calls)>polygonCount(renderAt(z,{}, {...stage,obstacles:[]})))
    assert.ok(runnerAnchor(calls)>0)
  }
  const opacity=z=>renderer.obstacleOpacity(100-z)
  assert.equal(opacity(75),1)
  assert.ok(opacity(103)>.2)
  assert.ok(Math.abs(opacity(101.99)-opacity(102.01))<.002,'no pop at the collider rear edge')
})

test('render draws road, projected runner, and HUD without DOM or images', () => {
  const run = { ...createRun(RED_STAGE), mode:'running', x:4, y:3, z:200 }
  const camera = createCamera({ ...run, x:0, y:0 })
  const ctx = recordingContext()

  render(ctx, run, camera, RED_STAGE, 320, 180)

  assert.ok(ctx.calls.some(call => call[0] === 'fill' && call[1] === RED_STAGE.visual.road))
  const anchor = runnerAnchor(ctx.calls)
  assert.ok(anchor >= 0)
  assert.ok(ctx.calls.slice(anchor + 1).some(call => call[0] === 'scale'))
  assert.ok(ctx.calls.some(call => call[0] === 'fillText' && call[1] === 'RED 1'))
})

test('stone joints stay at the same world position while the camera advances', () => {
  const stage = { ...RED_STAGE, sections:[[0,1000,30,0,0,0,11]], obstacles:[] }
  for (const z of [100.1,101.1,103.9,104.1]) {
    const run = { ...createRun(stage), mode:'running', time:4, speed:28, z }
    const camera = { ...createCamera(run), z:z-24 }
    const expected = [[-15,104.12],[15,104.12],[15,104],[-15,104]].map(([x,worldZ]) => {
      const point = projectPoint(camera,x,.03,worldZ,320,180)
      return [Math.round(point.x),Math.round(point.y)]
    })
    const ctx = recordingContext()
    render(ctx,run,camera,stage,320,180)
    let path = [], found = false
    for (const call of ctx.calls) {
      if (call[0] === 'beginPath') path = []
      if (call[0] === 'moveTo' || call[0] === 'lineTo') path.push(call.slice(1))
      if (call[0] === 'fill' && call[1] === NAVY && JSON.stringify(path) === JSON.stringify(expected)) found = true
    }
    assert.ok(found,`world seam at z=104 drifted when the runner reached ${z}`)
  }
})

test('map controls change decoration without hiding course obstacles', () => {
  const stage={...RED_STAGE,visual:{...VISUAL_DEFAULTS,tiles:false,edges:false}}
  const quiet=renderAt(100,{},stage)
  const decorated=renderAt(100,{}, {...stage,visual:{...stage.visual,landmarks:true,ripples:4}})
  assert.ok(drawCount(decorated)>drawCount(quiet),'decoration controls did not change the scene')
  assert.ok(quiet.some(call => call[0]==='fillRect' && call[1]===stage.visual.void))
  assert.ok(quiet.some(call => call[0]==='fillRect' && call[1]===stage.visual.sky))
  const withHurdle=renderAt(72,{},stage)
  const withoutHurdle=renderAt(72,{}, {...stage,obstacles:[]})
  assert.ok(drawCount(withHurdle)>drawCount(withoutHurdle))
  const recolored=renderAt(100,{}, {...stage,visual:{...stage.visual,road:'#123456'}})
  assert.ok(recolored.some(call => call[0]==='fill' && call[1]==='#123456'))
})

test('runner root scale stays readable in the default logical chase view', () => {
  const run = { ...createRun(RED_STAGE), mode:'running', z:200 }
  const ctx = recordingContext()

  render(ctx, run, createCamera(run), RED_STAGE, 320, 180)

  const anchor = runnerAnchor(ctx.calls)
  const rootScale = ctx.calls.slice(anchor + 1).find(call => call[0] === 'scale')
  assert.ok(rootScale[1] >= .58 && rootScale[1] <= .68, `runner root scale ${rootScale[1]}`)
  assert.equal(rootScale[1], rootScale[2])
})

test('runner world anchor responds to steering and jumping against a fixed camera', () => {
  const base = { ...createRun(RED_STAGE), mode:'running', z:200 }
  const camera = createCamera(base)
  const anchors = [base, { ...base, x:6, y:5 }].map(run => {
    const ctx = recordingContext()
    render(ctx, run, camera, RED_STAGE, 320, 180)
    return ctx.calls[runnerAnchor(ctx.calls)].slice(1)
  })

  assert.ok(anchors[1][0] > anchors[0][0])
  assert.ok(anchors[1][1] < anchors[0][1])
})

test('obstacle art disappears after its world plane passes behind the camera', () => {
  const run = { ...createRun(RED_STAGE), mode:'running', z:200 }
  const camera = { ...createCamera(run), z:189 }
  const emptyStage = { ...RED_STAGE, obstacles:[] }
  const flameStage = { ...RED_STAGE, obstacles:[RED_STAGE.obstacles.find(obstacle => obstacle[0] === 0)] }
  const empty = recordingContext()
  const behind = recordingContext()

  render(empty, run, camera, emptyStage, 320, 180)
  render(behind, run, camera, flameStage, 320, 180)

  assert.deepEqual(behind.calls, empty.calls)
})

test('all seven obstacle families add substantial visible geometry', () => {
  const minimumDraws = new Map([
    [FIRE, 7], [GAP, 4], [BRIDGE, 7], [FINISH, 8], [HURDLE, 7], [PISTON, 7], [SPRING, 7]
  ])

  for (const [type, minimum] of minimumDraws) {
    const obstacle = RED_STAGE.obstacles.find(item => item[0] === type)
    const z = obstacle[1] - 20
    const withObstacle = renderAt(z, {}, { ...RED_STAGE, obstacles:[obstacle] })
    const withoutObstacle = renderAt(z, {}, { ...RED_STAGE, obstacles:[] })
    const delta = drawCount(withObstacle) - drawCount(withoutObstacle)
    assert.ok(delta >= minimum, `obstacle ${type} added ${delta} draw operations`)
  }
})

test('crystal sculptures have distinct silhouettes for all four crossing patterns',()=>{
  const signatures=[1,2,3,4].map(id=>JSON.stringify(renderAt(80,{time:.4},{...RED_STAGE,obstacles:[obstacleRecipe(id,100)]})))
  assert.equal(new Set(signatures).size,4)
})

test('storm emitter shows lightning only during its active cycle', () => {
  assert.ok(obstacleColorDelta(FIRE,'fill', YELLOW,{time:1.2}) >= 1)
  assert.ok(obstacleColorDelta(FIRE,'fill', '#9c86c9',{time:1.2}) >= 1)
  const obstacle=RED_STAGE.obstacles.find(o=>o[0]===FIRE)
  assert.notDeepEqual(renderAt(obstacle[1]-20,{time:1.2},{...RED_STAGE,obstacles:[obstacle]}),
    renderAt(obstacle[1]-20,{time:2.2},{...RED_STAGE,obstacles:[obstacle]}))
})

test('gap opens onto the cloud layer instead of a filled lava panel', () => {
  assert.ok(obstacleDelta(GAP, 'clip') >= 1)
  assert.ok(obstacleDelta(GAP, 'stroke') >= 2)
})

test('road edges display all seven rainbow bands', () => {
  const calls=renderAt(80,{}, {...RED_STAGE,obstacles:[]})
  for (const color of ['#ff526e','#ff994d','#ffe16b','#58d995','#4cc9f0','#7a88ff','#be7bff'])
    assert.ok(calls.some(c=>c[0]==='fill' && c[1]===color),`missing rainbow band ${color}`)
})

test('moving constructs have distinct silhouettes instead of identical round orbs',()=>{
  const signatures=[9,10,11,12].map(id=>JSON.stringify(renderAt(80,{time:.4},{...RED_STAGE,obstacles:[obstacleRecipe(id,100)]})))
  assert.equal(new Set(signatures).size,4)
})

test('bridge plate projects four bolts plus its crack and edge thickness', () => {
  assert.ok(obstacleDelta(BRIDGE, 'arc') >= 4)
  assert.ok(obstacleDelta(BRIDGE, 'stroke') >= 1)
})

test('finish projects a bright layered arch portal', () => {
  assert.ok(obstacleDelta(FINISH, 'arc') >= 3)
})

test('the five course sections use the same quiet decoration system', () => {
  for (const z of [80,260,480,700,900]) {
    const stage={...RED_STAGE,obstacles:[],visual:{...VISUAL_DEFAULTS}}
    const quiet=renderAt(z,{speed:0},stage)
    assert.deepEqual(quiet,renderAt(z,{speed:0},stage))
    const decorated=renderAt(z,{speed:0}, {...stage,visual:{...stage.visual,landmarks:true}})
    assert.ok(drawCount(decorated)>drawCount(quiet))
    assert.equal(operationCount(quiet,'stroke'),0,'ornate scenery must not remain on the empty quiet course')
  }
})

test('stage name is read from stage data in the HUD', () => {
  const calls=renderAt(100,{}, {...RED_STAGE,name:'STAGE 7 PREVIEW'})
  assert.ok(calls.some(call => call[0]==='fillText' && call[1]==='STAGE 7 PREVIEW'))
})

test('maximum-length stage names stay in the HUD region before the timer', () => {
  for (const [width,height] of [[195,422],[320,180]]) {
    for (const name of ['ABCDEFGHIJKLMNOPQRSTUVWXYZ12','가나다라마바사아자차카타파하가나다라마바사아자차카타파하']) {
      const calls=renderAt(100,{}, {...RED_STAGE,name},width,height)
      const textCalls=calls.filter(call=>call[0]==='fillText')
      const stageCall=textCalls.find(call=>call[5]==='left' && call[2] <= 13)
      const timerCall=textCalls.find(call=>call[1]==='41s LEFT' && call[5]==='right')
      assert.ok(stageCall && timerCall)
      const stageSize=Number.parseInt(stageCall[4].match(/\d+px/)[0],10)
      const timerSize=Number.parseInt(timerCall[4].match(/\d+px/)[0],10)
      const measured=value=>Array.from(value).reduce((sum,character)=>
        sum+(/[^\x00-\xff]/.test(character)?stageSize:stageSize*.6),0)
      assert.ok(stageCall[2]+measured(stageCall[1]) < timerCall[2]-timerCall[1].length*timerSize*.6,
        `${name} overlaps the timer at ${width}x${height}`)
    }
  }
})

test('runner ground shadow shrinks and fades with jump altitude', () => {
  const stage = { ...RED_STAGE, obstacles:[] }
  const grounded = renderAt(200, { y:0, grounded:true }, stage)
  const jumping = renderAt(200, { y:10, grounded:false, jumps:1 }, stage)
  const groundRoot = runnerScaleIndex(grounded)
  const jumpRoot = runnerScaleIndex(jumping)
  const groundShadow = grounded.slice(0, groundRoot).findLast(call => call[0] === 'scale')
  const jumpShadow = jumping.slice(0, jumpRoot).findLast(call => call[0] === 'scale')
  const groundFill = grounded.slice(0, groundRoot).findLast(call => call[0] === 'fill')
  const jumpFill = jumping.slice(0, jumpRoot).findLast(call => call[0] === 'fill')

  assert.ok(groundShadow && jumpShadow, 'runner shadow transform is missing')
  assert.ok(groundShadow[1] >= 3 && groundShadow[1] <= 8,
    `ground shadow footprint scale ${groundShadow[1]}`)
  assert.ok(jumpShadow[1] < groundShadow[1], 'jump shadow did not shrink')
  assert.ok(jumpFill[2] < groundFill[2], 'jump shadow did not fade')
})

test('bridge collapse timer rotates the projected plate', () => {
  const bridge = RED_STAGE.obstacles.find(item => item[0] === BRIDGE)
  const stage = { ...RED_STAGE, obstacles:[bridge] }
  const z = bridge[1] - 20
  const stable = renderAt(z, { collapse:{ index:-1, timer:0 } }, stage)
  const falling = renderAt(z, { collapse:{ index:0, timer:bridge[6] * .75 } }, stage)
  const stableRotations = stable.slice(0, runnerScaleIndex(stable)).filter(call => call[0] === 'rotate')
  const fallingRotations = falling.slice(0, runnerScaleIndex(falling)).filter(call => call[0] === 'rotate')

  assert.notDeepEqual(fallingRotations, stableRotations)
  assert.ok(fallingRotations.some(call => Math.abs(call[1]) > .1))
  assert.ok(falling.some(call => (call[0] === 'fill' || call[0] === 'fillRect') && call[1] === STEEL),
    'bridge plate steel plane is missing')
  const orangeFills = calls => calls.filter(call =>
    (call[0] === 'fill' || call[0] === 'fillRect') && call[1] === ORANGE).length
  assert.ok(orangeFills(falling) > orangeFills(stable), 'collapse did not expose lava below the plate')
})

test('HUD and state text fit the 320x180 and 195x422 logical canvases', () => {
  const modes = [
    { mode:'title' },
    { mode:'countdown', countdown:3 },
    { mode:'success' },
    { mode:'failure', failReason:'TIME' }
  ]

  for (const [width, height] of [[320, 180], [195, 422]]) {
    for (const state of modes) {
      const calls = renderAt(80, state, { ...RED_STAGE, obstacles:[] }, width, height)
      for (const call of calls.filter(item => item[0] === 'fillText')) {
        const [, value, x, y, font, align] = call
        const size = Number.parseInt(font.match(/\d+px/)[0], 10)
        const textWidth = value.length * size * .6
        const left = align === 'left' ? x : align === 'right' ? x - textWidth : x - textWidth / 2
        const right = left + textWidth
        assert.ok(left >= 0 && right <= width, `${value} clips horizontally at ${width}x${height}`)
        assert.ok(y - size / 2 >= 0 && y + size / 2 <= height, `${value} clips vertically at ${width}x${height}`)
      }
    }
  }
})

test('every section and obstacle renders without runtime randomness or browser globals', () => {
  const random = Math.random
  Math.random = () => { throw new Error('runtime random call') }
  try {
    assert.doesNotThrow(() => {
      for (const z of [80, 260, 480, 700, 900]) renderAt(z)
      for (const type of [FIRE, GAP, BRIDGE, FINISH, HURDLE, PISTON]) {
        const obstacle = RED_STAGE.obstacles.find(item => item[0] === type)
        renderAt(obstacle[1] - 20, {}, { ...RED_STAGE, obstacles:[obstacle] }, 195, 422)
      }
    })
  } finally {
    Math.random = random
  }
})

test('a run beyond the finish keeps the final section elevation', () => {
  const run = { ...createRun(RED_STAGE), mode:'success', z:1001 }
  const camera = { x:0, y:0, z:980, horizon:.3, focal:.9, shakeX:0, shakeY:0 }
  const ctx = recordingContext()

  render(ctx, run, camera, RED_STAGE, 320, 180)

  assert.deepEqual(ctx.calls[runnerAnchor(ctx.calls)], ['translate', 160, 8])
})

test('HUD shows stage deadline and bounded remaining seconds', () => {
  const stage={...RED_STAGE,timeLimit:45,obstacles:[]}
  for (const [time,text] of [[0,'45s LEFT'],[35,'10s LEFT'],[44.9,'1s LEFT'],[46,'0s LEFT']]) {
    const calls=renderAt(80,{time},stage)
    assert.ok(calls.some(c=>c[0]==='fillText'&&c[1]===text))
  }
  const title=renderAt(0,{mode:'title',time:0},stage)
  assert.ok(title.some(c=>c[0]==='fillText'&&c[1]==='FINISH IN 45s'))
})

test('deadline bar drains to zero and changes color in the last ten seconds', () => {
  const stage={...RED_STAGE,obstacles:[]}
  const bar=time=>renderAt(80,{time},stage).findLast(c=>c[0]==='fillRect'&&c[5]===3&&(c[1]===COBALT||c[1]===ORANGE))
  const full=bar(0),half=bar(22.5),late=bar(40),empty=bar(46)
  assert.ok(full && half && late && empty)
  assert.equal(half[4],full[4]/2)
  assert.equal(late[1],ORANGE)
  assert.equal(empty[4],0)
})

test('starting road extends below the viewport and HUD omits numeric speed', () => {
  const calls=renderAt(0,{mode:'title',speed:0},{...RED_STAGE,obstacles:[]},320,180)
  assert.ok(calls.some(c=>(c[0]==='lineTo'||c[0]==='moveTo')&&c[2]>180))
  assert.ok(!renderAt(80,{speed:29}).some(c=>c[0]==='fillText'&&String(c[1]).includes('M/S')))
})

test('every new course renders its own obstacles and start instructions on narrow screens',()=>{
  for(const stage of STAGES) {
    const calls=renderAt(0,{mode:'title',time:0},stage,195,422)
    assert.ok(calls.some(c=>c[0]==='fillText'&&c[1]===stage.hint))
    for(const obstacle of stage.obstacles) {
      const frame=renderAt(Math.max(0,obstacle[1]-20),{},stage,195,422)
      assert.ok(frame.every(c=>c.slice(1).every(v=>typeof v!=='number'||Number.isFinite(v))))
    }
  }
})

test('passed obstacle opacity affects its facets and restores the drawing state',()=>{
  const obstacle=obstacleRecipe(2,100),stage={...RED_STAGE,obstacles:[obstacle]}
  const run={...createRun(stage),mode:'running',time:1,z:103},ctx=recordingContext(),stack=[]
  ctx.save=()=>stack.push(ctx.globalAlpha)
  ctx.restore=()=>{ctx.globalAlpha=stack.pop()}
  renderer.drawObstacle(ctx,{obstacle,index:0},run,createCamera(run),stage,320,180)
  const facets=ctx.calls.filter(c=>c[0]==='fill')
  assert.ok(facets.length>0,'the passed obstacle must remain rendered')
  assert.ok(facets.every(c=>c[2]>0&&c[2]<.4),'internal painting must preserve near transparency')
  assert.equal(ctx.globalAlpha,1,'subsequent road, runner and HUD must remain opaque')
  assert.equal(stack.length,0)
})
