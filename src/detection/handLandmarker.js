import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let handLandmarker = null;
let lastDetectionTime = 0;
const DETECTION_INTERVAL = 50;

export async function initHandLandmarker() {
  if (handLandmarker) return handLandmarker;
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numHands: 2
  });
  return handLandmarker;
}

export function detectHandLandmarks(video, timestamp) {
  if (!handLandmarker || !video.videoWidth) return null;
  if (timestamp - lastDetectionTime < DETECTION_INTERVAL) return null;
  lastDetectionTime = timestamp;
  return handLandmarker.detectForVideo(video, timestamp);
}
