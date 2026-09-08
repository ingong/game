import test from 'node:test'
import assert from 'node:assert/strict'
import { createMapSettings, validateMapSettings, runtimeMapSource } from '../tools/map-settings-model.mjs'

test('seven slots contain seven playable prototype stages', () => {
  const data = createMapSettings()
  assert.deepEqual(validateMapSettings(data),[])
  assert.deepEqual(data.stages.map(s => s.id),[1,2,3,4,5,6,7])
  assert.deepEqual(data.stages.map(s => s.state),Array(7).fill('playable'))
  assert.equal(data.stages[0].visual.landmarks,false)
  assert.equal(data.stages[0].visual.ripples,0)
})

test('invalid controls and unsupported stage changes are rejected', () => {
  for (const mutate of [
    d => d.stages.pop(), d => d.stages[1].id=1, d => d.stages[1].state='draft',
    d => d.stages[0].visual.sky='url(bad)', d => d.stages[0].visual.scale=Infinity,
    d => d.stages[0].visual.spacing=0, d => d.stages[0].visual.landmarks='false',
    d => d.stages[0].visual.ripples=2.5, d => d.stages[0].visual.extra=1,
    d => d.stages[0].name='', d => d.stages[0].visual=null
  ]) {
    const data=createMapSettings(); mutate(data)
    assert.ok(validateMapSettings(data).length)
  }
  for (const data of [null,[],{}, {version:1,stages:[null]}]) assert.ok(validateMapSettings(data).length)
})

test('every stage setting is included in the generated runtime', () => {
  const data=createMapSettings(), before=runtimeMapSource(data)
  data.stages[6].name='UNSHIPPED_STAGE_SEVEN'
  data.stages[6].visual.sky='#abcdef'
  assert.notEqual(runtimeMapSource(data),before)
  data.stages[0].visual.sky='#abcdef'
  assert.notEqual(runtimeMapSource(data),before)
  assert.ok(runtimeMapSource(data).includes('UNSHIPPED_STAGE_SEVEN'))
})
