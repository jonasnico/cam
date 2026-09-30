import { getNoteName } from '../tracking/gestures.js';

export function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

export function createHud() {
  const faceButton = document.getElementById('hud-face');
  const handsButton = document.getElementById('hud-hands');
  const faceState = document.getElementById('face-state');
  const handsState = document.getElementById('hands-state');
  const muteButton = document.getElementById('mute-btn');
  const note = document.getElementById('note-name');
  const source = document.getElementById('note-source');
  const feedback = document.getElementById('musical-feedback');
  const hint = document.getElementById('play-hint');
  const meter = document.querySelector('.activity-track');
  const activity = document.getElementById('hud-activity');
  let playedFor = 0;
  let previousTime = null;

  function update(snapshot, { muted, paused, volume, detectors }, timestamp) {
    const { parts, enabled, params } = snapshot;
    const silent = muted || paused || volume === 0;
    const present = parts.face.visible || parts.leftHand.visible || parts.rightHand.visible;
    const allOff = !enabled.face && !enabled.hands;

    function updateInput(button, stateElement, input, names) {
      const state = !enabled[input] ? 'Off'
        : detectors[input] === 'error' ? 'Unavailable'
          : detectors[input] === 'loading' ? 'Loading'
            : paused ? 'Paused'
              : !silent && names.some(name => parts[name].velocity >= 0.03) ? 'Playing'
                : names.some(name => parts[name].visible) ? 'Tracked' : 'Searching';
      button.setAttribute('aria-pressed', String(enabled[input]));
      button.dataset.state = state;
      setText(stateElement, state);
    }
    updateInput(faceButton, faceState, 'face', ['face']);
    updateInput(handsButton, handsState, 'hands', ['leftHand', 'rightHand']);
    muteButton.setAttribute('aria-pressed', String(muted));
    muteButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    setText(muteButton, muted ? 'Unmute' : 'Mute');

    let noteText = 'Ready';
    let sourceText = present ? 'Waiting for movement' : 'Bring your face or a hand into view';
    let hintText = parts.face.visible ? 'Move your head sideways to change the note.' : 'Lift a hand and move it up or down.';
    if (allOff) {
      noteText = 'Off';
      sourceText = 'Enable Face or Hands to play';
      hintText = '';
    } else if (params.source && !silent) {
      noteText = getNoteName(params.note);
      sourceText = { face: 'Face', leftHand: 'Left hand', rightHand: 'Right hand' }[params.source];
      hintText = params.source === 'face' ? 'Move sideways to explore the notes.' : 'Move up for higher notes, down for lower.';
      playedFor += previousTime === null ? 0 : Math.min(100, timestamp - previousTime);
    }
    if (playedFor > 2500) hintText = '';
    if (!present && !allOff) hintText = 'Keep your face or hands inside the camera view.';
    if (volume === 0) {
      noteText = 'Volume off';
      sourceText = 'Turn up Volume in Settings';
      hintText = '';
    }
    if (muted) {
      noteText = 'Muted';
      sourceText = 'Tracking is still on';
      hintText = 'Unmute whenever you are ready to play.';
    }
    if (paused) {
      noteText = 'Paused';
      sourceText = 'Your instrument is resting';
      hintText = '';
    }
    previousTime = timestamp;
    setText(note, noteText);
    setText(source, sourceText);
    setText(hint, hintText);
    feedback.dataset.source = silent ? '' : params.source ?? '';
    const intensity = Math.round(snapshot.activity * 100);
    activity.style.transform = `scaleX(${intensity / 100})`;
    meter.setAttribute('aria-valuenow', String(intensity));
  }

  function reset() {
    playedFor = 0;
    previousTime = null;
  }

  return { update, reset };
}
