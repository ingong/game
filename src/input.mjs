const handled = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'])

export function createInput(target) {
  const held = new Set()
  let jumpPressed = false

  const down = event => {
    if (!handled.has(event.code)) return
    event.preventDefault()
    if (event.code === 'Space' && !held.has('Space')) jumpPressed = true
    held.add(event.code)
  }

  const up = event => {
    if (!handled.has(event.code)) return
    event.preventDefault()
    held.delete(event.code)
  }

  const blur = () => {
    held.clear()
    jumpPressed = false
  }

  target.addEventListener('keydown', down)
  target.addEventListener('keyup', up)
  target.addEventListener('blur', blur)

  return {
    read() {
      const input = {
        left:held.has('ArrowLeft'),
        right:held.has('ArrowRight'),
        up:held.has('ArrowUp'),
        down:held.has('ArrowDown'),
        jumpPressed
      }
      jumpPressed = false
      return input
    },

    destroy() {
      target.removeEventListener('keydown', down)
      target.removeEventListener('keyup', up)
      target.removeEventListener('blur', blur)
    }
  }
}
