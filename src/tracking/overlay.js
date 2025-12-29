import * as THREE from 'three';

let overlayGroup = null;
let faceMarkers = [];
let landmarkMarkers = [];

const FACE_CONNECTIONS = [
  [10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389], [389, 356], [356, 454], [454, 323], [323, 361],
  [361, 288], [288, 397], [397, 365], [365, 379], [379, 378], [378, 400], [400, 377], [377, 152], [152, 148], [148, 176],
  [176, 149], [149, 150], [150, 136], [136, 172], [172, 58], [58, 132], [132, 93], [93, 234], [234, 127], [127, 162],
  [162, 21], [21, 54], [54, 103], [103, 67], [67, 109], [109, 10],
  [33, 7], [7, 163], [163, 144], [144, 145], [145, 153], [153, 154], [154, 155], [155, 133],
  [33, 246], [246, 161], [161, 160], [160, 159], [159, 158], [158, 157], [157, 173], [173, 133],
  [263, 249], [249, 390], [390, 373], [373, 374], [374, 380], [380, 381], [381, 382], [382, 362],
  [263, 466], [466, 388], [388, 387], [387, 386], [386, 385], [385, 384], [384, 398], [398, 362],
  [61, 146], [146, 91], [91, 181], [181, 84], [84, 17], [17, 314], [314, 405], [405, 321], [321, 375], [375, 291],
  [61, 185], [185, 40], [40, 39], [39, 37], [37, 0], [0, 267], [267, 269], [269, 270], [270, 409], [409, 291],
  [78, 95], [95, 88], [88, 178], [178, 87], [87, 14], [14, 317], [317, 402], [402, 318], [318, 324], [324, 308],
  [78, 191], [191, 80], [80, 81], [81, 82], [82, 13], [13, 312], [312, 311], [311, 310], [310, 415], [415, 308]
];

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17]
];

const PLANE_WIDTH = 16;
const PLANE_HEIGHT = 9;

export function initOverlay(scene) {
  if (overlayGroup) return overlayGroup;
  overlayGroup = new THREE.Group();
  overlayGroup.name = 'trackingOverlay';
  scene.add(overlayGroup);
  return overlayGroup;
}

function clearMarkers(markers) {
  markers.forEach(marker => {
    marker.geometry?.dispose();
    marker.material?.dispose();
    overlayGroup?.remove(marker);
  });
  return [];
}

function toPlaneCoords(x, y) {
  return {
    x: (x - 0.5) * PLANE_WIDTH,
    y: (0.5 - y) * PLANE_HEIGHT
  };
}

export function updateFaceDetectionOverlay(detections, videoWidth, videoHeight) {
  faceMarkers = clearMarkers(faceMarkers);
  if (!detections?.length || !videoWidth || !overlayGroup) return;

  detections.forEach(detection => {
    const box = detection.boundingBox;
    const normalizedX = (box.originX + box.width / 2) / videoWidth;
    const normalizedY = (box.originY + box.height / 2) / videoHeight;
    const normalizedW = box.width / videoWidth;
    const normalizedH = box.height / videoHeight;

    const pos = toPlaneCoords(normalizedX, normalizedY);
    const w = normalizedW * PLANE_WIDTH;
    const h = normalizedH * PLANE_HEIGHT;

    const boxGeometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h));
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    const wireframe = new THREE.LineSegments(boxGeometry, lineMaterial);
    wireframe.position.set(pos.x, pos.y, 0.1);
    overlayGroup.add(wireframe);
    faceMarkers.push(wireframe);

    detection.keypoints?.forEach(keypoint => {
      const kp = toPlaneCoords(keypoint.x / videoWidth, keypoint.y / videoHeight);
      const dotGeometry = new THREE.CircleGeometry(0.08, 8);
      const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      dot.position.set(kp.x, kp.y, 0.2);
      overlayGroup.add(dot);
      faceMarkers.push(dot);
    });
  });
}

export function updateLandmarksOverlay(faceResults, handResults, videoWidth, videoHeight) {
  landmarkMarkers = clearMarkers(landmarkMarkers);
  if (!videoWidth || !overlayGroup) return;

  if (faceResults?.faceLandmarks) {
    faceResults.faceLandmarks.forEach(landmarks => {
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
      FACE_CONNECTIONS.forEach(([i, j]) => {
        if (landmarks[i] && landmarks[j]) {
          const p1 = toPlaneCoords(landmarks[i].x, landmarks[i].y);
          const p2 = toPlaneCoords(landmarks[j].x, landmarks[j].y);
          const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(p1.x, p1.y, 0.1),
            new THREE.Vector3(p2.x, p2.y, 0.1)
          ]);
          const line = new THREE.Line(geometry, lineMaterial);
          overlayGroup.add(line);
          landmarkMarkers.push(line);
        }
      });
    });
  }

  if (handResults?.landmarks) {
    handResults.landmarks.forEach((landmarks, handIndex) => {
      const color = handIndex === 0 ? 0xff6600 : 0x0066ff;
      
      landmarks.forEach(point => {
        const pos = toPlaneCoords(point.x, point.y);
        const dot = new THREE.Mesh(
          new THREE.CircleGeometry(0.06, 8),
          new THREE.MeshBasicMaterial({ color })
        );
        dot.position.set(pos.x, pos.y, 0.2);
        overlayGroup.add(dot);
        landmarkMarkers.push(dot);
      });

      const lineMaterial = new THREE.LineBasicMaterial({ color });
      HAND_CONNECTIONS.forEach(([i, j]) => {
        const p1 = toPlaneCoords(landmarks[i].x, landmarks[i].y);
        const p2 = toPlaneCoords(landmarks[j].x, landmarks[j].y);
        const geometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(p1.x, p1.y, 0.15),
          new THREE.Vector3(p2.x, p2.y, 0.15)
        ]);
        const line = new THREE.Line(geometry, lineMaterial);
        overlayGroup.add(line);
        landmarkMarkers.push(line);
      });
    });
  }
}

export function clearAllOverlays() {
  faceMarkers = clearMarkers(faceMarkers);
  landmarkMarkers = clearMarkers(landmarkMarkers);
}
