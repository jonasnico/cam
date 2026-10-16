import * as THREE from 'three';

export function createTracking(scene, material, camera) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  scene.add(mesh);
  camera.position.z = 2;

  return function resize(width, height, videoWidth, videoHeight) {
    const aspect = videoWidth && videoHeight ? videoWidth / videoHeight : 16 / 9;
    const viewportAspect = width / height;
    const visibleWidth = Math.max(aspect, viewportAspect);
    const visibleHeight = visibleWidth / viewportAspect;
    mesh.scale.x = aspect;
    camera.left = -visibleWidth / 2;
    camera.right = visibleWidth / 2;
    camera.top = visibleHeight / 2;
    camera.bottom = -visibleHeight / 2;
    camera.updateProjectionMatrix();
  };
}
