import * as THREE from 'three';

// Baked once per clip/model, never an IK solve for every live viewer/frame.
export function createFootPlantSolver(humanoid) {
  const legs = ['left', 'right'].map((side) => ({
    upper: humanoid.getNormalizedBoneNode(`${side}UpperLeg`),
    lower: humanoid.getNormalizedBoneNode(`${side}LowerLeg`),
    foot: humanoid.getNormalizedBoneNode(`${side}Foot`), anchor: null, confidence: null
  }));
  const hip = new THREE.Vector3(), knee = new THREE.Vector3(), ankle = new THREE.Vector3();
  const direction = new THREE.Vector3(), pole = new THREE.Vector3(), desiredKnee = new THREE.Vector3(), target = new THREE.Vector3();
  const from = new THREE.Vector3(), to = new THREE.Vector3();
  const delta = new THREE.Quaternion(), parentRotation = new THREE.Quaternion(), footRotation = new THREE.Quaternion();
  function aim(bone, origin, endpoint, desired) {
    from.copy(endpoint).sub(origin).normalize(); to.copy(desired).sub(origin).normalize();
    delta.setFromUnitVectors(from, to);
    bone.parent.getWorldQuaternion(parentRotation);
    delta.premultiply(parentRotation.clone().invert()).multiply(parentRotation);
    bone.quaternion.premultiply(delta).normalize(); bone.updateWorldMatrix(false, true);
  }
  return (weights = [], airborne = 0) => {
    for (let side = 0; side < legs.length; side++) {
      const leg = legs[side]; if (!leg.upper || !leg.lower || !leg.foot) continue;
      const measured = weights[side] || 0;
      leg.confidence = leg.confidence === null ? measured : THREE.MathUtils.lerp(leg.confidence, measured, 0.28);
      const weight = leg.confidence;
      leg.foot.getWorldPosition(ankle);
      if (weight < 0.04 || airborne > 0.025) { leg.anchor = null; leg.confidence = 0; continue; }
      leg.upper.getWorldPosition(hip); leg.lower.getWorldPosition(knee);
      const first = hip.distanceTo(knee), second = knee.distanceTo(ankle), length = first + second;
      if (!leg.anchor) leg.anchor = ankle.clone();
      if (Math.hypot(ankle.x - leg.anchor.x, ankle.z - leg.anchor.z) > length * 0.22) leg.anchor.lerp(ankle, 0.2);
      target.copy(ankle); target.x = THREE.MathUtils.lerp(ankle.x, leg.anchor.x, weight);
      target.z = THREE.MathUtils.lerp(ankle.z, leg.anchor.z, weight);
      direction.copy(target).sub(hip);
      const distance = THREE.MathUtils.clamp(direction.length(), Math.abs(first - second) + 0.001, length * 0.998);
      direction.normalize(); target.copy(hip).addScaledVector(direction, distance);
      pole.copy(knee).sub(hip); pole.addScaledVector(direction, -pole.dot(direction));
      if (pole.lengthSq() < 1e-8) { pole.set(0, 0, 1); pole.addScaledVector(direction, -pole.dot(direction)); }
      if (pole.lengthSq() < 1e-8) pole.set(1, 0, 0);
      pole.normalize();
      const along = (first * first - second * second + distance * distance) / (2 * distance);
      desiredKnee.copy(hip).addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, first * first - along * along)));
      leg.foot.getWorldQuaternion(footRotation);
      aim(leg.upper, hip, knee, desiredKnee);
      leg.lower.getWorldPosition(knee); leg.foot.getWorldPosition(ankle);
      aim(leg.lower, knee, ankle, target);
      // Ankle orientation stays captured, so heel/toe pivots remain visible.
      leg.foot.parent.getWorldQuaternion(parentRotation).invert();
      leg.foot.quaternion.copy(parentRotation.multiply(footRotation)); leg.foot.updateWorldMatrix(false, true);
    }
  };
}
