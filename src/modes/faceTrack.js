import * as THREE from 'three';

let faceMarkers = [];

export function createFaceTrack(meshGroup, material, camera, controls) {
  camera.position.set(0, 0, 10);
  controls.enableZoom = true;
  const geometry = new THREE.PlaneGeometry(16, 9);
  const videoMesh = new THREE.Mesh(geometry, material);
  videoMesh.name = 'videoPlane';
  meshGroup.add(videoMesh);
  faceMarkers = [];
}

export function updateFaceMarkers(meshGroup, detections, videoWidth, videoHeight) {
  faceMarkers.forEach(marker => {
    marker.geometry.dispose();
    meshGroup.remove(marker);
  });
  faceMarkers = [];

  if (!detections || !videoWidth) return;

  const planeWidth = 16;
  const planeHeight = 9;

  detections.forEach(detection => {
    const box = detection.boundingBox;
    const normalizedX = (box.originX + box.width / 2) / videoWidth;
    const normalizedY = (box.originY + box.height / 2) / videoHeight;
    const normalizedW = box.width / videoWidth;
    const normalizedH = box.height / videoHeight;

    const x = (normalizedX - 0.5) * planeWidth;
    const y = (0.5 - normalizedY) * planeHeight;
    const w = normalizedW * planeWidth;
    const h = normalizedH * planeHeight;

    const boxGeometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h));
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    const wireframe = new THREE.LineSegments(boxGeometry, lineMaterial);
    wireframe.position.set(x, y, 0.01);
    meshGroup.add(wireframe);
    faceMarkers.push(wireframe);

    detection.keypoints.forEach(keypoint => {
      const kpX = (keypoint.x / videoWidth - 0.5) * planeWidth;
      const kpY = (0.5 - keypoint.y / videoHeight) * planeHeight;
      const dotGeometry = new THREE.CircleGeometry(0.08, 8);
      const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      dot.position.set(kpX, kpY, 0.02);
      meshGroup.add(dot);
      faceMarkers.push(dot);
    });
  });
}
