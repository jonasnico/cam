import GUI from 'lil-gui';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { detectFaceLandmarks, initFaceLandmarker } from './detection/faceLandmarker.js';
import { detectHandLandmarks, initHandLandmarker } from './detection/handLandmarker.js';
import { createTracking } from './modes/tracking.js';
import { clearAllOverlays, initOverlay, updateLandmarksOverlay } from './tracking/overlay.js';
import { generateStrudelCode, gestureToAudioParams, getActiveInputs, getGestureState, getVelocity, updateGesturesFromFace, updateGesturesFromHands } from './tracking/gestures.js';
import { initStrudel, playPattern, updateOscillators, SYNTH_TYPES } from './audio/strudel.js';

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

const audioSettings = {
  synthType: 'triangle',
  oscillatorCount: 2,
  masterVolume: 0.5,
  filterCutoff: 100,
  filterResonance: 1.5,
  reverbMix: 0.4,
  delayTime: 0.3,
  delayFeedback: 0.25
};

const settings = {
  showCode: false,
  showOverlay: true,
  faceEnabled: true,
  handsEnabled: true
};

let lastFaceLandmarks = null;
let lastHandLandmarks = null;
let strudelInitialized = false;
let lastCodeUpdate = 0;
let appStarted = false;

createTracking(meshGroup, material, camera, controls);
initOverlay(scene);

const startOverlay = document.getElementById('start-overlay');
const hud = document.getElementById('hud');
const hudFace = document.getElementById('hud-face');
const hudLeftHand = document.getElementById('hud-lhand');
const hudRightHand = document.getElementById('hud-rhand');
const hudActivity = document.getElementById('hud-activity');
const codeDisplay = document.getElementById('code-display');
const settingsPanel = document.getElementById('settings-panel');
const gearBtn = document.getElementById('gear-btn');

let gui = null;

hudFace.addEventListener('click', () => {
  settings.faceEnabled = !settings.faceEnabled;
  hudFace.classList.toggle('disabled', !settings.faceEnabled);
});
hudLeftHand.addEventListener('click', () => {
  settings.handsEnabled = !settings.handsEnabled;
  hudLeftHand.classList.toggle('disabled', !settings.handsEnabled);
  hudRightHand.classList.toggle('disabled', !settings.handsEnabled);
});
hudRightHand.addEventListener('click', () => {
  settings.handsEnabled = !settings.handsEnabled;
  hudLeftHand.classList.toggle('disabled', !settings.handsEnabled);
  hudRightHand.classList.toggle('disabled', !settings.handsEnabled);
});

function createSettingsPanel() {
  if (gui) return;
  gui = new GUI({ container: settingsPanel, title: 'Settings' });

  const soundFolder = gui.addFolder('Sound');
  soundFolder.add(audioSettings, 'synthType', SYNTH_TYPES).name('Waveform').onChange(() => {
    if (strudelInitialized) updateOscillators(audioSettings.synthType, audioSettings.oscillatorCount);
  });
  soundFolder.add(audioSettings, 'oscillatorCount', 1, 4, 1).name('Voices').onChange(() => {
    if (strudelInitialized) updateOscillators(audioSettings.synthType, audioSettings.oscillatorCount);
  });
  soundFolder.add(audioSettings, 'masterVolume', 0, 1, 0.01).name('Volume');

  const filterFolder = gui.addFolder('Filter');
  filterFolder.add(audioSettings, 'filterCutoff', 10, 100, 1).name('Cutoff %');
  filterFolder.add(audioSettings, 'filterResonance', 0.1, 15, 0.1).name('Resonance');
  filterFolder.close();

  const fxFolder = gui.addFolder('Effects');
  fxFolder.add(audioSettings, 'reverbMix', 0, 1, 0.01).name('Reverb');
  fxFolder.add(audioSettings, 'delayTime', 0.05, 1, 0.01).name('Delay Time');
  fxFolder.add(audioSettings, 'delayFeedback', 0, 0.9, 0.01).name('Delay Mix');
  fxFolder.close();

  const viewFolder = gui.addFolder('View');
  viewFolder.add(settings, 'showCode').name('Show Code');
  viewFolder.add(settings, 'showOverlay').name('Show Tracking');
  viewFolder.close();
}

gearBtn.addEventListener('click', () => {
  const isOpen = settingsPanel.classList.toggle('open');
  if (isOpen && !gui) createSettingsPanel();
});

async function startApp() {
  if (appStarted) return;
  appStarted = true;

  startOverlay.classList.add('hidden');
  hud.classList.add('visible');

  await initStrudel();
  updateOscillators(audioSettings.synthType, audioSettings.oscillatorCount);
  strudelInitialized = true;

  await initFaceLandmarker();
  await initHandLandmarker();
}

startOverlay.addEventListener('click', startApp);
startOverlay.addEventListener('touchstart', startApp);

function updateHud(vel, active) {
  hudFace.classList.toggle('active', active.face);
  hudLeftHand.classList.toggle('active', active.leftHand);
  hudRightHand.classList.toggle('active', active.rightHand);

  const totalPct = Math.min(100, vel.total * 50);
  hudActivity.style.width = `${totalPct}%`;
  hudActivity.style.opacity = totalPct > 5 ? '1' : '0.3';
}

renderer.setAnimationLoop((timestamp) => {
  if (appStarted) {
    if (settings.faceEnabled) {
      const faceResult = detectFaceLandmarks(video, timestamp);
      if (faceResult !== null) {
        lastFaceLandmarks = faceResult;
        updateGesturesFromFace(faceResult.faceLandmarks);
      }
    }

    if (settings.handsEnabled) {
      const handResult = detectHandLandmarks(video, timestamp);
      if (handResult !== null) {
        lastHandLandmarks = handResult;
        updateGesturesFromHands(handResult.landmarks, handResult.handednesses);
      }
    }

    if (settings.showOverlay) {
      updateLandmarksOverlay(
        settings.faceEnabled ? lastFaceLandmarks : null,
        settings.handsEnabled ? lastHandLandmarks : null,
        video.videoWidth,
        video.videoHeight
      );
    } else {
      clearAllOverlays();
    }

    const vel = getVelocity();
    const active = getActiveInputs();
    updateHud(vel, active);

    if (strudelInitialized && timestamp - lastCodeUpdate > 30) {
      const gestures = getGestureState();
      const params = gestureToAudioParams(gestures, vel);
      const code = generateStrudelCode(params, audioSettings);

      if (settings.showCode) {
        codeDisplay.textContent = code;
        codeDisplay.style.display = 'block';
      } else {
        codeDisplay.style.display = 'none';
      }

      playPattern(params, audioSettings);
      lastCodeUpdate = timestamp;
    }
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
}
