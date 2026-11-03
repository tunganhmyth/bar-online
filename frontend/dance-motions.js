import * as THREE from 'three';
import { createFootPlantSolver } from './dance-foot-ik.js';

export async function loadDanceMotions() {
  const response = await fetch('/animations/dance-motions.json?v=style3');
  if (!response.ok) throw new Error('Không tải được bộ động tác nhảy.');
  return response.json();
}

export function createDanceClip(humanoid, motion, special, legacy = false) {
  const data = special ? motion.skill : motion.dance;
  const frameCount = data.positions.length / 3;
  const times = Array.from({ length: frameCount }, (_, i) => i * data.duration / (frameCount - 1));
  const hips = humanoid.getNormalizedBoneNode('hips');
  const rest = hips.position.clone();
  const scale = rest.y / motion.hipsHeight;
  const rotationTracks = [];
  const boneSamples = [];
  for (const [name, values] of Object.entries(data.rotations)) {
    const bone = humanoid.getNormalizedBoneNode(name);
    if (!bone) continue;
    const converted = legacy ? values.map((value, index) => index % 2 === 0 ? -value : value) : values;
    boneSamples.push({ bone, values: converted, baked: [] });
  }
  // Correct for the different leg lengths of the human capture and anime rig.
  // Ground the supporting foot instead of letting the body slide into the floor.
  const contacts = ['leftFoot', 'rightFoot', 'leftToes', 'rightToes'].map((name) => humanoid.getNormalizedBoneNode(name)).filter(Boolean);
  const scratch = new THREE.Vector3();
  const footRest = contacts.map((bone) => bone.getWorldPosition(scratch).y);
  const positions = [];
  const previous = humanoid.getNormalizedPose();
  const solvePlants = createFootPlantSolver(humanoid);
  for (let i = 0; i < frameCount; i++) {
    for (const { bone, values } of boneSamples) bone.quaternion.fromArray(values, i * 4);
    const facing = legacy ? -1 : 1;
    hips.position.set(rest.x + data.positions[i * 3] * scale * facing,
      rest.y + (data.positions[i * 3 + 1] - motion.hipsHeight) * scale, rest.z + data.positions[i * 3 + 2] * scale * facing);
    humanoid.normalizedHumanBonesRoot.updateMatrixWorld(true);
    const support = Math.min(...contacts.map((bone, index) => bone.getWorldPosition(scratch).y - footRest[index]));
    const airborne = (data.flight?.[i] || 0) * scale;
    hips.position.y += THREE.MathUtils.clamp(airborne - support, -0.5, 0.6);
    humanoid.normalizedHumanBonesRoot.updateMatrixWorld(true);
    solvePlants(data.contacts?.map((values) => values[i]), airborne);
    for (const { bone, baked } of boneSamples) baked.push(...bone.quaternion.toArray());
    positions.push(...hips.position.toArray());
  }
  // Close the baked IK pose over the final 0.3s, including the root height.
  if (!special) {
    const tail = Math.min(9, frameCount - 1), q = new THREE.Quaternion(), first = new THREE.Quaternion();
    for (let step = 1; step <= tail; step++) {
      const i = frameCount - 1 - tail + step, t = THREE.MathUtils.smoothstep(step / tail, 0, 1);
      for (const { baked } of boneSamples) {
        q.fromArray(baked, i * 4).slerp(first.fromArray(baked), t).toArray(baked, i * 4);
      }
      for (let axis = 0; axis < 3; axis++) positions[i * 3 + axis] = THREE.MathUtils.lerp(positions[i * 3 + axis], positions[axis], t);
    }
  }
  // Near a fully extended knee the IK solution can change quickly even when
  // the source is smooth. Filter and limit the baked legs as well as the source.
  const q = new THREE.Quaternion(), neighbour = new THREE.Quaternion();
  for (const { bone, baked } of boneSamples) {
    if (!/Leg|Foot|Toes/.test(bone.name)) continue;
    const original = baked.slice();
    for (let i = 1; i < frameCount - 1; i++) {
      q.fromArray(original, i * 4).slerp(neighbour.fromArray(original, (i - 1) * 4), 0.15)
        .slerp(neighbour.fromArray(original, (i + 1) * 4), 0.15).toArray(baked, i * 4);
    }
    for (const direction of [1, -1]) {
      const steps = special ? frameCount - 1 : frameCount - 2;
      for (let k = 1; k <= steps; k++) {
        const i = direction === 1 ? k : frameCount - 1 - k;
        q.fromArray(baked, (i - direction) * 4).rotateTowards(neighbour.fromArray(baked, i * 4), 0.42).toArray(baked, i * 4);
      }
    }
  }
  for (const { bone, baked } of boneSamples) rotationTracks.push(new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, baked));
  humanoid.setNormalizedPose(previous);
  rotationTracks.push(new THREE.VectorKeyframeTrack(`${hips.name}.position`, times, positions));
  return new THREE.AnimationClip(`${special ? 'skill' : 'dance'}:${motion.sourceClip}`, data.duration, rotationTracks);
}
