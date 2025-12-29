import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

let faceDetector = null;
let lastDetectionTime = 0;
const DETECTION_INTERVAL = 100;

export async function initFaceDetector() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );
  faceDetector = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
      delegate: 'GPU'
    },
    runningMode: 'VIDEO'
  });
  return faceDetector;
}

export function detectFaces(video, timestamp) {
  if (!faceDetector || !video.videoWidth) return [];
  if (timestamp - lastDetectionTime < DETECTION_INTERVAL) return null;
  lastDetectionTime = timestamp;
  const result = faceDetector.detectForVideo(video, timestamp);
  return result.detections;
}

export function getFaceDetector() {
  return faceDetector;
}
