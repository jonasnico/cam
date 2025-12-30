let audioContext = null;
let oscillators = [];
let gainNode = null;
let filterNode = null;
let panNode = null;
let reverbNode = null;
let delayNode = null;
let delayGain = null;
let drumGainNode = null;
let isInitialized = false;

let lastDrumTime = {};
let beatClock = 0;

const SYNTH_TYPES = ['sine', 'square', 'triangle', 'sawtooth'];

const DRUM_CONFIG = {
  bd: { freq: 55, decay: 0.4, type: 'sine', pitchDecay: true },
  sd: { freq: 200, decay: 0.15, type: 'triangle', noise: true, noiseDecay: 0.1 },
  hh: { freq: 8000, decay: 0.05, type: 'square', highpass: true, noiseOnly: true },
  oh: { freq: 8000, decay: 0.25, type: 'square', highpass: true, noiseOnly: true },
  cp: { freq: 1200, decay: 0.08, type: 'square', noise: true, noiseDecay: 0.08 },
  rim: { freq: 800, decay: 0.03, type: 'triangle' }
};

export async function initStrudel() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  gainNode = audioContext.createGain();
  filterNode = audioContext.createBiquadFilter();
  panNode = audioContext.createStereoPanner();
  drumGainNode = audioContext.createGain();
  
  reverbNode = audioContext.createConvolver();
  reverbNode.buffer = createReverbImpulse(audioContext, 1.5, 2.5);
  
  delayNode = audioContext.createDelay(1);
  delayNode.delayTime.value = 0.3;
  delayGain = audioContext.createGain();
  delayGain.gain.value = 0;
  
  filterNode.type = 'lowpass';
  filterNode.frequency.value = 2000;
  filterNode.Q.value = 1;
  
  const dryGain = audioContext.createGain();
  dryGain.gain.value = 0.8;
  const wetGain = audioContext.createGain();
  wetGain.gain.value = 0.2;
  
  filterNode.connect(panNode);
  panNode.connect(dryGain);
  panNode.connect(reverbNode);
  reverbNode.connect(wetGain);
  dryGain.connect(gainNode);
  wetGain.connect(gainNode);
  panNode.connect(delayNode);
  delayNode.connect(delayGain);
  delayGain.connect(gainNode);
  
  drumGainNode.connect(audioContext.destination);
  gainNode.connect(audioContext.destination);
  gainNode.gain.value = 0;
  drumGainNode.gain.value = 0.8;
  
  Object.keys(DRUM_CONFIG).forEach(drum => lastDrumTime[drum] = 0);
  
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

function createNoiseBuffer(duration) {
  const length = audioContext.sampleRate * duration;
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function updateOscillators(synthType, count) {
  oscillators.forEach(osc => {
    try { osc.stop(); osc.disconnect(); } catch(e) {}
  });
  oscillators = [];
  
  if (!audioContext || !SYNTH_TYPES.includes(synthType)) return;
  
  for (let i = 0; i < count; i++) {
    const osc = audioContext.createOscillator();
    osc.type = synthType;
    osc.frequency.value = 130.81;
    osc.detune.value = i * 7;
    osc.connect(filterNode);
    osc.start();
    oscillators.push(osc);
  }
}

export function playDrum(drumType, velocity, volume) {
  if (!audioContext || velocity < 0.1 || !DRUM_CONFIG[drumType]) return;
  
  const now = audioContext.currentTime;
  const minInterval = drumType === 'hh' ? 0.05 : 0.08;
  
  if (now - lastDrumTime[drumType] < minInterval) return;
  lastDrumTime[drumType] = now;
  
  const config = DRUM_CONFIG[drumType];
  const drumOut = audioContext.createGain();
  drumOut.connect(drumGainNode);
  drumOut.gain.setValueAtTime(velocity * volume, now);
  drumOut.gain.exponentialRampToValueAtTime(0.001, now + config.decay);
  
  if (config.noiseOnly || config.noise) {
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = createNoiseBuffer(config.noiseDecay || config.decay);
    
    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = config.highpass ? 'highpass' : 'bandpass';
    noiseFilter.frequency.value = config.freq;
    noiseFilter.Q.value = config.highpass ? 1 : 5;
    
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(drumOut);
    noiseSource.start(now);
    noiseSource.stop(now + (config.noiseDecay || config.decay));
  }
  
  if (!config.noiseOnly) {
    const osc = audioContext.createOscillator();
    osc.type = config.type;
    osc.frequency.setValueAtTime(config.freq, now);
    
    if (config.pitchDecay) {
      osc.frequency.exponentialRampToValueAtTime(config.freq * 0.5, now + config.decay * 0.5);
    }
    
    osc.connect(drumOut);
    osc.start(now);
    osc.stop(now + config.decay);
  }
}

export async function playPattern(params, audioSettings) {
  if (!audioContext || !isInitialized) return;
  
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  
  const now = audioContext.currentTime;
  
  drumGainNode.gain.setTargetAtTime(audioSettings.drumVolume * audioSettings.masterVolume, now, 0.02);
  
  if (audioSettings.enableDrums && params.drumTriggers) {
    params.drumTriggers.forEach(trigger => {
      if (trigger.active) {
        playDrum(trigger.type, trigger.velocity, audioSettings.drumVolume * audioSettings.masterVolume);
      }
    });
  }
  
  if (params.gain < 0.01 || !audioSettings.enableSynth) {
    gainNode.gain.setTargetAtTime(0, now, 0.05);
    return;
  }
  
  if (oscillators.length > 0) {
    const activeOscCount = Math.min(oscillators.length, Math.ceil(params.complexity));
    const noteFreq = 130.81 * Math.pow(2, (params.note - 48) / 12);
    
    oscillators.forEach((osc, i) => {
      if (i < activeOscCount) {
        const harmonic = i === 0 ? 1 : i === 1 ? 2 : 0.5;
        osc.frequency.setTargetAtTime(noteFreq * harmonic, now, 0.02);
        osc.detune.setTargetAtTime(params.detune + i * 5, now, 0.02);
      }
    });
    
    const finalGain = params.gain * audioSettings.masterVolume * audioSettings.synthVolume;
    gainNode.gain.setTargetAtTime(finalGain, now, 0.02);
  }
  
  const filterFreq = params.lpf * (audioSettings.filterCutoff / 100);
  filterNode.frequency.setTargetAtTime(filterFreq, now, 0.02);
  filterNode.Q.setTargetAtTime(audioSettings.filterResonance, now, 0.02);
  
  panNode.pan.setTargetAtTime(Math.max(-1, Math.min(1, params.pan)), now, 0.02);
  
  delayNode.delayTime.setTargetAtTime(audioSettings.delayTime, now, 0.02);
  delayGain.gain.setTargetAtTime(audioSettings.delayFeedback, now, 0.02);
}

export function stopPattern() {
  if (gainNode && audioContext) {
    gainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.02);
  }
}

export function getAudioContext() {
  return audioContext;
}

export { SYNTH_TYPES };
