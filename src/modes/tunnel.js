import * as THREE from 'three';

export function createTunnel(meshGroup, material, camera, controls) {
  camera.position.set(0, 0, 5);
  controls.enableZoom = true;
  const geometry = new THREE.PlaneGeometry(4, 2.25);
  const count = 50;
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = -i * 8;
    mesh.rotation.z = i * 0.1;
    const scale = 1 + i * 0.5;
    mesh.scale.set(scale, scale, 1);
    meshGroup.add(mesh);
  }
}
