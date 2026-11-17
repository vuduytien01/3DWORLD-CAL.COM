"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { Vector3, Spherical, Quaternion } from "three";

interface CameraControllerOptions {
  mode: "demo" | "free" | "follow";
  patientState?: {
    x: number;
    y: number;
    z: number;
    headingRad?: number;
    walking?: boolean;
    walkPhase?: number;
  } | null;
  reducedMotion?: boolean;
  onFloorChange?: (floor: number) => void;
}

interface CameraControllerReturn {
  orbitRef: React.RefObject<any>;
  target: React.MutableRefObject<[number, number, number]>;
  currentFloor: number;
  setTarget: (target: [number, number, number] | null) => void;
  setMode: (mode: "demo" | "free" | "follow") => void;
}

/**
 * Camera controller with three modes:
 * - demo: choreographed camera path (handled externally)
 * - free: OrbitControls with WASD movement
 * - follow: smooth camera following patient
 */
export function useCameraController({
  mode,
  patientState,
  reducedMotion = false,
  onFloorChange,
}: CameraControllerOptions): CameraControllerReturn {
  const orbitRef = useRef<any>(null);
  const target = useRef<[number, number, number]>([0, 0, 0]);
  const [currentFloor, setCurrentFloor] = useState(0);
  const previousFloor = useRef(0);
  const isTransitioning = useRef(false);
  const transitionStart = useRef(0);

  // Set camera target
  const setTarget = useCallback((newTarget: [number, number, number] | null) => {
    if (newTarget) {
      target.current = newTarget;
    }
  }, []);

  const setMode = useCallback((newMode: "demo" | "free" | "follow") => {
    // Mode switching handled by parent
  }, []);

  // Floor tracking
  const updateFloor = useCallback((floor: number) => {
    setCurrentFloor(floor);
    if (onFloorChange && floor !== previousFloor.current) {
      previousFloor.current = floor;
      onFloorChange(floor);
    }
  }, [onFloorChange]);

  return {
    orbitRef,
    target,
    currentFloor,
    setTarget,
    setMode,
  };
}

/**
 * Smooth camera interpolation for follow mode
 */
export function useCameraFollow() {
  const target = useRef<[number, number, number]>([0, 0, 0]);
  const followOffset = useRef<[number, number, number]>([0, 5, -10]); // behind and above patient
  const followSpeed = 0.08; // lerp factor per frame

  const update = useCallback((patientPos: { x: number; y: number; z: number } | null, deltaTime: number) => {
    if (!patientPos) return;

    // Desired camera position: behind and above patient
    const desiredX = patientPos.x + followOffset.current[0];
    const desiredY = patientPos.y + followOffset.current[1];
    const desiredZ = patientPos.z + followOffset.current[2];

    // Smooth interpolation
    const lerpFactor = 1 - Math.pow(1 - followSpeed, deltaTime * 60); // frame-rate independent
    target.current[0] += (desiredX - target.current[0]) * lerpFactor;
    target.current[1] += (desiredY - target.current[1]) * lerpFactor;
    target.current[2] += (desiredZ - target.current[2]) * lerpFactor;
  }, []);

  return { target, update };
}

/**
 * Floor transition animation
 */
export function useFloorTransition() {
  const isTransitioning = useRef(false);
  const transitionStart = useRef(0);
  const fromFloor = useRef(0);
  const toFloor = useRef(0);
  const duration = 1.5; // seconds

  const startTransition = useCallback((from: number, to: number) => {
    if (from === to) return;
    fromFloor.current = from;
    toFloor.current = to;
    isTransitioning.current = true;
    transitionStart.current = performance.now() / 1000;
  }, []);

  const update = useCallback(() => {
    if (!isTransitioning.current) return 1; // complete

    const elapsed = performance.now() / 1000 - transitionStart.current;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOut cubic

    if (progress >= 1) {
      isTransitioning.current = false;
      return 1;
    }
    return eased;
  }, []);

  return { isTransitioning, fromFloor, toFloor, startTransition, update };
}

/**
 * Camera shake effect for dramatic moments
 */
export function useCameraShake() {
  const shakeIntensity = useRef(0);
  const shakeDecay = 0.95;
  const shakeOffset = useRef<[number, number, number]>([0, 0, 0]);

  const shake = useCallback((intensity: number) => {
    shakeIntensity.current = Math.max(shakeIntensity.current, intensity);
  }, []);

  const update = useCallback((deltaTime: number) => {
    if (shakeIntensity.current > 0.001) {
      // Use crypto.getRandomValues for better distribution (not crypto-sensitive, just visual shake)
      const rand = new Float32Array(3);
      if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        crypto.getRandomValues(rand);
      } else {
        // Fallback for environments without crypto
        rand[0] = Math.random();
        rand[1] = Math.random();
        rand[2] = Math.random();
      }
      shakeOffset.current = [
        (rand[0] - 0.5) * shakeIntensity.current * 2,
        (rand[1] - 0.5) * shakeIntensity.current * 2,
        (rand[2] - 0.5) * shakeIntensity.current * 2,
      ];
      shakeIntensity.current *= shakeDecay;
    } else {
      shakeIntensity.current = 0;
      shakeOffset.current = [0, 0, 0];
    }
    return shakeOffset.current;
  }, []);

  return { shake, update, offset: shakeOffset };
}