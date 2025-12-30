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

const SMOOTHING = 0.4;
const VELOCITY_DECAY = 0.7;
const MOVEMENT_THRESHOLD = 0.02;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function updateGesturesFromFace(faceLandmarks) {
  if (!faceLandmarks?.length) {
    velocity.face *= VELOCITY_DECAY;
    return;
  }
  const landmarks = faceLandmarks[0];
  
  const noseTip = landmarks[1];
  previousState.faceX = gestureState.faceX;
  previousState.faceY = gestureState.faceY;
  
  gestureState.faceX = lerp(gestureState.faceX, noseTip.x, SMOOTHING);
  gestureState.faceY = lerp(gestureState.faceY, noseTip.y, SMOOTHING);
  
  const faceMovement = distance(
    previousState.faceX, previousState.faceY,
    gestureState.faceX, gestureState.faceY
  );
  
  if (faceMovement > MOVEMENT_THRESHOLD) {
    velocity.face = Math.min(1, faceMovement * 30);
  } else {
    velocity.face *= VELOCITY_DECAY;
  }
}

export function updateGesturesFromHands(handLandmarks, handedness) {
  if (!handLandmarks?.length) {
    gestureState.handsVisible = Math.max(0, gestureState.handsVisible - 0.15);
    velocity.leftHand *= VELOCITY_DECAY;
    velocity.rightHand *= VELOCITY_DECAY;
    velocity.total = velocity.face + velocity.leftHand + velocity.rightHand;
    return;
  }
  
  gestureState.handsVisible = Math.min(1, gestureState.handsVisible + 0.3);
  
  handLandmarks.forEach((landmarks, index) => {
    const wrist = landmarks[0];
    const isLeft = handedness?.[index]?.categoryName === 'Left';
    
    if (isLeft) {
      previousState.leftHandX = gestureState.leftHandX;
      previousState.leftHandY = gestureState.leftHandY;
      gestureState.leftHandX = lerp(gestureState.leftHandX, wrist.x, SMOOTHING);
      gestureState.leftHandY = lerp(gestureState.leftHandY, 1 - wrist.y, SMOOTHING);
      
      const movement = distance(
        previousState.leftHandX, previousState.leftHandY,
        gestureState.leftHandX, gestureState.leftHandY
      );
      
      if (movement > MOVEMENT_THRESHOLD) {
        velocity.leftHand = Math.min(1, movement * 30);
      } else {
        velocity.leftHand *= VELOCITY_DECAY;
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
      
      if (movement > MOVEMENT_THRESHOLD) {
        velocity.rightHand = Math.min(1, movement * 30);
      } else {
        velocity.rightHand *= VELOCITY_DECAY;
      }
    }
  });
  
  velocity.total = velocity.face + velocity.leftHand + velocity.rightHand;
}

export function getGestureState() {
  return { ...gestureState };
}

export function getVelocity() {
  return { ...velocity };
}

export function gestureToAudioParams(gestures, vel) {
  const activity = Math.min(1, vel.total);
  
  if (activity < 0.05) {
    return { gain: 0, note: 48, lpf: 200, detune: 0, pan: 0, complexity: 0 };
  }
  
  return {
    gain: activity * 0.5,
    note: Math.floor(gestures.faceX * 12) + 48,
    lpf: 200 + activity * 4000 + gestures.rightHandY * 2000,
    detune: (gestures.leftHandX - 0.5) * 200,
    pan: (gestures.faceX - 0.5) * 1.5,
    complexity: 1 + Math.floor(activity * 3)
  };
}

export function generateStrudelCode(params, audioSettings) {
  if (params.gain < 0.01) return '// silent - move to make sound';
  
  const notes = ['c3', 'd3', 'e3', 'f3', 'g3', 'a3', 'b3', 'c4'];
  const noteIndex = Math.floor((params.note - 48) / 12 * notes.length) % notes.length;
  const note = notes[Math.abs(noteIndex)];
  
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
