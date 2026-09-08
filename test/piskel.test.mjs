import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { inspectPng } from '../tools/png-info.mjs'
import { encodeIndexedPng } from '../tools/indexed-png.mjs'
import { encodePiskel, decodePiskel, compilePiskel } from '../tools/piskel.mjs'

const indexed = (width,height,indices,palette) => encodeIndexedPng({width,height,indices:Buffer.from(indices),palette})
const dataUrl = png => `data:image/png;base64,${png.toString('base64')}`
const project = (width,height,frameCount,layers,extra = {}) => JSON.stringify({
  modelVersion:2,
  piskel:{name:'fixture',description:'',width,height,fps:12,layers:layers.map(layer => JSON.stringify(layer)),hiddenFrames:[],...extra}
})

test('encodePiskel roundtrips every atlas RGBA pixel and writes the model-2 chunk layout', () => {
  const png = readFileSync(new URL('../assets/runtime/unicorn-chibi-atlas.png',import.meta.url))
  const source = inspectPng(png,{pixels:true})
  const text = encodePiskel(png,{name:'Unicorn runner',width:32,height:56,frameCount:5,fps:12})
  const json = JSON.parse(text), layer = JSON.parse(json.piskel.layers[0])
  assert.deepEqual(layer.chunks[0].layout,[[0],[1],[2],[3],[4]])
  const decoded = decodePiskel(text)
  assert.deepEqual({width:decoded.width,height:decoded.height,frameCount:decoded.frameCount,fps:decoded.fps},{width:32,height:56,frameCount:5,fps:12})
  assert.deepEqual(decoded.rgba,source.rgba)
})

test('decodePiskel follows two-dimensional chunk layouts and composites layer opacity', () => {
  const transparent = [0,0,0,0], red = [255,0,0,255], blueHalf = [0,0,255,128]
  const base = indexed(2,2,[1,2,2,1],[transparent,red,transparent])
  const top = indexed(2,2,[1,0,0,0],[transparent,blueHalf])
  const text = project(1,1,4,[
    {name:'base',opacity:1,frameCount:4,chunks:[{layout:[[0,2],[1,3]],base64PNG:dataUrl(base)}]},
    {name:'top',opacity:.5,frameCount:4,chunks:[{layout:[[0,2],[1,3]],base64PNG:dataUrl(top)}]}
  ])
  assert.deepEqual([...decodePiskel(text).rgba],[191,0,64,255,0,0,0,0,0,0,0,0,255,0,0,255])
})

test('decodePiskel rejects unsupported, hidden, incomplete, duplicated, and oversized projects', () => {
  const png = indexed(1,1,[1],[[0,0,0,0],[1,2,3,255]])
  const layer = {name:'x',opacity:1,frameCount:1,chunks:[{layout:[[0]],base64PNG:dataUrl(png)}]}
  assert.throws(() => decodePiskel('{'),/JSON|Piskel/i)
  assert.throws(() => decodePiskel(JSON.stringify({modelVersion:1,piskel:{}})),/modelVersion/i)
  assert.throws(() => decodePiskel(project(1,1,1,[layer],{hiddenFrames:[0]})),/hidden/i)
  assert.throws(() => decodePiskel(project(1,1,2,[{...layer,frameCount:2}])),/missing/i)
  assert.throws(() => decodePiskel(project(1,1,1,[{...layer,chunks:[...layer.chunks,...layer.chunks]}])),/duplicate/i)
  assert.throws(() => decodePiskel(project(1,1,1,[{...layer,chunks:[{layout:[[0]],base64PNG:'data:image/png;base64,***'}]}])),/chunk PNG/i)
  assert.throws(() => decodePiskel(project(2048,2048,1,[layer])),/limit|dimensions/i)
  assert.throws(() => decodePiskel(project(1,1,1,Array(65).fill(layer))),/layers|limit/i)
})

test('decodePiskel rejects ragged layouts and chunk PNGs larger than their declared grid', () => {
  const palette = [[0,0,0,0],[1,2,3,255]]
  const oversized = indexed(6,1,[1,1,1,1,1,1],palette)
  const fiveFrames = {name:'x',opacity:1,frameCount:5,chunks:[{layout:[[0],[1],[2],[3],[4]],base64PNG:dataUrl(oversized)}]}
  assert.throws(() => decodePiskel(project(1,1,5,[fiveFrames])),/dimensions|grid/i)

  const grid = indexed(3,2,[1,1,1,1,1,1],palette)
  const ragged = {...fiveFrames,chunks:[{layout:[[0,1],[2],[3,4]],base64PNG:dataUrl(grid)}]}
  assert.throws(() => decodePiskel(project(1,1,5,[ragged])),/rectangular|layout/i)
})

test('decodePiskel rejects padded null cells before inspecting chunk pixels', () => {
  const headerOnly = Buffer.alloc(24)
  Buffer.from([137,80,78,71,13,10,26,10]).copy(headerOnly)
  headerOnly.writeUInt32BE(13,8)
  headerOnly.write('IHDR',12)
  headerOnly.writeUInt32BE(6,16)
  headerOnly.writeUInt32BE(1,20)
  const layer = {name:'x',opacity:1,frameCount:5,chunks:[{
    layout:[[0],[1],[2],[3],[4],[null]],base64PNG:dataUrl(headerOnly)
  }]}
  assert.throws(() => decodePiskel(project(1,1,5,[layer])),/null|unused|padding/i)
})

test('compilePiskel enforces the runner contract, preserves transparency, and emits indexed PNG', () => {
  const runtime = readFileSync(new URL('../assets/runtime/unicorn-chibi-atlas.png',import.meta.url))
  const text = encodePiskel(runtime,{name:'Runner',width:32,height:56,frameCount:5,fps:12})
  const compiled = inspectPng(compilePiskel(text),{pixels:true})
  const source = inspectPng(runtime,{pixels:true})
  assert.equal(compiled.colorType,3)
  assert.equal(compiled.transparentPixels,source.transparentPixels)
  assert.equal(compiled.partialAlphaPixels,0)
  assert.deepEqual([...compiled.rgba.filter((_,i) => i%4 === 3)],[...source.rgba.filter((_,i) => i%4 === 3)])
  const wrong = encodePiskel(indexed(1,1,[0],[[0,0,0,0]]),{name:'x',width:1,height:1,frameCount:1,fps:12})
  assert.throws(() => compilePiskel(wrong),/32.*56|5 frames/i)
})

test('checked-in Piskel source reproduces the current runtime atlas', () => {
  const source = readFileSync(new URL('../assets/concepts/unicorn-runner.piskel',import.meta.url),'utf8')
  const runtime = readFileSync(new URL('../assets/runtime/unicorn-chibi-atlas.png',import.meta.url))
  assert.deepEqual(inspectPng(compilePiskel(source),{pixels:true}),inspectPng(runtime,{pixels:true}))
})
