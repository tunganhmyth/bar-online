import * as THREE from 'three';

export function createDanceHands(humanoid, body, legacy) {
  const joints = [], euler = new THREE.Euler(), rotation = new THREE.Quaternion();
  for (const [side, sign] of [['left', 1], ['right', -1]]) {
    for (const [finger, ordinal] of ['Thumb', 'Index', 'Middle', 'Ring', 'Little'].map((name, i) => [name, i])) {
      const segments = finger === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal'];
      segments.forEach((segment, index) => {
        const node = humanoid.getNormalizedBoneNode(`${side}${finger}${segment}`);
        if (node) joints.push({ node, rest: node.quaternion.clone(), sign: sign * (legacy ? -1 : 1), finger: ordinal, segment: index });
      });
    }
  }
  return (counts, signature) => {
    const female = body === 'female';
    const hit = Math.pow(Math.max(0, Math.cos(counts * Math.PI)), 12);
    for (const joint of joints) {
      const ripple = Math.sin(counts * Math.PI / 2 - joint.finger * 0.55 - joint.segment * 0.3);
      const curl = female ? 0.19 + 0.12 * ripple + (signature ? 0.07 : 0)
        : 0.32 + 0.12 * ripple + hit * (signature ? 0.48 : 0.27);
      const strength = [0.8, 1, 0.7][joint.segment];
      if (joint.finger === 0) euler.set(0, -joint.sign * curl * 0.35, -joint.sign * curl * 0.2);
      else euler.set(0, joint.segment === 0 ? joint.sign * (joint.finger - 2.5) * (female ? 0.025 : 0.012) : 0, -joint.sign * curl * strength);
      joint.node.quaternion.copy(joint.rest).multiply(rotation.setFromEuler(euler));
    }
  };
}
