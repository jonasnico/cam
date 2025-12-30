const gestureState = {
  faceX: 0.5,
  faceY: 0.5,
  leftHandX: 0.5,
  leftHandY: 0.5,
  rightHandX: 0.5,
  rightHandY: 0.5,
  leftHandVisible: false,
  rightHandVisible: false,
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
const VELOCITY_DECAY = 0.65;
const MOVEMENT_THRESHOLD = 0.015;

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
    velocity.face = Math.min(1, faceMovement * 40);
  } else {
    velocity.face *= VELOCITY_DECAY;
  }
}

export function updateGesturesFromHands(handLandmarks, handedness) {
  gestureState.leftHandVisible = false;
  gestureState.rightHandVisible = false;
  
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
      gestureState.leftHandVisible = true;
      previousState.leftHandX = gestureState.leftHandX;
      previousState.leftHandY = gestureState.leftHandY;
      gestureState.leftHandX = lerp(gestureState.leftHandX, wrist.x, SMOOTHING);
      gestureState.leftHandY = lerp(gestureState.leftHandY, 1 - wrist.y, SMOOTHING);
      
      const movement = distance(
        previousState.leftHandX, previousState.leftHandY,
        gestureState.leftHandX, gestureState.leftHandY
      );
      
      if (movement > MOVEMENT_THRESHOLD) {
        velocity.leftHand = Math.min(1, movement * 40);
      } else {
        velocity.leftHand *= VELOCITY_DECAY;
      }
    } else {
      gestureState.rightHandVisible = true;
      previousState.rightHandX = gestureState.rightHandX;
      previousState.rightHandY = gestureState.rightHandY;
      gestureState.rightHandX = lerp(gestureState.rightHandX, wrist.x, SMOOTHING);
      gestureState.rightHandY = lerp(gestureState.rightHandY, 1 - wrist.y, SMOOTHING);
      
      const movement = distance(
        previousState.rightHandX, previousState.rightHandY,
        gestureState.rightHandX, gestureState.rightHandY
      );
      
      if (movement > MOVEMENT_THRESHOLD) {
        velocity.rightHand = Math.min(1, movement * 40);
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

export function gestureToAudioParams(gestures, vel, audioSettings) {
  const drumTriggers = [];
  
  if (audioSettings?.enableDrums && gestures.leftHandVisible) {
    if (vel.leftHand > 0.15) {
      if (gestures.leftHandY > 0.7) {
        drumTriggers.push({ type: 'bd', active: true, velocity: vel.leftHand * 1.2 });
      } else if (gestures.leftHandY > 0.4) {
        drumTriggers.push({ type: 'sd', active: true, velocity: vel.leftHand });
      } else {
        drumTriggers.push({ type: 'hh', active: true, velocity: vel.leftHand * 0.8 });
      }
    }
    
    if (vel.leftHand > 0.4 && gestures.leftHandX < 0.3) {
      drumTriggers.push({ type: 'cp', active: true, velocity: vel.leftHand });
    }
    if (vel.leftHand > 0.5 && gestures.leftHandX > 0.7) {
      drumTriggers.push({ type: 'oh', active: true, velocity: vel.leftHand });
    }
  }
  
  const synthActive = audioSettings?.enableSynth && (gestures.rightHandVisible || vel.face > 0.1);
  const synthGain = synthActive ? Math.min(1, vel.rightHand + vel.face * 0.5) * 0.6 : 0;
  
  const baseNote = Math.floor(gestures.faceX * 7);
  const scale = [0, 2, 4, 5, 7, 9, 11];
  const scaleNote = scale[baseNote % scale.length];
  const octave = gestures.rightHandVisible ? Math.floor(gestures.rightHandY * 3) : 1;
  
  return {
    gain: synthGain,
    note: 48 + scaleNote + octave * 12,
    lpf: 400 + (vel.face + vel.rightHand) * 3000 + gestures.rightHandY * 2000,
    detune: (gestures.faceX - 0.5) * 100,
    pan: (gestures.rightHandX - 0.5) * 1.5,
    complexity: 1 + Math.floor((vel.face + vel.rightHand) * 2),
    drumTriggers
  };
}

export function generateStrudelCode(params, audioSettings) {
  const lines = [];
  
  if (audioSettings.enableDrums && params.drumTriggers?.length > 0) {
    const activeDrums = params.drumTriggers.filter(t => t.active).map(t => t.type);
    if (activeDrums.length > 0) {
      lines.push(`s("${activeDrums.join(' ')}").gain(${audioSettings.drumVolume.toFixed(2)})`);
    }
  }
  
  if (audioSettings.enableSynth && params.gain > 0.01) {
    const notes = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
    const octave = Math.floor(params.note / 12);
    const noteIndex = params.note % 12;
    const note = notes[noteIndex] + octave;
    
    let synthCode = `sound("${audioSettings.synthType}").note("${note}")`;
    synthCode += `.gain(${(params.gain * audioSettings.synthVolume).toFixed(2)})`;
    synthCode += `.lpf(${Math.floor(params.lpf * audioSettings.filterCutoff / 100)})`;
    
    if (audioSettings.delayFeedback > 0.1) {
      synthCode += `.delay(${audioSettings.delayFeedback.toFixed(1)})`;
    }
    if (audioSettings.reverbMix > 0.1) {
      synthCode += `.room(${audioSettings.reverbMix.toFixed(1)})`;
    }
    lines.push(synthCode);
  }
  
  if (lines.length === 0) return '// silent - move to make sound';
  if (lines.length === 1) return lines[0];
  return `stack(\n  ${lines.join(',\n  ')}\n)`;
}
