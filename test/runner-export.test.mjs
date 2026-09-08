import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync,writeFileSync,mkdtempSync,rmSync } from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import { inspectPng } from '../tools/png-info.mjs'

import * as tools from '../tools/runner-export.mjs'

test('runtime export makes the matte transparent and retains pale interior colors', () => {
  const source = { width:4,height:1,rgba:Buffer.from([
    255,255,255,255, 245,247,248,255, 235,226,220,255, 32,48,80,255
  ]) }
  const result = tools.packPixels(source,{ width:4,height:1,palette:['#ebe2dc','#203050'],matteMin:240 })
  assert.deepEqual([...result.indices],[0,0,1,2])
  const png = tools.encodeIndexedPng(result)
  const decoded = inspectPng(png,{ pixels:true })
  assert.equal(decoded.transparentPixels,2)
  assert.equal(decoded.opaquePixels,2)
  assert.equal(decoded.partialAlphaPixels,0)
  assert.deepEqual([...decoded.rgba.subarray(8)],[235,226,220,255,32,48,80,255])
})

test('nearest-neighbor export honors the recorded crop and preserves alpha', () => {
  const source = { width:4,height:1,rgba:Buffer.from([
    200,0,0,255, 0,200,0,0, 0,0,200,255, 200,0,0,255
  ]) }
  const result = tools.packPixels(source,{ width:2,height:1,crop:[1,0,2,1],palette:['#c80000','#0000c8'] })
  assert.deepEqual([...result.indices],[0,2])
  assert.throws(() => tools.packPixels(source,{ width:2,height:1,crop:[0,0,5,1],palette:['#000'] }), /crop|palette/i)
})

test('the shipped atlas is reproducible from the edited source and export recipe', () => {
  const expected = tools.compileRunner()
  const actual = readFileSync(new URL('../assets/runtime/unicorn-chibi-atlas.png',import.meta.url))
  assert.deepEqual(actual,expected)
  const info = inspectPng(actual)
  assert.equal(info.width,160)
  assert.equal(info.height,56)
  assert.ok(info.transparentPixels > 0)
  assert.ok(info.opaquePixels > 0)
  assert.equal(info.partialAlphaPixels,0)
  assert.ok(actual.length <= 3000)
})

test('check mode rejects a changed Piskel source without rewriting the runtime atlas', () => {
  const target = new URL('../assets/runtime/unicorn-chibi-atlas.png',import.meta.url)
  const before = readFileSync(target)
  const original = tools.RUNNER_EXPORT.source
  const dir=mkdtempSync(join(tmpdir(),'piskel-drift-'))
  const model=JSON.parse(readFileSync(new URL('../assets/concepts/unicorn-runner.piskel',import.meta.url),'utf8'))
  const layer=JSON.parse(model.piskel.layers[0]);layer.opacity=0
  model.piskel.layers[0]=JSON.stringify(layer)
  writeFileSync(join(dir,'changed.piskel'),JSON.stringify(model))
  try {
    tools.RUNNER_EXPORT.source = join(dir,'changed.piskel')
    assert.throws(() => tools.exportRunner({check:true}), /Runner export is stale/)
    assert.deepEqual(readFileSync(target),before)
  } finally {
    tools.RUNNER_EXPORT.source = original
    rmSync(dir,{recursive:true,force:true})
  }
})
