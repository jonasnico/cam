import test from 'node:test';
import assert from 'node:assert/strict';

class AudioParam {
  value = 0;
  setTargetAtTime(value) { this.value = value; }
  cancelAndHoldAtTime() {}
  cancelScheduledValues() {}
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
}

class AudioNode {
  connections = [];
  gain = new AudioParam();
  frequency = new AudioParam();
  detune = new AudioParam();
  Q = new AudioParam();
  pan = new AudioParam();
  delayTime = new AudioParam();
  threshold = new AudioParam();
  knee = new AudioParam();
  ratio = new AudioParam();
  attack = new AudioParam();
  release = new AudioParam();
  connect(node) { this.connections.push(node); }
  disconnect(node) { this.connections = node ? this.connections.filter(connection => connection !== node) : []; }
  start() {}
  stop() { this.stopped = true; }
}

test('audio reuses its context, silences inactive voices, wires effects and mutes the output', async () => {
  const gains = [];
  const oscillators = [];
  const delays = [];
  const reverbs = [];
  let contexts = 0;
  globalThis.window = {
    AudioContext: class {
      state = 'suspended';
      currentTime = 0;
      sampleRate = 1000;
      destination = new AudioNode();
      constructor() { contexts++; }
      async resume() { this.state = 'running'; }
      async suspend() { this.state = 'suspended'; }
      createGain() { const node = new AudioNode(); gains.push(node); return node; }
      createOscillator() { const node = new AudioNode(); oscillators.push(node); return node; }
      createBiquadFilter() { return new AudioNode(); }
      createStereoPanner() { return new AudioNode(); }
      createDelay() { const node = new AudioNode(); delays.push(node); return node; }
      createConvolver() { const node = new AudioNode(); reverbs.push(node); return node; }
      createDynamicsCompressor() { return new AudioNode(); }
      createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    }
  };
  try {
    const { initStrudel, updateOscillators, playPattern, setMuted, stopPattern, suspendStrudel, getAudioContext } = await import('../src/audio/strudel.js');
    await initStrudel();
    await initStrudel();
    assert.equal(contexts, 1);
    updateOscillators('triangle', 4);
    const [expression, master, output, dry, wet, echo, feedback, ...voiceGains] = gains;
    const params = { note: 69, gain: 0.3, complexity: 2, detune: 0, lpf: 2000, pan: 0 };
    const settings = { masterVolume: 0.5, filterCutoff: 100, filterResonance: 1.5, reverbMix: 0, delayTime: 0.3, delayMix: 0.2, delayFeedback: 0.25 };
    playPattern(params, settings);
    assert.equal(oscillators[0].frequency.value, 440);
    assert.deepEqual(voiceGains.map(node => node.gain.value), [0.5, 0.5, 0, 0]);
    assert.equal(dry.gain.value, 1);
    assert.equal(wet.gain.value, 0);
    assert.equal(echo.gain.value, 0.2);
    assert.equal(feedback.gain.value, 0.25);
    assert.equal(master.gain.value, 0.5);
    assert.equal(output.connections[0], getAudioContext().destination);
    playPattern({ ...params, complexity: 1 }, { ...settings, reverbMix: 1 });
    assert.deepEqual(voiceGains.map(node => node.gain.value), [1, 0, 0, 0]);
    assert.equal(wet.gain.value, 1);
    assert.ok(dry.gain.value < 0.0001);
    setMuted(true);
    assert.equal(output.gain.value, 0);
    playPattern(params, settings);
    assert.equal(output.gain.value, 0);
    setMuted(false);
    assert.equal(output.gain.value, 1);
    stopPattern();
    assert.equal(expression.gain.value, 0);
    updateOscillators('sine', 2);
    assert.ok(oscillators.slice(0, 4).every(oscillator => oscillator.stopped));
    oscillators.slice(0, 4).forEach(oscillator => oscillator.onended());
    assert.ok(voiceGains.every(node => node.connections.length === 0));
    playPattern(params, settings);
    await suspendStrudel();
    assert.equal(getAudioContext().state, 'suspended');
    assert.equal(expression.gain.value, 0);
    assert.equal(output.gain.value, 0);
    assert.equal(delays.length, 2);
    assert.equal(reverbs.length, 2);
    assert.equal(delays[0].connections.length, 0);
    assert.equal(reverbs[0].connections.length, 0);
    await initStrudel();
    assert.equal(output.gain.value, 0);
    assert.equal(expression.gain.value, 0);
    assert.equal(contexts, 1);
  } finally {
    delete globalThis.window;
  }
});
