import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFootPlantSolver } from '../frontend/dance-foot-ik.js';

test('planted feet stay anchored while the hip moves; airborne feet release', () => {
  const root = new THREE.Group(), upper = new THREE.Bone(), lower = new THREE.Bone(), foot = new THREE.Bone();
  root.add(upper); upper.position.set(-0.1, 0.9, 0); upper.add(lower); lower.position.set(0, -0.43, 0.12);
  lower.add(foot); foot.position.set(0, -0.43, -0.12); root.updateMatrixWorld(true);
  const bones = { leftUpperLeg: upper, leftLowerLeg: lower, leftFoot: foot };
  const solve = createFootPlantSolver({ getNormalizedBoneNode: (name) => bones[name] });
  const anchor = foot.getWorldPosition(new THREE.Vector3()), orientation = foot.getWorldQuaternion(new THREE.Quaternion());
  const rest = [upper.quaternion.clone(), lower.quaternion.clone(), foot.quaternion.clone()];
  solve([1, 0], 0);
  upper.position.x += 0.08; root.updateMatrixWorld(true); solve([1, 0], 0);
  assert(foot.getWorldPosition(new THREE.Vector3()).distanceTo(anchor) < 0.001, 'Keeps the support foot on its original spot');
  assert(foot.getWorldQuaternion(new THREE.Quaternion()).angleTo(orientation) < 0.001, 'Keeps captured ankle orientation');
  for (const bone of [upper, lower, foot]) assert(bone.quaternion.toArray().every(Number.isFinite));
  [upper, lower, foot].forEach((bone, i) => bone.quaternion.copy(rest[i]));
  root.updateMatrixWorld(true); const before = foot.getWorldPosition(new THREE.Vector3());
  solve([1, 0], 0.1);
  assert(foot.getWorldPosition(new THREE.Vector3()).distanceTo(before) < 1e-6, 'An airborne leg is never pinned');
});
