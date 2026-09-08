import test from 'node:test'
import assert from 'node:assert/strict'

test('runner sheet replacement settles only after the image load event', async () => {
  const previousImage = globalThis.Image
  let image
  globalThis.Image = class {
    constructor() { image = this }
    set src(value) { this._src = value }
  }
  try {
    const art = await import(`../src/art.mjs?editor-preview=${Date.now()}`)
    const loaded = art.setRunnerSheetSource('/runner.png')
    let settled = false
    loaded.finally(() => { settled = true })
    await Promise.resolve()
    assert.equal(settled, false)
    image.onload()
    await loaded
    assert.equal(settled, true)

    const failed = art.setRunnerSheetSource('/broken.png')
    image.onerror()
    await assert.rejects(failed, /runner sheet/i)
  } finally {
    if (previousImage === undefined) delete globalThis.Image
    else globalThis.Image = previousImage
  }
})

test('runner sheet replacement is a harmless resolved promise without Image', async () => {
  const previousImage = globalThis.Image
  delete globalThis.Image
  try {
    const art = await import(`../src/art.mjs?editor-preview-node=${Date.now()}`)
    await assert.doesNotReject(art.setRunnerSheetSource('/runner.png'))
  } finally {
    if (previousImage !== undefined) globalThis.Image = previousImage
  }
})
