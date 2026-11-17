# 013 — Add inertia/damping to free camera (WASD + Q/E)

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: MEDIUM
- **Category**: Physicality & origin / Interruptibility
- **Estimated scope**: 1 file, ~30 lines changed (`apps/web/app/hospital-demo/page.tsx`)

## Problem

Free camera mode (F key, WASD + Q/E) moves the camera instantly with no inertia or damping. Per AUDIT §3: "Press feedback: `transform: scale(0.97)` on `:active`... Keep it subtle." And §4: "Gesture-driven motion should use springs — they carry velocity when interrupted." The current implementation at `page.tsx:349-373` applies velocity directly to position each frame with no damping:

```ts
if (keys.has('w')) {
  cam.position.x += Math.sin(cam.yaw) * moveSpeed * dt;
  cam.position.z += Math.cos(cam.yaw) * moveSpeed * dt;
}
```

This feels "floaty" and unresponsive — no sense of mass or momentum.

## Target

Add velocity state with spring-like damping to free camera movement:
- **Velocity state**: `velocityRef = useRef({ x: 0, z: 0, y: 0 })`
- **Acceleration**: input keys add to velocity (not position directly)
- **Damping**: `velocity *= 0.9` per frame (adjustable)
- **Position update**: `position += velocity * dt`
- **Stop threshold**: if `|velocity| < 0.01`, set to 0 (prevents infinite drift)

This creates a "heavy" camera feel that responds to input but settles naturally.

## Repo conventions to follow

- Free camera state already in `freeCameraRef` (position, target, pitch, yaw)
- Add `velocityRef` alongside it
- Use `dt` from tick loop for frame-rate independence
- Reduced motion: instant stop (no inertia) when `reducedMotion` is true

## Steps

1. **Add velocity ref** at line 293 (after `lastFreeUpdateMs`):
   ```tsx
   const velocityRef = useRef({ x: 0, z: 0, y: 0 });
   const DAMPING = 0.92; // per-frame multiplier (tune for feel)
   const ACCELERATION = 40; // meters/s² (moveSpeed * ACCELERATION)
   ```

2. **Modify free camera movement** (lines 349-373) to use velocity:
   ```tsx
   // Acceleration from input
   if (keys.has('w')) {
     velocityRef.current.x += Math.sin(cam.yaw) * ACCELERATION * dt;
     velocityRef.current.z += Math.cos(cam.yaw) * ACCELERATION * dt;
   }
   if (keys.has('s')) {
     velocityRef.current.x -= Math.sin(cam.yaw) * ACCELERATION * dt;
     velocityRef.current.z -= Math.cos(cam.yaw) * ACCELERATION * dt;
   }
   if (keys.has('a')) {
     velocityRef.current.x -= Math.cos(cam.yaw) * ACCELERATION * dt;
     velocityRef.current.z += Math.sin(cam.yaw) * ACCELERATION * dt;
   }
   if (keys.has('d')) {
     velocityRef.current.x += Math.cos(cam.yaw) * ACCELERATION * dt;
     velocityRef.current.z -= Math.sin(cam.yaw) * ACCELERATION * dt;
   }
   if (keys.has('q')) velocityRef.current.y += ACCELERATION * dt;
   if (keys.has('e')) velocityRef.current.y -= ACCELERATION * dt;

   // Damping
   if (!reducedMotion) {
     velocityRef.current.x *= DAMPING;
     velocityRef.current.z *= DAMPING;
     velocityRef.current.y *= DAMPING;
   } else {
     velocityRef.current.x = 0;
     velocityRef.current.z = 0;
     velocityRef.current.y = 0;
   }

   // Stop threshold
   if (Math.abs(velocityRef.current.x) < 0.01) velocityRef.current.x = 0;
   if (Math.abs(velocityRef.current.z) < 0.01) velocityRef.current.z = 0;
   if (Math.abs(velocityRef.current.y) < 0.01) velocityRef.current.y = 0;

   // Apply velocity to position
   cam.position.x += velocityRef.current.x * dt;
   cam.position.z += velocityRef.current.z * dt;
   cam.position.y += velocityRef.current.y * dt;
   ```

3. **Rotation** (pitch/yaw) — keep instant for now, or add similar damping if desired

## Boundaries

- **Do NOT change** demo mode camera (choreography) — only free camera
- **Do NOT change** rotation controls (Arrow keys) — keep instant
- **Respect** `reducedMotion` → instant stop, no inertia
- **Do NOT add** new dependencies

## Verification

### Mechanical
```bash
cd packages/features/hospital-pipeline && bunx tsc --noEmit
cd packages/features/hospital-pipeline && bunx vitest run
```

### Feel check
1. Run demo, press **F** for free camera
2. **Hold W** → camera accelerates smoothly, continues moving after release, slows to stop
3. **Tap W briefly** → camera moves a short distance, settles
4. **Change direction** (W then S) → camera slows, reverses smoothly
5. **Reduced motion** → camera moves only while key held, stops instantly on release
6. **No drift** → camera stops completely when velocity < threshold
7. No regression on demo mode or keyboard controls (Space, 1-9, etc.)

### Done when
- Type-check + unit tests pass
- Free camera has natural inertia/damping
- Reduced motion disables inertia
- No regression on demo mode