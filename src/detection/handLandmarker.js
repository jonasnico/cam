import { HandLandmarker } from '@mediapipe/tasks-vision';
import { createVideoDetector } from './videoDetector.js';

export const { init: initHandLandmarker, detect: detectHandLandmarks } = createVideoDetector(HandLandmarker, {
  baseOptions: {
    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
  },
  numHands: 2
});
