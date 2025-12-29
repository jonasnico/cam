import * as THREE from 'three';

export function createSphere(meshGroup, material, camera, controls) {
  camera.position.set(0, 0, 0.01);
  controls.enableZoom = false;
  const geometry = new THREE.PlaneGeometry(8, 4.5);
  const count = 128;
  const radius = 32;
  for (let i = 1; i <= count; i++) {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.setFromSphericalCoords(radius, phi, theta);
    mesh.lookAt(camera.position);
    meshGroup.add(mesh);
  }
}
