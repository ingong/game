import test from 'node:test'
import assert from 'node:assert/strict'

// Browser Image decode state is the boundary; exercise the real renderer.
test('loaded atlas draws valid full frames for every movement state', async t => {
  const previous = globalThis.Image
  t.after(() => { if (previous) globalThis.Image = previous; else delete globalThis.Image })
  let sheet
  globalThis.Image = class {
    complete = true
    naturalWidth = 160
    constructor() { sheet = this }
  }
  const { drawRunnerSprite:drawRunner } = await import('../src/art.mjs?sprite-test')
  const calls = []
  const ctx = {
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    drawImage(...args) { calls.push(args) },
    fillRect() { calls.push('fallback') }
  }
  const base = { mode:'running', anim:0, grounded:true, jumps:0, stumble:0, landing:0 }
  const cases = [
    [{ mode:'title' },0], [{ anim:0 },1], [{ anim:.25 },0], [{ anim:.5 },2], [{ anim:.75 },0],
    [{ grounded:false, jumps:1 },3], [{ grounded:false, jumps:2 },3], [{ stumble:.2 },4], [{ landing:1 },4]
  ]
  for (const [state,frame] of cases) {
    calls.length = 0
    drawRunner(ctx,{ ...base,...state },100,200,1)
    assert.deepEqual(calls,[[sheet,frame*32,0,32,56,-17,-60,34,60]])
  }
  sheet.naturalWidth = 0
  calls.length = 0
  drawRunner(ctx,base,100,200,1)
  assert.ok(calls.length > 0 && calls.every(call => call === 'fallback'), 'failed decode must use geometry')
})
