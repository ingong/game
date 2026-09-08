import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createMapSettings} from '../tools/map-settings-model.mjs'
import {readMapDocument,saveMapDocument,assertLocalWrite} from '../tools/map-editor-store.mjs'
import {readPiskelDocument,savePiskelDocument} from '../tools/map-editor-server.mjs'

test('saving stage settings persists and regenerates all seven stages', () => {
  const root=mkdtempSync(join(tmpdir(),'map-store-'))
  try {
    mkdirSync(join(root,'config'))
    writeFileSync(join(root,'config/map-settings.json'),JSON.stringify(createMapSettings()))
    const initial=readMapDocument(root)
    initial.data.stages[0].visual.landmarks=true
    initial.data.stages[6].name="SAVED VIOLET"
    const saved=saveMapDocument(root,initial)
    assert.notEqual(saved.revision,initial.revision)
    assert.equal(readMapDocument(root).data.stages[0].visual.landmarks,true)
    assert.match(readFileSync(join(root,'src/generated/map-settings.mjs'),'utf8'),/"landmarks":true/)
    assert.match(readFileSync(join(root,'src/generated/map-settings.mjs'),'utf8'),/SAVED VIOLET/)
    assert.throws(() => saveMapDocument(root,initial),/다른 창|conflict/i)
    const invalid={data:{...saved.data,version:2},revision:saved.revision}
    assert.throws(() => saveMapDocument(root,invalid),/version/)
    assert.equal(readMapDocument(root).revision,saved.revision)
  } finally {rmSync(root,{recursive:true,force:true})}
})

test('local writes require matching origin, host and JSON content type', () => {
  const headers={host:'127.0.0.1:4175',origin:'http://127.0.0.1:4175','content-type':'application/json'}
  assert.doesNotThrow(() => assertLocalWrite(headers))
  for (const patch of [{origin:'https://other.example'},{host:'other.example'}, {origin:undefined}, {'content-type':'text/plain'}]) {
    assert.throws(() => assertLocalWrite({...headers,...patch}))
  }
})

test('Piskel imports validate before writing and update source, atlas and embedding together', () => {
  const root=mkdtempSync(join(tmpdir(),'piskel-store-'))
  const paths=['assets/concepts/unicorn-runner.piskel','assets/runtime/unicorn-chibi-atlas.png','src/generated/assets.mjs']
  try {
    for(const path of paths) {
      mkdirSync(join(root,path,'..'),{recursive:true})
      writeFileSync(join(root,path),readFileSync(new URL('../'+path,import.meta.url)))
    }
    const initial=readPiskelDocument(root), before=paths.map(path=>readFileSync(join(root,path)))
    assert.throws(()=>savePiskelDocument(root,{text:'broken',revision:initial.revision}),/Piskel/)
    paths.forEach((path,i)=>assert.deepEqual(readFileSync(join(root,path)),before[i]))
    const model=JSON.parse(initial.text),layer=JSON.parse(model.piskel.layers[0]);layer.opacity=0
    model.piskel.layers[0]=JSON.stringify(layer)
    const saved=savePiskelDocument(root,{text:JSON.stringify(model),revision:initial.revision})
    assert.notEqual(saved.revision,initial.revision)
    const atlas=readFileSync(join(root,paths[1]))
    assert.notDeepEqual(atlas,before[1])
    assert.ok(readFileSync(join(root,paths[2]),'utf8').includes(atlas.toString('base64')))
    assert.throws(()=>savePiskelDocument(root,{text:initial.text,revision:initial.revision}),/다른 창/)
    assert.equal(readPiskelDocument(root).revision,saved.revision)
  } finally {rmSync(root,{recursive:true,force:true})}
})
