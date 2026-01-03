import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a0b10, 30, 220);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);

const clock = new THREE.Clock();

const ambientLight = new THREE.AmbientLight(0x8899aa, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.15);
dirLight.position.set(50, 80, -30);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
scene.add(dirLight);

const terrainUniforms = {
  uTime: { value: 0 },
  uColorLow: { value: new THREE.Color("#2b2f2f") },
  uColorMid: { value: new THREE.Color("#3c4e2c") },
  uColorHigh: { value: new THREE.Color("#6f6a4d") },
  uRim: { value: new THREE.Color("#84b5ff") }
};

const terrainGeometry = new THREE.PlaneGeometry(400, 400, 200, 200);
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
  return texture;
}

const hullTexture = makeSvgTexture(svgHull);
const turretTexture = makeSvgTexture(svgTurret);
const treadTexture = makeSvgTexture(svgTread);

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

const smokeTrail = [];
const maxSmoke = 40;
const smokeMaterial = new THREE.MeshStandardMaterial({
  color: 0x6c7077,
  transparent: true,
  opacity: 0.6
});

for (let i = 0; i < maxSmoke; i += 1) {
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), smokeMaterial.clone());
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
    new THREE.SphereGeometry(0.25, 8, 8),
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
}

function updateCamera() {
  const mode = cameraModes[cameraModeIndex];
  const offset = new THREE.Vector3();
  const focus = new THREE.Vector3();

  if (mode === "driver") {
    offset.set(0, 3.2, -8.5);
    focus.set(0, 2.2, 6);
  } else if (mode === "gunner") {
    offset.set(0, 4.6, -2.2);
    focus.set(0, 3.6, 18);
  } else {
    offset.set(0, 12, -18);
    focus.set(0, 0, 18);
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
  tankGroup.position.y = height + 1.2;

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
