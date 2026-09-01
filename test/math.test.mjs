import test from 'node:test'
import assert from 'node:assert/strict'
import { clamp, projectPoint, roadEdges } from '../src/math.mjs'

test('clamp limits a scalar', () => {
  assert.equal(clamp(-2, 0, 1), 0)
  assert.equal(clamp(.4, 0, 1), .4)
  assert.equal(clamp(3, 0, 1), 1)
})

test('near points project larger and lower than far points', () => {
  const near = projectPoint(0, 0, 30, 960, 540)
  const far = projectPoint(0, 0, 300, 960, 540)
  assert.ok(near.scale > far.scale)
  assert.ok(near.y > far.y)
})

test('road narrows toward the horizon', () => {
  const near = roadEdges(30, 960, 540)
  const far = roadEdges(300, 960, 540)
  assert.ok(near.right - near.left > far.right - far.left)
})
