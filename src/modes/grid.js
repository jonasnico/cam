import * as THREE from 'three';

export function createGrid(meshGroup, material, camera, controls) {
  camera.position.set(0, 0, 30);
  controls.enableZoom = true;
  const geometry = new THREE.PlaneGeometry(4, 2.25);
  const gridSize = 5;
  const spacing = 5;
  for (let x = -gridSize; x <= gridSize; x++) {
    for (let y = -gridSize; y <= gridSize; y++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x * spacing, y * spacing, 0);
      meshGroup.add(mesh);
    }
  }
}
