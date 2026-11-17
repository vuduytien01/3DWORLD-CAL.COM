import { Timer } from "three";

/**
 * Performance monitoring utilities using renderer.info and THREE.Timer
 */

export interface PerformanceMetrics {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
  programs: number;
  geometryBytes: number;
  textureBytes: number;
  attributeBytes: number;
  totalMemoryMB: number;
}

let timerInstance: any = null;
let frameCount = 0;
let lastTime = 0;
let accumTime = 0;

export function getTimer(): Timer {
  if (!timerInstance) {
    timerInstance = new Timer();
    timerInstance.connect(document);
  }
  return timerInstance;
}

export function startPerformanceTracking(renderer: any): () => void {
  const timer = getTimer();
  let frameCount = 0;
  let lastTime = performance.now();

  const update = () => {
    timer.update();
    frameCount++;

    const now = performance.now();
    const delta = now - lastTime;

    if (delta >= 1000) {
      const fps = (frameCount * 1000) / delta;
      const info = renderer.info;

      console.log(`[Perf] FPS: ${fps.toFixed(1)} | Draw calls: ${info.render?.calls} | Triangles: ${info.render?.triangles} | Geometries: ${info.memory?.geometries} | Textures: ${info.memory?.textures} | Memory: ${(info.memory?.textures * 4 * 1.33 / 1024 / 1024).toFixed(1)} MB est.`);

      frameCount = 0;
      lastTime = now;
    }
  };

  const animate = () => {
    update();
    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);

  return () => {
    // cleanup
  };
}

export function getPerformanceMetrics(renderer: any): any {
  const info = renderer.info;
  const timer = getTimer();

  return {
    fps: 1 / timer.getDelta(),
    frameMs: timer.getDelta() * 1000,
    drawCalls: info.render?.calls || 0,
    triangles: info.render?.triangles || 0,
    points: info.render?.points || 0,
    lines: info.render?.lines || 0,
    geometries: info.memory?.geometries || 0,
    textures: info.memory?.textures || 0,
    programs: info.programs?.length || 0,
    // Memory estimates (rough)
    geometryBytes: 0, // would need custom tracking
    textureBytes: info.memory?.textures * 4 * 1024 * 1024 * 1.33 || 0, // rough estimate
    attributeBytes: 0,
    totalMemoryMB: 0,
  };
}

export function checkPerformanceTargets(metrics: any, targets: { maxDrawCalls?: number; maxTriangles?: number; maxFrameMs?: number } = {}): { passed: boolean; violations: string[] } {
  const violations: string[] = [];

  if (targets.maxDrawCalls && metrics.drawCalls > targets.maxDrawCalls) {
    violations.push(`Draw calls: ${metrics.drawCalls} > ${targets.maxDrawCalls}`);
  }

  if (targets.maxTriangles && metrics.triangles > targets.maxTriangles) {
    violations.push(`Triangles: ${metrics.triangles} > ${targets.maxTriangles}`);
  }

  if (targets.maxFrameMs && metrics.frameMs > targets.maxFrameMs) {
    violations.push(`Frame time: ${metrics.frameMs.toFixed(2)}ms > ${targets.maxFrameMs}ms`);
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}