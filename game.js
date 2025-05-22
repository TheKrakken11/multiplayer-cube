import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from './GLTFLoader.js';
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
let scene, camera, renderer;
let cube, peerCube;
let light;
let peer, conn;
let movepov = 1;
let msyup = 0;

// Pointer lock variables
let pointerLocked = false;
const mouse = new THREE.Vector2();
let mx, mz;

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

function init3D() {
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
	const plane = new THREE.Mesh(geopl, mat);
	plane.position.z = -0.5;
	plane.receiveShadow = true;
	scene.add(plane);
	let car;
	const loader = new GLTFLoader();
	loader.load('Car.glb', (gltf) => {
		car = gltf.scene;
		car.position.set(5, 5, -0.5)
		car.scale.set(0.05, 0.05, 0.05)
		car.rotation.x = Math.PI / 2
		scene.add(car);
	});
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
function getApproximateIntersectionPoint(mesh1, mesh2) {
  if (!mesh1.geometry.boundsTree) mesh1.geometry.computeBoundsTree();
  if (!mesh2.geometry.boundsTree) mesh2.geometry.computeBoundsTree();

  const intersections = mesh1.geometry.boundsTree.intersectsGeometry(
    mesh2.geometry,
    mesh2.matrixWorld,
    {
      returnIntersections: true,
    }
  );

  if (intersections.length === 0) return null;

  const { triangle1, triangle2 } = intersections[0];

  const centroid1 = new THREE.Vector3();
  triangle1.getMidpoint(centroid1);

  const centroid2 = new THREE.Vector3();
  triangle2.getMidpoint(centroid2);

  const midpoint = new THREE.Vector3().addVectors(centroid1, centroid2).multiplyScalar(0.5);

  return midpoint;
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
	rotateBox();
	cube.position.z += cubevup
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
	const coords = document.getElementById('coordinates');
	coords.innerHTML = 
		`X: ${cube.position.x.toFixed(2)}<br>` +
		`Y: ${cube.position.y.toFixed(2)}<br>` +
		`Z: ${cube.position.z.toFixed(2)}`;
	updateLightPosition();
	if (conn && conn.open) {
		conn.send({
			type: 'move',
			x: cube.position.x,
			y: cube.position.y,
			z: cube.position.z,
			rot: cube.rotation.z
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
			peerCube.position.x = data.x;
			peerCube.position.y = data.y;
			peerCube.position.z = data.z;
			peerCube.rotation.z = data.rot
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
		cube.position.y += 0.1*(Math.cos(-cube.rotation.z));
		cube.position.x += 0.1*(Math.sin(-cube.rotation.z));
		if (cubevup === 0) {
			cubevup = 0.05;
		}
		moved = true;
	} else if (event.key === 's') {
		cube.position.y -= 0.1*(Math.cos(-cube.rotation.z));
		cube.position.x -= 0.1*(Math.sin(-cube.rotation.z));
		if (cubevup === 0) {
			cubevup = 0.05;
		}
		moved = true;
	} else if (event.key === 'a') {
		cube.position.y -= 0.1*(Math.sin(cube.rotation.z));
		cube.position.x -= 0.1*(Math.cos(cube.rotation.z));
		if (cubevup === 0) {
			cubevup = 0.05;
		}
		moved = true;
	} else if (event.key === 'd') {
		cube.position.y += 0.1*(Math.sin(cube.rotation.z));
		cube.position.x += 0.1*(Math.cos(cube.rotation.z));
		if (cubevup === 0) {
			cubevup = 0.05;
		}
		moved = true;
	} else if (event.key === ' ') {
		if (cubevup === 0) {
			cubevup = 0.2;
		}
		moved = true;
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
