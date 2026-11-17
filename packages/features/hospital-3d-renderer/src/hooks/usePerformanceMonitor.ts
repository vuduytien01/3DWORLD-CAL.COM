"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Timer } from "three";

interface PerformanceStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  memory: number; // MB
}

interface UsePerformanceMonitorOptions {
  enabled?: boolean;
  sampleInterval?: number; // ms
}

/**
 * Performance monitor using THREE.Timer and renderer.info
 * Provides live FPS, draw calls, triangles, and memory stats
 */
export function usePerformanceMonitor({ enabled = false, sampleInterval = 1000 }: UsePerformanceMonitorOptions) {
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 0,
    frameMs: 0,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    memory: 0,
  });

  const timerRef = useRef<Timer | null>(null);
  const rendererRef = useRef<any>(null);
  const frameCountRef = useRef(0);
  const lastSampleRef = useRef(0);
  const accumTimeRef = useRef(0);

  const getRenderer = useCallback(() => {
    // This would be set by the Canvas onCreated callback
    return rendererRef.current;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const timer = new Timer();
    timer.connect(document);
    timerRef.current = timer;

    const updateStats = () => {
      const renderer = getRenderer();
      if (!renderer || !renderer.info) return;

      const now = performance.now();
      const delta = now - lastSampleRef.current;
      lastSampleRef.current = now;

      // Calculate FPS from Timer
      timer.update();
      const fps = 1 / timer.getDelta();

      // renderer.info (resets each frame by default)
      const info = renderer.info;
      const drawCalls = info.render?.calls ?? 0;
      const triangles = info.render?.triangles ?? 0;
      const geometries = info.memory?.geometries ?? 0;
      const textures = info.memory?.textures ?? 0;

      // Estimate GPU memory (rough approximation)
      // Each geometry ~ vertices * 12 bytes (3 floats * 4 bytes)
      // Each texture ~ 4 bytes/pixel * mip chain (1.33x)
      let memoryMB = 0;
      // We can't easily get exact memory, but we can estimate from counts
      // For now, just track counts

      setStats({
        fps: Math.round(fps),
        frameMs: Math.round(timer.getDelta() * 1000 * 100) / 100,
        drawCalls,
        triangles,
        geometries,
        textures,
        memory: 0, // placeholder
      });
    };

    const interval = setInterval(updateStats, 1000);
    return () => clearInterval(interval);
  }, [enabled, getRenderer]);

  // Expose renderer ref for Canvas onCreated
  const setRenderer = useCallback((gl: any) => {
    rendererRef.current = gl;
  }, []);

  return { stats, enabled, setRenderer };
}