import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import * as THREE from 'three';
import { createCharacterRig } from '../character-rig-three';
import { CHARACTER_NODE_NAMES, resetCharacterRig } from '../character-poses';

describe('createCharacterRig (T-14)', () => {
  let rig: ReturnType<typeof createCharacterRig>;

  beforeEach(() => {
    rig = createCharacterRig();
  });

  afterEach(() => {
    resetCharacterRig(rig);
  });

  it('tạo đúng 11 node Object3D (9 core + 2 arms)', () => {
    expect(rig).toBeInstanceOf(THREE.Group);
    for (const name of CHARACTER_NODE_NAMES) {
      const node = rig.getObjectByName(name);
      expect(node, `missing node: ${name}`).toBeInstanceOf(THREE.Object3D);
    }
  });

  it('hierarchy đúng: pelvis > spine > head, pelvis > legs, pelvis > arms', () => {
    const pelvis = rig.getObjectByName('root');
    const spine = rig.getObjectByName('spine')!;
    const head = rig.getObjectByName('head')!;
    const leftThigh = rig.getObjectByName('leftThigh')!;
    const leftShin = rig.getObjectByName('leftShin')!;
    const leftFoot = rig.getObjectByName('leftFoot')!;
    const rightThigh = rig.getObjectByName('rightThigh')!;
    const rightShin = rig.getObjectByName('rightShin')!;
    const rightFoot = rig.getObjectByName('rightFoot')!;
    const leftArm = rig.getObjectByName('leftArm')!;
    const rightArm = rig.getObjectByName('rightArm')!;

    expect(pelvis).toBeDefined();
    expect(spine.parent).toBe(pelvis);
    expect(head.parent).toBe(spine);
    expect(leftThigh.parent).toBe(pelvis);
    expect(leftShin.parent).toBe(leftThigh);
    expect(leftFoot.parent).toBe(leftShin);
    expect(rightThigh.parent).toBe(pelvis);
    expect(rightShin.parent).toBe(rightThigh);
    expect(rightFoot.parent).toBe(rightShin);
    expect(leftArm.parent).toBe(pelvis);
    expect(rightArm.parent).toBe(pelvis);
  });

  it('tất cả node rotation khởi tạo = 0', () => {
    for (const name of CHARACTER_NODE_NAMES) {
      const node = rig.getObjectByName(name)!;
      expect(node.rotation.x).toBe(0);
      expect(node.rotation.y).toBe(0);
      expect(node.rotation.z).toBe(0);
    }
  });
});
