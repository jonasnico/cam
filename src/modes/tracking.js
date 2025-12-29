import * as THREE from 'three';

export function createTracking(meshGroup, material, camera, controls) {
  camera.position.set(0, 0, 10);
  controls.enableZoom = true;
  const geometry = new THREE.PlaneGeometry(16, 9);
  const mesh = new THREE.Mesh(geometry, material);
  meshGroup.add(mesh);
}
