# Copilot Instructions

## Project Overview
**cam** — gesture-controlled music synthesizer. Move your face and hands to generate sound. Uses MediaPipe for tracking and Web Audio API for synthesis.

## Design Philosophy
- Play first, configure later
- Zero-config start: tap to begin, move to play
- Any single body part (face OR hand) independently triggers sound
- Advanced settings hidden behind gear icon
- Pentatonic scale ensures everything sounds musical

## Code Style
- Minimal, self-describing code — no comments
- ES modules, modern JavaScript
- Small focused files
- pnpm for package management
- Never commit or push — always let the user do it

## Structure
- `index.html` - UI overlay (start screen, HUD, settings panel, styles)
- `src/main.js` - App orchestration, UI logic, render loop
- `src/audio/strudel.js` - Web Audio synth (oscillators, filter, reverb, delay)
- `src/detection/faceLandmarker.js` - MediaPipe face landmark detection
- `src/detection/handLandmarker.js` - MediaPipe hand landmark detection
- `src/tracking/gestures.js` - Movement → velocity → audio params
- `src/tracking/overlay.js` - Three.js landmark visualization
- `src/modes/tracking.js` - Video plane setup

## UX Flow
1. App opens → webcam starts, start overlay shown
2. User taps → AudioContext inits, tracking starts, HUD appears
3. HUD indicators (face, left hand, right hand) glow when active
4. Click HUD indicators to toggle face/hands on/off
5. Gear icon → advanced settings panel (lil-gui)

## Movement Detection
- Hysteresis thresholds: start=0.008, stop=0.004 (on smoothed positions)
- Each body part triggers independently
- Hand left/right determined by wrist x-position (not MediaPipe handedness)
- Velocity decays at 0.55 per frame when no movement
- Total velocity = sum of all active parts

## Gesture → Audio Mapping
- Dominant moving part → pitch (pentatonic scale, C3-C5)
- Face X → stereo pan
- Activity level → volume + harmonic complexity
- Right hand Y → filter cutoff (when hands visible)
- Left hand X → detune (when hands visible)

## Audio Engine
- Web Audio API (not Strudel library despite filename)
- Oscillators: triangle default, 2 voices, gentle detuning
- Signal chain: oscillators → lowpass filter → stereo pan → dry/wet reverb → delay → master gain
- Smooth envelopes: attack 0.08s, release 0.15s, stop 0.2s

## References
- Three.js: https://threejs.org/docs/
- MediaPipe: https://ai.google.dev/edge/mediapipe/solutions/guide
- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

## Commands
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
