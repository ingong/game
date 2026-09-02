# 스프링으로 지연 추적 2.5D 카메라 만들기

## 배경

JS13K 게임을 만들면서 3인칭 러너 카메라를 구현했다. 처음에는 캐릭터를 화면 아래쪽에 고정하고 도로와 장애물만 다가오게 그렸다. 달리는 모습은 나오지만 방향키를 눌러도 제자리에서 발만 구르는 느낌이었다.

캐릭터와 카메라가 동시에 똑같이 움직이면 둘의 상대 위치는 그대로다. 화면에서도 이동이 거의 보이지 않는다. 캐릭터가 먼저 움직이고 카메라가 조금 늦게 따라와야 했다.

그래서 카메라를 단순한 렌더링 옵션이 아니라 위치와 속도를 가진 게임 상태로 분리했다.

## 2.5D는 3D 좌표를 2D 캔버스에 그리는 방식이다

게임 월드는 `x`, `y`, `z` 세 좌표를 쓴다. `x`는 도로의 좌우, `y`는 점프 높이, `z`는 전진 거리다. WebGL은 사용하지 않았다. 좌표를 직접 변환한 뒤 Canvas 2D로 도로와 캐릭터를 그린다.

```js
function projectPoint(camera, x, y, z, width, height) {
  const depth = Math.max(1, z - camera.z);
  const scale = Math.min(width, height) * camera.focal / depth;

  return {
    x: width / 2 + (x - camera.x) * scale + camera.shakeX,
    y: height * camera.horizon - (y - camera.y) * scale + camera.shakeY,
    scale,
    depth,
  };
}
```

카메라와 가까워서 `depth`가 작으면 크게 그려지고, 멀면 작게 그려진다. 도로와 장애물의 꼭짓점마다 같은 계산을 적용하면 멀리 있는 도로는 수평선에 모이고 가까운 장애물은 화면을 향해 커진다.

충돌 판정은 월드 좌표에서 처리한다. 카메라가 흔들리거나 투영 비율이 달라져도 충돌 영역은 움직이지 않는다.

## 카메라의 목표는 캐릭터 위치와 같지 않다

카메라가 따라갈 목표 위치를 이렇게 정했다.

```js
const targetX = runner.x * 0.55;
const targetY = ground + 8 + runner.y * 0.18;
const targetZ = runner.z - 20 - runner.speed * 0.12;
const targetHorizon = 0.30 - 0.035 * runner.speed / 34;
```

좌우로는 캐릭터 이동량의 55%만 따라간다. 캐릭터가 오른쪽으로 10만큼 이동하면 카메라 목표는 5.5만 움직인다. 나머지 4.5는 화면에 실제 이동으로 남는다.

점프 높이는 18%만 반영했다. 카메라가 점프를 그대로 복사하면 캐릭터는 화면에서 움직이지 않고 도로만 내려간다. 일부만 따라가게 하니 캐릭터가 화면 위로 솟는다.

전진 방향에서는 기본 20만큼 뒤에 둔다. 최고 속도 34에서는 거리가 24.08로 늘어난다. 수평선도 화면 높이의 30%에서 26.5%로 올라가 앞쪽 도로를 더 보여준다.

## 바로 대입하지 않고 감쇠 스프링으로 따라간다

`camera.x = targetX`처럼 바로 대입하면 지연이 없다. 처음에는 선형 보간을 적용했다.

```js
camera.x += (targetX - camera.x) * 0.1;
```

코드는 짧지만 프레임마다 같은 비율을 적용해 주사율의 영향을 받는다. 카메라 자체의 속도도 없다. 대신 위치와 속도를 함께 갱신하는 임계 감쇠 스프링을 사용했다.

```js
function spring(position, velocity, target, frequency, dt) {
  const f = 1 + 2 * dt * frequency;
  const oo = frequency * frequency;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const inv = 1 / (f + hhoo);

  return [
    (f * position + dt * velocity + hhoo * target) * inv,
    (velocity + hoo * (target - position)) * inv,
  ];
}
```

목표가 바뀌면 카메라는 먼저 가속하고, 가까워지면 속도를 줄인다. 임계 감쇠라 목표 주변에서 여러 번 출렁이지 않는다. `frequency`가 크면 빨리 따라가고 작으면 묵직하게 늦어진다.

축마다 원하는 반응 속도가 달라 값을 따로 줬다.

```js
[camera.x, camera.vx] = spring(camera.x, camera.vx, targetX, 7, dt);
[camera.y, camera.vy] = spring(camera.y, camera.vy, targetY, 5, dt);
[camera.z, camera.vz] = spring(camera.z, camera.vz, targetZ, 8, dt);
[camera.horizon, camera.horizonVelocity] = spring(
  camera.horizon,
  camera.horizonVelocity,
  targetHorizon,
  4,
  dt,
);
```

전진 방향은 8, 좌우는 7, 높이는 5로 정했다. 수평선은 4로 가장 느리게 바꿨다. 직접 플레이하면서 화면이 튀지 않으면서도 조작이 보이는 지점을 찾았다.

## 흔들림은 추적 위치와 분리했다

착지와 장애물 충돌까지 스프링 목표에 섞으면 카메라가 원래 구도로 돌아오는 시간을 예측하기 어려웠다. 흔들림은 별도의 화면 오프셋으로 더했다.

```js
if (runner.landingId !== camera.lastLandingId) {
  camera.shakeY += 2.2;
}

if (runner.stumbleId !== camera.lastStumbleId) {
  camera.shakeX += 2.6 * Math.sign(runner.x - camera.x || 1);
}

camera.lastLandingId = runner.landingId;
camera.lastStumbleId = runner.stumbleId;

const decay = Math.exp(-12 * dt);
camera.shakeX *= decay;
camera.shakeY *= decay;
```

두 ID는 사건이 일어날 때만 증가한다. 착지 상태가 여러 프레임 유지되어도 충격은 한 번만 들어간다. 추적 스프링은 월드에서의 움직임을 맡고, `shakeX`, `shakeY`는 화면 피드백만 맡는다.

## 카메라도 고정 시간 간격으로 갱신한다

러너와 카메라는 모두 1/120초 고정 스텝에서 업데이트한다.

```js
const STEP = 1 / 120;

while (accumulator >= STEP) {
  runner = stepRunner(runner, controls, STEP);
  camera = stepCamera(camera, runner, STEP, ground);
  accumulator -= STEP;
}
```

캐릭터는 고정 스텝인데 카메라만 렌더링 프레임의 `dt`를 쓰면 둘의 상대 위치가 기기마다 달라질 수 있다. 같은 루프에 넣으니 600스텝 뒤 목표에 수렴하는지, 착지 흔들림이 일정하게 줄어드는지도 테스트할 수 있었다.

## 정리

1. 2.5D는 `x`, `y`, `z` 월드 좌표를 깊이에 따라 확대하거나 축소해 Canvas 2D에 그릴 수 있다.
2. 카메라 목표를 캐릭터 위치와 똑같이 두지 않았다. 좌우 이동의 55%, 점프의 18%만 따라가게 해서 조작이 화면에 남도록 했다.
3. 위치와 속도를 함께 계산하는 감쇠 스프링을 사용하면 카메라가 튀지 않고 늦게 따라온다. 축마다 주파수를 달리해 반응 속도도 조절할 수 있다.
4. 착지와 충돌 흔들림은 추적 스프링과 분리하고, 러너와 카메라는 같은 1/120초 고정 스텝에서 갱신했다.

카메라 코드를 추가하고 나서야 방향 전환이 캐릭터의 움직임으로 보이기 시작했다. 같은 러너와 같은 도로였는데 조작감은 완전히 달라졌다.
