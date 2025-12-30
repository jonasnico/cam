import GUI from 'lil-gui';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { detectFaceLandmarks, initFaceLandmarker } from './detection/faceLandmarker.js';
import { detectHandLandmarks, initHandLandmarker } from './detection/handLandmarker.js';
import { createTracking } from './modes/tracking.js';
import { clearAllOverlays, initOverlay, updateLandmarksOverlay } from './tracking/overlay.js';
import { generateStrudelCode, gestureToAudioParams, getGestureState, getVelocity, updateGesturesFromFace, updateGesturesFromHands } from './tracking/gestures.js';
import { initStrudel, playPattern, stopPattern, updateOscillators, SYNTH_TYPES } from './audio/strudel.js';

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

const settings = { 
  faceLandmarks: true,
  handLandmarks: true,
  musicEnabled: false,
  showCode: true
};

const audioSettings = {
  synthType: 'sine',
  oscillatorCount: 3,
  masterVolume: 0.5,
  synthVolume: 0.7,
  drumVolume: 0.8,
  filterCutoff: 100,
  filterResonance: 2,
  reverbMix: 0.3,
  delayTime: 0.25,
  delayFeedback: 0.2,
  enableSynth: true,
  enableDrums: true
};

let lastFaceLandmarks = null;
let lastHandLandmarks = null;
let strudelInitialized = false;
let lastCodeUpdate = 0;

createTracking(meshGroup, material, camera, controls);
initOverlay(scene);

const codeDisplay = document.createElement('pre');
codeDisplay.id = 'code-display';
codeDisplay.style.cssText = `
  position: fixed;
  bottom: 20px;
  left: 20px;
  background: rgba(0,0,0,0.85);
  color: #0f0;
  padding: 15px 20px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  border-radius: 8px;
  max-width: 350px;
  z-index: 100;
  border: 1px solid #0f03;
  box-shadow: 0 4px 20px rgba(0,255,0,0.1);
`;
document.body.appendChild(codeDisplay);

const meterContainer = document.createElement('div');
meterContainer.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(0,0,0,0.85);
  padding: 15px;
  border-radius: 8px;
  z-index: 100;
  font-family: sans-serif;
  font-size: 12px;
  color: #fff;
  border: 1px solid #fff2;
`;
meterContainer.innerHTML = `
  <div style="margin-bottom:8px;font-weight:bold;">Movement</div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
    <span style="width:50px;">Face</span>
    <div style="flex:1;height:8px;background:#333;border-radius:4px;overflow:hidden;">
      <div id="face-meter" style="height:100%;width:0%;background:#0f0;transition:width 0.1s;"></div>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
    <span style="width:50px;">L Hand</span>
    <div style="flex:1;height:8px;background:#333;border-radius:4px;overflow:hidden;">
      <div id="lhand-meter" style="height:100%;width:0%;background:#f60;transition:width 0.1s;"></div>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
    <span style="width:50px;">R Hand</span>
    <div style="flex:1;height:8px;background:#333;border-radius:4px;overflow:hidden;">
      <div id="rhand-meter" style="height:100%;width:0%;background:#06f;transition:width 0.1s;"></div>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid #fff2;">
    <span style="width:50px;font-weight:bold;">Total</span>
    <div style="flex:1;height:12px;background:#333;border-radius:4px;overflow:hidden;">
      <div id="total-meter" style="height:100%;width:0%;background:linear-gradient(90deg,#0f0,#ff0,#f00);transition:width 0.1s;"></div>
    </div>
  </div>
`;
document.body.appendChild(meterContainer);

const gui = new GUI({ title: 'Gesture Music Controller' });

const trackingFolder = gui.addFolder('Tracking');
trackingFolder.add(settings, 'faceLandmarks').name('Face').onChange(async (enabled) => {
  if (enabled) await initFaceLandmarker();
});
trackingFolder.add(settings, 'handLandmarks').name('Hands').onChange(async (enabled) => {
  if (enabled) await initHandLandmarker();
});

const synthFolder = gui.addFolder('Synth');
synthFolder.add(audioSettings, 'enableSynth').name('Enable');
synthFolder.add(audioSettings, 'synthType', SYNTH_TYPES).name('Waveform').onChange(() => {
  if (strudelInitialized) updateOscillators(audioSettings.synthType, audioSettings.oscillatorCount);
});
synthFolder.add(audioSettings, 'oscillatorCount', 1, 4, 1).name('Voices').onChange(() => {
  if (strudelInitialized) updateOscillators(audioSettings.synthType, audioSettings.oscillatorCount);
});
synthFolder.add(audioSettings, 'synthVolume', 0, 1, 0.01).name('Volume');

const drumsFolder = gui.addFolder('Drums');
drumsFolder.add(audioSettings, 'enableDrums').name('Enable');
drumsFolder.add(audioSettings, 'drumVolume', 0, 1, 0.01).name('Volume');

const filterFolder = gui.addFolder('Filter');
filterFolder.add(audioSettings, 'filterCutoff', 10, 100, 1).name('Cutoff %');
filterFolder.add(audioSettings, 'filterResonance', 0.1, 15, 0.1).name('Resonance');

const effectsFolder = gui.addFolder('Effects');
effectsFolder.add(audioSettings, 'reverbMix', 0, 1, 0.01).name('Reverb');
effectsFolder.add(audioSettings, 'delayTime', 0.05, 1, 0.01).name('Delay Time');
effectsFolder.add(audioSettings, 'delayFeedback', 0, 0.9, 0.01).name('Delay Mix');

const controlFolder = gui.addFolder('Control');
controlFolder.add(audioSettings, 'masterVolume', 0, 1, 0.01).name('Master Volume');
controlFolder.add(settings, 'musicEnabled').name('Enable Audio').onChange(async (enabled) => {
  if (enabled) {
    if (!strudelInitialized) {
      await initStrudel();
      updateOscillators(audioSettings.synthType, audioSettings.oscillatorCount);
      strudelInitialized = true;
    }
  } else {
    stopPattern();
  }
});
controlFolder.add(settings, 'showCode').name('Show Code');

async function initTracking() {
  await initFaceLandmarker();
  await initHandLandmarker();
}

function updateMeters(vel) {
  document.getElementById('face-meter').style.width = `${Math.min(100, vel.face * 100)}%`;
  document.getElementById('lhand-meter').style.width = `${Math.min(100, vel.leftHand * 100)}%`;
  document.getElementById('rhand-meter').style.width = `${Math.min(100, vel.rightHand * 100)}%`;
  document.getElementById('total-meter').style.width = `${Math.min(100, vel.total * 33)}%`;
}

renderer.setAnimationLoop((timestamp) => {
  if (settings.faceLandmarks || settings.handLandmarks) {
    if (settings.faceLandmarks) {
      const faceResult = detectFaceLandmarks(video, timestamp);
      if (faceResult !== null) {
        lastFaceLandmarks = faceResult;
        updateGesturesFromFace(faceResult.faceLandmarks);
      }
    }
    if (settings.handLandmarks) {
      const handResult = detectHandLandmarks(video, timestamp);
      if (handResult !== null) {
        lastHandLandmarks = handResult;
        updateGesturesFromHands(handResult.landmarks, handResult.handednesses);
      }
    }
    updateLandmarksOverlay(
      settings.faceLandmarks ? lastFaceLandmarks : null,
      settings.handLandmarks ? lastHandLandmarks : null,
      video.videoWidth,
      video.videoHeight
    );
    
    const vel = getVelocity();
    updateMeters(vel);
    
    if (settings.musicEnabled && timestamp - lastCodeUpdate > 30) {
      const gestures = getGestureState();
      const params = gestureToAudioParams(gestures, vel, audioSettings);
      const code = generateStrudelCode(params, audioSettings);
      
      if (settings.showCode) {
        codeDisplay.textContent = code;
        codeDisplay.style.display = 'block';
      }
      
      playPattern(params, audioSettings);
      lastCodeUpdate = timestamp;
    }
  } else {
    clearAllOverlays();
  }
  
  if (!settings.showCode) {
    codeDisplay.style.display = 'none';
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
    .then(async stream => {
      video.srcObject = stream;
      video.play();
      await initTracking();
    })
    .catch(error => console.error('Unable to access webcam:', error));
} else {
  console.error('MediaDevices interface not available.');
}
