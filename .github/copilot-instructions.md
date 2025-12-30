# Copilot Instructions

## Project Overview
Gesture-controlled music synthesizer using MediaPipe for face/hand tracking and Web Audio for sound generation.

## Code Style Guidelines
- Minimal and clean code
- No comments - use self-describing code
- Use latest versions of dependencies
- ES modules with modern JavaScript syntax
- Keep files small and focused

## Structure
- `src/main.js` - Main app with UI setup
- `src/modes/tracking.js` - Video plane display
- `src/detection/` - MediaPipe face and hand landmarkers
- `src/tracking/gestures.js` - Gesture interpretation and velocity tracking
- `src/tracking/overlay.js` - Landmark visualization
- `src/audio/strudel.js` - Web Audio synthesizer

## Movement-Based Audio
- Sound is only produced when there is movement
- No movement = silence (gain = 0)
- Velocity decay ensures sound fades when movement stops
- Movement threshold filters out noise

## Gesture Mappings
- Face X position → Note/pitch + stereo pan
- Face movement → Contributes to overall velocity
- Right hand Y → Filter cutoff boost
- Left hand X → Detune/pitch wobble
- Total velocity → Volume + harmonic complexity

## Audio Settings
- Synth: sawtooth, square, triangle, sine
- Voices: 1-4 oscillators with harmonics
- Filter: Low-pass with adjustable cutoff and resonance
- Effects: Reverb, delay with adjustable parameters

## Reference
- Three.js: https://github.com/mrdoob/three.js
- MediaPipe: https://ai.google.dev/edge/mediapipe/solutions/guide
- Strudel Docs:
  - https://strudel.cc/learn/samples/
  - https://strudel.cc/learn/synths/
  - https://strudel.cc/learn/effects/
  - https://strudel.cc/technical-manual/project-start/

## Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build