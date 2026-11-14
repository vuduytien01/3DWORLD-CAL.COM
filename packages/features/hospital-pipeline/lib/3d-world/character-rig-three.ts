/**
 * T-14 — Character L1 procedural rig, builder THREE.
 *
 * Cấu trúc phân cấp (tất cả Object3D, không skinning):
 * - root (pelvis)
 *   - spine
 *     - head
 *   - leftThigh
 *     - leftShin
 *       - leftFoot
 *   - rightThigh
 *     - rightShin
 *       - rightFoot
 *   - leftArm
 *   - rightArm
 *
 * Pose math thuần nằm ở character-poses.ts và chỉ cần PoseRig;
 * file này là một cài đặt THREE.Group của cùng bộ node.
 */

import * as THREE from 'three';

/**
 * Tạo bộ rig thủ tục 9+2 Object3D (không skinning, không bone).
 * Gọi 1 lần khi mount avatar, clone cho mỗi bệnh nhân nếu cần.
 */
export function createCharacterRig(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'character-rig';

  // Pelvis (root) — vị trí 0,0,0
  const pelvis = new THREE.Object3D();
  pelvis.name = 'root';
  root.add(pelvis);

  // Spine
  const spine = new THREE.Object3D();
  spine.name = 'spine';
  spine.position.set(0, 0.3, 0);
  pelvis.add(spine);

  // Head
  const head = new THREE.Object3D();
  head.name = 'head';
  head.position.set(0, 0.25, 0);
  spine.add(head);

  // Left leg chain
  const leftThigh = new THREE.Object3D();
  leftThigh.name = 'leftThigh';
  leftThigh.position.set(-0.08, -0.1, 0);
  pelvis.add(leftThigh);

  const leftShin = new THREE.Object3D();
  leftShin.name = 'leftShin';
  leftShin.position.set(0, -0.4, 0);
  leftThigh.add(leftShin);

  const leftFoot = new THREE.Object3D();
  leftFoot.name = 'leftFoot';
  leftFoot.position.set(0, -0.4, 0.05);
  leftShin.add(leftFoot);

  // Right leg chain
  const rightThigh = new THREE.Object3D();
  rightThigh.name = 'rightThigh';
  rightThigh.position.set(0.08, -0.1, 0);
  pelvis.add(rightThigh);

  const rightShin = new THREE.Object3D();
  rightShin.name = 'rightShin';
  rightShin.position.set(0, -0.4, 0);
  rightThigh.add(rightShin);

  const rightFoot = new THREE.Object3D();
  rightFoot.name = 'rightFoot';
  rightFoot.position.set(0, -0.4, 0.05);
  rightShin.add(rightFoot);

  // Arms
  const leftArm = new THREE.Object3D();
  leftArm.name = 'leftArm';
  leftArm.position.set(-0.18, 0.15, 0);
  pelvis.add(leftArm);

  const rightArm = new THREE.Object3D();
  rightArm.name = 'rightArm';
  rightArm.position.set(0.18, 0.15, 0);
  pelvis.add(rightArm);

  return root;
}
