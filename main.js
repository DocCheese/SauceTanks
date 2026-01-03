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

const voxelConfig = {
  size: 36,
  maxHeight: 8,
  voxelSize: 1
};

function getTerrainHeightNoise(x, z) {
  const base = Math.sin(x * 0.22) * Math.cos(z * 0.18) * 2.5;
  const ridges = Math.sin((x + z) * 0.3) * 1.2;
  const rolling = Math.cos(z * 0.12) * 1.6;
  return base + ridges + rolling + 3;
}

class VoxelTerrain {
  constructor(config) {
    this.size = config.size;
    this.maxHeight = config.maxHeight;
    this.voxelSize = config.voxelSize;
    this.halfWorld = (this.size * this.voxelSize) / 2;
    this.columns = Array.from({ length: this.size }, () => Array(this.size).fill(0));
    this.filled = new Set();
    this.group = new THREE.Group();
    this.voxelMesh = null;
    this.propGroup = new THREE.Group();
    this.group.add(this.propGroup);
    this.voxelMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.05
    });
  }

  generate() {
    this.filled.clear();
    for (let x = 0; x < this.size; x += 1) {
      for (let z = 0; z < this.size; z += 1) {
        const worldX = (x + 0.5) * this.voxelSize - this.halfWorld;
        const worldZ = (z + 0.5) * this.voxelSize - this.halfWorld;
        const height = Math.floor(
          THREE.MathUtils.clamp(getTerrainHeightNoise(worldX, worldZ), 1, this.maxHeight)
        );
        this.columns[x][z] = height;
        for (let y = 0; y < height; y += 1) {
          this.filled.add(this.key(x, y, z));
        }
      }
    }
    this.rebuild();
  }

  key(x, y, z) {
    return `${x},${y},${z}`;
  }

  isInside(x, y, z) {
    return x >= 0 && z >= 0 && y >= 0 && x < this.size && z < this.size && y < this.maxHeight;
  }

  isFilled(x, y, z) {
    return this.filled.has(this.key(x, y, z));
  }

  worldToVoxel(pos) {
    const x = Math.floor((pos.x + this.halfWorld) / this.voxelSize);
    const z = Math.floor((pos.z + this.halfWorld) / this.voxelSize);
    const y = Math.floor(pos.y / this.voxelSize);
    return { x, y, z };
  }

  voxelToWorld(x, y, z) {
    return new THREE.Vector3(
      x * this.voxelSize - this.halfWorld + this.voxelSize / 2,
      y * this.voxelSize + this.voxelSize / 2,
      z * this.voxelSize - this.halfWorld + this.voxelSize / 2
    );
  }

  getSurfaceHeight(x, z) {
    const voxel = this.worldToVoxel(new THREE.Vector3(x, 0, z));
    if (voxel.x < 0 || voxel.z < 0 || voxel.x >= this.size || voxel.z >= this.size) {
      return 0;
    }
    for (let y = this.maxHeight - 1; y >= 0; y -= 1) {
      if (this.isFilled(voxel.x, y, voxel.z)) {
        return (y + 1) * this.voxelSize;
      }
    }
    return 0;
  }

  removeSphere(center, radius) {
    const min = this.worldToVoxel(new THREE.Vector3(center.x - radius, 0, center.z - radius));
    const max = this.worldToVoxel(new THREE.Vector3(center.x + radius, 0, center.z + radius));
    let removed = false;
    for (let x = min.x; x <= max.x; x += 1) {
      for (let z = min.z; z <= max.z; z += 1) {
        for (let y = 0; y < this.maxHeight; y += 1) {
          if (!this.isInside(x, y, z) || !this.isFilled(x, y, z)) continue;
          const world = this.voxelToWorld(x, y, z);
          if (world.distanceTo(center) <= radius) {
            this.filled.delete(this.key(x, y, z));
            removed = true;
          }
        }
      }
    }
    if (removed) {
      this.rebuild();
    }
  }

  rebuild() {
    if (this.voxelMesh) {
      this.group.remove(this.voxelMesh);
      this.voxelMesh.geometry.dispose();
    }
    const voxels = Array.from(this.filled.values());
    const geometry = new THREE.BoxGeometry(this.voxelSize, this.voxelSize, this.voxelSize);
    const mesh = new THREE.InstancedMesh(geometry, this.voxelMaterial, voxels.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const color = new THREE.Color();
    const dummy = new THREE.Object3D();
    voxels.forEach((entry, index) => {
      const [x, y, z] = entry.split(",").map((value) => Number(value));
      dummy.position.copy(this.voxelToWorld(x, y, z));
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (y >= this.maxHeight - 2) {
        color.set("#4c7a3c");
      } else if (y >= this.maxHeight - 4) {
        color.set("#6a5a3a");
      } else {
        color.set("#4a4a4a");
      }
      mesh.setColorAt(index, color);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.voxelMesh = mesh;
    this.group.add(mesh);
    this.rebuildProps();
  }

  rebuildProps() {
    this.propGroup.clear();
    const treeGeometry = new THREE.ConeGeometry(0.8, 2.6, 6);
    const treeMaterial = new THREE.MeshStandardMaterial({ color: "#2f6b3f" });
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 1.2, 6);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#5b4632" });
    const rockGeometry = new THREE.DodecahedronGeometry(0.6);
    const rockMaterial = new THREE.MeshStandardMaterial({ color: "#5a5a5a" });
    const grassGeometry = new THREE.ConeGeometry(0.35, 0.9, 5);
    const grassMaterial = new THREE.MeshStandardMaterial({ color: "#63b567" });

    const treeCount = Math.floor((this.size * this.size) * 0.06);
    const rockCount = Math.floor((this.size * this.size) * 0.04);
    const grassCount = Math.floor((this.size * this.size) * 0.2);

    const treeTops = new THREE.InstancedMesh(treeGeometry, treeMaterial, treeCount);
    const treeTrunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, treeCount);
    const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, rockCount);
    const grasses = new THREE.InstancedMesh(grassGeometry, grassMaterial, grassCount);

    const dummy = new THREE.Object3D();
    const surfaceSpots = [];
    for (let x = 0; x < this.size; x += 1) {
      for (let z = 0; z < this.size; z += 1) {
        const height = this.getSurfaceHeight(
          x * this.voxelSize - this.halfWorld + this.voxelSize / 2,
          z * this.voxelSize - this.halfWorld + this.voxelSize / 2
        );
        if (height > 0) {
          surfaceSpots.push({ x, z, height });
        }
      }
    }

    function pickSpot() {
      return surfaceSpots[Math.floor(Math.random() * surfaceSpots.length)];
    }

    for (let i = 0; i < treeCount; i += 1) {
      const spot = pickSpot();
      if (!spot) break;
      const world = new THREE.Vector3(
        spot.x * this.voxelSize - this.halfWorld + this.voxelSize / 2,
        spot.height,
        spot.z * this.voxelSize - this.halfWorld + this.voxelSize / 2
      );
      dummy.position.copy(world);
      dummy.position.y += 1.4;
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      treeTops.setMatrixAt(i, dummy.matrix);
      dummy.position.y = world.y + 0.6;
      dummy.updateMatrix();
      treeTrunks.setMatrixAt(i, dummy.matrix);
    }

    for (let i = 0; i < rockCount; i += 1) {
      const spot = pickSpot();
      if (!spot) break;
      const world = new THREE.Vector3(
        spot.x * this.voxelSize - this.halfWorld + this.voxelSize / 2,
        spot.height,
        spot.z * this.voxelSize - this.halfWorld + this.voxelSize / 2
      );
      dummy.position.copy(world);
      dummy.position.y += 0.3;
      dummy.rotation.set(Math.random(), Math.random(), Math.random());
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }

    for (let i = 0; i < grassCount; i += 1) {
      const spot = pickSpot();
      if (!spot) break;
      const world = new THREE.Vector3(
        spot.x * this.voxelSize - this.halfWorld + this.voxelSize / 2,
        spot.height,
        spot.z * this.voxelSize - this.halfWorld + this.voxelSize / 2
      );
      dummy.position.copy(world);
      dummy.position.y += 0.3;
      dummy.rotation.y = Math.random() * Math.PI * 2;
      const scale = 0.6 + Math.random() * 0.6;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      grasses.setMatrixAt(i, dummy.matrix);
    }

    treeTops.castShadow = true;
    treeTrunks.castShadow = true;
    rocks.castShadow = true;
    grasses.castShadow = true;

    this.propGroup.add(treeTops, treeTrunks, rocks, grasses);
  }

  checkProjectileHit(start, end) {
    const direction = end.clone().sub(start);
    const distance = direction.length();
    if (distance <= 0) return null;
    const steps = Math.ceil(distance / 0.25);
    direction.normalize();
    const step = direction.multiplyScalar(distance / steps);
    const position = start.clone();
    for (let i = 0; i <= steps; i += 1) {
      const voxel = this.worldToVoxel(position);
      if (this.isInside(voxel.x, voxel.y, voxel.z) && this.isFilled(voxel.x, voxel.y, voxel.z)) {
        return position.clone();
      }
      position.add(step);
    }
    return null;
  }
}

const voxelTerrain = new VoxelTerrain(voxelConfig);
voxelTerrain.generate();
scene.add(voxelTerrain.group);

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
  clock.getElapsedTime();

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

  const height = voxelTerrain.getSurfaceHeight(tankGroup.position.x, tankGroup.position.z);
  tankGroup.position.y = height + 1.2;

  turretGroup.rotation.y = tankState.turretYaw;
  cannonPivot.rotation.x = tankState.cannonPitch;

  if (tankState.fireCooldown > 0) {
    tankState.fireCooldown -= delta;
  }

  projectiles.forEach((shot, index) => {
    const start = shot.position.clone();
    shot.position.addScaledVector(shot.userData.velocity, delta);
    shot.userData.velocity.y -= 20 * delta;
    const hit = voxelTerrain.checkProjectileHit(start, shot.position);
    if (hit) {
      voxelTerrain.removeSphere(hit, 1.6);
      scene.remove(shot);
      projectiles.splice(index, 1);
      return;
    }
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
