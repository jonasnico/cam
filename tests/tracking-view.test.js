import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTracking } from '../src/modes/tracking.js';
import { clearAllOverlays, initOverlay, updateLandmarksOverlay } from '../src/tracking/overlay.js';

test('the complete camera image fits portrait, landscape and resized viewports', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  const resize = createTracking(scene, new THREE.MeshBasicMaterial(), camera);
  for (const [width, height, videoWidth, videoHeight] of [
    [390, 844, 1280, 720], [844, 390, 1280, 720],
    [1200, 800, 640, 480], [390, 844, 720, 1280]
  ]) {
    resize(width, height, videoWidth, videoHeight);
    camera.updateMatrixWorld();
    const aspect = videoWidth / videoHeight;
    assert.equal(scene.children[0].scale.x, aspect);
    for (const x of [-aspect / 2, aspect / 2]) {
      for (const y of [-0.5, 0.5]) {
        const projected = new THREE.Vector3(x, y, 0).project(camera);
        assert.ok(Math.abs(projected.x) <= 1.00001);
        assert.ok(Math.abs(projected.y) <= 1.00001);
      }
    }
    assert.ok(Math.abs((camera.right - camera.left) / (camera.top - camera.bottom) - width / height) < 0.00001);
  }
});

test('tracking geometry is reused, mirrored and cleared without GPU allocations', () => {
  const scene = new THREE.Scene();
  const overlay = initOverlay(scene);
  const faceLandmarks = [Array.from({ length: 478 }, () => ({ x: 0.7, y: 0.4 }))];
  const landmarks = [Array.from({ length: 21 }, () => ({ x: 0.8, y: 0.3 }))];
  const geometryIds = () => overlay.children.flatMap(group => group.children.map(mesh => mesh.geometry.uuid));
  const original = geometryIds();
  for (let frame = 0; frame < 200; frame++) {
    updateLandmarksOverlay({ faceLandmarks }, { landmarks }, 1280, 720, 'leftHand');
  }
  assert.deepEqual(geometryIds(), original);
  assert.equal(original.length, 6);
  assert.equal(overlay.scale.x, 1280 / 720);
  const [face, leftHand, unusedHand] = overlay.children;
  assert.equal(face.visible, true);
  assert.equal(leftHand.visible, true);
  assert.equal(unusedHand.visible, false);
  assert.ok(Math.abs(leftHand.children[0].geometry.attributes.position.getX(0) + 0.3) < 0.00001);
  assert.equal(leftHand.children[0].material.opacity, 0.95);
  clearAllOverlays();
  assert.equal(overlay.visible, false);
  updateLandmarksOverlay(null, null, 1280, 720, null);
  assert.ok(overlay.children.every(group => !group.visible));
  assert.deepEqual(geometryIds(), original);
});
