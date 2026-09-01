export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v

export function projectPoint(x, y, z, w, h) {
  const d = Math.max(12, z)
  const scale = 220 / d
  return { x: w / 2 + x * scale, y: h * .28 + 58 * scale - y * scale, scale }
}

export function roadEdges(z, w, h) {
  const a = projectPoint(-34, 0, z, w, h)
  const b = projectPoint(34, 0, z, w, h)
  return { left: a.x, right: b.x, y: a.y }
}
