import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a0b10, 70, 420);
scene.background = new THREE.Color("#0d1b2e");

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  650
);

const clock = new THREE.Clock();

function makeSvgTexture(svgMarkup) {
  const blob = new Blob([svgMarkup], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  const texture = new THREE.CanvasTexture(document.createElement("canvas"));

  image.onload = () => {
    const canvas = texture.image;
    const ctx = canvas.getContext("2d");
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    texture.needsUpdate = true;
    URL.revokeObjectURL(url);
  };

  image.src = url;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const svgSkybox = `
<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'>
  <defs>
    <linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='#0b1e3a'/>
      <stop offset='55%' stop-color='#275c9a'/>
      <stop offset='100%' stop-color='#8bb7e9'/>
    </linearGradient>
    <radialGradient id='glow' cx='70%' cy='25%' r='28%'>
      <stop offset='0%' stop-color='#fff2b0' stop-opacity='0.95'/>
      <stop offset='100%' stop-color='#fff2b0' stop-opacity='0'/>
    </radialGradient>
  </defs>
  <rect width='512' height='512' fill='url(#sky)'/>
  <circle cx='360' cy='120' r='80' fill='url(#glow)'/>
  <g fill='#ffffff' opacity='0.6'>
    <circle cx='40' cy='60' r='2'/>
    <circle cx='90' cy='90' r='1.5'/>
    <circle cx='130' cy='50' r='1'/>
    <circle cx='200' cy='80' r='2'/>
    <circle cx='260' cy='120' r='1.5'/>
    <circle cx='310' cy='60' r='1.5'/>
    <circle cx='410' cy='80' r='1'/>
    <circle cx='450' cy='130' r='2'/>
  </g>
  <g fill='#d5e6ff' opacity='0.5'>
    <circle cx='70' cy='200' r='1'/>
    <circle cx='160' cy='220' r='1.2'/>
    <circle cx='240' cy='200' r='1'/>
    <circle cx='330' cy='210' r='1.3'/>
    <circle cx='420' cy='230' r='1'/>
  </g>
  <path d='M40 330 C140 300 240 360 340 330 C400 315 460 310 520 320 L520 512 L0 512 Z' fill='#8eb2e8' opacity='0.35'/>
</svg>
`;

const skyTexture = makeSvgTexture(svgSkybox);
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(520, 32, 16),
  new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  })
);
scene.add(skyDome);

function createLightingSystem(targetScene) {
  const skyColor = new THREE.Color("#0d1b2e");
  const daySkyColor = new THREE.Color("#e3f0ff");

  const ambientLight = new THREE.AmbientLight(0xb1c6da, 0.55);
  const hemiLight = new THREE.HemisphereLight(0x93b6ff, 0x0c1017, 0.5);
  const sunLight = new THREE.DirectionalLight(0xfff4d1, 1.15);
  sunLight.position.set(60, 90, -40);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 260;
  sunLight.shadow.camera.left = -80;
  sunLight.shadow.camera.right = 80;
  sunLight.shadow.camera.top = 80;
  sunLight.shadow.camera.bottom = -80;

  targetScene.add(ambientLight, hemiLight, sunLight);

  function update(time) {
    const cycle = (Math.sin(time * 0.08) + 1) / 2;
    const sunAngle = THREE.MathUtils.lerp(-Math.PI * 0.15, Math.PI * 0.65, cycle);
    sunLight.position.set(
      Math.cos(sunAngle) * 80,
      Math.sin(sunAngle) * 90 + 20,
      -30
    );

    const sunIntensity = THREE.MathUtils.lerp(0.7, 1.35, cycle);
    sunLight.intensity = sunIntensity;
    ambientLight.intensity = THREE.MathUtils.lerp(0.35, 0.6, cycle);
    hemiLight.intensity = THREE.MathUtils.lerp(0.3, 0.6, cycle);
    skyDome.material.color.lerpColors(skyColor, daySkyColor, Math.min(cycle * 1.2, 1));
  }

  return { update };
}

const lightingSystem = createLightingSystem(scene);

const terrainUniforms = {
  uTime: { value: 0 },
  uColorLow: { value: new THREE.Color("#2b2f2f") },
  uColorMid: { value: new THREE.Color("#3c4e2c") },
  uColorHigh: { value: new THREE.Color("#6f6a4d") },
  uRim: { value: new THREE.Color("#84b5ff") }
};

const terrainGeometry = new THREE.PlaneGeometry(520, 520, 220, 220);
const terrainMaterial = new THREE.ShaderMaterial({
  uniforms: terrainUniforms,
  vertexShader: `
    varying vec3 vPos;
    varying float vHeight;
    uniform float uTime;

    float getHeight(vec2 pos) {
      float base = sin(pos.x * 0.04) * cos(pos.y * 0.03) * 3.0;
      float ridges = sin((pos.x + uTime * 0.2) * 0.15) * sin((pos.y - uTime * 0.25) * 0.12);
      float dunes = sin((pos.x + pos.y) * 0.08) * 1.5;
      return base + ridges * 2.2 + dunes;
    }

    void main() {
      vec3 newPosition = position;
      float height = getHeight(newPosition.xz);
      newPosition.z += height;
      vPos = newPosition;
      vHeight = height;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vPos;
    varying float vHeight;
    uniform vec3 uColorLow;
    uniform vec3 uColorMid;
    uniform vec3 uColorHigh;
    uniform vec3 uRim;

    void main() {
      float heightFactor = smoothstep(-2.0, 3.5, vHeight);
      vec3 base = mix(uColorLow, uColorMid, heightFactor);
      base = mix(base, uColorHigh, smoothstep(2.0, 5.0, vHeight));
      float rim = smoothstep(0.15, 1.0, abs(normalize(vPos).y));
      vec3 color = mix(base, uRim, rim * 0.15);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  side: THREE.DoubleSide
});

const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
terrain.rotation.x = -Math.PI / 2;
terrain.receiveShadow = true;
scene.add(terrain);

const tankGroup = new THREE.Group();
scene.add(tankGroup);

const svgHull = `
<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>
  <rect width='256' height='256' rx='32' ry='32' fill='#2d3238'/>
  <path d='M32 128 L128 32 L224 128 L128 224 Z' fill='#3f4b57'/>
  <circle cx='128' cy='128' r='48' fill='#1e242b'/>
  <circle cx='128' cy='128' r='20' fill='#8ca0b3'/>
</svg>
`;

const svgTurret = `
<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>
  <rect width='256' height='256' fill='#272b2f'/>
  <rect x='32' y='64' width='192' height='128' rx='48' fill='#48525d'/>
  <rect x='96' y='96' width='64' height='64' rx='18' fill='#9db2c7'/>
</svg>
`;

const svgTread = `
<svg xmlns='http://www.w3.org/2000/svg' width='256' height='128'>
  <rect width='256' height='128' fill='#1a1c1f'/>
  <g fill='#3b3f45'>
    <rect x='8' y='16' width='40' height='96' rx='8'/>
    <rect x='56' y='16' width='40' height='96' rx='8'/>
    <rect x='104' y='16' width='40' height='96' rx='8'/>
    <rect x='152' y='16' width='40' height='96' rx='8'/>
    <rect x='200' y='16' width='40' height='96' rx='8'/>
  </g>
</svg>
`;

const svgBeacon = `
<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>
  <rect width='256' height='256' rx='24' fill='#242a33'/>
  <rect x='32' y='32' width='192' height='64' rx='20' fill='#3a4552'/>
  <rect x='32' y='120' width='192' height='96' rx='20' fill='#0f1724'/>
  <circle cx='64' cy='168' r='16' fill='#f7cf5b'/>
  <circle cx='128' cy='168' r='16' fill='#5bd0ff'/>
  <circle cx='192' cy='168' r='16' fill='#ff7a7a'/>
</svg>
`;

const svgFuel = `
<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>
  <rect width='256' height='256' rx='28' fill='#1f252d'/>
  <rect x='48' y='40' width='160' height='176' rx='28' fill='#2e3a46'/>
  <rect x='80' y='72' width='96' height='112' rx='20' fill='#0e1117'/>
  <path d='M96 104 L160 104 L176 136 L160 168 L96 168 L80 136 Z' fill='#7dd39b'/>
  <circle cx='128' cy='136' r='20' fill='#bff7d2'/>
</svg>
`;

const svgOutpost = `
<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>
  <rect width='256' height='256' rx='18' fill='#21252c'/>
  <rect x='24' y='32' width='208' height='192' rx='20' fill='#38424f'/>
  <rect x='40' y='56' width='176' height='64' rx='18' fill='#4d6b92'/>
  <rect x='40' y='136' width='72' height='72' rx='12' fill='#c7d7e6'/>
  <rect x='144' y='136' width='72' height='72' rx='12' fill='#93a7bd'/>
</svg>
`;

const svgRock = `
<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>
  <rect width='256' height='256' fill='#1a1d22'/>
  <path d='M24 176 L64 72 L160 48 L232 120 L200 216 L88 224 Z' fill='#3b3f45'/>
  <path d='M88 208 L128 112 L200 128 L176 200 Z' fill='#565b63'/>
</svg>
`;

const hullTexture = makeSvgTexture(svgHull);
const turretTexture = makeSvgTexture(svgTurret);
const treadTexture = makeSvgTexture(svgTread);
const beaconTexture = makeSvgTexture(svgBeacon);
const fuelTexture = makeSvgTexture(svgFuel);
const outpostTexture = makeSvgTexture(svgOutpost);
const rockTexture = makeSvgTexture(svgRock);

const hullMaterial = new THREE.MeshStandardMaterial({
  map: hullTexture,
  roughness: 0.6,
  metalness: 0.2
});

const turretMaterial = new THREE.MeshStandardMaterial({
  map: turretTexture,
  roughness: 0.5,
  metalness: 0.25
});

const treadMaterial = new THREE.MeshStandardMaterial({
  map: treadTexture,
  roughness: 0.9,
  metalness: 0.1
});

const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 2.2, 10), hullMaterial);
hull.position.y = 1.4;
hull.castShadow = true;
tankGroup.add(hull);

const turretGroup = new THREE.Group();
turretGroup.position.set(0, 2.6, 0);
tankGroup.add(turretGroup);

const turret = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 1.6, 16), turretMaterial);
turret.rotation.x = Math.PI / 2;
turret.castShadow = true;
turretGroup.add(turret);

const cannonPivot = new THREE.Group();
cannonPivot.position.set(0, 0.2, 2.2);
turretGroup.add(cannonPivot);

const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 6, 12), turretMaterial);
cannon.rotation.x = Math.PI / 2;
cannon.position.z = 3;
cannon.castShadow = true;
cannonPivot.add(cannon);

const leftTread = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 10.5), treadMaterial);
leftTread.position.set(-3.4, 1.1, 0);
leftTread.castShadow = true;
tankGroup.add(leftTread);

const rightTread = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 10.5), treadMaterial);
rightTread.position.set(3.4, 1.1, 0);
rightTread.castShadow = true;
tankGroup.add(rightTread);

const tankScale = 0.55;
tankGroup.scale.setScalar(tankScale);

const beaconMaterial = new THREE.MeshStandardMaterial({
  map: beaconTexture,
  roughness: 0.45,
  metalness: 0.4
});

const fuelMaterial = new THREE.MeshStandardMaterial({
  map: fuelTexture,
  roughness: 0.6,
  metalness: 0.2
});

const outpostMaterial = new THREE.MeshStandardMaterial({
  map: outpostTexture,
  roughness: 0.5,
  metalness: 0.25
});

const rockMaterial = new THREE.MeshStandardMaterial({
  map: rockTexture,
  roughness: 0.9,
  metalness: 0.05
});

const worldProps = [];
const propScale = 0.75;

function addWorldProp(mesh, position, groundOffset) {
  mesh.position.copy(position);
  mesh.scale.multiplyScalar(propScale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.groundOffset = groundOffset * propScale;
  scene.add(mesh);
  worldProps.push(mesh);
}

function createBeacon(position) {
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 8, 12), beaconMaterial);
  const dish = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2, 12), beaconMaterial);
  dish.position.y = 5.2;
  dish.rotation.x = Math.PI * 0.5;
  tower.add(dish);
  addWorldProp(tower, position, 4);
}

function createFuelDepot(position) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 6), fuelMaterial);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 4.4, 14), fuelMaterial);
  tank.position.y = 2.6;
  base.add(tank);
  addWorldProp(base, position, 0.8);
}

function createOutpost(position) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(8, 2.6, 8), outpostMaterial);
  const top = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 6), outpostMaterial);
  top.position.y = 2.4;
  base.add(top);
  addWorldProp(base, position, 1.3);
}

function createRockCluster(position) {
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(3, 0), rockMaterial);
  rock.scale.set(1.2, 0.8, 1.4);
  addWorldProp(rock, position, 2.2);
}

[
  new THREE.Vector3(-60, 0, -40),
  new THREE.Vector3(50, 0, 70),
  new THREE.Vector3(-90, 0, 90),
  new THREE.Vector3(100, 0, -60)
].forEach((pos) => createOutpost(pos));

[
  new THREE.Vector3(-120, 0, 30),
  new THREE.Vector3(120, 0, 20),
  new THREE.Vector3(0, 0, -120)
].forEach((pos) => createFuelDepot(pos));

[
  new THREE.Vector3(-30, 0, 120),
  new THREE.Vector3(70, 0, -110),
  new THREE.Vector3(140, 0, 80),
  new THREE.Vector3(-140, 0, -80)
].forEach((pos) => createBeacon(pos));

[
  new THREE.Vector3(-20, 0, -90),
  new THREE.Vector3(90, 0, 30),
  new THREE.Vector3(-110, 0, 10),
  new THREE.Vector3(20, 0, 90),
  new THREE.Vector3(130, 0, -20)
].forEach((pos) => createRockCluster(pos));

const smokeTrail = [];
const maxSmoke = 40;
const smokeMaterial = new THREE.MeshStandardMaterial({
  color: 0x6c7077,
  transparent: true,
  opacity: 0.6
});

for (let i = 0; i < maxSmoke; i += 1) {
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), smokeMaterial.clone());
  puff.visible = false;
  scene.add(puff);
  smokeTrail.push(puff);
}

const inputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  boost: false,
  map: false
};

const cameraModes = ["driver", "gunner", "commander"];
let cameraModeIndex = 0;

const tankState = {
  velocity: 0,
  rotationSpeed: 0,
  turretYaw: 0,
  cannonPitch: -0.15,
  fireCooldown: 0
};

const projectiles = [];

function getHeightAt(x, z, time) {
  const base = Math.sin(x * 0.04) * Math.cos(z * 0.03) * 3;
  const ridges = Math.sin((x + time * 0.2) * 0.15) * Math.sin((z - time * 0.25) * 0.12);
  const dunes = Math.sin((x + z) * 0.08) * 1.5;
  return base + ridges * 2.2 + dunes;
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", handleResize);

function onKey(event, isDown) {
  switch (event.code) {
    case "KeyW":
      inputState.forward = isDown;
      break;
    case "KeyS":
      inputState.backward = isDown;
      break;
    case "KeyA":
      inputState.left = isDown;
      break;
    case "KeyD":
      inputState.right = isDown;
      break;
    case "ShiftLeft":
    case "ShiftRight":
      inputState.boost = isDown;
      break;
    case "KeyV":
      if (isDown) {
        cameraModeIndex = (cameraModeIndex + 1) % cameraModes.length;
      }
      break;
    case "KeyM":
      if (isDown) {
        inputState.map = !inputState.map;
        document.getElementById("mini-map").classList.toggle("hidden", !inputState.map);
      }
      break;
    default:
      break;
  }
}

window.addEventListener("keydown", (event) => onKey(event, true));
window.addEventListener("keyup", (event) => onKey(event, false));

canvas.addEventListener("click", () => {
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) return;
  tankState.turretYaw -= event.movementX * 0.0025;
  tankState.cannonPitch -= event.movementY * 0.002;
  tankState.cannonPitch = THREE.MathUtils.clamp(tankState.cannonPitch, -0.6, 0.2);
});

window.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;
  if (tankState.fireCooldown > 0) return;
  const projectile = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffc66b, emissive: 0xff8c20 })
  );
  const worldPosition = new THREE.Vector3();
  cannon.getWorldPosition(worldPosition);
  projectile.position.copy(worldPosition);
  const direction = new THREE.Vector3(0, 0, 1)
    .applyQuaternion(cannon.getWorldQuaternion(new THREE.Quaternion()))
    .normalize();
  projectile.userData.velocity = direction.multiplyScalar(60);
  scene.add(projectile);
  projectiles.push(projectile);
  tankState.fireCooldown = 0.4;
});

const miniMap = document.getElementById("mini-map");
const mapCanvas = document.createElement("canvas");
mapCanvas.width = 160;
mapCanvas.height = 160;
miniMap.appendChild(mapCanvas);
const mapCtx = mapCanvas.getContext("2d");

function updateMiniMap() {
  mapCtx.fillStyle = "rgba(4,4,6,0.8)";
  mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
  mapCtx.strokeStyle = "rgba(255,255,255,0.2)";
  mapCtx.strokeRect(8, 8, mapCanvas.width - 16, mapCanvas.height - 16);

  const mapScale = 0.4;
  const centerX = mapCanvas.width / 2;
  const centerY = mapCanvas.height / 2;

  mapCtx.fillStyle = "#63e2a5";
  const tankX = centerX + tankGroup.position.x * mapScale;
  const tankY = centerY + tankGroup.position.z * mapScale;
  mapCtx.beginPath();
  mapCtx.arc(tankX, tankY, 4, 0, Math.PI * 2);
  mapCtx.fill();

  mapCtx.strokeStyle = "#ffcc66";
  mapCtx.beginPath();
  mapCtx.moveTo(tankX, tankY);
  mapCtx.lineTo(
    tankX + Math.sin(-tankGroup.rotation.y) * 12,
    tankY + Math.cos(-tankGroup.rotation.y) * 12
  );
  mapCtx.stroke();

  worldProps.forEach((prop) => {
    const propX = centerX + prop.position.x * mapScale;
    const propY = centerY + prop.position.z * mapScale;
    mapCtx.fillStyle = "#7fb4ff";
    mapCtx.fillRect(propX - 2, propY - 2, 4, 4);
  });
}

function updateCamera() {
  const mode = cameraModes[cameraModeIndex];
  const offset = new THREE.Vector3();
  const focus = new THREE.Vector3();

  if (mode === "driver") {
    offset.set(0, 2.6, -7.6);
    focus.set(0, 1.8, 6.8);
  } else if (mode === "gunner") {
    offset.set(0, 3.8, -2.4);
    focus.set(0, 2.8, 17);
  } else {
    offset.set(0, 10, -16);
    focus.set(0, 0, 16);
  }

  const quaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0, tankGroup.rotation.y, 0)
  );
  offset.applyQuaternion(quaternion);
  focus.applyQuaternion(quaternion);

  const targetPosition = tankGroup.position.clone().add(offset);
  camera.position.lerp(targetPosition, 0.08);
  camera.lookAt(tankGroup.position.clone().add(focus));
}

function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();
  terrainUniforms.uTime.value = elapsed;
  lightingSystem.update(elapsed);

  const acceleration = inputState.boost ? 18 : 10;
  const maxSpeed = inputState.boost ? 16 : 9;
  const forwardAxis = inputState.forward ? 1 : 0;
  const backwardAxis = inputState.backward ? 1 : 0;
  const moveDirection = forwardAxis - backwardAxis;

  tankState.velocity += moveDirection * acceleration * delta;
  tankState.velocity *= 0.92;
  tankState.velocity = THREE.MathUtils.clamp(tankState.velocity, -maxSpeed, maxSpeed);

  const turnDirection = (inputState.left ? 1 : 0) - (inputState.right ? 1 : 0);
  tankState.rotationSpeed = turnDirection * 1.4 * (Math.abs(tankState.velocity) > 0.2 ? 1 : 0.2);

  tankGroup.rotation.y += tankState.rotationSpeed * delta;

  const moveVector = new THREE.Vector3(0, 0, tankState.velocity * delta);
  moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), tankGroup.rotation.y);
  tankGroup.position.add(moveVector);

  const height = getHeightAt(tankGroup.position.x, tankGroup.position.z, elapsed);
  tankGroup.position.y = height + 1.2 * tankScale;

  turretGroup.rotation.y = tankState.turretYaw;
  cannonPivot.rotation.x = tankState.cannonPitch;

  if (tankState.fireCooldown > 0) {
    tankState.fireCooldown -= delta;
  }

  projectiles.forEach((shot, index) => {
    shot.position.addScaledVector(shot.userData.velocity, delta);
    shot.userData.velocity.y -= 20 * delta;
    if (shot.position.y < -10 || shot.position.length() > 400) {
      scene.remove(shot);
      projectiles.splice(index, 1);
    }
  });

  worldProps.forEach((prop) => {
    prop.position.y = getHeightAt(prop.position.x, prop.position.z, elapsed) + prop.userData.groundOffset;
  });

  if (Math.abs(tankState.velocity) > 2) {
    const puff = smokeTrail.shift();
    if (puff) {
      puff.visible = true;
      puff.position.copy(tankGroup.position);
      puff.position.y += 1.5;
      puff.material.opacity = 0.6;
      puff.scale.setScalar(1);
      smokeTrail.push(puff);
    }
  }

  smokeTrail.forEach((puff) => {
    if (!puff.visible) return;
    puff.position.y += delta * 1.5;
    puff.scale.addScalar(delta * 0.4);
    puff.material.opacity -= delta * 0.4;
    if (puff.material.opacity <= 0) {
      puff.visible = false;
    }
  });

  updateCamera();
  updateMiniMap();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
