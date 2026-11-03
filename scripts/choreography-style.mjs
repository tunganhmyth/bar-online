import * as THREE from 'three';

const TAU = Math.PI * 2;
const offset = new THREE.Quaternion(), euler = new THREE.Euler();
const smooth = (v) => { const t = THREE.MathUtils.clamp(v, 0, 1); return t * t * (3 - 2 * t); };
function rotate(pose, bone, x = 0, y = 0, z = 0) {
  if (pose.rotations[bone]) pose.rotations[bone].multiply(offset.setFromEuler(euler.set(x, y, z, 'YXZ')));
}

// Small anatomical accents over captured steps, keeping captured balance.
export function stylePose(pose, plan, counts, section, special) {
  const phase = plan.phases[section % plan.phases.length];
  const localCounts = counts % (special ? 4 : 8);
  const edge = smooth(localCounts / 0.7) * smooth(((special ? 4 : 8) - localCounts) / 0.7);
  const strength = plan.strength * edge * (special ? 1 - smooth((counts - 10.4) / 1.3) : 1);
  const b = counts * TAU, wave = /WAVE|ROLL|FLOW/.test(phase);
  const ripple = counts * Math.PI * (wave ? 0.5 : 1);
  if (/HEEL TOE|QUICK STEP|DOUBLE STEP|KNEE SWITCH|KICK CHANGE/.test(phase) || (special && section === 1)) {
    for (const [side, sign] of [['left', 1], ['right', -1]]) {
      const lift = Math.pow(Math.max(0, Math.sin(b + (sign < 0 ? Math.PI : 0))), 2);
      const amount = strength * (plan.body === 'male' ? 1 : 0.8);
      rotate(pose, `${side}UpperLeg`, -0.13 * lift * amount, sign * 0.05 * Math.sin(b) * amount);
      rotate(pose, `${side}LowerLeg`, 0.22 * lift * amount);
      rotate(pose, `${side}Foot`, -0.09 * lift * amount, sign * 0.13 * Math.sin(b) * amount);
    }
  }
  if (plan.body === 'female') {
    const sway = Math.sin(b / 4), eight = Math.sin(b / 2 + 0.3);
    rotate(pose, 'hips', (wave ? 0.17 : 0.065) * Math.sin(ripple) * strength, 0.13 * eight * strength, 0.115 * sway * strength);
    rotate(pose, 'spine', (wave ? 0.20 : 0.07) * Math.sin(ripple - 0.8) * strength, -0.07 * eight * strength, -0.075 * sway * strength);
    rotate(pose, 'chest', (wave ? 0.18 : 0.065) * Math.sin(ripple - 1.65) * strength,
      0.08 * Math.sin(b / 4 + 0.7) * strength, -0.06 * Math.sin(b / 4 - 0.5) * strength);
    rotate(pose, 'neck', -0.04 * Math.sin(ripple - 2.2) * strength, 0.035 * Math.sin(b / 8) * strength);
    pose.position.x += 0.025 * sway * strength;
    for (const [side, sign] of [['left', 1], ['right', -1]]) {
      const t = ripple - sign * 0.6;
      rotate(pose, `${side}Shoulder`, 0.045 * Math.sin(t - 1.2) * strength, 0, sign * 0.025 * Math.cos(t) * strength);
      rotate(pose, `${side}Hand`, 0.07 * Math.sin(t - 2.0) * strength, sign * 0.035, sign * (0.08 + 0.045 * Math.sin(t - 2.6)) * strength);
    }
  } else {
    const hit = Math.exp(-Math.pow(((counts + 0.12) % 1) - 0.16, 2) / 0.012);
    const pulse = /LOCK|POP|TUT|HIT/.test(phase) ? hit : 0.25 * hit;
    rotate(pose, 'hips', (wave ? 0.13 : 0.035) * Math.sin(ripple) * strength, 0.065 * Math.sin(b / 4) * strength, 0.035 * Math.sin(b / 2) * strength);
    rotate(pose, 'spine', (wave ? 0.22 : 0.055) * Math.sin(ripple - 0.9) * strength, 0.075 * Math.sin(b / 4) * strength);
    rotate(pose, 'chest', ((wave ? 0.20 : 0.045) * Math.sin(ripple - 1.8) - 0.10 * pulse) * strength,
      -0.09 * Math.sin(b / 4 - 0.3) * strength, 0.04 * Math.sin(b / 2) * strength);
    rotate(pose, 'neck', -0.045 * strength, -0.04 * Math.sin(b / 8) * strength);
    rotate(pose, 'head', 0.025 * Math.sin(ripple - 2.4) * strength);
    for (const [side, sign] of [['left', 1], ['right', -1]]) {
      const t = ripple + sign * 0.8;
      rotate(pose, `${side}Shoulder`, (0.055 * Math.sin(t) - pulse * 0.055) * strength, sign * pulse * 0.04);
      rotate(pose, `${side}LowerArm`, 0.04 * Math.sin(t - 0.9) * strength, sign * 0.04 * Math.sin(t - 1.4) * strength);
      rotate(pose, `${side}Hand`, 0.07 * Math.sin(t - 2.3) * strength, 0, sign * 0.045 * Math.sin(t - 2.8) * strength);
    }
  }
  return pose;
}
