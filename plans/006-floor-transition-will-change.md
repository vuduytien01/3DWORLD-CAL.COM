# 006 — Add temporary will-change during floor transitions

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 1 file, ~8 lines changed (`packages/features/hospital-pipeline/lib/html5-world/html5-floor-renderer.tsx`)

## Problem

Floor transition at `html5-floor-renderer.tsx:375-417` animates `translateY` + `opacity` on full-viewport `.html5-floor-group` elements for 300ms. While `transform` + `opacity` are composite-only, the transition runs during camera motion (the choreography triggers floor changes), competing for GPU bandwidth. No `will-change` hint means the browser may promote layers mid-animation, causing a frame hitch.

AUDIT §5: "Where it earns its place is an expensive paint... Promote it and keep the layer small." The floor group is full-viewport but short-lived (300ms). Add `will-change: transform, opacity` inline only during transition, remove after.

## Target

In `repositionOverlay()`, when floor transition starts (`floorTransitionDirection` set), add `willChange` to the animating groups. When transition completes (`progress >= 1`), remove it.

```tsx
// At transition start (after line 382 where floorTransitionDirection is set):
overlayFloors.forEach((group) => {
  group.style.willChange = 'transform, opacity';
});

// At transition end (after line 417 where buildOverlay is called):
overlayFloors.forEach((group) => {
  group.style.willChange = 'auto';
});
```

## Repo conventions to follow

- No global `will-change` in CSS (plan 003 removed them) — inline only when animating
- `will-change: transform, opacity` matches the animated properties
- Set/clear in the same transition block to avoid leaks

## Steps

1. **Add at line 383** (after `floorTransitionDirection = newFocus > oldFocus ? "up" : "down";`): loop `overlay.querySelectorAll(".html5-floor-group")` and set `style.willChange = 'transform, opacity'`
2. **Add at line 418** (after `buildOverlay(camera.focusFloor);`): loop again and set `style.willChange = 'auto'`
3. **Handle early exit**: if transition is interrupted (shouldn't happen, but safe), ensure cleanup in `return` cleanup function

## Boundaries

- **Do NOT add** `will-change` to CSS block (removed in plan 003)
- **Do NOT change** transition duration (300ms), easing (easeOut cubic), or translateY percentages
- **Do NOT touch** patient marker or room hover code

## Verification

### Mechanical
```bash
cd packages/features/hospital-pipeline && bunx tsc --noEmit
cd packages/features/hospital-pipeline && bunx vitest run
```

### Feel check
1. Run demo, wait for floor transition (or use keyboard 1-9 to jump steps)
2. DevTools Performance panel — record during transition
3. **Confirm**: no "Composite Layers" promotion spike at transition start
4. **Confirm**: frame time stays smooth during transition + camera motion
5. GPU memory: no permanent layer promotion (will-change cleared after 300ms)

### Done when
- Type-check + unit tests pass
- DevTools confirms will-change set/cleared correctly
- No frame hitch at transition start