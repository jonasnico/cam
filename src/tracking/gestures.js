const gestureState = {
  faceX: 0.5,
  faceY: 0.5,
  leftHandX: 0.5,
  leftHandY: 0.5,
  rightHandX: 0.5,
  rightHandY: 0.5,
  handsVisible: 0
};

const previousState = { ...gestureState };
const velocity = {
  face: 0,
  leftHand: 0,
  rightHand: 0,
  total: 0
};

const SMOOTHING = 0.35;
const VELOCITY_DECAY = 0.55;
const MOVEMENT_THRESHOLD = 0.008;
const SILENCE_THRESHOLD = 0.004;

let faceActive = false;
let leftHandActive = false;
let rightHandActive = false;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function updateGesturesFromFace(faceLandmarks) {
  if (!faceLandmarks?.length) {
    velocity.face *= VELOCITY_DECAY;
    faceActive = velocity.face > SILENCE_THRESHOLD;
    recalcTotal();
    return;
  }
  const landmarks = faceLandmarks[0];

  const noseTip = landmarks[1];
  previousState.faceX = gestureState.faceX;
  previousState.faceY = gestureState.faceY;

  gestureState.faceX = lerp(gestureState.faceX, noseTip.x, SMOOTHING);
  gestureState.faceY = lerp(gestureState.faceY, noseTip.y, SMOOTHING);

  const movement = distance(
    previousState.faceX, previousState.faceY,
    gestureState.faceX, gestureState.faceY
  );

  const threshold = faceActive ? SILENCE_THRESHOLD : MOVEMENT_THRESHOLD;

  if (movement > threshold) {
    velocity.face = Math.min(1, movement * 25);
    faceActive = true;
  } else {
    velocity.face *= VELOCITY_DECAY;
    faceActive = velocity.face > SILENCE_THRESHOLD;
  }

  recalcTotal();
}

export function updateGesturesFromHands(handLandmarks, handedness) {
  if (!handLandmarks?.length) {
    gestureState.handsVisible = Math.max(0, gestureState.handsVisible - 0.15);
    velocity.leftHand *= VELOCITY_DECAY;
    velocity.rightHand *= VELOCITY_DECAY;
    leftHandActive = velocity.leftHand > SILENCE_THRESHOLD;
    rightHandActive = velocity.rightHand > SILENCE_THRESHOLD;
    recalcTotal();
    return;
  }

  gestureState.handsVisible = Math.min(1, gestureState.handsVisible + 0.3);

  handLandmarks.forEach((landmarks, index) => {
    const wrist = landmarks[0];
    const isLeft = wrist.x > 0.5;

    if (isLeft) {
      previousState.leftHandX = gestureState.leftHandX;
      previousState.leftHandY = gestureState.leftHandY;
      gestureState.leftHandX = lerp(gestureState.leftHandX, wrist.x, SMOOTHING);
      gestureState.leftHandY = lerp(gestureState.leftHandY, 1 - wrist.y, SMOOTHING);

      const movement = distance(
        previousState.leftHandX, previousState.leftHandY,
        gestureState.leftHandX, gestureState.leftHandY
      );

      const threshold = leftHandActive ? SILENCE_THRESHOLD : MOVEMENT_THRESHOLD;

      if (movement > threshold) {
        velocity.leftHand = Math.min(1, movement * 25);
        leftHandActive = true;
      } else {
        velocity.leftHand *= VELOCITY_DECAY;
        leftHandActive = velocity.leftHand > SILENCE_THRESHOLD;
      }
    } else {
      previousState.rightHandX = gestureState.rightHandX;
      previousState.rightHandY = gestureState.rightHandY;
      gestureState.rightHandX = lerp(gestureState.rightHandX, wrist.x, SMOOTHING);
      gestureState.rightHandY = lerp(gestureState.rightHandY, 1 - wrist.y, SMOOTHING);

      const movement = distance(
        previousState.rightHandX, previousState.rightHandY,
        gestureState.rightHandX, gestureState.rightHandY
      );

      const threshold = rightHandActive ? SILENCE_THRESHOLD : MOVEMENT_THRESHOLD;

      if (movement > threshold) {
        velocity.rightHand = Math.min(1, movement * 25);
        rightHandActive = true;
      } else {
        velocity.rightHand *= VELOCITY_DECAY;
        rightHandActive = velocity.rightHand > SILENCE_THRESHOLD;
      }
    }
  });

  recalcTotal();
}

function recalcTotal() {
  velocity.total = velocity.face + velocity.leftHand + velocity.rightHand;
}

export function getGestureState() {
  return { ...gestureState };
}

export function getVelocity() {
  return { ...velocity };
}

export function getActiveInputs() {
  return { face: faceActive, leftHand: leftHandActive, rightHand: rightHandActive };
}

const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export function gestureToAudioParams(gestures, vel) {
  const maxVel = Math.max(vel.face, vel.leftHand, vel.rightHand);

  if (maxVel < 0.03) {
    return { gain: 0, note: 48, lpf: 200, detune: 0, pan: 0, complexity: 0 };
  }

  const activity = Math.min(1, vel.total * 0.8);

  const pitchSource = vel.face > vel.leftHand && vel.face > vel.rightHand
    ? gestures.faceX
    : vel.rightHand > vel.leftHand
      ? gestures.rightHandY
      : gestures.leftHandY;

  const scaleIndex = Math.floor(pitchSource * PENTATONIC.length);
  const clampedIndex = Math.max(0, Math.min(PENTATONIC.length - 1, scaleIndex));
  const note = 48 + PENTATONIC[clampedIndex];

  const filterBoost = gestures.handsVisible > 0.5
    ? gestures.rightHandY * 2500
    : activity * 1500;

  const detune = gestures.handsVisible > 0.5
    ? (gestures.leftHandX - 0.5) * 80
    : 0;

  return {
    gain: Math.min(0.5, activity * 0.45),
    note,
    lpf: 300 + activity * 2500 + filterBoost,
    detune,
    pan: (gestures.faceX - 0.5) * 1.0,
    complexity: 1 + Math.floor(activity * 2)
  };
}

export function generateStrudelCode(params, audioSettings) {
  if (params.gain < 0.01) return '// silent - move to make sound';

  const noteNames = ['c3', 'd3', 'e3', 'g3', 'a3', 'c4', 'd4', 'e4', 'g4', 'a4', 'c5'];
  const noteIndex = Math.max(0, Math.min(noteNames.length - 1,
    PENTATONIC.indexOf(params.note - 48) !== -1
      ? PENTATONIC.indexOf(params.note - 48)
      : 0
  ));
  const note = noteNames[noteIndex];

  let code = `sound("${audioSettings.synthType}")`;
  code += `.note("${note}")`;
  code += `.gain(${params.gain.toFixed(2)})`;
  code += `.lpf(${Math.floor(params.lpf * audioSettings.filterCutoff / 100)})`;

  if (audioSettings.delayFeedback > 0.1) {
    code += `.delay(${audioSettings.delayFeedback.toFixed(1)})`;
  }
  if (audioSettings.reverbMix > 0.1) {
    code += `.room(${audioSettings.reverbMix.toFixed(1)})`;
  }

  return code;
}
