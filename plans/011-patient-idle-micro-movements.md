# 011 — Add patient idle micro-movements (breathing, sway, blink)

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: MEDIUM
- **Category**: Physicality & origin / Missed opportunity
- **Estimated scope**: 1 file, ~30 lines changed (`packages/features/hospital-pipeline/lib/3d-world/character-poses.ts`)

## Problem

The patient idle pose (`computeIdlePose` in `character-poses.ts`) uses a simple breath/sway cycle driven by `idleTimeS`. The current implementation likely has basic sinusoidal movement. Per AUDIT §3: "Nothing in the real world appears from nothing" and §8: "Rare, high-emotion moments rendered with none of the delight budget they're allowed." A stationary patient should feel alive with subtle micro-movements: breathing (chest), weight shift (hips), occasional blink (head), micro-sway.

## Target

Enhance `computeIdlePose` in `character-poses.ts` to add:
1. **Breathing** (chest/spine): 0.3 Hz, 0.02 rad rotation on X axis
2. **Weight shift** (hips/root): 0.15 Hz, 0.015 rad on Z axis
3. **Micro-sway** (spine): 0.1 Hz, 0.01 rad on X/Z combined
4. **Head micro-movement**: 0.2 Hz, 0.01 rad on Y (looking around)

All using `easeInOutSine` from motion-tokens for natural easing.

Current `computeIdlePose` signature at `character-poses.ts:160`:
```ts
export function sampleCharacterPose(input: CharacterPoseInput): CharacterPoseState {
  if (input.walking) { ... }
  return computeIdlePose(HEADLESS_RIG, input.idleTimeS);
}
```

## Repo conventions to follow

- Motion tokens from `motion-tokens.ts` — use `easeInOutSine` (cubic-bezier equivalent)
- Walk constants from `motion-tokens.ts` — `WALK_CYCLE_HZ` etc.
- Character pose math is renderer-free in `lib/3d-world/character-poses.ts`
- Pure functions, no side effects

## Steps

1. **Read current `computeIdlePose`** in `character-poses.ts` to understand existing breath/sway
2. **Add micro-movement layers** to the idle pose computation:
   - Chest breath: `spine.rotation.x += Math.sin(idleTimeS * 2 * Math.PI * 0.3) * 0.02 * easeInOutSine(phase)`
   - Hip weight shift: `root.rotation.z += Math.sin(idleTimeS * 2 * Math.PI * 0.15) * 0.015 * easeInOutSine(phase)`
   - Spine micro-sway: `spine.rotation.x += Math.sin(idleTimeS * 2 * Math.PI * 0.1) * 0.01 * easeInOutSine(phase)`
   - Head look: `head.rotation.y += Math.sin(idleTimeS * 2 * Math.PI * 0.2) * 0.01 * easeInOutSine(phase)`
3. **Use `easeInOutSine` from motion-tokens** (import at top)
4. **Ensure reduced motion compatibility** — when `reducedMotion` is true, skip micro-movements (handled upstream in `sampleCharacterPose`)

## Boundaries

- **Do NOT change** walk cycle (`computeWalkPose`) — only idle
- **Do NOT change** `sampleCharacterPose` signature or walk logic
- **Do NOT add** new dependencies
- **Keep** existing breath/sway if present; add layers on top

## Verification

### Mechanical
```bash
cd packages/features/hospital-pipeline && bunx tsc --noEmit
cd packages/features/hospital-pipeline && bunx vitest run
```

### Feel check
1. Run demo, pause (Space) during action segment (patient standing)
2. **Observe patient** for 10+ seconds:
   - Chest rises/falls visibly (breathing)
   - Hips shift weight side-to-side slowly
   - Head makes micro-movements (looking around)
   - All movements feel organic, not mechanical
3. **Reduced motion** → patient stands perfectly still (no micro-movements)
4. **Walk segments** → micro-movements disabled, walk cycle takes over
5. No regression on walk cycle or floor transitions

### Done when
- Type-check + unit tests pass
- Idle patient shows breathing, weight shift, micro-sway, head movement
- Reduced motion disables all micro-movements
- Walk cycle unaffected