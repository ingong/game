import test from 'node:test'
import assert from 'node:assert/strict'
import {stageAfterRun} from '../src/progression.mjs'
import {STAGES,validateStage} from '../src/stage.mjs'

test('clear advances, failure retries and final clear wraps to stage one',()=>{
  for(let i=0;i<7;i++) {
    assert.equal(stageAfterRun(i,'failure'),i)
    assert.equal(stageAfterRun(i,'title'),i)
    assert.equal(stageAfterRun(i,'success'),(i+1)%7)
  }
})
test('stage variants share patterns but do not alias mutable obstacle arrays',()=>{
  assert.equal(STAGES.length,7)
  for(const stage of STAGES)assert.deepEqual(validateStage(stage),[])
  assert.notDeepEqual(STAGES[0].obstacles,STAGES[1].obstacles)
  assert.notEqual(STAGES[0].obstacles[0],STAGES[1].obstacles[0])
  assert.deepEqual(STAGES.map(s=>s.id),[1,2,3,4,5,6,7])
})

test('courses require distinct obstacle sequences and positions, not palette-only variants',()=>{
  const signatures=STAGES.map(s=>JSON.stringify(s.obstacles.map(o=>[o[0],o[1]])))
  assert.equal(new Set(signatures).size,7)
  assert.ok(new Set(STAGES.map(s=>s.length)).size>=4)
  assert.ok(STAGES.every(s=>typeof s.hint==='string'&&s.hint.length>0))
})

test('each course mixes at least three obstacle families',()=>{
  for(const stage of STAGES) {
    assert.ok(new Set(stage.obstacles.filter(o=>o[0]!==3).map(o=>o[0])).size>=3,stage.name)
  }
})
