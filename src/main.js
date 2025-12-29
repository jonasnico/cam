import GUI from 'lil-gui';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { detectFaces, initFaceDetector } from './detection/faceDetector.js';
import { detectFaceLandmarks, initFaceLandmarker } from './detection/faceLandmarker.js';
import { detectHandLandmarks, initHandLandmarker } from './detection/handLandmarker.js';
import { animateCube, createCube } from './modes/cube.js';
import { createGrid } from './modes/grid.js';
import { createSphere } from './modes/sphere.js';
import { createTracking } from './modes/tracking.js';
import { createTunnel } from './modes/tunnel.js';
import { clearAllOverlays, initOverlay, updateFaceDetectionOverlay, updateLandmarksOverlay } from './tracking/overlay.js';

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
  tracking: () => createTracking(meshGroup, material, camera, controls),
  sphere: () => createSphere(meshGroup, material, camera, controls),
  tunnel: () => createTunnel(meshGroup, material, camera, controls),
  grid: () => createGrid(meshGroup, material, camera, controls),
  cube: () => createCube(meshGroup, material, camera, controls),
};

const settings = { 
  mode: 'tracking', 
  faceDetection: false,
  faceLandmarks: false,
  handLandmarks: false
};
let lastDetections = [];
let lastFaceLandmarks = null;
let lastHandLandmarks = null;

initOverlay(scene);

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

const detectionFolder = gui.addFolder('Detection');
detectionFolder.add(settings, 'faceDetection').name('Face Detection').onChange(async (enabled) => {
  if (enabled) await initFaceDetector();
});
detectionFolder.add(settings, 'faceLandmarks').name('Face Landmarks').onChange(async (enabled) => {
  if (enabled) await initFaceLandmarker();
});
detectionFolder.add(settings, 'handLandmarks').name('Hand Landmarks').onChange(async (enabled) => {
  if (enabled) await initHandLandmarker();
});

setMode(settings.mode);

renderer.setAnimationLoop((timestamp) => {
  if (settings.mode === 'cube') animateCube(meshGroup);
  
  if (settings.faceDetection) {
    const detections = detectFaces(video, timestamp);
    if (detections !== null) lastDetections = detections;
    updateFaceDetectionOverlay(lastDetections, video.videoWidth, video.videoHeight);
  } else if (!settings.faceLandmarks && !settings.handLandmarks) {
    clearAllOverlays();
  }
  
  if (settings.faceLandmarks || settings.handLandmarks) {
    if (settings.faceLandmarks) {
      const faceResult = detectFaceLandmarks(video, timestamp);
      if (faceResult !== null) lastFaceLandmarks = faceResult;
    }
    if (settings.handLandmarks) {
      const handResult = detectHandLandmarks(video, timestamp);
      if (handResult !== null) lastHandLandmarks = handResult;
    }
    updateLandmarksOverlay(
      settings.faceLandmarks ? lastFaceLandmarks : null,
      settings.handLandmarks ? lastHandLandmarks : null,
      video.videoWidth,
      video.videoHeight
    );
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
