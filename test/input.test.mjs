import test from 'node:test'
import assert from 'node:assert/strict'
import { createInput } from '../src/input.mjs'

function fakeEventTarget() {
  const listeners = new Map()
  return {
    addEventListener(type, listener) { listeners.set(type, listener) },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type)
    },
    dispatch(type, code) {
      listeners.get(type)?.({ code, preventDefault() {} })
    },
    listeners
  }
}

test('blur resets input state and destroy removes its listener', () => {
  const target = fakeEventTarget()
  const input = createInput(target)

  target.dispatch('keydown', 'ArrowRight')
  target.dispatch('keydown', 'Space')
  target.dispatch('blur')

  const afterBlur = input.read()
  assert.equal(afterBlur.right, false)
  assert.equal(afterBlur.jumpPressed, false)

  target.dispatch('keydown', 'Space')
  assert.equal(input.read().jumpPressed, true)

  input.destroy()
  assert.equal(target.listeners.has('blur'), false)
})
