import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let faceLandmarker = null;
let lastDetectionTime = 0;
const DETECTION_INTERVAL = 50;

export async function initFaceLandmarker() {
  if (faceLandmarker) return faceLandmarker;
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );
  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numFaces: 2,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false
  });
  return faceLandmarker;
}

export function detectFaceLandmarks(video, timestamp) {
  if (!faceLandmarker || !video.videoWidth) return null;
  if (timestamp - lastDetectionTime < DETECTION_INTERVAL) return null;
  lastDetectionTime = timestamp;
  return faceLandmarker.detectForVideo(video, timestamp);
}
