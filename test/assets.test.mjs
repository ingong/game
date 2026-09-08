import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import * as tools from '../tools/assets.mjs'
import { renderCatalog } from '../tools/asset-catalog.mjs'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'js13k-assets-'))
  t.after(() => rmSync(root, { recursive:true, force:true }))
  mkdirSync(join(root, 'assets/runtime'), { recursive:true })
  mkdirSync(join(root, 'src'), { recursive:true })
  const atlas = readFileSync(new URL('../assets/concepts/unicorn-chibi-atlas-legacy.png', import.meta.url))
  writeFileSync(join(root, 'assets/runtime/runner.png'), atlas)
  const manifest = { version:1, assets:[{
    id:'runner', title:'Runner', kind:'image', role:'runtime', path:'assets/runtime/runner.png',
    source:{ kind:'project', author:'Project', evidence:'Fixture' },
    license:{ id:'project-original', note:'Original test fixture' },
    width:160, height:56, budgetBytes:3000, exportName:'RUNNER',
    frames:{ width:32, height:56, names:['contact','stride-left','stride-right-mirrored','jump','impact'] }
  }] }
  const save = () => writeFileSync(join(root, 'assets/manifest.json'), JSON.stringify(manifest))
  save()
  return { root, manifest, save, atlas }
}

test('generation embeds the exact PNG and frame contract; check detects drift without writing', async t => {
  const { root, atlas } = fixture(t)
  tools.generateAssets({ root })
  const generatedPath = join(root, 'src/generated/assets.mjs')
  const source = readFileSync(generatedPath, 'utf8')
  const generated = await import(pathToFileURL(generatedPath))
  assert.deepEqual(Buffer.from(generated.RUNNER_SHEET_SRC.split(',')[1], 'base64'), atlas)
  assert.equal(generated.RUNNER_FRAME_WIDTH, 32)
  assert.equal(generated.RUNNER_FRAME_HEIGHT, 56)
  assert.equal(generated.RUNNER_FRAME_COUNT, 5)
  tools.generateAssets({ root })
  assert.equal(readFileSync(generatedPath, 'utf8'), source)
  writeFileSync(generatedPath, '// stale')
  assert.throws(() => tools.generateAssets({ root, check:true }), /assets:generate/)
  assert.equal(readFileSync(generatedPath, 'utf8'), '// stale')
})

test('audit rejects missing files, unregistered files, and duplicate IDs', t => {
  const { root, manifest, save } = fixture(t)
  manifest.assets.push({ ...manifest.assets[0], path:'assets/runtime/missing.png' })
  save()
  writeFileSync(join(root, 'assets/forgotten.bin'), 'unregistered')
  const { errors } = tools.auditAssets({ root })
  assert.ok(errors.some(error => /duplicate.*runner/i.test(error)))
  assert.ok(errors.some(error => /missing.png/.test(error)))
  assert.ok(errors.some(error => /unregistered.*forgotten.bin/i.test(error)))
})

test('audit rejects invalid frames, exceeded runtime budgets, and unknown sources', t => {
  const { root, manifest, save } = fixture(t)
  manifest.assets[0].frames.width = 33
  manifest.assets[0].budgetBytes = 10
  manifest.assets[0].derivedFrom = ['unknown-source']
  save()
  const { errors } = tools.auditAssets({ root })
  assert.ok(errors.some(error => /frame/i.test(error)))
  assert.ok(errors.some(error => /budget/i.test(error)))
  assert.ok(errors.some(error => /unknown-source/.test(error)))
  assert.throws(() => tools.generateAssets({ root }), /frame/i)
})

test('audit rejects reference assets promoted into the runtime and paths outside their role', t => {
  const { root, manifest, save } = fixture(t)
  manifest.assets[0].source.kind = 'external'
  manifest.assets[0].license.id = 'custom-reference-only'
  save()
  assert.ok(tools.auditAssets({ root }).errors.some(error => /runtime.*project/i.test(error)))
  manifest.assets[0].path = '../outside.png'
  save()
  assert.ok(tools.auditAssets({ root }).errors.some(error => /path/i.test(error)))
})

test('audit requires provenance and detects unregistered inline images', t => {
  const { root, manifest, save } = fixture(t)
  delete manifest.assets[0].license
  save()
  writeFileSync(join(root, 'src/leak.mjs'), "export const leak='data:image/png;base64,AAAA'")
  const { errors } = tools.auditAssets({ root })
  assert.ok(errors.some(error => /license/i.test(error)))
  assert.ok(errors.some(error => /inline.*leak.mjs/i.test(error)))
})

test('audit reports measured PNG size, transparency defects, and exact duplicates', t => {
  const { root, manifest, save, atlas } = fixture(t)
  mkdirSync(join(root, 'assets/concepts'), { recursive:true })
  writeFileSync(join(root, 'assets/concepts/copy.png'), atlas)
  manifest.assets.push({ ...manifest.assets[0], id:'copy', role:'concept', path:'assets/concepts/copy.png' })
  save()
  const report = tools.auditAssets({ root })
  assert.deepEqual(report.errors, [])
  const runner = report.assets.find(asset => asset.id === 'runner')
  assert.equal(runner.bytes, 2402)
  assert.equal(runner.image.width, 160)
  assert.equal(runner.image.height, 56)
  assert.equal(runner.image.transparentPixels, 0)
  assert.ok(runner.image.partialAlphaPixels > 0)
  assert.ok(report.warnings.some(warning => /transparen/i.test(warning)))
  assert.ok(report.warnings.some(warning => /duplicate/i.test(warning)))
})

test('PNG inspection rejects corrupted content', async () => {
  const { inspectPng } = await import('../tools/png-info.mjs')
  assert.throws(() => inspectPng(Buffer.from('not a PNG')), /PNG/)
  // A known 1x1 opaque PNG; corrupting IHDR must fail integrity validation.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=', 'base64')
  png[20] ^= 1
  assert.throws(() => inspectPng(png), /CRC|PNG/)
})

test('audit rejects runner layouts that omit the landing frame even when the grid fits', t => {
  const { root, manifest, save } = fixture(t)
  manifest.assets[0].frames = { width:40, height:56, names:['contact','left','right','jump'] }
  save()
  assert.ok(tools.auditAssets({ root }).errors.some(error => /RUNNER.*frame/.test(error)))
})

test('audit reports invalid manifest types without throwing', t => {
  const { root, manifest, save } = fixture(t)
  writeFileSync(join(root,'assets/manifest.json'), 'null')
  assert.ok(tools.auditAssets({ root }).errors.length > 0)
  manifest.assets[0].id = 123
  save()
  assert.ok(tools.auditAssets({ root }).errors.some(error => /invalid ID/.test(error)))
})

test('non-string export names cannot bypass the runner frame contract', t => {
  const { root, manifest, save } = fixture(t)
  manifest.assets[0].exportName = ['RUNNER']
  manifest.assets[0].frames = { width:40, height:56, names:['contact','left','right','jump'] }
  save()
  assert.ok(tools.auditAssets({ root }).errors.some(error => /exportName/.test(error)))
  assert.throws(() => tools.generateAssets({ root }), /exportName/)
})

test('catalog remains available to diagnose malformed metadata', t => {
  const { root, manifest, save } = fixture(t)
  manifest.assets[0].review = 'Invalid list'
  manifest.assets[0].derivedFrom = 'Invalid list'
  manifest.assets[0].frames.names = null
  save()
  const report = tools.auditAssets({ root })
  assert.ok(report.errors.length >= 3)
  const html = renderCatalog(report)
  assert.ok(html.includes('review must be a list'))
  assert.ok(html.includes('derivedFrom must be an ID list'))
  assert.ok(html.includes('frame grid'))
})

test('runtime provenance checks reference ancestors through concept sheets', t => {
  const { root, manifest, save, atlas } = fixture(t)
  mkdirSync(join(root,'assets/concepts'),{ recursive:true })
  mkdirSync(join(root,'assets/references'),{ recursive:true })
  writeFileSync(join(root,'assets/concepts/sheet.png'),atlas)
  writeFileSync(join(root,'assets/references/source.png'),atlas)
  manifest.assets[0].derivedFrom = ['sheet']
  manifest.assets.push({ ...manifest.assets[0], id:'sheet', role:'concept', path:'assets/concepts/sheet.png', derivedFrom:['external'] })
  manifest.assets.push({ ...manifest.assets[0], id:'external', role:'reference', path:'assets/references/source.png', derivedFrom:[] })
  save()
  assert.ok(tools.auditAssets({ root }).errors.some(error => /runner.*reference.*external/i.test(error)))
})
