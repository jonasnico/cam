import test from 'node:test';
import assert from 'node:assert/strict';
import { createGestureTracker, generateStrudelCode, getNoteName } from '../src/tracking/gestures.js';

const face = (x, y = 0.5) => [[{}, { x, y }]];
const hand = (x, y) => [{ x, y }];

test('appearing and reacquired inputs seed position without a false note', () => {
  const tracker = createGestureTracker();
  tracker.updateFace(face(0.1), 0);
  tracker.updateHands([hand(0.9, 0.1)], 0);
  assert.equal(tracker.getSnapshot(0).params.gain, 0);
  tracker.updateFace([], 50);
  tracker.updateHands([], 50);
  tracker.updateFace(face(0.9), 100);
  tracker.updateHands([hand(0.7, 0.9)], 100);
  assert.equal(tracker.getSnapshot(100).params.gain, 0);
});

test('face and either hand independently create pentatonic notes', () => {
  for (const input of ['face', 'leftHand', 'rightHand']) {
    const tracker = createGestureTracker();
    if (input === 'face') {
      tracker.updateFace(face(0.5), 0);
      tracker.updateFace(face(0.8), 50);
    } else {
      const x = input === 'leftHand' ? 0.8 : 0.2;
      tracker.updateHands([hand(x, 0.5)], 0);
      tracker.updateHands([hand(x, 0.1)], 50);
    }
    const { params } = tracker.getSnapshot(50);
    assert.ok(params.gain > 0);
    assert.equal(params.source, input);
    assert.ok([48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72].includes(params.note));
  }
});

test('disabling inputs immediately removes volume and all their modulation', () => {
  const tracker = createGestureTracker();
  tracker.updateFace(face(0.5), 0);
  tracker.updateFace(face(0.9), 50);
  tracker.setEnabled('face', false);
  tracker.updateFace(face(0.1), 100);
  let snapshot = tracker.getSnapshot(100);
  assert.equal(snapshot.params.gain, 0);
  assert.equal(snapshot.params.pan, 0);
  assert.equal(snapshot.parts.face.visible, false);

  tracker.updateHands([hand(0.9, 0.5), hand(0.1, 0.5)], 100);
  tracker.updateHands([hand(0.9, 0.1), hand(0.1, 0.1)], 150);
  tracker.setEnabled('hands', false);
  snapshot = tracker.getSnapshot(150);
  assert.equal(snapshot.params.gain, 0);
  assert.equal(snapshot.params.detune, 0);
  assert.equal(snapshot.params.lpf, 300);
  tracker.setEnabled('face', true);
  tracker.updateFace(face(0.2), 200);
  assert.equal(tracker.getSnapshot(200).params.gain, 0);
});

test('a missing hand decays even while the other hand remains visible', () => {
  const tracker = createGestureTracker();
  tracker.updateHands([hand(0.8, 0.5), hand(0.2, 0.5)], 0);
  tracker.updateHands([hand(0.8, 0.1), hand(0.2, 0.5)], 50);
  assert.ok(tracker.getSnapshot(50).parts.leftHand.velocity > 0);
  for (let time = 100; time <= 1000; time += 50) tracker.updateHands([hand(0.2, 0.5)], time);
  const { parts, params } = tracker.getSnapshot(1000);
  assert.equal(parts.leftHand.visible, false);
  assert.equal(parts.rightHand.visible, true);
  assert.ok(parts.leftHand.velocity < 0.001);
  assert.equal(params.gain, 0);
  assert.equal(params.detune, 0);
});

test('lost video expires movement and presence even with no new detections', () => {
  const tracker = createGestureTracker();
  tracker.updateFace(face(0.5), 0);
  tracker.updateFace(face(0.9), 50);
  assert.ok(tracker.getSnapshot(50).params.gain > 0);
  const snapshot = tracker.getSnapshot(301);
  assert.equal(snapshot.params.gain, 0);
  assert.equal(snapshot.parts.face.visible, false);
});

test('returning to stillness becomes silent while remaining tracked', () => {
  const tracker = createGestureTracker();
  tracker.updateFace(face(0.5), 0);
  tracker.updateFace(face(0.9), 50);
  for (let time = 100; time <= 2000; time += 50) tracker.updateFace(face(0.9), time);
  const snapshot = tracker.getSnapshot(2000);
  assert.equal(snapshot.parts.face.visible, true);
  assert.equal(snapshot.params.source, null);
  assert.equal(snapshot.params.gain, 0);
});

test('movement speed is comparable at different detection rates', () => {
  function play(step) {
    const tracker = createGestureTracker();
    for (let time = 0; time <= 600; time += step) tracker.updateFace(face(0.2 + time / 1000), time);
    return tracker.getSnapshot(600);
  }
  const fast = play(50);
  const slow = play(100);
  assert.ok(Math.abs(fast.parts.face.velocity - slow.parts.face.velocity) < 0.04);
  assert.ok(Math.abs(fast.params.gain - slow.params.gain) < 0.02);
});

test('small velocity differences do not keep stealing the pitch source', () => {
  const tracker = createGestureTracker();
  tracker.updateFace(face(0.5), 0);
  tracker.updateHands([hand(0.2, 0.5)], 0);
  tracker.updateFace(face(0.6), 50);
  tracker.updateHands([hand(0.2, 0.41)], 50);
  assert.equal(tracker.getSnapshot(50).params.source, 'face');
  tracker.updateFace(face(0.67), 100);
  tracker.updateHands([hand(0.2, 0.33)], 100);
  assert.equal(tracker.getSnapshot(100).params.source, 'face');
});

test('hand modulation uses only the hand actually visible', () => {
  const tracker = createGestureTracker();
  tracker.updateHands([hand(0.9, 0.1)], 0);
  tracker.updateHands([hand(0.9, 0.3)], 50);
  const { params, activity } = tracker.getSnapshot(50);
  assert.equal(params.lpf, 300 + activity * 4000);
  assert.ok(params.detune < 0);
  assert.equal(params.pan, 0);
});

test('pitch follows the mirrored stage and the note readout matches its MIDI pitch', () => {
  const tracker = createGestureTracker();
  tracker.updateFace(face(0.8), 0);
  for (let time = 50; time <= 400; time += 50) tracker.updateFace(face(0.8 - time / 600), time);
  const { params } = tracker.getSnapshot(400);
  assert.ok(params.note >= 64);
  assert.equal(getNoteName(48), 'C3');
  assert.equal(getNoteName(72), 'C5');
  assert.match(generateStrudelCode(params, { synthType: 'triangle', filterCutoff: 100, delayMix: 0.2, reverbMix: 0.3 }), /\.room\(0.30\)/);
});
