import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

const video = document.getElementById('video');
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const scene = new THREE.Scene();
const meshGroup = new THREE.Group();
scene.add(meshGroup);

const texture = new THREE.VideoTexture(video);
texture.colorSpace = THREE.SRGBColorSpace;
const material = new THREE.MeshBasicMaterial({ map: texture });

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;

const modes = {
  sphere: createSphere,
  tunnel: createTunnel,
  grid: createGrid,
  cube: createCube,
  mirror: createMirror,
  single: createSingle
};

const settings = { mode: 'sphere' };

function clearScene() {
  while (meshGroup.children.length > 0) {
    const child = meshGroup.children[0];
    child.geometry?.dispose();
    meshGroup.remove(child);
  }
}

function createSphere() {
  camera.position.set(0, 0, 0.01);
  controls.enableZoom = false;
  const geometry = new THREE.PlaneGeometry(8, 4.5);
  const count = 128;
  const radius = 32;
  for (let i = 1; i <= count; i++) {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.setFromSphericalCoords(radius, phi, theta);
    mesh.lookAt(camera.position);
    meshGroup.add(mesh);
  }
}

function createTunnel() {
  camera.position.set(0, 0, 5);
  controls.enableZoom = true;
  const geometry = new THREE.PlaneGeometry(4, 2.25);
  const count = 50;
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = -i * 8;
    mesh.rotation.z = i * 0.1;
    const scale = 1 + i * 0.5;
    mesh.scale.set(scale, scale, 1);
    meshGroup.add(mesh);
  }
}

function createGrid() {
  camera.position.set(0, 0, 30);
  controls.enableZoom = true;
  const geometry = new THREE.PlaneGeometry(4, 2.25);
  const gridSize = 5;
  const spacing = 5;
  for (let x = -gridSize; x <= gridSize; x++) {
    for (let y = -gridSize; y <= gridSize; y++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x * spacing, y * spacing, 0);
      meshGroup.add(mesh);
    }
  }
}

function createCube() {
  camera.position.set(3, 3, 3);
  controls.enableZoom = true;
  const geometry = new THREE.BoxGeometry(4, 4, 4);
  const materials = Array(6).fill(material);
  const mesh = new THREE.Mesh(geometry, materials);
  meshGroup.add(mesh);
}

function createMirror() {
  camera.position.set(0, 0, 10);
  controls.enableZoom = true;
  const geometry = new THREE.PlaneGeometry(4, 2.25);
  const segments = 8;
  for (let i = 0; i < segments; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    const angle = (i / segments) * Math.PI * 2;
    mesh.position.set(Math.cos(angle) * 3, Math.sin(angle) * 3, 0);
    mesh.rotation.z = angle + Math.PI / 2;
    mesh.scale.x = i % 2 === 0 ? 1 : -1;
    meshGroup.add(mesh);
  }
}

function createSingle() {
  camera.position.set(0, 0, 10);
  controls.enableZoom = true;
  const geometry = new THREE.PlaneGeometry(16, 9);
  const mesh = new THREE.Mesh(geometry, material);
  meshGroup.add(mesh);
}

function setMode(mode) {
  clearScene();
  modes[mode]();
  controls.target.set(0, 0, 0);
  controls.update();
}

const gui = new GUI();
gui.add(settings, 'mode', Object.keys(modes)).name('Visualization').onChange(setMode);

setMode(settings.mode);

renderer.setAnimationLoop(() => {
  if (settings.mode === 'cube') meshGroup.children[0]?.rotation.set(
    meshGroup.children[0].rotation.x + 0.005,
    meshGroup.children[0].rotation.y + 0.005,
    0
  );
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (navigator.mediaDevices?.getUserMedia) {
  navigator.mediaDevices
    .getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' } })
    .then(stream => {
      video.srcObject = stream;
      video.play();
    })
    .catch(error => console.error('Unable to access webcam:', error));
} else {
  console.error('MediaDevices interface not available.');
}
