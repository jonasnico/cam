import GUI from 'lil-gui';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { detectFaces, initFaceDetector } from './detection/faceDetector.js';
import { animateCube, createCube } from './modes/cube.js';
import { createFaceTrack, updateFaceMarkers } from './modes/faceTrack.js';
import { createGrid } from './modes/grid.js';
import { createSphere } from './modes/sphere.js';
import { createTunnel } from './modes/tunnel.js';

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
  sphere: () => createSphere(meshGroup, material, camera, controls),
  tunnel: () => createTunnel(meshGroup, material, camera, controls),
  grid: () => createGrid(meshGroup, material, camera, controls),
  cube: () => createCube(meshGroup, material, camera, controls),
  faceTrack: () => createFaceTrack(meshGroup, material, camera, controls)
};

const settings = { mode: 'sphere', faceDetection: false };
let lastDetections = [];

function clearScene() {
  while (meshGroup.children.length > 0) {
    const child = meshGroup.children[0];
    child.geometry?.dispose();
    meshGroup.remove(child);
  }
}

function setMode(mode) {
  clearScene();
  modes[mode]();
  controls.target.set(0, 0, 0);
  controls.update();
}

const gui = new GUI();
gui.add(settings, 'mode', Object.keys(modes)).name('Visualization').onChange(setMode);
gui.add(settings, 'faceDetection').name('Face Detection').onChange(async (enabled) => {
  if (enabled) await initFaceDetector();
});

setMode(settings.mode);

renderer.setAnimationLoop((timestamp) => {
  if (settings.mode === 'cube') animateCube(meshGroup);
  
  if (settings.faceDetection && settings.mode === 'faceTrack') {
    const detections = detectFaces(video, timestamp);
    if (detections !== null) lastDetections = detections;
    updateFaceMarkers(meshGroup, lastDetections, video.videoWidth, video.videoHeight);
  }
  
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
