import { FilesetResolver } from '@mediapipe/tasks-vision';
import simdLoader from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import simdBinary from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import basicLoader from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url';
import basicBinary from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url';

const visionFiles = FilesetResolver.isSimdSupported().then(supported => ({
  wasmLoaderPath: supported ? simdLoader : basicLoader,
  wasmBinaryPath: supported ? simdBinary : basicBinary
}));

export function createVideoDetector(Landmarker, options) {
  let detector = null;
  let initialization = null;
  let lastDetectionTime = -Infinity;
  let lastVideoTime = -1;

  async function init() {
    if (detector) return detector;
    if (!initialization) {
      initialization = (async () => {
        const files = await visionFiles;
        try {
          detector = await Landmarker.createFromOptions(files, {
            ...options,
            baseOptions: { ...options.baseOptions, delegate: 'GPU' },
            runningMode: 'VIDEO'
          });
        } catch (error) {
          console.warn('GPU tracking unavailable; trying CPU tracking:', error);
          detector = await Landmarker.createFromOptions(files, {
            ...options,
            baseOptions: { ...options.baseOptions, delegate: 'CPU' },
            runningMode: 'VIDEO'
          });
        }
        return detector;
      })().finally(() => { initialization = null; });
    }
    return initialization;
  }

  function detect(video, timestamp) {
    if (!detector || video.readyState < 2 || !video.videoWidth || video.currentTime === lastVideoTime) return null;
    if (timestamp - lastDetectionTime < 50) return null;
    lastDetectionTime = timestamp;
    lastVideoTime = video.currentTime;
    try {
      return detector.detectForVideo(video, timestamp);
    } catch (error) {
      const failedDetector = detector;
      detector = null;
      lastVideoTime = -1;
      try {
        failedDetector.close();
      } catch (cleanupError) {
        console.warn('Unable to release failed tracker:', cleanupError);
      }
      throw error;
    }
  }

  return { init, detect };
}
