import test from 'node:test'
import assert from 'node:assert/strict'
import {OBSTACLE_LABELS,OBSTACLE_RECIPES,obstacleRecipe} from '../src/obstacles.mjs'
import {STAGES,obstacleBounds,contactAt,validateStage} from '../src/stage.mjs'
import {createRun,stepRun} from '../src/sim.mjs'
import {MAP_ASSETS} from '../tools/map-settings-model.mjs'
const stage={...STAGES[0],length:200,sections:[[0,200,32,0,0,0,0]]}
const scene=id=>({...stage,obstacles:[obstacleRecipe(id,100),[3,200,0,28,4,18,0,0]]})
const bounds=(id,time)=>obstacleBounds(obstacleRecipe(id,100),time,stage)

test('twenty documented recipes are individually visible in the editor and used in real courses',()=>{
  assert.equal(OBSTACLE_RECIPES.length,20)
  assert.equal(OBSTACLE_LABELS.length,20)
  const used=new Set(STAGES.flatMap(s=>s.obstacles.map(o=>o[8])).filter(Boolean))
  assert.deepEqual([...used].sort((a,b)=>a-b),Array.from({length:20},(_,i)=>i+1))
  assert.equal(new Set(OBSTACLE_RECIPES.map(r=>JSON.stringify(r))).size,20)
  for(let id=1;id<=20;id++){
    assert.equal(MAP_ASSETS.filter(a=>a.variant===id).length,1)
    assert.deepEqual(validateStage(scene(id)),[])
  }
})

test('timed storms expose one pulse, two pulses and a distinct long active window',()=>{
  const transitions=id=>{
    const period=OBSTACLE_RECIPES[id-1][4]
    const phases=Array.from({length:1000},(_,i)=>bounds(id,i*period/1000).active)
    return phases.reduce((n,on,i)=>n+(on&&!phases[(i+999)%1000]),0)
  }
  assert.equal(transitions(5),1);assert.equal(transitions(6),2);assert.equal(transitions(8),1)
  assert.equal(bounds(5,.25*2.4).active,false)
  assert.equal(bounds(8,.25*3.3).active,true)
  assert.notEqual(bounds(7,0).x,bounds(7,.75).x)
})

test('moving forms change collision geometry in the same clock as their appearance',()=>{
  assert.notEqual(bounds(9,0).x,bounds(9,.75).x)
  const x=[.2,.4,.6].map(t=>bounds(10,t).x)
  assert.ok(Math.abs((x[1]-x[0])-(x[2]-x[1]))<1e-9,'comet must travel at constant horizontal speed')
  assert.ok(bounds(11,0).width<bounds(11,.85).width)
  assert.ok(bounds(12,0).bottom<bounds(12,1).bottom)
  assert.equal(bounds(12,0).x,bounds(12,1).x)
  const s=scene(4),run={...createRun(s),x:0,z:100,y:2,time:0}
  assert.equal(contactAt(s,run),null)
  assert.equal(contactAt(s,{...run,time:.75}).kind,'stumble')
})

test('side collapse leaves a usable lane and collapsing surfaces have distinct deadlines',()=>{
  assert.equal(contactAt(scene(15),{x:-14,z:100,y:0,time:0}),null)
  assert.equal(contactAt(scene(15),{x:0,z:100,y:0,time:0}).kind,'lava')
  for(const [id,expired] of [[17,false],[18,true]]){
    const s=scene(id),run={x:0,z:100,y:0,time:0,collapse:{index:0,timer:.4}}
    assert.equal(contactAt(s,run).kind,expired?'lava':'bridge')
  }
})

test('two launch pads produce measurably different launch heights through real contact',()=>{
  const launch=id=>{
    const s=scene(id),run={...createRun(s),mode:'running',z:100}
    return stepRun(run,{},1/120,s)
  }
  assert.equal(launch(19).vy,28);assert.equal(launch(20).vy,34)
  assert.equal(launch(19).springId,1)
})


test('the moon leaves real clearance overhead and retracted spikes allow ground passage',()=>{
  const moon=scene(12),run={x:0,z:100,y:0,time:1}
  assert.equal(contactAt(moon,run),null)
  assert.equal(contactAt(moon,{...run,time:3}).kind,'stumble')
  const spikes=scene(4)
  assert.equal(contactAt(spikes,{...run,time:0}),null)
  assert.equal(contactAt(spikes,{...run,time:.75}).kind,'stumble')
})
