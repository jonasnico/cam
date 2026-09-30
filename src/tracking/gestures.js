const PARTS = ['face', 'leftHand', 'rightHand'];
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FRAME_MS = 50;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function createPart() {
  return { x: 0.5, y: 0.5, velocity: 0, visible: false, moving: false, updatedAt: null };
}

export function getNoteName(note) {
  return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}

export function createGestureTracker() {
  const parts = Object.fromEntries(PARTS.map(name => [name, createPart()]));
  const enabled = { face: true, hands: true };
  let source = null;
  let scaleIndex = null;

  function updatePart(name, point, timestamp) {
    const part = parts[name];
    const elapsed = part.updatedAt === null ? 1 : clamp((timestamp - part.updatedAt) / FRAME_MS, 0.1, 3);
    const wasVisible = part.visible;
    part.updatedAt = timestamp;
    part.visible = Boolean(point);

    if (!point) {
      part.velocity *= 0.55 ** elapsed;
      part.moving = false;
      return;
    }

    const x = clamp(1 - point.x, 0, 1);
    const y = clamp(1 - point.y, 0, 1);
    if (!wasVisible) {
      part.x = x;
      part.y = y;
      part.velocity = 0;
      part.moving = false;
      return;
    }

    const smoothing = 1 - 0.65 ** elapsed;
    const nextX = part.x + (x - part.x) * smoothing;
    const nextY = part.y + (y - part.y) * smoothing;
    const movement = Math.hypot(nextX - part.x, nextY - part.y) / elapsed;
    part.x = nextX;
    part.y = nextY;
    part.moving = movement > (part.moving ? 0.004 : 0.008);
    part.velocity = part.moving ? Math.min(1, movement * 25) : part.velocity * 0.55 ** elapsed;
  }

  function reset(names = PARTS) {
    names.forEach(name => Object.assign(parts[name], createPart()));
    if (names.includes(source)) {
      source = null;
      scaleIndex = null;
    }
  }

  function setEnabled(input, value) {
    enabled[input] = value;
    reset(input === 'face' ? ['face'] : ['leftHand', 'rightHand']);
  }

  function updateFace(landmarks, timestamp) {
    if (enabled.face) updatePart('face', landmarks?.[0]?.[1], timestamp);
  }

  function updateHands(landmarks, timestamp) {
    if (!enabled.hands) return;
    const wrists = { leftHand: null, rightHand: null };
    for (const hand of landmarks ?? []) {
      const wrist = hand[0];
      const name = wrist.x > 0.5 ? 'leftHand' : 'rightHand';
      const existing = wrists[name];
      if (!existing || Math.abs(wrist.x - 0.5) > Math.abs(existing.x - 0.5)) wrists[name] = wrist;
    }
    updatePart('leftHand', wrists.leftHand, timestamp);
    updatePart('rightHand', wrists.rightHand, timestamp);
  }

  function getSnapshot(timestamp) {
    for (const name of PARTS) {
      const part = parts[name];
      if (part.updatedAt !== null && timestamp - part.updatedAt > 250) reset([name]);
    }

    const candidate = PARTS.reduce((best, name) => parts[name].velocity > parts[best].velocity ? name : best);
    if (parts[candidate].velocity < 0.03) {
      source = null;
      scaleIndex = null;
    } else if (!source || parts[source].velocity < 0.03 || parts[candidate].velocity > parts[source].velocity * 1.2) {
      if (source !== candidate) scaleIndex = null;
      source = candidate;
    }

    const total = PARTS.reduce((sum, name) => sum + parts[name].velocity, 0);
    const activity = Math.min(1, total * 0.8);
    if (source) {
      const pitch = source === 'face' ? parts.face.x : parts[source].y;
      const position = pitch * PENTATONIC.length;
      if (scaleIndex === null || position < scaleIndex - 0.15 || position > scaleIndex + 1.15) {
        scaleIndex = clamp(Math.floor(position), 0, PENTATONIC.length - 1);
      }
    }

    const params = {
      gain: source ? Math.min(0.5, activity * 0.45) : 0,
      note: 48 + PENTATONIC[scaleIndex ?? 0],
      lpf: 300 + activity * 2500 + (parts.rightHand.visible ? parts.rightHand.y * 2500 : activity * 1500),
      detune: parts.leftHand.visible ? (parts.leftHand.x - 0.5) * 80 : 0,
      pan: parts.face.visible ? (parts.face.x - 0.5) : 0,
      complexity: 1 + Math.floor(activity * 3),
      source
    };

    return {
      parts: Object.fromEntries(PARTS.map(name => [name, { ...parts[name] }])),
      enabled: { ...enabled },
      activity: source ? activity : 0,
      params
    };
  }

  return { updateFace, updateHands, setEnabled, reset, getSnapshot };
}

export function generateStrudelCode(params, audioSettings) {
  if (params.gain < 0.01) return '// silent - move to make sound';
  return `sound("${audioSettings.synthType}").note("${getNoteName(params.note).toLowerCase()}")`
    + `.gain(${params.gain.toFixed(2)}).lpf(${Math.floor(params.lpf * audioSettings.filterCutoff / 100)})`
    + `.delay(${audioSettings.delayMix.toFixed(2)}).room(${audioSettings.reverbMix.toFixed(2)})`;
}
