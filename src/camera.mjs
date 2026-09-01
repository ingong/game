const spring = (position, velocity, target, frequency, dt) => {
  const f = 1 + 2 * dt * frequency
  const oo = frequency * frequency
  const hoo = dt * oo
  const hhoo = dt * hoo
  const inv = 1 / (f + hhoo)
  return [
    (f * position + dt * velocity + hhoo * target) * inv,
    (velocity + hoo * (target - position)) * inv
  ]
}

export function createCamera(run, ground = 0) {
  const speed = run.speed || 0
  return {
    x:run.x * .55,
    y:ground + 8 + (run.y || 0) * .18,
    z:run.z - 20 - speed * .12,
    vx:0,
    vy:0,
    vz:0,
    horizon:.30 - .035 * speed / 34,
    horizonVelocity:0,
    focal:.9,
    shakeX:0,
    shakeY:0,
    lastLandingId:run.landingId || 0,
    lastStumbleId:run.stumbleId || 0
  }
}

export function stepCamera(camera, run, dt, ground = 0) {
  const next = { ...camera }
  const speed = run.speed || 0

  ;[next.x, next.vx] = spring(next.x, next.vx, run.x * .55, 7, dt)
  ;[next.y, next.vy] = spring(next.y, next.vy, ground + 8 + (run.y || 0) * .18, 5, dt)
  ;[next.z, next.vz] = spring(next.z, next.vz, run.z - 20 - speed * .12, 8, dt)
  ;[next.horizon, next.horizonVelocity] = spring(next.horizon, next.horizonVelocity, .30 - .035 * speed / 34, 4, dt)

  if ((run.landingId || 0) !== next.lastLandingId) next.shakeY += 2.2
  if ((run.stumbleId || 0) !== next.lastStumbleId) next.shakeX += 2.6 * Math.sign(run.x - camera.x || 1)

  const decay = Math.exp(-12 * dt)
  next.shakeX *= decay
  next.shakeY *= decay
  next.lastLandingId = run.landingId || 0
  next.lastStumbleId = run.stumbleId || 0
  return next
}
