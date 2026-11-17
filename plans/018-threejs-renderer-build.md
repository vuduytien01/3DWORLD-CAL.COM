# 018 — Build Three.js/R3F renderer using 3D world data layer

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: HIGH
- **Category**: Performance / 3D Renderer
- **Estimated scope**: Multiple files, new package `@calcom/features/hospital-3d-renderer`

## Problem

The HTML5 Canvas 2D renderer (ADR 0003) works but has limitations:
- No true 3D (isometric projection only)
- No GPU acceleration for complex scenes
- Limited to ~18k tris for 10 floors

The 3D world data layer (`lib/3d-world/`) already exists with:
- 6 departments × 2 floors = 12 department slices
- 14 furniture kinds with presets
- 60+ rooms with furniture placement
- Stairwell + elevator shaft
- Two-tier signage

**Target**: Build Three.js/R3F renderer achieving **<300 draw calls**, **~18k tris**, **60fps on Intel Iris Xe** (integrated GPU).

## Target Architecture

### Package Structure
```
packages/features/hospital-3d-renderer/
├── src/
│   ├── Hospital3DScene.tsx          # Main R3F scene component
│   ├── hooks/
│   │   ├── useHospitalWorld.ts      # Loads slices, builds scene graph
│   │   ├── useCameraController.ts   # Orbit + follow + dollhouse modes
│   │   └── usePerformanceMonitor.ts # renderer.info tracking
│   ├── components/
│   │   ├── FloorSlice.tsx           # Instanced floor slab + walls
│   │   ├── DepartmentSlice.tsx      # Department with rooms + furniture
│   │   ├── FurnitureInstance.tsx    # InstancedMesh per furniture kind
│   │   ├── Stairwell.tsx            # Stair geometry
│   │   ├── Elevator.tsx             # Elevator shaft + cabin
│   │   ├── Signage.tsx              # Instanced sign meshes
│   │   ├── PatientAvatar.tsx        # Animated patient (L1 poses)
│   │   └── LightingSetup.tsx        # Optimized lighting
│   ├── utils/
│   │   ├── instancedFurniture.ts    # InstancedMesh builders
│   │   ├── mergedGeometry.ts        # BufferGeometryUtils.mergeGeometries
│   │   ├── ktx2Loader.ts            # KTX2 texture loading
│   │   └── performance.ts           # renderer.info helpers
│   └── index.ts                     # Exports
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Performance Targets (from `threejs-performance` skill)

| Metric | Target | Skill Reference |
|--------|--------|-----------------|
| Draw calls | <300 | `InstancedMesh`, `BatchedMesh`, merge static geometry |
| Triangles | ~18k | LOD, merge static, culling |
| Frame time | ≤16.7ms (60fps) | `renderer.info`, `THREE.Timer` |
| GPU memory | <200MB | KTX2 textures, disposal |
| Shader compiles | 0 at runtime | `renderer.compileAsync()` |

## Key Optimizations (per `threejs-performance` skill)

### 1. InstancedMesh for Furniture (14 kinds × 120 instances)
```typescript
// One InstancedMesh per furniture kind, not per room
const furnitureMesh = new InstancedMesh(geometry, material, count);
furnitureMesh.instanceMatrix.setUsage(DynamicDrawUsage);
furnitureMesh.count = count;
```

### 2. Merge Static Geometry (Floors, Walls, Corridors)
```typescript
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
const mergedFloor = BufferGeometryUtils.mergeGeometries(floorGeometries);
const mergedWalls = BufferGeometryUtils.mergeGeometries(wallGeometries);
```

### 3. BatchedMesh for Signage (different geometries, same material)
```typescript
const batchedSigns = new BatchedMesh(maxSigns, maxVertices, maxIndices, material);
```

### 4. KTX2 Compressed Textures
```typescript
const ktx2Loader = new KTX2Loader().detectSupport(renderer);
const map = await ktx2Loader.loadAsync('texture.ktx2');
map.colorSpace = THREE.SRGBColorSpace;
```

### 5. Frustum Culling + LOD
```typescript
mesh.frustumCulled = true;
const lod = new LOD();
lod.addLevel(highDetail, 0);
lod.addLevel(mediumDetail, 15);
lod.addLevel(lowDetail, 40);
```

### 6. Static Transforms (matrixAutoUpdate = false)
```typescript
mesh.matrixAutoUpdate = false;
mesh.updateMatrix(); // once at init
```

### 7. Shadow Optimization
```typescript
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false; // freeze for static scenery
sun.shadow.mapSize.set(1024, 1024);
```

### 8. Shader Pre-compilation
```typescript
await renderer.compileAsync(scene, camera);
```

## Implementation Steps

### Phase 1: Package Setup & Core Types
1. Create `packages/features/hospital-3d-renderer/` with package.json
2. Export types from `lib/3d-world/` as shared dependency
3. Set up R3F with proper TS config

### Phase 2: Scene Graph & Instanced Furniture
1. `useHospitalWorld` hook loads all floor slices
2. Build `InstancedMesh` per furniture kind (14 kinds)
3. Create `FurnitureInstance` component with per-instance transforms

### Phase 3: Static Geometry Merging
1. Merge floor slabs, walls, corridors per floor
2. Create `FloorSlice` component with merged geometry
3. Stairwell + elevator as separate merged meshes

### Phase 4: Lighting & Shadows
1. Directional light (sun) + Hemisphere light (ambient)
2. Freeze shadow maps (`autoUpdate = false`)
2. Bake shadow maps once at init

### Phase 5: Camera Controller
1. OrbitControls for free camera
2. Follow mode (smooth lerp to patient)
3. Dollhouse mode (fixed isometric)
4. Smooth floor transitions

### Phase 6: Performance & Polish
1. `renderer.compileAsync(scene, camera)` at load
2. Performance monitor (draw calls, tris, FPS)
3. LOD for distant furniture
4. KTX2 texture pipeline

## Verification

### Mechanical
```bash
cd packages/features/hospital-3d-renderer && bunx tsc --noEmit
cd packages/features/hospital-3d-renderer && bunx vitest run
```

### Performance Verification (on Intel Iris Xe)
1. Run demo, open DevTools Performance panel
2. Record 30s, check:
   - Draw calls < 300
   - Triangles ~18k
   - Frame time ≤16.7ms (60fps)
   - GPU memory <200MB
4. `renderer.info` overlay shows live stats

### Feel Check
1. Orbit camera — smooth 60fps
2. Follow patient — smooth lerp, no jitter
3. Floor transition — smooth elevator/stair animation
4. All furniture visible, correct positions

## Dependencies
- `three` (r186+)
- `@react-three/fiber` (latest)
- `@react-three/drei` (for helpers)
- `three-mesh-bvh` (optional, for raycasting)
- `ktx-parse` + `ktx2-loader` (for textures)

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Too many draw calls | Profile early, merge more, instance more |
| Shader compile stalls | `compileAsync` at load, avoid runtime material changes |
| Memory on Iris Xe | KTX2 textures, dispose unused, limit texture sizes |
| Animation jitter | Fixed timestep, `THREE.Timer`, velocity-based movement |