"use client";

import { useMemo } from "react";
import { DirectionalLight, HemisphereLight, AmbientLight } from "three";

/**
 * Optimized lighting setup for hospital scene.
 * Uses minimal lights for performance on integrated GPUs.
 */
export function LightingSetup() {
  // Sun light - main directional light with shadows
  const sunLight = useMemo(() => {
    const light = new DirectionalLight(0xffffff, 2.5);
    light.position.set(20, 30, 15);
    light.castShadow = true;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 100;
    light.shadow.camera.left = -30;
    light.shadow.camera.right = 30;
    light.shadow.camera.top = 30;
    light.shadow.camera.bottom = -30;
    light.shadow.bias = -0.0005;
    light.shadow.normalBias = 0.02;
    return light;
  }, []);

  // Hemisphere light for ambient fill (sky + ground)
  const hemiLight = useMemo(() => {
    const light = new HemisphereLight(0x88ccff, 0x443322, 0.6);
    light.position.set(0, 20, 0);
    return light;
  }, []);

  // Additional ambient for shadow fill
  const ambientLight = useMemo(() => {
    const light = new AmbientLight(0x404040, 0.3);
    return light;
  }, []);

  return (
    <>
      <primitive object={sunLight} />
      <primitive object={hemiLight} />
      <primitive object={ambientLight} />
    </>
  );
}