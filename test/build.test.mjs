import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'

test('submission ZIP has one top-level index and fits the limit', () => {
  execFileSync('node', ['tools/build.mjs'], { stdio:'pipe' })
  const names = execFileSync('unzip', ['-Z1', 'dist/game.zip'], { encoding:'utf8' }).trim().split('\n')
  assert.deepEqual(names, ['index.html'])
  assert.ok(statSync('dist/game.zip').size <= 13312)
})
