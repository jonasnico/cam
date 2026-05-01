let audioContext = null;
let oscillators = [];
let gainNode = null;
let filterNode = null;
let panNode = null;
let reverbNode = null;
let delayNode = null;
let delayGain = null;
let isInitialized = false;

const SYNTH_TYPES = ['sawtooth', 'square', 'triangle', 'sine'];

export async function initStrudel() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  gainNode = audioContext.createGain();
  filterNode = audioContext.createBiquadFilter();
  panNode = audioContext.createStereoPanner();
  
  reverbNode = audioContext.createConvolver();
  const reverbBuffer = createReverbImpulse(audioContext, 2, 2);
  reverbNode.buffer = reverbBuffer;
  
  delayNode = audioContext.createDelay(1);
  delayNode.delayTime.value = 0.3;
  delayGain = audioContext.createGain();
  delayGain.gain.value = 0;
  
  filterNode.type = 'lowpass';
  filterNode.frequency.value = 200;
  filterNode.Q.value = 2;
  
  const dryGain = audioContext.createGain();
  dryGain.gain.value = 0.7;
  
  const wetGain = audioContext.createGain();
  wetGain.gain.value = 0.3;
  
  filterNode.connect(panNode);
  panNode.connect(dryGain);
  panNode.connect(reverbNode);
  reverbNode.connect(wetGain);
  
  dryGain.connect(gainNode);
  wetGain.connect(gainNode);
  
  panNode.connect(delayNode);
  delayNode.connect(delayGain);
  delayGain.connect(gainNode);
  
  gainNode.connect(audioContext.destination);
  gainNode.gain.value = 0;
  
  isInitialized = true;
  return true;
}

function createReverbImpulse(ctx, duration, decay) {
  const rate = ctx.sampleRate;
  const length = rate * duration;
  const impulse = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

export function updateOscillators(synthType, count) {
  oscillators.forEach(osc => {
    try { osc.stop(); osc.disconnect(); } catch(e) {}
  });
  oscillators = [];
  
  if (!audioContext) return;
  
  for (let i = 0; i < count; i++) {
    const osc = audioContext.createOscillator();
    osc.type = synthType;
    osc.frequency.value = 130.81;
    osc.detune.value = i * 3;
    osc.connect(filterNode);
    osc.start();
    oscillators.push(osc);
  }
}

export async function playPattern(params, audioSettings) {
  if (!audioContext || !isInitialized) return;
  
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  
  const now = audioContext.currentTime;
  
  if (params.gain < 0.01) {
    gainNode.gain.setTargetAtTime(0, now, 0.15);
    return;
  }
  
  const activeOscCount = Math.min(oscillators.length, Math.ceil(params.complexity));
  const noteFreq = 130.81 * Math.pow(2, (params.note - 48) / 12);
  
  oscillators.forEach((osc, i) => {
    if (i < activeOscCount) {
      const harmonic = i === 0 ? 1 : i === 1 ? 2 : 0.5;
      osc.frequency.setTargetAtTime(noteFreq * harmonic, now, 0.05);
      osc.detune.setTargetAtTime(params.detune + i * 3, now, 0.05);
    }
  });
  
  const finalGain = params.gain * audioSettings.masterVolume;
  gainNode.gain.setTargetAtTime(finalGain, now, 0.08);
  
  const filterFreq = params.lpf * (audioSettings.filterCutoff / 100);
  filterNode.frequency.setTargetAtTime(filterFreq, now, 0.05);
  filterNode.Q.setTargetAtTime(audioSettings.filterResonance, now, 0.05);
  
  panNode.pan.setTargetAtTime(Math.max(-1, Math.min(1, params.pan)), now, 0.05);
  
  delayNode.delayTime.setTargetAtTime(audioSettings.delayTime, now, 0.05);
  delayGain.gain.setTargetAtTime(audioSettings.delayFeedback, now, 0.05);
}

export function stopPattern() {
  if (gainNode && audioContext) {
    gainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.2);
  }
}

export function getAudioContext() {
  return audioContext;
}

export { SYNTH_TYPES };
