// game.js
let scene, camera, renderer;
let cube, peerCube;
let peer, conn;

function init3D() {
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
	renderer = new THREE.WebGLRenderer();
	renderer.domElement.id = 'gameCanvas';
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);
	const geometry = new THREE.BoxGeometry();
	const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
	cube = new THREE.Mesh(geometry, material);
	scene.add(cube)
	const peerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
	peerCube = new THREE.Mesh(geometry, peerMaterial);
	scene.add(peerCube)
	cube.position.x = -1;
	peerCube.position.x = 1;
	camera.position.z = 5;
	animate();
}

function animate() {
	requestAnimationFrame(animate);
	camera.position.x = cube.position.x;
	camera.position.y = cube.position.y;
	camera.position.z = cube.position.z + 5;
	const coords = document.getElementById('coordinates');
	coords.innerHTML = 
		`X: ${cube.position.x.toFixed(2)}<br>` +
		`Y: ${cube.position.y.toFixed(2)}`;
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
		}
	});
}

document.addEventListener('keydown', event => {
	let moved = false;
	if (event.key === 'ArrowUp') {
		cube.position.y += 0.1;
		moved = true;
	} else if (event.key === 'ArrowDown') {
		cube.position.y -= 0.1;
		moved = true;
	} else if (event.key === 'ArrowLeft') {
		cube.position.x -= 0.1;
		moved = true;
	} else if (event.key === 'ArrowRight') {
		cube.position.x += 0.1;
		moved = true;
	}
	
	if (moved && conn && conn.open) {
		conn.send({
			type: 'move',
			x: cube.position.x,
			y: cube.position.y
		});
	}
});
function moveCube(direction) {
  let moved = false;
  switch (direction) {
    case 'up':
      cube.position.y += 0.1;
      moved = true;
      break;
    case 'down':
      cube.position.y -= 0.1;
      moved = true;
      break;
    case 'left':
      cube.position.x -= 0.1;
      moved = true;
      break;
    case 'right':
      cube.position.x += 0.1;
      moved = true;
      break;
  }

  if (moved && conn && conn.open) {
    conn.send({
      type: 'move',
      x: cube.position.x,
      y: cube.position.y
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
