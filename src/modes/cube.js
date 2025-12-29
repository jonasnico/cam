import * as THREE from 'three';

export function createCube(meshGroup, material, camera, controls) {
  camera.position.set(3, 3, 3);
  controls.enableZoom = true;
  const geometry = new THREE.BoxGeometry(4, 4, 4);
  const materials = Array(6).fill(material);
  const mesh = new THREE.Mesh(geometry, materials);
  meshGroup.add(mesh);
}

export function animateCube(meshGroup) {
  const cube = meshGroup.children[0];
  if (cube) {
    cube.rotation.x += 0.005;
    cube.rotation.y += 0.005;
  }
}
