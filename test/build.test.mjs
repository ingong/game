import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { assertStandaloneHtml } from '../tools/build.mjs'

const asset = 'assets/unicorn-runner-sprite-concept.png'

function build() {
  return execFileSync('node', ['tools/build.mjs'], { encoding:'utf8' })
}

test('build guard permits local assets and rejects network resources', () => {
  assert.doesNotThrow(() => assertStandaloneHtml(`<script src="./${asset}"></script>`))
  for (const forbidden of ['http://', 'https://']) {
    assert.throws(() => assertStandaloneHtml(`<script>${forbidden}</script>`), new RegExp(forbidden.replaceAll('/', '\\/')))
  }
})

test('build reports generated game and runtime asset without size accounting', () => {
  const output = build()
  assert.equal(output, `Built dist/index.html and dist/${asset}\n`)
})

test('build copies the approved sprite sheet byte-for-byte', () => {
  build()
  assert.deepEqual(
    readFileSync(`dist/${asset}`),
    readFileSync(`src/${asset}`)
  )
})

test('submission ZIP includes the local runtime asset', () => {
  build()
  const names = execFileSync('unzip', ['-Z1', 'dist/game.zip'], { encoding:'utf8' }).trim().split('\n')
  assert.deepEqual(names, ['index.html', asset])
})
