export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v

export function projectPoint(camera, x, y, z, w, h) {
  const depth = Math.max(1, z - camera.z)
  const scale = Math.min(w, h) * camera.focal / depth
  return {
    x:w / 2 + (x - camera.x) * scale + camera.shakeX,
    y:h * camera.horizon - (y - camera.y) * scale + camera.shakeY,
    scale, depth
  }
}

export function logicalViewport(cssW, cssH) {
  const pixelScale = 2
  return {
    width:Math.ceil(cssW / pixelScale),
    height:Math.ceil(cssH / pixelScale),
    pixelScale
  }
}
