import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { createVideoDetector } from './videoDetector.js';

export const { init: initFaceLandmarker, detect: detectFaceLandmarks } = createVideoDetector(FaceLandmarker, {
  baseOptions: {
    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
  },
  numFaces: 1,
  outputFaceBlendshapes: false,
  outputFacialTransformationMatrixes: false
});
