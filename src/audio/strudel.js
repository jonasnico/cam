let audioContext = null;
let voices = [];
let expressionGain;
let masterGain;
let outputGain;
let filterNode;
let panNode;
let dryGain;
let wetGain;
let delayNode;
let delayGain;
let feedbackGain;
let reverbNode;
let reverbBuffer;
let muted = false;

export const SYNTH_TYPES = ['triangle', 'sine', 'sawtooth', 'square'];

export async function initStrudel() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    expressionGain = audioContext.createGain();
    masterGain = audioContext.createGain();
    outputGain = audioContext.createGain();
    filterNode = audioContext.createBiquadFilter();
    panNode = audioContext.createStereoPanner();
    dryGain = audioContext.createGain();
    wetGain = audioContext.createGain();
    delayGain = audioContext.createGain();
    feedbackGain = audioContext.createGain();
    reverbBuffer = createReverbImpulse(audioContext, 1.6, 2.5);
    const limiter = audioContext.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;

    expressionGain.gain.value = 0;
    masterGain.gain.value = 0.5;
    outputGain.gain.value = muted ? 0 : 1;
    filterNode.type = 'lowpass';
    filterNode.frequency.value = 200;
    filterNode.Q.value = 1.5;
    delayGain.gain.value = 0;
    feedbackGain.gain.value = 0;

    expressionGain.connect(filterNode);
    filterNode.connect(panNode);
    panNode.connect(dryGain);
    dryGain.connect(masterGain);
    wetGain.connect(masterGain);
    delayGain.connect(masterGain);
    resetEffects();
    masterGain.connect(limiter);
    limiter.connect(outputGain);
    outputGain.connect(audioContext.destination);
  }
  await audioContext.resume();
  if (audioContext.state !== 'running') throw new Error('Audio could not start. Tap to try again.');
}

function resetEffects() {
  if (reverbNode) {
    panNode.disconnect(reverbNode);
    panNode.disconnect(delayNode);
    reverbNode.disconnect();
    delayNode.disconnect();
    feedbackGain.disconnect();
  }
  reverbNode = audioContext.createConvolver();
  reverbNode.buffer = reverbBuffer;
  delayNode = audioContext.createDelay(1);
  delayNode.delayTime.value = 0.3;
  panNode.connect(reverbNode);
  reverbNode.connect(wetGain);
  panNode.connect(delayNode);
  delayNode.connect(delayGain);
  delayNode.connect(feedbackGain);
  feedbackGain.connect(delayNode);
}

function createReverbImpulse(context, duration, decay) {
  const length = Math.floor(context.sampleRate * duration);
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }
  return impulse;
}

export function updateOscillators(synthType, count) {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  voices.forEach(({ oscillator, gain }) => {
    gain.gain.cancelAndHoldAtTime(now);
    gain.gain.linearRampToValueAtTime(0, now + 0.04);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.stop(now + 0.05);
  });
  voices = Array.from({ length: count }, () => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = synthType;
    oscillator.frequency.value = 130.81;
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(expressionGain);
    oscillator.start();
    return { oscillator, gain };
  });
}

export function playPattern(params, settings) {
  if (audioContext?.state !== 'running') return;
  const now = audioContext.currentTime;
  const activeCount = Math.min(voices.length, params.complexity);
  const frequency = 440 * 2 ** ((params.note - 69) / 12);
  voices.forEach(({ oscillator, gain }, index) => {
    const harmonic = [1, 2, 0.5, 3][index];
    oscillator.frequency.setTargetAtTime(frequency * harmonic, now, 0.04);
    oscillator.detune.setTargetAtTime(params.detune + index * 3, now, 0.05);
    gain.gain.setTargetAtTime(index < activeCount ? 1 / activeCount : 0, now, 0.04);
  });
  expressionGain.gain.setTargetAtTime(params.gain, now, params.gain > 0 ? 0.04 : 0.08);
  masterGain.gain.setTargetAtTime(settings.masterVolume, now, 0.025);
  filterNode.frequency.setTargetAtTime(Math.min(audioContext.sampleRate / 2, params.lpf * settings.filterCutoff / 100), now, 0.05);
  filterNode.Q.setTargetAtTime(settings.filterResonance, now, 0.05);
  panNode.pan.setTargetAtTime(Math.max(-1, Math.min(1, params.pan)), now, 0.05);
  dryGain.gain.setTargetAtTime(Math.cos(settings.reverbMix * Math.PI / 2), now, 0.05);
  wetGain.gain.setTargetAtTime(Math.sin(settings.reverbMix * Math.PI / 2), now, 0.05);
  delayNode.delayTime.setTargetAtTime(settings.delayTime, now, 0.1);
  delayGain.gain.setTargetAtTime(settings.delayMix, now, 0.05);
  feedbackGain.gain.setTargetAtTime(settings.delayFeedback, now, 0.05);
}

export function setMuted(value) {
  muted = value;
  if (outputGain) outputGain.gain.setTargetAtTime(value ? 0 : 1, audioContext.currentTime, 0.015);
}

export function stopPattern() {
  if (expressionGain) expressionGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.02);
}

export async function suspendStrudel() {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  for (const node of [outputGain, expressionGain]) {
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(0, now);
  }
  resetEffects();
  await audioContext.suspend();
}

export function getAudioContext() {
  return audioContext;
}
