// game.js
let scene, camera, renderer;
let cube, peerCube;
let light;
let peer, conn;
let movepov = 1;
let msyup = 0;

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
		camera.position.z = cube.position.z + 1.5
		camera.lookAt(cube.position.x, cube.position.y, cube.position.z + 1 + msyup);
	} else if (movepov === 0) {
		camera.position.x = cube.position.x + (0.51*Math.sin(-cube.rotation.z));
		camera.position.y = cube.position.y + (0.51*Math.cos(-cube.rotation.z));
		camera.position.z = cube.position.z + 0.05
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
peer = new Peer(myId)
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
const mouse = new THREE.Vector2();
window.addEventListener('mousemove', (event) => {
	mouse.x = event.clientX;
	mouse.y = event.clientY;
});
let mx = mouse.x;
let mz = mouse.y;

function rotateBox() {
	const dx = mouse.x - mx;
	const dy = mouse.y - mz
	if (Math.abs(dx) > 0.01) {
		cube.rotation.z -= dx * 0.005;
		mx = mouse.x
	}
	if (Math.abs(dy) > 0.01) {
		msyup = -mouse.y * 0.005
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
