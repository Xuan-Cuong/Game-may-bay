import * as THREE from 'three';

// --- Constants ---
// CONTROLS TUNING
const PITCH_SPEED = 0.012;
const ROLL_SPEED = 0.018;
const YAW_SPEED = 0.005;
const ACCELERATION = 0.07;
const DECELERATION = 0.05;
const MAX_SPEED = 1.6;
const MIN_SPEED = 0.1;
const DAMPING = 0.96;
const CONTROL_LERP_FACTOR = 7;

// SHOOTING/GAMEPLAY Constants
const BULLET_SPEED = 3.8;
const BULLET_LIFETIME = 3.0;
const BULLET_RADIUS = 0.4;
const TARGET_COUNT = 25; // Initial target count
const TARGET_SIZE = 15;
const TARGET_COLLISION_RADIUS = TARGET_SIZE * 0.9;
const SHOOT_COOLDOWN = 0.18;

// --- Basic Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- Graphics Enhancements ---
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
scene.fog = new THREE.Fog(0xcccccc, 500, 3500);

const cubeLoader = new THREE.CubeTextureLoader();
const textureCube = cubeLoader.load([
    'https://threejs.org/examples/textures/cube/skyboxsun25deg/px.jpg', 'https://threejs.org/examples/textures/cube/skyboxsun25deg/nx.jpg',
    'https://threejs.org/examples/textures/cube/skyboxsun25deg/py.jpg', 'https://threejs.org/examples/textures/cube/skyboxsun25deg/ny.jpg',
    'https://threejs.org/examples/textures/cube/skyboxsun25deg/pz.jpg', 'https://threejs.org/examples/textures/cube/skyboxsun25deg/nz.jpg'
]);
scene.background = textureCube;

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0x707070);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(150, 200, 100);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 50;
directionalLight.shadow.camera.far = 600;
directionalLight.shadow.camera.left = -300;
directionalLight.shadow.camera.right = 300;
directionalLight.shadow.camera.top = 300;
directionalLight.shadow.camera.bottom = -300;
scene.add(directionalLight);

// --- Ground (Textured and Hilly) ---
const textureLoader = new THREE.TextureLoader();
const grassTexture = textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
grassTexture.wrapS = THREE.RepeatWrapping;
grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(100, 100);
const groundGeometry = new THREE.PlaneGeometry(5000, 5000, 100, 100);
const groundMaterial = new THREE.MeshLambertMaterial({ map: grassTexture });
const vertices = groundGeometry.attributes.position;
for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i);
    const y = vertices.getY(i);
    const height = (Math.sin(x * 0.004 + y * 0.001) * 30 + Math.cos(x * 0.001 + y * 0.006) * 25 + Math.sin(x * 0.0008) * 15);
    vertices.setZ(i, height);
}
groundGeometry.computeVertexNormals();
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.position.y = -25;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// --- Raycaster for Terrain Height ---
const raycaster = new THREE.Raycaster();
const downVector = new THREE.Vector3(0, -1, 0);
function getGroundHeight(x, z) {
    raycaster.set(new THREE.Vector3(x, 500, z), downVector);
    const intersects = raycaster.intersectObject(groundMesh);
    if (intersects.length > 0) {
        return intersects[0].point.y;
    }
    return groundMesh.position.y;
}

// --- Simple Trees (Improved Placement) ---
function createTree(x, z) {
    const groundHeight = getGroundHeight(x, z);
    const trunkHeight = Math.random() * 4 + 3;
    const topRadius = Math.random() * 1.5 + 1.0;
    const topHeight = topRadius * (Math.random() * 1.5 + 3.0);
    const trunkMat = new THREE.MeshPhongMaterial({ color: new THREE.Color(0x8B4513).offsetHSL(0, 0, Math.random() * 0.1 - 0.05), shininess: 5 });
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.4, trunkHeight, 8);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    const topMat = new THREE.MeshPhongMaterial({ color: new THREE.Color(0x228B22).offsetHSL(0.01, 0.1, Math.random() * 0.2 - 0.1), shininess: 10 });
    const topGeo = new THREE.ConeGeometry(topRadius, topHeight, 8);
    const top = new THREE.Mesh(topGeo, topMat);
    top.castShadow = true;
    top.receiveShadow = false;
    top.position.y = trunkHeight * 0.6;
    trunk.add(top);
    trunk.position.set(x, groundHeight + trunkHeight / 2, z);
    scene.add(trunk);
    return trunk;
}
for (let i = 0; i < 200; i++) { // Create initial trees
    const x = (Math.random() - 0.5) * 4800;
    const z = (Math.random() - 0.5) * 4800;
     if (x*x + z*z > 250*250) { createTree(x, z); }
}

// --- Targets ---
const targets = []; // Array to hold target meshes
const targetGeometry = new THREE.TorusGeometry(TARGET_SIZE, TARGET_SIZE * 0.15, 8, 32);
const targetMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0x550055, roughness: 0.4, metalness: 0.1 });

// Function to create a single target
function createTarget() {
    const target = new THREE.Mesh(targetGeometry, targetMaterial);
    // Place target randomly within bounds, above ground
    const x = (Math.random() - 0.5) * 4000;
    const z = (Math.random() - 0.5) * 4000;
    const minTargetAltitude = 60;
    const maxTargetAltitude = 400;
    // Ensure target is placed relative to groundMesh base Y, not absolute 0
    const y = groundMesh.position.y + minTargetAltitude + Math.random() * (maxTargetAltitude - minTargetAltitude);

    target.position.set(x, y, z);
    target.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI); // Random orientation
    target.castShadow = true;
    target.isTarget = true; // Flag for identification
    target.radius = TARGET_COLLISION_RADIUS; // Store collision radius

    scene.add(target);
    targets.push(target); // Add to the array
}

// Create initial set of targets
for (let i = 0; i < TARGET_COUNT; i++) {
    createTarget();
}


// --- Airplane Model (Blue accents) ---
// Airplane model code remains the same as previous version...
const plane = new THREE.Group();
const fuselageMat = new THREE.MeshPhongMaterial({ color: 0xdddddd, shininess: 60 });
const wingMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 40 });
const accentMat = new THREE.MeshPhongMaterial({color: 0x0055aa, shininess: 70});
const redMat = new THREE.MeshPhongMaterial({color: 0xff0000, shininess: 60});
const fuselageGeo = new THREE.BoxGeometry(1, 0.8, 4);
const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
plane.add(fuselage);
const stripeGeo = new THREE.BoxGeometry(0.8, 0.1, 3.5);
const stripe1 = new THREE.Mesh(stripeGeo, accentMat);
stripe1.position.y = 0.35; fuselage.add(stripe1);
const stripe2 = new THREE.Mesh(stripeGeo, accentMat);
stripe2.position.y = -0.35; fuselage.add(stripe2);
const wingGeo = new THREE.BoxGeometry(8, 0.1, 1.5);
const wing = new THREE.Mesh(wingGeo, wingMat);
wing.position.z = -0.5; plane.add(wing);
const wingTipGeo = new THREE.BoxGeometry(0.5, 0.12, 1.5);
const leftTip = new THREE.Mesh(wingTipGeo, accentMat);
leftTip.position.x = -4.0; wing.add(leftTip);
const rightTip = new THREE.Mesh(wingTipGeo, accentMat);
rightTip.position.x = 4.0; wing.add(rightTip);
const tailWingGeo = new THREE.BoxGeometry(3, 0.1, 0.8);
const tailWing = new THREE.Mesh(tailWingGeo, wingMat);
tailWing.position.z = 1.8; tailWing.position.y = 0.2; plane.add(tailWing);
const verticalTailGeo = new THREE.BoxGeometry(0.15, 1.2, 0.8);
const verticalTail = new THREE.Mesh(verticalTailGeo, fuselageMat);
verticalTail.position.z = 1.8; verticalTail.position.y = 0.6 + 0.4; plane.add(verticalTail);
const tailStripeGeo = new THREE.BoxGeometry(0.16, 1.0, 0.1);
const tailStripe = new THREE.Mesh(tailStripeGeo, accentMat);
tailStripe.position.z = 0.35; verticalTail.add(tailStripe);
const noseGeo = new THREE.ConeGeometry(0.4, 0.8, 8);
const nose = new THREE.Mesh(noseGeo, redMat);
nose.rotation.x = Math.PI / 2; nose.position.z = -2.4; fuselage.add(nose);
plane.traverse((child) => { if (child.isMesh) { child.castShadow = true; } });
plane.position.y = 100; plane.position.z = 0;
scene.add(plane);

// --- Simple Clouds ---
// Cloud code remains the same...
function createCloud() {
    const cloudGroup = new THREE.Group();
    const puffMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false });
    for (let i = 0; i < Math.random() * 6 + 4; i++) {
        const puffGeo = new THREE.SphereGeometry(Math.random() * 12 + 6, 8, 6);
        const puff = new THREE.Mesh(puffGeo, puffMat);
        puff.position.set((Math.random() - 0.5) * 25, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 15);
        puff.scale.set(Math.random() * 0.5 + 0.8, Math.random() * 0.3 + 0.4, Math.random() * 0.5 + 0.8);
        cloudGroup.add(puff);
    }
    cloudGroup.position.set((Math.random() - 0.5) * 4500, Math.random() * 200 + 200, (Math.random() - 0.5) * 4500);
    scene.add(cloudGroup); return cloudGroup;
}
for (let i = 0; i < 20; i++) { createCloud(); }

// --- Shooting Mechanics ---
const bullets = [];
const bulletGeometry = new THREE.SphereGeometry(BULLET_RADIUS, 6, 6);
const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
// `canShoot` is now mainly handled by cooldown timer
let lastShotTime = 0;

function fireBullet() {
    const now = clock.getElapsedTime();
    // Check cooldown
    if (now - lastShotTime < SHOOT_COOLDOWN) {
        return;
    }
    lastShotTime = now; // Reset cooldown timer

    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    const planeDirection = new THREE.Vector3();
    plane.getWorldDirection(planeDirection); // Get the forward vector (-Z)
    const planePosition = new THREE.Vector3();
    plane.getWorldPosition(planePosition);

    // Start bullet slightly in front of the nose tip
    const noseOffset = new THREE.Vector3(0, -0.1, -3.5);
    noseOffset.applyQuaternion(plane.quaternion); // Rotate offset to match plane orientation
    bullet.position.copy(planePosition).add(noseOffset);

    const velocity = planeDirection.clone().multiplyScalar(BULLET_SPEED);

    const bulletData = {
        mesh: bullet,
        velocity: velocity,
        spawnTime: now, // Use 'now' which we already have
        radius: BULLET_RADIUS
    };
    bullets.push(bulletData);
    scene.add(bullet.mesh);
}

// --- Flight State, Input Handling, HUD Elements ---
const planeState = { speed: 0.5, pitchRate: 0, rollRate: 0, yawRate: 0 };
const keysPressed = {};
let score = 0;

// Keyboard listener ONLY for movement keys
document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    // Prevent default browser behavior for arrow keys if needed
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'a', 'd', 'w', 's'].includes(key)) {
         // event.preventDefault(); // Uncomment if keys scroll the page
    }
    keysPressed[key] = true;
    // **REMOVED SPACEBAR LOGIC HERE**
});
document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    keysPressed[key] = false;
    // **REMOVED SPACEBAR LOGIC HERE**
});

// **NEW:** Mouse listener for shooting
document.addEventListener('mousedown', (event) => {
    // Optional: Check if clicking on canvas, not UI elements if they existed
    // if (event.target === renderer.domElement) {
        fireBullet();
    // }
});


const speedElement = document.getElementById('speed-value');
const altitudeElement = document.getElementById('altitude-value');
const pitchElement = document.getElementById('pitch-value');
const rollElement = document.getElementById('roll-value');
const scoreElement = document.getElementById('score-value');

// --- Camera Setup ---
const cameraOffset = new THREE.Vector3(0, 5.0, 18.0);

// --- Clock ---
const clock = new THREE.Clock();

// --- Utility Vectors ---
const forward = new THREE.Vector3();
const velocity = new THREE.Vector3();
const desiredCameraPosition = new THREE.Vector3();
const euler = new THREE.Euler();
const planeGroundPos = new THREE.Vector3();

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1);
    const elapsedTime = clock.getElapsedTime();

    // --- Process Inputs & Update Rates ---
    let targetPitchRate = 0, targetRollRate = 0, targetYawRate = 0;
    if (keysPressed['arrowup']) targetPitchRate = PITCH_SPEED;
    if (keysPressed['arrowdown']) targetPitchRate = -PITCH_SPEED;
    if (keysPressed['arrowleft']) targetRollRate = ROLL_SPEED;
    if (keysPressed['arrowright']) targetRollRate = -ROLL_SPEED;
    if (keysPressed['a']) targetYawRate = YAW_SPEED;
    if (keysPressed['d']) targetYawRate = -YAW_SPEED;
    if (keysPressed['w']) planeState.speed += ACCELERATION * deltaTime;
    if (keysPressed['s']) planeState.speed -= DECELERATION * deltaTime;
    planeState.speed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, planeState.speed));

    planeState.pitchRate += (targetPitchRate - planeState.pitchRate) * deltaTime * CONTROL_LERP_FACTOR;
    planeState.rollRate += (targetRollRate - planeState.rollRate) * deltaTime * CONTROL_LERP_FACTOR;
    planeState.yawRate += (targetYawRate - planeState.yawRate) * deltaTime * CONTROL_LERP_FACTOR;

    if (!keysPressed['arrowup'] && !keysPressed['arrowdown']) planeState.pitchRate *= DAMPING;
    if (!keysPressed['arrowleft'] && !keysPressed['arrowright']) planeState.rollRate *= DAMPING;
    if (!keysPressed['a'] && !keysPressed['d']) planeState.yawRate *= DAMPING;

    // --- Apply Rotations ---
    plane.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), planeState.yawRate * deltaTime * 100);
    plane.rotateX(planeState.pitchRate * deltaTime * 100);
    plane.rotateZ(planeState.rollRate * deltaTime * 100);

    // --- Update Plane Position ---
    plane.getWorldDirection(forward);
    velocity.copy(forward).multiplyScalar(planeState.speed);
    plane.position.addScaledVector(velocity, deltaTime * 100);

    // --- Update Bullets ---
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bulletData = bullets[i];
        bulletData.mesh.position.addScaledVector(bulletData.velocity, deltaTime);
        if (elapsedTime - bulletData.spawnTime > BULLET_LIFETIME) {
            scene.remove(bulletData.mesh);
            bullets.splice(i, 1);
        }
    }

    // --- Collision Detection ---
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bulletData = bullets[i];
        let bulletHit = false;
        for (let j = targets.length - 1; j >= 0; j--) {
            const target = targets[j];
            const distance = bulletData.mesh.position.distanceTo(target.position);
            const collisionThreshold = bulletData.radius + target.radius;

            if (distance < collisionThreshold) {
                // Hit!
                scene.remove(target); // Remove target mesh from scene
                targets.splice(j, 1); // Remove target data from array

                scene.remove(bulletData.mesh); // Remove bullet mesh
                bullets.splice(i, 1); // Remove bullet data

                score++; // Increase score
                scoreElement.textContent = score; // Update HUD

                // **NEW:** Create a new target immediately
                createTarget();

                bulletHit = true;
                break; // Bullet hits one target and disappears
            }
        }
        // If bullet hit, skip remaining target checks for this bullet
        if (bulletHit) continue;
    }

    // --- Update Camera ---
    desiredCameraPosition.copy(plane.position).add(cameraOffset.clone().applyQuaternion(plane.quaternion));
    camera.position.lerp(desiredCameraPosition, deltaTime * 3.5);
    camera.lookAt(plane.position);

    // --- Update HUD ---
    speedElement.textContent = (planeState.speed * 50).toFixed(1);
    planeGroundPos.copy(plane.position);
    planeGroundPos.y = 500;
    raycaster.set(planeGroundPos, downVector);
    const intersects = raycaster.intersectObject(groundMesh);
    let currentAltitude = plane.position.y - groundMesh.position.y;
    if (intersects.length > 0) {
        currentAltitude = plane.position.y - intersects[0].point.y;
    }
    altitudeElement.textContent = Math.max(0, Math.round(currentAltitude));
    euler.setFromQuaternion(plane.quaternion, 'YXZ');
    pitchElement.textContent = (-THREE.MathUtils.radToDeg(euler.x)).toFixed(0);
    rollElement.textContent = (-THREE.MathUtils.radToDeg(euler.z)).toFixed(0);

    // --- Render ---
    renderer.render(scene, camera);
}

// --- Resize Handler ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);

// --- Start Animation ---
animate();