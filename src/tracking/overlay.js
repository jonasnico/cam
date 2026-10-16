import * as THREE from 'three';

let overlayGroup = null;
let face = null;
let hands = [];

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

export function initOverlay(scene) {
  if (overlayGroup) return overlayGroup;
  overlayGroup = new THREE.Group();
  overlayGroup.name = 'trackingOverlay';
  face = createMarkers(FACE_CONNECTIONS, 1);
  hands = [createMarkers(HAND_CONNECTIONS, 21), createMarkers(HAND_CONNECTIONS, 21)];
  overlayGroup.add(face.group, ...hands.map(hand => hand.group));
  scene.add(overlayGroup);
  return overlayGroup;
}

function createMarkers(connections, pointCount) {
  const group = new THREE.Group();
  const lineGeometry = new THREE.BufferGeometry();
  const pointGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(connections.length * 6), 3).setUsage(THREE.DynamicDrawUsage));
  pointGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pointCount * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const lines = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({
    transparent: true, opacity: 0.5, depthTest: false
  }));
  const points = new THREE.Points(pointGeometry, new THREE.PointsMaterial({
    size: 4, sizeAttenuation: false, depthTest: false
  }));
  lines.frustumCulled = false;
  points.frustumCulled = false;
  lines.renderOrder = 1;
  points.renderOrder = 2;
  group.add(lines, points);
  group.visible = false;
  return { group, lines, points, connections, pointCount };
}

function updateMarkers(markers, landmarks, color, active) {
  markers.group.visible = Boolean(landmarks);
  if (!landmarks) return;
  const linePositions = markers.lines.geometry.attributes.position;
  markers.connections.forEach(([first, second], index) => {
    for (const [offset, point] of [landmarks[first], landmarks[second]].entries()) {
      linePositions.setXYZ(index * 2 + offset, 0.5 - point.x, 0.5 - point.y, 0.01);
    }
  });
  const pointPositions = markers.points.geometry.attributes.position;
  const dots = markers.pointCount === 1 ? [landmarks[1]] : landmarks;
  dots.forEach((point, index) => {
    pointPositions.setXYZ(index, 0.5 - point.x, 0.5 - point.y, 0.02);
  });
  linePositions.needsUpdate = true;
  pointPositions.needsUpdate = true;
  markers.lines.material.color.setHex(color);
  markers.points.material.color.setHex(color);
  markers.lines.material.opacity = active ? 0.95 : 0.4;
  markers.points.material.size = active ? 7 : 3;
}

export function updateLandmarksOverlay(faceResults, handResults, videoWidth, videoHeight, source) {
  if (!overlayGroup || !videoWidth || !videoHeight) return;
  overlayGroup.visible = true;
  overlayGroup.scale.x = videoWidth / videoHeight;
  updateMarkers(face, faceResults?.faceLandmarks?.[0], 0x86dcc7, source === 'face');
  hands.forEach((markers, index) => {
    const landmarks = handResults?.landmarks?.[index];
    const name = landmarks?.[0].x > 0.5 ? 'leftHand' : 'rightHand';
    updateMarkers(markers, landmarks, 0xf1c58c, source === name);
  });
}

export function clearAllOverlays() {
  if (overlayGroup) overlayGroup.visible = false;
}
