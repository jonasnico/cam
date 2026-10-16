import * as THREE from 'three';
import { detectFaceLandmarks, initFaceLandmarker } from './detection/faceLandmarker.js';
import { detectHandLandmarks, initHandLandmarker } from './detection/handLandmarker.js';
import { createTracking } from './modes/tracking.js';
import { clearAllOverlays, initOverlay, updateLandmarksOverlay } from './tracking/overlay.js';
import { createGestureTracker, generateStrudelCode } from './tracking/gestures.js';
import { getAudioContext, initStrudel, playPattern, setMuted, suspendStrudel, updateOscillators } from './audio/strudel.js';
import { createHud, setText } from './ui/hud.js';
import { createSettingsPanel } from './ui/settings.js';

const element = id => document.getElementById(id);
const video = element('video');
const startOverlay = element('start-overlay');
const startButton = element('start-btn');
const startStatus = element('start-status');
const cancelButton = element('cancel-btn');
const appControls = element('app-controls');
const notice = element('notice');
const noticeText = element('notice-text');
const retryButton = element('retry-btn');
const resumeButton = element('resume-btn');
const codeDisplay = element('code-display');
const settingsPanel = element('settings-panel');
const helpPanel = element('help-panel');

const audioSettings = {
  synthType: 'triangle',
  oscillatorCount: 2,
  masterVolume: 0.5,
  filterCutoff: 100,
  filterResonance: 1.5,
  reverbMix: 0.3,
  delayTime: 0.3,
  delayMix: 0.2,
  delayFeedback: 0.25
};
const settings = { showCode: false, showOverlay: true };
const tracker = createGestureTracker();
const hud = createHud();
const detectors = { face: 'loading', hands: 'loading' };
const results = { face: null, hands: null };
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
let renderer = null;
let resizeTracking = null;
let stream = null;
let gui = null;
let sessionId = 0;
let ready = false;
let starting = false;
let paused = false;
let muted = false;
let lastFrame = 0;
let lastVideoTime = -1;
let lastVideoAdvance = 0;
let retrying = false;

function setStarting(value) {
  starting = value;
  startButton.disabled = value;
  startOverlay.setAttribute('aria-busy', String(value));
  cancelButton.hidden = !value;
  setText(startButton, value ? 'Preparing your instrument...' : 'Enable camera & play');
}

function showNotice(message, { retry = false, resume = false } = {}) {
  notice.hidden = !message;
  setText(noticeText, message);
  retryButton.hidden = !retry;
  resumeButton.hidden = !resume;
}

function updateTrackingNotice() {
  if (paused) return;
  const failed = Object.keys(detectors).filter(input => detectors[input] === 'error');
  const loading = Object.values(detectors).includes('loading');
  if (failed.length) {
    const label = failed.length === 2 ? 'Face and hand tracking are' : `${failed[0] === 'face' ? 'Face' : 'Hand'} tracking is`;
    const other = failed[0] === 'face' ? 'hands' : 'face';
    const enabled = tracker.getSnapshot(performance.now()).enabled;
    const alternative = failed.length === 1
      ? enabled[other] ? 'The other input can still play. ' : `Enable ${other === 'face' ? 'Face' : 'Hands'} to keep playing. `
      : '';
    showNotice(`${label} unavailable. ${alternative}Check your connection and retry.`, { retry: true });
  } else {
    showNotice(loading ? 'You can play now. The other tracker is still loading.' : '');
  }
}

function resize() {
  if (!renderer) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeTracking(window.innerWidth, window.innerHeight, video.videoWidth, video.videoHeight);
}

function initStage() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    endSession('The camera display was interrupted. Reload this page to reconnect.');
    startButton.disabled = true;
  });
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.x = -1;
  texture.offset.x = 1;
  resizeTracking = createTracking(scene, new THREE.MeshBasicMaterial({ map: texture }), camera);
  initOverlay(scene);
  document.body.prepend(renderer.domElement);
  resize();
}

function releaseCamera() {
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  video.srcObject = null;
}

async function openCamera(id) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs a supported browser and a secure HTTPS connection.');
  const cameraStream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user', frameRate: { ideal: 30 } },
    audio: false
  });
  if (id !== sessionId) {
    cameraStream.getTracks().forEach(track => track.stop());
    throw new DOMException('Start cancelled', 'AbortError');
  }
  stream = cameraStream;
  stream.getVideoTracks()[0].addEventListener('ended', () => {
    if (id === sessionId) endSession('Camera disconnected. Reconnect it, then start again.');
  });
  video.srcObject = stream;
  await video.play();
  if (id !== sessionId) throw new DOMException('Start cancelled', 'AbortError');
  resize();
}

function startError(error) {
  if (error.name === 'NotAllowedError') return 'Camera or audio access was blocked. Allow camera access in your browser, then try again.';
  if (error.name === 'NotFoundError') return 'No camera was found. Connect a camera, then try again.';
  if (error.name === 'NotReadableError') return 'The camera is busy. Close other apps using it, then try again.';
  return error.message || 'The instrument could not start. Check your connection and try again.';
}

function enterPerformance() {
  if (ready) return;
  ready = true;
  setStarting(false);
  startOverlay.hidden = true;
  appControls.hidden = false;
  muted = false;
  paused = false;
  tracker.reset();
  hud.reset();
  setMuted(false);
  lastVideoTime = -1;
  lastVideoAdvance = performance.now();
  element('mute-btn').focus({ preventScroll: true });
  if (document.hidden) pauseSession();
}

async function loadDetector(input, initialize, id) {
  detectors[input] = 'loading';
  try {
    await initialize();
    if (id !== sessionId) return;
    detectors[input] = 'ready';
    enterPerformance();
  } catch (error) {
    if (id !== sessionId) return;
    console.error(`${input} tracking failed:`, error);
    detectors[input] = 'error';
  }
  if (id === sessionId && ready) updateTrackingNotice();
}

async function startApp() {
  if (starting || ready) return;
  const id = ++sessionId;
  setStarting(true);
  setText(startStatus, 'Allow camera access to begin. Your video is processed on this device.');
  try {
    const audioReady = initStrudel();
    await Promise.all([audioReady, openCamera(id)]);
    if (id !== sessionId) return;
    initStage();
    updateOscillators(audioSettings.synthType, audioSettings.oscillatorCount);
    getAudioContext().onstatechange = () => {
      if (ready && !paused && getAudioContext().state !== 'running') pauseSession();
    };
    renderer.setAnimationLoop(render);
    detectors.face = 'loading';
    detectors.hands = 'loading';
    setText(startStatus, 'Loading face and hand tracking. The first visit can take a moment.');
    await Promise.all([
      loadDetector('face', initFaceLandmarker, id),
      loadDetector('hands', initHandLandmarker, id)
    ]);
    if (id !== sessionId) return;
    if (!ready) throw new Error('Tracking could not load. Check your connection, then try again.');
  } catch (error) {
    if (id !== sessionId) return;
    console.error('Unable to start instrument:', error);
    endSession(startError(error));
    setText(startButton, 'Try again');
  }
}

function endSession(message = '') {
  sessionId++;
  ready = false;
  paused = false;
  retrying = false;
  retryButton.disabled = false;
  resumeButton.disabled = false;
  setStarting(false);
  setMuted(true);
  releaseCamera();
  tracker.reset();
  results.face = null;
  results.hands = null;
  clearAllOverlays();
  renderer?.setAnimationLoop(null);
  renderer?.clear();
  settingsPanel.close();
  helpPanel.close();
  appControls.hidden = true;
  startOverlay.hidden = false;
  setText(startStatus, message);
  showNotice('');
  const context = getAudioContext();
  if (context?.state === 'running') {
    suspendStrudel().catch(error => console.error('Unable to suspend audio:', error));
  }
  startButton.focus({ preventScroll: true });
}

function pauseSession(message = 'Paused while you were away. Resume when you are ready.') {
  if (!ready || paused) return;
  paused = true;
  tracker.reset();
  results.face = null;
  results.hands = null;
  setMuted(true);
  clearAllOverlays();
  stream?.getVideoTracks().forEach(track => { track.enabled = false; });
  showNotice(message, { resume: true });
  suspendStrudel().catch(error => {
    console.error('Unable to suspend audio:', error);
    showNotice('Audio could not pause, but sound is muted. Resume when ready.', { resume: true });
  });
}

async function resumeSession() {
  if (!paused) return;
  const id = sessionId;
  resumeButton.disabled = true;
  try {
    await initStrudel();
    if (id !== sessionId) return;
    stream.getVideoTracks().forEach(track => { track.enabled = true; });
    await video.play();
    if (id !== sessionId) return;
    tracker.reset();
    lastVideoTime = -1;
    lastVideoAdvance = performance.now();
    paused = false;
    setMuted(muted);
    updateTrackingNotice();
    element('mute-btn').focus({ preventScroll: true });
  } catch (error) {
    if (id !== sessionId) return;
    console.error('Unable to resume instrument:', error);
    showNotice('Could not resume camera or sound. Try again, or end this session.', { resume: true });
  } finally {
    resumeButton.disabled = false;
  }
}

function toggleInput(input) {
  const enabled = tracker.getSnapshot(performance.now()).enabled;
  tracker.setEnabled(input, !enabled[input]);
  results[input] = null;
  updateTrackingNotice();
}

function toggleMute() {
  muted = !muted;
  setMuted(muted || paused);
}

function detect(input, detectFrame, timestamp) {
  try {
    const result = detectFrame(video, timestamp);
    if (result !== null) {
      results[input] = result;
      if (input === 'face') tracker.updateFace(result.faceLandmarks, timestamp);
      else tracker.updateHands(result.landmarks, timestamp);
    }
  } catch (error) {
    console.error(`${input} tracking interrupted:`, error);
    detectors[input] = 'error';
    results[input] = null;
    tracker.reset(input === 'face' ? ['face'] : ['leftHand', 'rightHand']);
    updateTrackingNotice();
  }
}

function render(timestamp) {
  if (document.hidden) return;
  if (ready && timestamp - lastFrame >= 30) {
    lastFrame = timestamp;
    if (!paused) {
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        lastVideoAdvance = timestamp;
      } else if (timestamp - lastVideoAdvance > 2000) {
        pauseSession('The camera stopped updating. Resume to reconnect.');
      }
    }
    const enabled = tracker.getSnapshot(timestamp).enabled;
    if (!paused) {
      if (enabled.face && detectors.face === 'ready') detect('face', detectFaceLandmarks, timestamp);
      if (enabled.hands && detectors.hands === 'ready') detect('hands', detectHandLandmarks, timestamp);
    }
    const snapshot = tracker.getSnapshot(timestamp);
    if (settings.showOverlay && !paused) {
      updateLandmarksOverlay(
        snapshot.parts.face.visible ? results.face : null,
        snapshot.parts.leftHand.visible || snapshot.parts.rightHand.visible ? results.hands : null,
        video.videoWidth, video.videoHeight, muted ? null : snapshot.params.source
      );
    } else clearAllOverlays();
    if (!paused) playPattern(snapshot.params, audioSettings);
    hud.update(snapshot, { muted, paused, volume: audioSettings.masterVolume, detectors }, timestamp);
    codeDisplay.hidden = !settings.showCode;
    if (settings.showCode) setText(codeDisplay, generateStrudelCode(snapshot.params, audioSettings));
  }
  renderer.render(scene, camera);
}

startButton.addEventListener('click', startApp);
cancelButton.addEventListener('click', () => endSession());
element('end-btn').addEventListener('click', () => endSession());
element('hud-face').addEventListener('click', () => toggleInput('face'));
element('hud-hands').addEventListener('click', () => toggleInput('hands'));
element('mute-btn').addEventListener('click', toggleMute);
resumeButton.addEventListener('click', resumeSession);
retryButton.addEventListener('click', async () => {
  if (retrying) return;
  retrying = true;
  retryButton.disabled = true;
  const id = sessionId;
  await Promise.all([
    detectors.face === 'error' ? loadDetector('face', initFaceLandmarker, id) : Promise.resolve(),
    detectors.hands === 'error' ? loadDetector('hands', initHandLandmarker, id) : Promise.resolve()
  ]);
  if (id === sessionId) {
    retrying = false;
    retryButton.disabled = false;
  }
});
element('gear-btn').addEventListener('click', () => {
  if (!gui) gui = createSettingsPanel(audioSettings, settings);
  settingsPanel.showModal();
});
element('help-btn').addEventListener('click', () => helpPanel.showModal());
document.querySelectorAll('.close-dialog').forEach(button => {
  button.addEventListener('click', () => button.closest('dialog').close());
});
document.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.repeat || !ready || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target.closest('button, input, select, textarea, summary, [contenteditable], dialog')) return;
  event.preventDefault();
  toggleMute();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseSession();
});
window.addEventListener('pagehide', () => endSession());
window.addEventListener('resize', resize);
video.addEventListener('resize', resize);
