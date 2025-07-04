import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from './GLTFLoader.js';
import { AirplanePhysics } from './AirplanePhysics.js';
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast
} from './index.module.js';
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
await new Promise((resolve, reject) => {
	const script = document.createElement('script');
	script.src = 'https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js';
	script.onload = resolve;
	script.onerror = reject;
	document.body.appendChild(script);
});
let start = Date.now() + 1000;
let scene, camera, renderer;
let cube, peerCube, plane;
let light;
let peer, conn;
let movepov = 1;
let msyup = 0;
let accel = 0;
let car, car2, truck, truck2, airplane;
let airplanePhysics;
let attind;
let thrust;
const vehicles = [];
let keysDown = new Set();
// Pointer lock variables
let pointerLocked = false;
const mouse = new THREE.Vector2();
let mx, mz;
let mixer, animationAction, clock = new THREE.Clock();

// --- POINTER LOCK IMPLEMENTATION STARTS HERE ---

// Request pointer lock on the renderer's DOM element
function requestPointerLock() {
  const el = renderer.domElement;
  if (el.requestPointerLock) {
    el.requestPointerLock();
  } else if (el.mozRequestPointerLock) {
    el.mozRequestPointerLock();
  } else if (el.webkitRequestPointerLock) {
    el.webkitRequestPointerLock();
  }
}

// Listen for pointer lock change events
function onPointerLockChange() {
  const el = renderer.domElement;
  if (
    document.pointerLockElement === el ||
    document.mozPointerLockElement === el ||
    document.webkitPointerLockElement === el
  ) {
    pointerLocked = true;
    document.addEventListener("mousemove", pointerLockMouseMove, false);
  } else {
    pointerLocked = false;
    document.removeEventListener("mousemove", pointerLockMouseMove, false);
  }
}

// Listen for pointer lock error
function onPointerLockError() {
  console.error("Pointer lock failed");
}

// Only used when pointer is locked: apply deltas directly
function pointerLockMouseMove(e) {
  const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
  const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
  cube.rotation.z -= movementX * 0.005; // rotate horizontally
  msyup += -movementY * 0.005;          // vertical look
  // Optionally clamp msyup to avoid flipping over
  msyup = Math.max(-1.5, Math.min(1.5, msyup));
}

// Add pointer lock event listeners
document.addEventListener('pointerlockchange', onPointerLockChange, false);
document.addEventListener('mozpointerlockchange', onPointerLockChange, false);
document.addEventListener('webkitpointerlockchange', onPointerLockChange, false);
document.addEventListener('pointerlockerror', onPointerLockError, false);
document.addEventListener('mozpointerlockerror', onPointerLockError, false);
document.addEventListener('webkitpointerlockerror', onPointerLockError, false);

// Start pointer lock on 'f' key press
document.addEventListener('keydown', (event) => {
  if (event.key === 'f' || event.key === 'F') {
    requestPointerLock();
  }
});

// --- END POINTER LOCK IMPLEMENTATION ---
function random(min, max) {
	return Math.random() * (max - min) + min;
}
function randomInt(min, max) {
	return Math.floor(random(min, max));
}
function loadCar() {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      'Car.glb',
      (gltf) => {
        const carModel = gltf.scene;
        carModel.position.set(0, 0, 0);  // reset position inside wrapper
        carModel.rotation.set(Math.PI / 2, 0, 0);  // rotate model so that x=π/2 becomes zero

        const car = new THREE.Object3D();
        car.add(carModel);

        // Now 'car' is the wrapper; you can set position, rotation, scale on it as usual:
        car.position.set(5, 5, -0.5);
        car.scale.set(0.05, 0.05, 0.05);
        car.up.set(0, 1, 0);

        // Set userData on the wrapper object
        car.userData = {
          type: 'car',
          maxSeats: 4,
          seats: [1, 2, 3, 4],
          speed: 0
        };

        resolve(car);
      },
      undefined,
      (error) => reject(error)
    );
  });
}
function loadTruck() {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      'Truck.glb',
      (gltf) => {
        const carModel = gltf.scene;
        carModel.position.set(-5.75, 0, 0);  // reset position inside wrapper
        carModel.rotation.set(Math.PI / 2, Math.PI / 2, 0);  // rotate model so that x=π/2 becomes zero
		
        const car = new THREE.Object3D();
        car.add(carModel);

        // Now 'car' is the wrapper; you can set position, rotation, scale on it as usual:
        car.position.set(5, 5, -0.5);
        car.scale.set(0.5, 0.5, 0.5);
        car.up.set(0, 1, 0);

        // Set userData on the wrapper object
        car.userData = {
          type: 'car',
          maxSeats: 10,
          seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          speed: 0
        };

        resolve(car);
      },
      undefined,
      (error) => reject(error)
    );
  });
}
function loadPlane() {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      'airplane.glb',
      (gltf) => {
        const carModel = gltf.scene;
        carModel.position.set(0, 0, 0);  // reset position inside wrapper
        carModel.rotation.set(Math.PI / 2, 0, 0);  // rotate model so that x=π/2 becomes zero
		carModel.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), Math.PI);
		mixer = new THREE.AnimationMixer(carModel);
		const clip = gltf.animations[0];
		animationAction = mixer.clipAction(clip);
		animationAction.clampWhenFinished = true;
		animationAction.loop = THREE.LoopOnce;
        const car = new THREE.Object3D();
        car.add(carModel);

        // Now 'car' is the wrapper; you can set position, rotation, scale on it as usual:
        car.position.set(5, 5, 0);
        car.scale.set(0.75, 0.75, 0.75);
        car.up.set(0, 1, 0);
        car.rotation.z = 0

        // Set userData on the wrapper object
        car.userData = {
          type: 'plane',
          maxSeats: 2,
          seats: [1, 2],
          speed: 0,
          thrust: 0
        };

        resolve(car);
      },
      undefined,
      (error) => reject(error)
    );
  });
}
function makeTree(x, y) {
	return new Promise((resolve, reject) => {
		const loader = new GLTFLoader();
		loader.load(
			'Tree.glb',
			(gltf) => {
				const tree = gltf.scene;
				tree.position.set(x, y, 0);
				tree.rotation.x = Math.PI / 2
				tree.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), random(0, (2 * Math.PI)));
				const scale = random(0.3, 1);
				tree.scale.set(scale, scale, scale);
				tree.position.z = 7 * scale;
				resolve(tree);
			},
			undefined,
			(error) => reject(error)
		);
	});
}
function gearUp(anim) {
	if (anim.isRunning()) {
		return;
	}
	anim.paused = false;
	anim.timeScale = 1;
	anim.reset();
	anim.play();
}
function gearDown(anim) {
	if (anim.isRunning()) {
		return;
	}
	anim.paused = false;
	anim.timeScale = -1;
	anim.reset();
	const duration = anim.getClip().duration;
	anim.time = duration;
	anim.play();
}
async function init3D() {
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x87ceeb);
	light = new THREE.DirectionalLight(0xffffff, 2);
	light.position.set(100, 100, 100);
	light.castShadow = true;
	scene.add(light);
	light.shadow.camera.left = -100;
	light.shadow.camera.right = 100;
	light.shadow.camera.top = 100;
	light.shadow.camera.bottom = -100;
	light.shadow.camera.near = 10;
	light.shadow.camera.far = 500;
	light.shadow.mapSize.width = 2048;
	light.shadow.mapSize.height = 2048;
	light.shadow.bias = -0.005;
	light.target.position.set(0, 0, 0);
	scene.add(light.target);
	const amblight = new THREE.AmbientLight(0xffffff, 1.5);
	scene.add(amblight);
	camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
	camera.up.set(0, 0, 1);
	renderer = new THREE.WebGLRenderer();
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.domElement.style.cursor = 'none';
	renderer.shadowMap.enabled = true;
	document.body.appendChild(renderer.domElement);
	const geopl = new THREE.PlaneGeometry(1000, 1000);
	const mat = new THREE.MeshStandardMaterial({
		color: 0x228B22,
		metalness: 0.2,
		roughness: 0.8
	});
	plane = await new Promise((resolve) => {
		const geopl = new THREE.PlaneGeometry(100000, 100000);
		const mat = new THREE.MeshStandardMaterial({
			color: 0x228B22,
			metalness: 0.2,
			roughness: 0.8
		});
		const p = new THREE.Mesh(geopl, mat);
		p.position.z = -0.5;
		p.receiveShadow = true;
		scene.add(p);
		resolve(p);
	});
	car = await loadCar();
	car.name = 'car';
	vehicles.push(car);
	scene.add(car);
	car2 = await loadCar();
	car2.position.set(8, 5, -0.5);
	car2.name = 'car2';
	vehicles.push(car2);
	scene.add(car2);
	truck = await loadTruck();
	truck.position.set(11, 5, -0.5);
	truck.name = 'truck';
	vehicles.push(truck);
	scene.add(truck);
	truck2 = await loadTruck();
	truck2.position.set(14, 5, -0.5);
	truck2.name = 'truck2';
	vehicles.push(truck2);
	scene.add(truck2);
	airplane = await loadPlane();
	airplane.position.set(5, 12, 1);
	airplane.userData.airplanePhysics = new AirplanePhysics(airplane);
	airplane.rotateX(Math.PI / 23);
	airplane.userData.thrust = 0
	airplane.userData.braking = false;
	airplane.name = 'plane';
	vehicles.push(airplane);
	scene.add(airplane);
	for (let i = 0; i < 100; i++) {
		const treex = randomInt(-250, 250);
		const treey = randomInt(-250, 250);
		const tree = await makeTree(treex, treey);
		scene.add(tree);
	}
	const sphereGeo = new THREE.SphereGeometry(1, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
	const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, side: THREE.DoubleSide });
	const sky = new THREE.Mesh(sphereGeo, skyMaterial);
	const groundGeo = new THREE.SphereGeometry(1, 32, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
	const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
	const ground = new THREE.Mesh(groundGeo, groundMaterial);
	scene.add(camera);
	attind = new THREE.Group()
	attind.add(sky)
	attind.add(ground);
	attind.scale.set(0.2, 0.2, 0.2);
	camera.add(attind);
	attind.position.set(0.85, -0.3, -1.2);
	const reticleGeo = new THREE.RingGeometry(0.02, 0.03, 32);
	const reticleMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });
	const headingReticle = new THREE.Mesh(reticleGeo, reticleMat);
	headingReticle.scale.set(2, 2, 2)
	camera.add(headingReticle);
	headingReticle.position.set(0.75, -0.3, -1); // local to camera
	const geometry = new THREE.BoxGeometry();
	const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
	cube = new THREE.Mesh(geometry, material);
	cube.up.set(0, 0, 1);
	cube.castShadow = true;
	scene.add(cube);
	const peerMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
	peerCube = new THREE.Mesh(geometry, peerMaterial);
	peerCube.castShadow = true;
	scene.add(peerCube);
	cube.position.x = -1;
	peerCube.position.x = 1;
	camera.position.z = 5;
	animate();
}
function updateLightPosition() {
	const lightdir = new THREE.Vector3(1, 1, -2).normalize();
	light.position.copy(cube.position).add(lightdir.clone().multiplyScalar(100));
	light.target.position.copy(cube.position); // Focus on cube, not camera
	light.target.updateMatrixWorld();
}
function nearestObjectDistance(originObject, scene) {
	let closestDistance = Infinity;
	const originPos = new THREE.Vector3();
	originObject.getWorldPosition(originPos);
	scene.traverse(obj => {
		if (obj.isMesh && obj !== originObject && obj !== plane) {
			const objPos = new THREE.Vector3();
			obj.getWorldPosition(objPos);
			const distance = originPos.distanceTo(objPos);
			if (distance < closestDistance) {
				closestDistance = distance;
			}
		}
	});
	return isFinite(closestDistance) ? closestDistance : null;
}
function wouldHit(cube, direction, scene, rayDistance = 0.1, rayDensity = 3) {
	if (nearestObjectDistance > 2) {
		return false;
	}
	const dir = direction.clone().normalize();
	const geomet = cube.geometry.clone();
	geomet.applyMatrix4(cube.matrixWorld);
	const bbox = new THREE.Box3().setFromObject(cube);
	const center = bbox.getCenter(new THREE.Vector3());
	const size = bbox.getSize(new THREE.Vector3());
	const rays = [];
	const up = new THREE.Vector3(0, 0, 1);
	const tangent = new THREE.Vector3().crossVectors(dir, up).normalize();
	const bitangent = new THREE.Vector3().crossVectors(dir, tangent).normalize();
	for (let i = -rayDensity; i <= rayDensity; i++) {
		for (let j = -rayDensity; j <= rayDensity; j++) {
			const offset = tangent.clone().multiplyScalar(i * size.x / (2 * rayDensity))
				.add(bitangent.clone().multiplyScalar(j * size.y / (2 * rayDensity)));
			const origin = center.clone().add(offset);
			rays.push(origin);
		}
	}
	const testObjects = [];
	scene.traverse(obj => {
		if (obj.isMesh && obj !== cube && obj !== plane && obj !== attind) testObjects.push(obj);
	});
	for (const origin of rays) {
		raycaster.set(origin, dir);
		const hits = raycaster.intersectObjects(testObjects, true);
		if (hits.length > 0 && hits[0].distance <= rayDistance) {
			return true;
		}
	}
	return false;
}
function getTightBoundingBox(object) {
	const box = new THREE.Box3();
	object.traverse(child => {
		if (child.isMesh && child.geometry) {
			child.updateWorldMatrix(true, false);
			const childBox = new THREE.Box3().setFromObject(child);
			box.union(childBox);
		}
	});
	return box;
}
function scaleBox(box, scaleFactor) {
	const center = box.getCenter(new THREE.Vector3());
	const size = box.getSize(new THREE.Vector3()).multiplyScalar(scaleFactor);
	const halfSize = size.multiplyScalar(0.5);
	box.min.copy(center).sub(halfSize);
	box.max.copy(center).add(halfSize);
	return box;
}
function isObjectCollideList(objects, targetObject, moveVector) {
	targetObject.updateMatrixWorld(true);
	const targetBox = getTightBoundingBox(targetObject);
	targetBox.translate(moveVector);
	if (!targetObject.name.includes('truck')) {
		scaleBox(targetBox, 0.77)
	} else if (targetObject.name.includes('truck')) {
		scaleBox(targetBox, 0.8)
	}
	for (const obj of objects) {
		if (obj === targetObject) continue;
		obj.updateMatrixWorld(true);
		const box = getTightBoundingBox(obj);
		if (!obj.name.includes('truck')) {
			scaleBox(box, 0.77)
		} else if (obj.name.includes('truck')) {
			scaleBox(box, 0.8)
		}
		if (targetBox.intersectsBox(box)) {
			return true;
		}
	}
	return false;
}
function rotateBoundingBox(box, rotx, roty, rotz) {
    const center = box.getCenter(new THREE.Vector3());

    const rotX = new THREE.Matrix4().makeRotationX(rotx);
    const rotY = new THREE.Matrix4().makeRotationY(roty);
    const rotZ = new THREE.Matrix4().makeRotationZ(rotz);

    const rotMatrix = new THREE.Matrix4()
        .multiply(rotZ)
        .multiply(rotY)
        .multiply(rotX);

    const translationToOrigin = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z);
    const translationBack = new THREE.Matrix4().makeTranslation(center.x, center.y, center.z);

    const fullTransform = new THREE.Matrix4()
        .multiply(translationBack)
        .multiply(rotMatrix)
        .multiply(translationToOrigin);

    const points = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z)
    ];

    points.forEach(p => p.applyMatrix4(fullTransform));

    return new THREE.Box3().setFromPoints(points);
}
function hitGround(aircraft, xrot = 0, yrot = 0, zrot = 0, mvz = 0, ground = plane) {
    aircraft.updateMatrixWorld(true);
    let planebox = getTightBoundingBox(aircraft);
    planebox = rotateBoundingBox(planebox, xrot, yrot, zrot);

    // Move the bounding box down/up
    planebox.min.z += mvz;
    planebox.max.z += mvz;
    const groundbox = new THREE.Box3().setFromObject(ground);

    return planebox.intersectsBox(groundbox);
}
let lastFrameTime = performance.now();
let frameCount = 0;
let fps = 0;
function getFPS() {
	const now = performance.now();
	frameCount++;
	const delta = now - lastFrameTime;
	if (delta >= 1000) {
		fps = frameCount;
		frameCount = 0;
		lastFrameTime = now;
	}
	return fps;
}
let lastTime = performance.now();
let lastUpdateTime = Date.now();
function getDT() {
	const now = performance.now();
	const dt = (now - lastTime) / 1000;
	lastTime = now;
	return dt;
}
const raycaster = new THREE.Raycaster();
const forward = new THREE.Vector3();

function canMount(player, vehicle, maxDistance = 5) {
	const playerPos = new THREE.Vector3();
	player.getWorldPosition(playerPos);

	const vehicleBox = new THREE.Box3().setFromObject(vehicle);
	const vehicleCenter = vehicleBox.getCenter(new THREE.Vector3());
	const distance = playerPos.distanceTo(vehicleCenter);

	if (distance > maxDistance) return false;

	// Ray from player forward
	const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(player.quaternion).normalize();
	const ray = new THREE.Ray(playerPos, forward);

	// Test if the ray intersects the vehicle's bounding box
	return ray.intersectsBox(vehicleBox);
}


function mountVehicle(player, vehicle) {
	if (vehicle.userData.seats.length === 0) {
		return false;
	}
	const seatNumber = vehicle.userData.seats.shift();
	player.rotation.z = vehicle.rotation.z
	player.riding = {
		id : vehicle,
		seat : seatNumber,
		type : vehicle.userData.type
	};
	if (conn && conn.open) {
		conn.send({
			type: 'seats',
			vehiclename: vehicle.name,
			seats: vehicle.userData.seats
		});
	}
	return true;
}
function dismountVehicle(player) {
	if (!player.riding) return;
	const vehicle = player.riding.id;
	const seatNumber = player.riding.seat;
	if (!vehicle.userData.seats.includes(seatNumber)) {
		vehicle.userData.seats.push(seatNumber);
		vehicle.userData.seats.sort();
	}
	vehicle.userData.speed = 0
	const worldPos = new THREE.Vector3();
	player.getWorldPosition(worldPos);
	player.position.set(worldPos.x + 3, worldPos.y + 3, worldPos.z);
	player.riding = null;
	if (conn && conn.open) {
		conn.send({
			type: 'seats',
			vehiclename: vehicle.name,
			seats: vehicle.userData.seats
		});
	}
}
function setHealth(percent) {
	const healthBar = document.getElementById('health-bar');
	healthBar.style.width = percent + '%';
}
function getRollingSquareCenterFromAngle(totalAngle) {
  const r = Math.SQRT2 / 2;
  const quarterTurn = Math.PI / 2;

  const step = Math.floor(totalAngle / quarterTurn);
  const theta = totalAngle % quarterTurn;

  // Ensure theta is always positive (0 to π/2)
  const correctedTheta = theta < 0 ? theta + quarterTurn : theta;
  const correctedStep = theta < 0 ? step - 1 : step;

  const angle = Math.PI / 4 + correctedTheta;
  const x = correctedStep + r * Math.cos(angle);
  const y = r * Math.sin(angle);

  return [x, y];
}

function animate() {
	requestAnimationFrame(animate);
	const delta = clock.getDelta();
	if (mixer) mixer.update(delta);
	cube.rotation.set(0, 0, cube.rotation.z);
	rotateBox();
	if (!cube.riding || cube.riding.type != 'plane') {
		camera.visible = false;
		document.getElementById('speed').style.display = 'none';
		document.getElementById('thrust').style.display = 'none';
		document.getElementById('zmv').style.display = 'none';
		document.getElementById('alt').style.display = 'none';
		document.getElementById('warn').style.display = 'none';
		document.getElementById('braking').style.display = 'none';
	} else {
		document.getElementById('speed').style.display = 'block';
		document.getElementById('thrust').style.display = 'block';
		document.getElementById('zmv').style.display = 'block';
		document.getElementById('alt').style.display = 'block';
		document.getElementById('braking').style.display = 'block';
	}
	if (!cube.riding) {
		cube.position.z += cubevup;
		if (cube.position.z > 0) {
			cubevup -= 0.01
		} else {
			cubevup = 0
			cube.position.z = 0
		}
		if (movepov === 1) {
			camera.position.x = cube.position.x - (3*Math.sin(-cube.rotation.z));
			camera.position.y = cube.position.y - (3*Math.cos(-cube.rotation.z));
			camera.position.z = cube.position.z + 1.5;
			cube.visible = true
			camera.lookAt(cube.position.x, cube.position.y, cube.position.z + 1 + msyup);
		} else if (movepov === 0) {
			camera.position.x = cube.position.x + (0.51*Math.sin(-cube.rotation.z));
			camera.position.y = cube.position.y + (0.51*Math.cos(-cube.rotation.z));
			camera.position.z = cube.position.z + 0.05;
			cube.visible = false
			camera.lookAt((cube.position.x+(1*Math.sin(-cube.rotation.z))), (cube.position.y+(1*Math.cos(-cube.rotation.z))), (cube.position.z + 0.05 + msyup))
		}
	} else if (cube.riding.type === 'car') {
		const rdvhl = cube.riding.id;
		const moveVector = new THREE.Vector3(rdvhl.userData.speed * Math.sin(-rdvhl.rotation.z), rdvhl.userData.speed * Math.cos(-rdvhl.rotation.z), 0);
		if (!isObjectCollideList(vehicles, rdvhl, moveVector)) {
			rdvhl.position.x -= rdvhl.userData.speed * Math.sin(-rdvhl.rotation.z)
			rdvhl.position.y -= rdvhl.userData.speed * Math.cos(-rdvhl.rotation.z)
		}
		cube.visible = false;
		cube.position.copy(rdvhl.position)
		if (cube.riding.seat === 1) {
			rdvhl.rotation.z = cube.rotation.z
			if (keysDown.has('w') || keysDown.has('s')) {
				rdvhl.userData.speed += accel;
				// Clamp speed between -1 and 1
				rdvhl.userData.speed = Math.min(Math.max(rdvhl.userData.speed, -0.25), 0.25);
			}
			if (movepov === 0) {
				let offset
				if (!cube.riding.id.name.includes('truck')) {
					offset = new THREE.Vector3(0.5, -0.75, 1.5);
				} else if (cube.riding.id.name.includes('truck')) {
					offset = new THREE.Vector3(0.5, -1.25, 1.75);
				} 
				offset.applyQuaternion(rdvhl.quaternion);
				camera.position.copy(rdvhl.position.clone().add(offset));
				let lookAtOffset
				if (!cube.riding.id.name.includes('truck')) {
					lookAtOffset = new THREE.Vector3(0.5, -1, 1.5);
				} else if (cube.riding.id.name.includes('truck')) {
					lookAtOffset = new THREE.Vector3(0.5, -1.5, 1.75);
				}
				lookAtOffset.applyQuaternion(rdvhl.quaternion);
				camera.lookAt(rdvhl.position.clone().add(lookAtOffset));
			} else if (movepov === 1) {
				const relativeCameraOffset = new THREE.Vector3(0, 6, 3);
				const desiredCameraPos = relativeCameraOffset.clone().applyQuaternion(rdvhl.quaternion).add(rdvhl.position);

				const lookAtOffset = new THREE.Vector3(0, 2, 2.75);
				const desiredLookAt = lookAtOffset.clone().applyQuaternion(rdvhl.quaternion).add(rdvhl.position);

				// Detect significant rotation change
				const currentQuat = camera.quaternion.clone();
				const targetQuat = rdvhl.quaternion.clone();
				const angle = currentQuat.angleTo(targetQuat);

				const snapRotationThreshold = 0.2; // radians (~11.5 degrees)

				if (angle > snapRotationThreshold) {
					// Snap immediately
					camera.position.copy(desiredCameraPos);
				} else {
					// Smooth follow
					camera.position.lerp(desiredCameraPos, 0.3);
				}

				camera.lookAt(desiredLookAt);
			}

		} else if (cube.riding.seat === 2) {
			if (movepov === 0) {
				let offset
				if (!cube.riding.id.name.includes('truck')) {
					offset = new THREE.Vector3(-0.5, -0.75, 1.5);
				} else if (cube.riding.id.name.includes('truck')) {
					offset = new THREE.Vector3(-0.5, -1.25, 1.75);
				} 
				offset.applyQuaternion(rdvhl.quaternion);
				camera.position.copy(rdvhl.position.clone().add(offset));
				let lookAtOffset
				if (!cube.riding.id.name.includes('truck')) {
					lookAtOffset = new THREE.Vector3(-0.5, -1, 1.5);
				} else if (cube.riding.id.name.includes('truck')) {
					lookAtOffset = new THREE.Vector3(-0.5, -1.5, 1.75);
				}
				lookAtOffset.applyQuaternion(rdvhl.quaternion);
				camera.lookAt(rdvhl.position.clone().add(lookAtOffset));
			} else if (movepov === 1) {
				const relativeCameraOffset = new THREE.Vector3(0, 6, 3);
				const desiredCameraPos = relativeCameraOffset.clone().applyQuaternion(rdvhl.quaternion).add(rdvhl.position);

				const lookAtOffset = new THREE.Vector3(0, 2, 2.75);
				const desiredLookAt = lookAtOffset.clone().applyQuaternion(rdvhl.quaternion).add(rdvhl.position);

				// Detect significant rotation change
				const currentQuat = camera.quaternion.clone();
				const targetQuat = rdvhl.quaternion.clone();
				const angle = currentQuat.angleTo(targetQuat);

				const snapRotationThreshold = 0.2; // radians (~11.5 degrees)

				if (angle > snapRotationThreshold) {
					// Snap immediately
					camera.position.copy(desiredCameraPos);
				} else {
					// Smooth follow
					camera.position.lerp(desiredCameraPos, 0.3);
				}

				camera.lookAt(desiredLookAt);
			}
		} else {
			const relativeCameraOffset = new THREE.Vector3(0, 6, 3);
			const desiredCameraPos = relativeCameraOffset.clone().applyQuaternion(rdvhl.quaternion).add(rdvhl.position);

			const lookAtOffset = new THREE.Vector3(0, 2, 2.75);
			const desiredLookAt = lookAtOffset.clone().applyQuaternion(rdvhl.quaternion).add(rdvhl.position);
			// Detect significant rotation change
			const currentQuat = camera.quaternion.clone();
			const targetQuat = rdvhl.quaternion.clone();
			const angle = currentQuat.angleTo(targetQuat);

			const snapRotationThreshold = 0.2; // radians (~11.5 degrees)

			if (angle > snapRotationThreshold) {
				// Snap immediately
				camera.position.copy(desiredCameraPos);
			} else {
				// Smooth follow
				camera.position.lerp(desiredCameraPos, 0.3);
			}

			camera.lookAt(desiredLookAt);
		}
	} else if (cube.riding.type === 'plane') {
		const rdvhl = cube.riding.id
		cube.visible = false;
		cube.position.copy(rdvhl.position);
		const planeQuat = new THREE.Quaternion();
		rdvhl.getWorldQuaternion(planeQuat);
		const euler = new THREE.Euler();
		euler.setFromQuaternion(planeQuat, 'YXZ');
		attind.rotation.x = euler.x;
		attind.rotation.y = euler.z;
		//show details
		const MpS = rdvhl.userData.airplanePhysics.velocity.length();
		const knots = MpS * 1.94384;
		const fixedKnots = knots.toFixed(1);
		document.getElementById('speed').textContent = `Speed: ${fixedKnots} kts`;
		document.getElementById('thrust').textContent = `Thrust: ${((rdvhl.userData.thrust) / 4.448).toFixed(1)} lbs of force`;
		const vup = rdvhl.userData.airplanePhysics.velocity.z;
		const vupkts = vup * 1.94384;
		let fksdvupkts = vupkts.toFixed(1);
		document.getElementById('zmv').textContent = `Vertical speed: ${(fksdvupkts * 1.68781).toFixed(1)} fps`;
		document.getElementById('alt').textContent = `Altitude: ${(cube.position.z * 3.281).toFixed(1)} ft`;
		document.getElementById('warn').style.display = 'none';
		const box = document.getElementById('braking');
		if (cube.riding.id.userData.braking) {
			box.style.boxShadow = '0 0 20px 5px rgba(0, 255, 255, 0.8)';
			box.style.backgroundColor = '#6CA6CD';
		} else {
			box.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0)';
			box.style.backgroundColor = '#555';
		}
		if (movepov === 0) {
			let offset
			offset = new THREE.Vector3(0, 0.5, 0.75);
			offset.applyQuaternion(rdvhl.quaternion);
			camera.position.copy(rdvhl.position.clone().add(offset));
			let lookAtOffset
			lookAtOffset = new THREE.Vector3(0, 1.5, 0.75);
			lookAtOffset.applyQuaternion(rdvhl.quaternion);
			camera.lookAt(rdvhl.position.clone().add(lookAtOffset));
		} else if (movepov === 1) {
			const relativeCameraOffset = new THREE.Vector3(0, -6, 3);
			const desiredCameraPos = relativeCameraOffset.clone().applyQuaternion(rdvhl.quaternion).add(rdvhl.position);
			const lookAtOffset = new THREE.Vector3(0, 2, 2.75);
			const desiredLookAt = lookAtOffset.clone().applyQuaternion(rdvhl.quaternion).add(rdvhl.position);
			// Detect significant rotation change
			const currentQuat = camera.quaternion.clone();
			const targetQuat = rdvhl.quaternion.clone();
			const angle = currentQuat.angleTo(targetQuat);

			const snapRotationThreshold = 0.2; // radians (~11.5 degrees)

			if (angle > snapRotationThreshold) {
				// Snap immediately
				camera.position.copy(desiredCameraPos);
			} else {
				// Smooth follow
				camera.position.lerp(desiredCameraPos, 0.3);
			}
				camera.lookAt(desiredLookAt);
		}
	}
	if (Date.now() > start) {
		if (lastUpdateTime < start) {
			lastUpdateTime = Infinity;
			lastTime = performance.now();
		}
		const bbox = new THREE.Box3().setFromObject(airplane);
		const minZ = bbox.min.z;
		airplane.userData.airplanePhysics.update(airplane.userData.thrust, minZ + 0.5, getDT(), airplane.userData.braking);
	}
	if (car.userData.seats === 0 && car.userData.speed !== 0) {
		car.userData.speed *= 0.95
		if (Math.abs(car.userData.speed) < 0.01) {
			car.userData.speed = 0
		}
	}
		
	const coords = document.getElementById('coordinates');
	coords.innerHTML = 
		`X: ${cube.position.x.toFixed(2)}<br>` +
		`Y: ${cube.position.y.toFixed(2)}<br>` +
		`Z: ${cube.position.z.toFixed(2)}`;
	updateLightPosition();
	if (conn && conn.open) {
		conn.send({
			type: 'move',
			cube: {
				x: cube.position.x,
				y: cube.position.y,
				z: cube.position.z,
				rot: cube.rotation.z,
				riding: cube.riding ? {
					id: cube.riding.id.name,
					seat: cube.riding.seat,
					type: cube.riding.type
				} : null
			},
			// Only send vehicle data if this player is the driver
			vehicle: (cube.riding && cube.riding.seat === 1) ? {
				id: cube.riding.id.name,
				pos: {
					x: cube.riding.id.position.x,
					y: cube.riding.id.position.y,
					z: cube.riding.id.position.z
				},
				rotZ: cube.riding.id.rotation.z,
				speed: cube.riding.id.userData.speed,
				seats: cube.riding.id.userData.seats
			} : undefined // not null, so 'vehicle' is omitted entirely if not driver
		});
	}
	renderer.render(scene, camera);
}

function generateShortId() {
	const chars = 'ABCDEFGHIJKLMNOP'
	return chars.charAt(Math.floor(Math.random() * 26)) +
		chars.charAt(Math.floor(Math.random() * 10));
}
const myId = generateShortId();
peer = new window.Peer(myId)
peer.on('open', id => {
	document.getElementById('my-id').textContent = id;
});
document.getElementById('connect-button').onclick = () => {
	const peerId = document.getElementById('peer-id-input').value;
	conn = peer.connect(peerId);
	conn.on('open', setupConnection);
};
peer.on('connection', connection => {
	conn = connection;
	conn.on('open', setupConnection);
});

function setupConnection() {
  conn.on('data', data => {
    if (data.type === 'move') {
      const c = data.cube;

      // Update peer cube position and rotation
      peerCube.position.set(c.x, c.y, c.z);
      peerCube.rotation.z = c.rot;

      // Handle peer riding logic
      if (c.riding) {
		const vehicle = vehicles.find(obj => obj.name === c.riding.id);
		if (vehicle) {
			peerCube.visible = false;
			peerCube.position.copy(vehicle.position);
		} else {
			peerCube.visible = true;
		}
	} else {
		peerCube.visible = true;
	}

	// Only apply vehicle movement updates if we got them (i.e., from driver)
	if (data.vehicle) {
		const vehicle = vehicles.find(obj => obj.name === data.vehicle.id);
		if (vehicle) {
			vehicle.position.set(
				data.vehicle.pos.x,
				data.vehicle.pos.y,
				data.vehicle.pos.z
			);
			vehicle.rotation.z = data.vehicle.rotZ;
			vehicle.userData.speed = data.vehicle.speed;
			vehicle.userData.seats = data.vehicle.seats;
		}
	}
	} else if (data.type === 'seats') {
		const vehicle = vehicles.find(obj => obj.name === data.vehiclename);
		if (vehicle) {
			vehicle.userData.seats = data.seats;
		}
	}
  });
}

// Standard mouse tracking for when pointer lock is NOT enabled
window.addEventListener('mousemove', (event) => {
  if (!pointerLocked) {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  }
});
mx = mouse.x;
mz = mouse.y;

// Only need to handle rotation in regular mode
function rotateBox() {
  if (!pointerLocked) {
    const dx = mouse.x - mx;
    const dy = mouse.y - mz;
    if (Math.abs(dx) > 0.01) {
      cube.rotation.z -= dx * 0.005;
      mx = mouse.x;
    }
    if (Math.abs(dy) > 0.01) {
      msyup = (-mouse.y + 100) * 0.005;
      mz = mouse.y;
    }
    // Optionally clamp msyup
    msyup = Math.max(-1.5, Math.min(1.5, msyup));
  }
}

let cubevup = 0
document.addEventListener('keydown', event => {
	let moved = false;
	if (event.key === 'w') {
		if (!cube.riding) {
			const direction = new THREE.Vector3(0, 1, 0);
			direction.applyAxisAngle(new THREE.Vector3(0, 0, 1), cube.rotation.z);
			if (!wouldHit(cube, direction, scene, 0.7)) {
				cube.position.y += 0.1*(Math.cos(-cube.rotation.z));
				cube.position.x += 0.1*(Math.sin(-cube.rotation.z));
				if (cubevup === 0) {
					cubevup = 0.05;
				}
			}
		} else if (cube.riding.type === 'car' && cube.riding.seat === 1) {
			accel = 0.05
		} else if (cube.riding.type === 'plane' && cube.riding.seat === 1) {
			if (cube.riding.id.userData.thrust < 7500) {
				cube.riding.id.userData.thrust += 75
			} else if (cube.riding.id.userData.thrust > 7500) {
				cube.riding.id.userData.thrust = 7500
			}
		}
		moved = true;
	} else if (event.key === 's') {
		if (!cube.riding) {
			const direction = new THREE.Vector3(0, -1, 0);
			direction.applyAxisAngle(new THREE.Vector3(0, 0, 1), cube.rotation.z);
			if (!wouldHit(cube, direction, scene, 0.7)) {
				cube.position.y -= 0.1*(Math.cos(-cube.rotation.z));
				cube.position.x -= 0.1*(Math.sin(-cube.rotation.z));
				if (cubevup === 0) {
					cubevup = 0.05;
				}
			}
		} else if (cube.riding.type === 'car' && cube.riding.seat === 1) {
			accel = -0.05
		} else if (cube.riding.type === 'plane' && cube.riding.seat === 1) {
			if (cube.riding.id.userData.thrust > 0) {
				cube.riding.id.userData.thrust -= 260
			} else if (cube.riding.id.userData.thrust < 0) {
				cube.riding.id.userData.thrust = 0
			}
		}
		moved = true;
	}
	if (!(cube.riding && cube.riding.type === 'car')) {
		if (event.key === 'a') {
			if (!cube.riding) {
				const direction = new THREE.Vector3(-1, 0, 0);
				direction.applyAxisAngle(new THREE.Vector3(0, 0, 1), cube.rotation.z);
				if (!wouldHit(cube, direction, scene, 0.7)) {
					cube.position.y -= 0.1*(Math.sin(cube.rotation.z));
					cube.position.x -= 0.1*(Math.cos(cube.rotation.z));
					if (cubevup === 0) {
						cubevup = 0.05;
					}
				}
			} else {
				if (cube.riding.type === 'plane' && cube.riding.seat === 1) {
					if (!hitGround(cube.riding.id, 0, 0, 0.03, 0, plane)) {
						cube.riding.id.userData.airplanePhysics.applyControls(0, 0.1, 0)
					} else {
						cube.riding.id.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), 0.03);
					}
				}
			}
			moved = true;
		} else if (event.key === 'd') {
			if (!cube.riding) {
				const direction = new THREE.Vector3(1, 0, 0);
				direction.applyAxisAngle(new THREE.Vector3(0, 0, 1), cube.rotation.z);
				if (!wouldHit(cube, direction, scene, 0.7)) {
					cube.position.y += 0.1*(Math.sin(cube.rotation.z));
					cube.position.x += 0.1*(Math.cos(cube.rotation.z));
					if (cubevup === 0) {
						cubevup = 0.05;
					}
				}
				moved = true;
			} else {
				if (cube.riding.type === 'plane' && cube.riding.seat === 1) {
					if (!hitGround(cube.riding.id, 0, 0, -0.03, 0, plane)) {
						cube.riding.id.userData.airplanePhysics.applyControls(0, -0.1, 0)
					} else {
						cube.riding.id.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -0.03);
					}
				}
			}
		} else if (event.key === ' ') {
			if (cubevup === 0) {
				cubevup = 0.2;
			}
			moved = true;
		}
	}
});
document.addEventListener('keydown', event => {
	if (event.key === 'r') {
		if (movepov === 1) {
			movepov = 0;
		} else if (movepov === 0) {
			movepov = 1;
		}
	}
});
document.addEventListener('keydown', event => {
	if (event.key === 't') {
		gearUp(animationAction);
	} else if (event.key === 'v') {
		gearDown(animationAction);
	} else if (event.key === 'g') {
		if (cube.riding && cube.riding.type === 'plane') {
			if (cube.riding.seat === 1) {
				cube.riding.id.userData.braking = !cube.riding.id.userData.braking;
			}
		}
	} else if (event.key === 'ArrowUp') {
		if (cube.riding && cube.riding.type === 'plane') {
			if (!hitGround(cube.riding.id, 0.05, 0, 0, 0, plane)) {
				cube.riding.id.userData.airplanePhysics.applyControls(0.1, 0, 0)
			}
		}
	} else if (event.key === 'ArrowDown') {
		if (cube.riding && cube.riding.type === 'plane') {
			if (cube.riding) {
				if (!hitGround(cube.riding.id, -0.05, 0, 0, 0, plane)) {
					cube.riding.id.userData.airplanePhysics.applyControls(-0.1, 0, 0)
				}
			}
		}
	} else if (event.key === 'ArrowLeft') {
		if (cube.riding && cube.riding.type === 'plane') {
			if (cube.riding) {
				if (!hitGround(cube.riding.id, 0.07, 0, 0, 0, plane)) {
					cube.riding.id.userData.airplanePhysics.applyControls(0, 0, 0.1)
				}
			}
		}
	} else if (event.key === 'ArrowRight') {
		if (cube.riding && cube.riding.type === 'plane') {
			if (cube.riding) {
				if (!hitGround(cube.riding.id, -0.07, 0, 0, 0, plane)) {
					cube.riding.id.userData.airplanePhysics.applyControls(0, 0, -0.1)
				}
			}
		}
	}
});
document.addEventListener('keydown', event => {
	if (event.key === 'e') {
		if (!cube.riding) {
			for (const v of vehicles) {
				if (canMount(cube, v)) {
					mountVehicle(cube, v);
					break;
				}
			}
		}
	}
	if (event.key === 'q' && cube.riding) {
		dismountVehicle(cube);
	}
});
document.addEventListener('keydown', event => {
	keysDown.add(event.key.toLowerCase());
});
document.addEventListener('keyup', event => {
	keysDown.delete(event.key.toLowerCase());
});
function moveCube(direction) {
  let moved = false;
  switch (direction) {
    case 'up':
      cube.position.y += 0.1*(Math.cos(-cube.rotation.z));
      cube.position.x += 0.1*(Math.sin(-cube.rotation.z));
      moved = true;
      break;
    case 'down':
      cube.position.y -= 0.1*(Math.cos(-cube.rotation.z));
      cube.position.x -= 0.1*(Math.sin(-cube.rotation.z));
      moved = true;
      break;
    case 'left':
      cube.position.y -= 0.1*(Math.sin(-cube.rotation.z));
      cube.position.x -= 0.1*(Math.cos(-cube.rotation.z));
      moved = true;
      break;
    case 'right':
      cube.position.y += 0.1*(Math.sin(-cube.rotation.z));
      cube.position.x += 0.1*(Math.cos(-cube.rotation.z));
      moved = true;
      break;
  }

  if (moved && conn && conn.open) {
    conn.send({
      type: 'move',
      x: cube.position.x,
      y: cube.position.y,
      z: cube.position.z,
      rot: cube.rotation.z
    });
  }
}

// Add touch/click listeners
['up', 'down', 'left', 'right'].forEach(dir => {
  const btn = document.getElementById(dir);
  let intervalId;

  const startMoving = () => {
    moveCube(dir); // Move immediately
    intervalId = setInterval(() => moveCube(dir), 100); // Repeat every 100ms
  };

  const stopMoving = () => {
    clearInterval(intervalId);
  };

  // Touch events for mobile
  btn.addEventListener('touchstart', startMoving);
  btn.addEventListener('touchend', stopMoving);
  btn.addEventListener('touchcancel', stopMoving);

  // Mouse events for desktop
  btn.addEventListener('mousedown', startMoving);
  btn.addEventListener('mouseup', stopMoving);
  btn.addEventListener('mouseleave', stopMoving);
});

init3D();
