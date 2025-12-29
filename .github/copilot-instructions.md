# Copilot Instructions

## Project Overview
Three.js WebGL webapp using webcam video input as a texture with MediaPipe face detection.

## Code Style Guidelines
- Minimal and clean code
- No comments - use self-describing code
- Use latest versions of dependencies
- ES modules with modern JavaScript syntax
- Keep files small and focused
- Modular structure with separate files for modes and detection

## Structure
- `src/main.js` - Main app entry point
- `src/modes/` - Visualization mode modules
- `src/detection/` - Face detection modules

## Reference
- Based on: https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_video_webcam.html
- More examples: https://github.com/mrdoob/three.js/tree/master/examples
- MediaPipe: https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector/web_js

## Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build