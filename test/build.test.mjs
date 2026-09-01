import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { assertStandaloneHtml } from '../tools/build.mjs'

const limit = 13312

function build() {
  return execFileSync('node', ['tools/build.mjs'], { encoding:'utf8' })
}

function zipHash() {
  return createHash('sha256').update(readFileSync('dist/game.zip')).digest('hex')
}

test('standalone HTML guard rejects external resource references', () => {
  for (const forbidden of ['assets/', 'http://', 'https://']) {
    assert.throws(() => assertStandaloneHtml(`<script>${forbidden}</script>`), new RegExp(forbidden.replaceAll('/', '\\/')))
  }
})

test('build reports exact generated HTML and ZIP byte counts', () => {
  const output = build()
  assert.equal(output, `HTML: ${statSync('dist/index.html').size} bytes\nZIP: ${statSync('dist/game.zip').size} / ${limit} bytes\n`)
})

test('consecutive builds produce an identical submission ZIP', () => {
  build()
  const first = zipHash()
  build()
  assert.equal(zipHash(), first)
})

test('submission ZIP has one top-level index and fits the limit', () => {
  build()
  const names = execFileSync('unzip', ['-Z1', 'dist/game.zip'], { encoding:'utf8' }).trim().split('\n')
  assert.deepEqual(names, ['index.html'])
  assert.ok(statSync('dist/game.zip').size <= limit)
})
