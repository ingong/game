import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { assertStandaloneHtml } from '../tools/build.mjs'

function build() {
  return execFileSync(process.execPath, ['tools/build.mjs'], { encoding:'utf8' })
}

test('build guard rejects network resources', () => {
  assert.doesNotThrow(() => assertStandaloneHtml('<script>game()</script>'))
  for (const forbidden of ['http://', 'https://']) {
    assert.throws(() => assertStandaloneHtml(`<script>${forbidden}</script>`), new RegExp(forbidden.replaceAll('/', '\\/')))
  }
})

test('build reports a standalone game without runtime assets', () => {
  assert.equal(build(), 'Built dist/index.html\n')
})

test('submission archive contains only index.html', () => {
  build()
  const listing = execFileSync('unzip', ['-Z1', 'dist/game.zip'], { encoding:'utf8' }).trim().split('\n')
  assert.deepEqual(listing, ['index.html'])
})
