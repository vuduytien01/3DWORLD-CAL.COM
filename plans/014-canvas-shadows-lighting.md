# 014 — Add Canvas 2D shadows and lighting for depth perception

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: MEDIUM
- **Category**: Physicality & origin / Missed opportunity
- **Estimated scope**: 1 file, ~50 lines changed (`packages/features/hospital-pipeline/lib/html5-world/html5-floor-renderer.tsx`)

## Problem

The HTML5 isometric renderer uses flat colors for boxes (walls, rooms, corridor). No shadows or lighting means:
- Hard to distinguish floor heights
- No depth perception for multi-floor dollhouse
- Rooms on different floors look identical

Per AUDIT §3: "Physicality & origin — shadows ground objects in space." §8: "Missed opportunity — spatial depth cues that don't animate but should."

## Target

Add simple Canvas 2D shadow/lighting system:
1. **Ambient occlusion** — darker colors for faces facing away from light
2. **Floor shadow** — subtle drop shadow under each floor group
3. **Directional light** — top-left light source (matches isometric azimuth)

### Light direction
Isometric camera azimuth ≈ -45° (from camera-adapter). Light from top-left (-45° azimuth, 45° elevation).

### Box face lighting
- **Top face** (y+): 100% brightness (full light)
- **Front face** (z+): 85% brightness
- **Side face** (x+): 70% brightness
- **Bottom/back**: 50% (ambient only)

### Floor shadow
- Draw semi-transparent ellipse under each floor's bounding box
- Offset by light direction: shadow offset ≈ (4px, 4px) at 1x DPR
- Color: `rgba(0, 0, 0, 0.15)` with blur

## Repo conventions to follow

- Drawing in `drawStatic` (static layer, only redraws on camera change)
- Colors from `HTML5_PALETTE` — multiply brightness
- Use `ctx.globalAlpha` for transparency
- Respect `DPR_CAP` for crisp shadows

## Steps

1. **Add light direction constants** at top of renderer (after `SIGN_FONT_STACK`):
   ```ts
   const LIGHT_DIR = { x: -0.707, y: 0.707, z: -0.707 }; // top-left, 45° elevation
   const FACE_BRIGHTNESS = { top: 1.0, front: 0.85, side: 0.7, back: 0.5 };
   const SHADOW_OFFSET = 4; // px at 1x DPR
   const SHADOW_COLOR = 'rgba(0, 0, 0, 0.15)';
   ```

2. **Add `applyLighting` helper** (after `drawSignOnCanvas`):
   ```ts
   function applyLighting(baseColor: string, face: 'top' | 'front' | 'side' | 'back'): string {
     const brightness = FACE_BRIGHTNESS[face];
     // Multiply RGB by brightness (assuming baseColor is hex)
     const r = parseInt(baseColor.slice(1, 3), 16);
     const g = parseInt(baseColor.slice(3, 5), 16);
     const b = parseInt(baseColor.slice(5, 7), 16);
     return `rgb(${Math.round(r * brightness)}, ${Math.round(g * brightness)}, ${Math.round(b * brightness)})`;
   }
   ```

3. **Modify `drawBox`** (lines 114-160) to use face-aware colors:
   - Top face: `applyLighting(color, 'top')`
   - Front face (z+): `applyLighting(color, 'front')`
   - Side face (x+): `applyLighting(color, 'side')`

4. **Add floor shadow drawing** in `drawStatic` (after floor loop, before sign loop):
   ```ts
   // Floor shadows
   for (const floor of world.floors) {
     if (overlayFloors.has(floor.floorIndex)) continue; // only background floors get shadows
     const bounds = floor.bounds; // { minX, maxX, minZ, maxZ }
     const shadowX = (bounds.minX + bounds.maxX) / 2 + SHADOW_OFFSET * size.dpr;
     const shadowZ = (bounds.minZ + bounds.maxZ) / 2 + SHADOW_OFFSET * size.dpr;
     const shadowW = (bounds.maxX - bounds.minX) * size.dpr;
     const shadowH = (bounds.maxZ - bounds.minZ) * size.dpr * 0.3; // ellipse height
     drawFloorShadow(staticCtx, shadowX, shadowZ, shadowW, shadowH, camera);
   }
   ```

5. **Add `drawFloorShadow` helper**:
   ```ts
   function drawFloorShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, camera: IsometricCamera): void {
     ctx.save();
     ctx.globalAlpha = 0.15;
     ctx.fillStyle = '#000000';
     ctx.beginPath();
     ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
     ctx.fill();
     ctx.restore();
   }
   ```

## Boundaries

- **Do NOT change** dynamic layer (patient, marker) — only static layer
- **Do NOT change** camera or choreography
- **Respect** `reducedMotion` — shadows are static, no animation impact
- **Do NOT add** WebGL shaders — pure Canvas 2D

## Verification

### Mechanical
```bash
cd packages/features/hospital-pipeline && bunx tsc --noEmit
cd packages/features/hospital-pipeline && bunx vitest run
```

### Feel check
1. Run demo, observe multi-floor view
2. **Confirm**: top faces brightest, side faces darker, back faces darkest
3. **Confirm**: subtle shadows under background floors
4. **Confirm**: depth perception improved — can distinguish floor heights
5. **Performance**: no frame time regression (shadows in static layer only)

### Done when
- Type-check + unit tests pass
- Visual depth improved on all floors
- No frame time regression