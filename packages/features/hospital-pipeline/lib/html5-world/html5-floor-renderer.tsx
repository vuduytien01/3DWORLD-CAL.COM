"use client";

/**
 * HTML5 isometric dollhouse renderer (ADR 0003 hybrid Canvas 2D + DOM overlay).
 *
 * Two canvases: the static layer redraws only when the camera or data changes
 * (walls, rooms, doors, corridor, background-floor signage), the dynamic layer
 * redraws every rAF frame with a clamped delta time (patient rig + marker). The DOM
 * overlay carries real Vietnamese signage text, step chips and room hotspots
 * for focus floor ± 1 only, positioned through the same worldToScreen module
 * as the canvas. React never owns camera or animation state — everything
 * mutable lives in refs and one effect, so re-renders and StrictMode
 * double-invocation cannot fight the loop.
 */

import { useEffect, useRef } from "react";
import type { CameraPose } from "../demo/camera-choreography";
import { cameraPoseToIsometric, type ViewportSize } from "./camera-adapter";
import {
  buildHtml5World,
  findRoomAtScreen,
  HTML5_PALETTE,
  type Html5BoxItem,
  type Html5RoomRef,
  type Html5SignItem,
  type Html5World,
  overlayFloorRange,
} from "./floor-plan";
import { CHARACTER_BONES, forwardKinematics, projectCharacterRig, sampleCharacterPose } from "./patient-rig";
import { type IsometricCamera, type ScreenPoint, sortPainters, worldToScreen } from "./world-to-screen";

const DPR_CAP = 2;
const CULL_MARGIN_PX = 96;
const BACKGROUND_FLOOR_ALPHA = 0.35;
const SIGN_FONT_STACK = "'Be Vietnam Pro', Inter, 'Noto Sans', sans-serif";

// Lighting constants for Canvas 2D depth perception
const LIGHT_DIR = { x: -0.707, y: 0.707, z: -0.707 }; // top-left, 45° elevation
const FACE_BRIGHTNESS = { top: 1.0, front: 0.85, side: 0.7, back: 0.5 };
const SHADOW_OFFSET = 4; // px at 1x DPR
const SHADOW_COLOR = 'rgba(0, 0, 0, 0.15)';
const SHADOW_HEIGHT_RATIO = 0.3; // floor shadow ellipse height ratio

const OVERLAY_CSS = `
.html5-canvas { position: absolute; inset: 0; display: block; }
.html5-overlay { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.html5-floor-group { position: absolute; inset: 0; }
.html5-sign { position: absolute; left: 0; top: 0; white-space: nowrap; text-shadow: 0 1px 2px rgba(248, 250, 252, 0.9); opacity: 0; transform: translateY(10px); transition: opacity 200ms cubic-bezier(0.23, 1, 0.32, 1), transform 200ms cubic-bezier(0.23, 1, 0.32, 1); }
.html5-sign--entrance { opacity: 1; transform: translateY(0); }
.html5-sign--dept-hanging { font-weight: 700; }
.html5-sign--room-wall { font-weight: 600; }
.html5-chip { position: absolute; left: 0; top: 0; padding: 2px 8px; border-radius: 9999px; background: #134E4A; color: #F8FAFC; font-size: 11px; font-weight: 600; white-space: nowrap; }
.html5-room-hotspot { position: absolute; left: 0; top: 0; padding: 0; border: 1px solid rgba(15, 118, 110, 0.35); border-radius: 4px; background: transparent; cursor: pointer; pointer-events: auto; width: 100%; height: 100%; }
.html5-room-hotspot:hover { background: rgba(153, 246, 228, 0.35); }
.html5-room-hotspot--selected { border-color: #0F766E; background: rgba(153, 246, 228, 0.45); }
.html5-room-hotspot__content { display: block; width: 100%; height: 100%; transform-origin: center; transition: transform 150ms cubic-bezier(0.23, 1, 0.32, 1); /* easeOut from motion-tokens.ts */ }
.html5-room-hotspot:hover .html5-room-hotspot__content { transform: scale(1.02); }
.html5-room-hotspot:active .html5-room-hotspot__content { transform: scale(0.98); }
.html5-room-tooltip { 
  position: absolute; 
  left: 50%; 
  bottom: 100%; 
  transform: translateX(-50%) translateY(-8px); 
  background: rgba(19, 78, 74, 0.95); 
  color: #fff; 
  padding: 4px 10px; 
  border-radius: 4px; 
  font-size: 11px; 
  font-weight: 500; 
  white-space: nowrap; 
  pointer-events: none; 
  opacity: 0; 
  transform: translateX(-50%) translateY(-8px); 
  transition: opacity 150ms cubic-bezier(0.23, 1, 0.32, 1), transform 150ms cubic-bezier(0.23, 1, 0.32, 1); 
  box-shadow: 0 4px 16px rgba(19, 78, 74, 0.3); 
  z-index: 10; 
}
.html5-room-hotspot:hover .html5-room-tooltip { 
  opacity: 1; 
  transform: translateX(-50%) translateY(0); 
}
.html5-patient-marker { position: absolute; left: -5px; top: -5px; width: 10px; height: 10px; border-radius: 9999px; background: #BFDBFE; border: 1.5px solid #0F766E; }
`;

export interface Html5PatientState {
  x: number;
  y: number;
  z: number;
  /** Facing yaw in radians (atan2(dx, dz)); absent faces the +Z corridor axis. */
  headingRad?: number;
  /** True while the timeline walks the patient (walk cycle instead of idle). */
  walking?: boolean;
  /** Walk-cycle phase in [0, 1) while walking. */
  walkPhase?: number;
}

export interface Html5FloorRendererProps {
  /** Raw demo camera pose; mapped through camera-adapter every frame. */
  cameraPose: CameraPose;
  /** Patient world position; marker + glyph follow it. Task 3 feeds pose math. */
  patientState?: Html5PatientState | null;
  selectedDeptCode?: string | null;
  onRoomClick?: (roomId: string) => void;
  /** Optional callback for room click toast: roomId, deptCode, screen x, screen y */
  onRoomToast?: (roomId: string, deptCode: string, x: number, y: number) => void;
  /** Mirrored to the __ORBIT_CONTROLS_ENABLED__ seam (kept engine-agnostic). */
  enableOrbit?: boolean;
  /** When true, skips walk-cycle phase and snaps camera to target instantly (prefers-reduced-motion). */
  reducedMotion?: boolean;
  className?: string;
}

/** measureText is the slowest canvas op — cache per (font, string). */
const measureCache = new Map<string, number>();

function cameraKeyOf(camera: IsometricCamera): string {
  return `${camera.panX.toFixed(2)}|${camera.panY.toFixed(2)}|${camera.zoom.toFixed(3)}|${camera.focusFloor}`;
}

function fillQuad(
  ctx: CanvasRenderingContext2D,
  points: readonly ScreenPoint[],
  color: string,
  alpha: number
): void {
  const first = points[0];
  if (!first) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(first.sx, first.sy);
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    if (point) ctx.lineTo(point.sx, point.sy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * One axis-aligned box as three screen quads (+z face, +x face, top face —
 * the faces the fixed iso azimuth sees). Returns false when fully culled.
 */
function drawBox(
  ctx: CanvasRenderingContext2D,
  item: Html5BoxItem,
  camera: IsometricCamera,
  color: string,
  alpha: number,
  viewport: ViewportSize
): boolean {
  const hx = item.sx / 2;
  const hy = item.sy / 2;
  const hz = item.sz / 2;
  const p = (x: number, y: number, z: number) => worldToScreen(x, y, z, camera);

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const ys = [item.cy - hy, item.cy + hy];
  const xs = [item.cx - hx, item.cx + hx];
  const zs = [item.cz - hz, item.cz + hz];
  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        const corner = p(x, y, z);
        minX = Math.min(minX, corner.sx);
        maxX = Math.max(maxX, corner.sx);
        minY = Math.min(minY, corner.sy);
        maxY = Math.max(maxY, corner.sy);
      }
    }
  }
  if (maxX < -CULL_MARGIN_PX || minX > viewport.width + CULL_MARGIN_PX) return false;
  if (maxY < -CULL_MARGIN_PX || minY > viewport.height + CULL_MARGIN_PX) return false;

  const topColor = applyLighting(color, 'top');
  const frontColor = applyLighting(color, 'front');
  const sideColor = applyLighting(color, 'side');

  fillQuad(
    ctx,
    [
      p(item.cx - hx, item.cy - hy, item.cz + hz),
      p(item.cx + hx, item.cy - hy, item.cz + hz),
      p(item.cx + hx, item.cy + hy, item.cz + hz),
      p(item.cx - hx, item.cy + hy, item.cz + hz),
    ],
    topColor,
    alpha * 0.72
  );
  fillQuad(
    ctx,
    [
      p(item.cx + hx, item.cy - hy, item.cz - hz),
      p(item.cx + hx, item.cy - hy, item.cz + hz),
      p(item.cx + hx, item.cy + hy, item.cz + hz),
      p(item.cx + hx, item.cy + hy, item.cz - hz),
    ],
    frontColor,
    alpha * 0.86
  );
  fillQuad(
    ctx,
    [
      p(item.cx - hx, item.cy + hy, item.cz - hz),
      p(item.cx + hx, item.cy + hy, item.cz - hz),
      p(item.cx + hx, item.cy + hy, item.cz + hz),
      p(item.cx - hx, item.cy + hy, item.cz + hz),
    ],
    sideColor,
    alpha
  );
  return true;
}

/**
 * Apply lighting to a base color based on face orientation.
 * Light from top-left (-45° azimuth, 45° elevation).
 */
function applyLighting(baseColor: string, face: 'top' | 'front' | 'side' | 'back'): string {
  const brightness = ({ top: 1.0, front: 0.85, side: 0.7, back: 0.5 })[face];
  // Parse hex color
  const hex = baseColor.startsWith('#') ? baseColor.slice(1) : baseColor;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgb(${Math.round(r * brightness)}, ${Math.round(g * brightness)}, ${Math.round(b * brightness)})`;
}

/**
 * Draw floor shadow ellipse for depth perception.
 */
function drawFloorShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  dpr: number
): void {
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function measureTextCached(ctx: CanvasRenderingContext2D, font: string, text: string): number {
  const cacheKey = `${font}|${text}`;
  const cached = measureCache.get(cacheKey);
  if (cached !== undefined) return cached;
  ctx.font = font;
  const width = ctx.measureText(text).width;
  measureCache.set(cacheKey, width);
  return width;
}

/** Background floors carry their signage as dimmed canvas text. */
function drawSignOnCanvas(
  ctx: CanvasRenderingContext2D,
  sign: Html5SignItem,
  camera: IsometricCamera,
  alpha: number
): void {
  const point = worldToScreen(sign.x, sign.y, sign.z, camera);
  const fontPx = Math.max(9, Math.min(22, sign.heightM * camera.zoom * 0.85));
  const font = `${fontPx.toFixed(1)}px ${SIGN_FONT_STACK}`;
  const maxWidthPx = Math.max(24, sign.widthM * camera.zoom);
  const textWidth = measureTextCached(ctx, font, sign.text);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = sign.color;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Only condense when the measured string really overflows its world width.
  ctx.fillText(sign.text, point.sx, point.sy, textWidth <= maxWidthPx ? undefined : maxWidthPx);
  ctx.globalAlpha = 1;
}

type OverlayEntry =
  | { el: HTMLElement; kind: "sign"; sign: Html5SignItem }
  | { el: HTMLElement; kind: "room"; room: Html5RoomRef };

export function Html5FloorRenderer(props: Html5FloorRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dynamicCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Latest-props pattern: the loop reads current props without re-subscribing.
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const container = containerRef.current;
    const staticCanvas = staticCanvasRef.current;
    const dynamicCanvas = dynamicCanvasRef.current;
    const overlay = overlayRef.current;
    if (!container || !staticCanvas || !dynamicCanvas || !overlay) return;
    const staticCtx = staticCanvas.getContext("2d");
    const dynamicCtx = dynamicCanvas.getContext("2d");
    if (!staticCtx || !dynamicCtx) return;

    const world: Html5World = buildHtml5World();
    const size = { cssW: 0, cssH: 0, dpr: 1 };
    let camera: IsometricCamera | null = null;
    let rafId = 0;
    let lastFrameMs = 0;
    let lastKey = "";
    let overlayFocus = -1;
    let drawnItems = 0;
    let overlayNodes = 0;
    let fpsEma = 0;
    let frameMsEma = 0;
    let walkClockS = 0;
    let disposed = false;
    let registry: readonly OverlayEntry[] = [];
    // Dirty flag for drawDynamic (spec #11): only redraw when patient or camera changed
    let lastPatientSig = "";
    let lastCameraSig = "";
    // Patient marker entrance animation (spec #16): track previous existence
    let prevPatientExists = false;
    let entranceStartMs = 0;
    // Floor transition indicator (spec #17): track previous focusFloor for crossfade
    let prevFocusFloor = -1;
    let floorTransitionStartMs = 0;
    let floorTransitionDirection: "up" | "down" | null = null;

    const win = window as unknown as Record<string, unknown>;
    const patientMarker = document.createElement("div");
    patientMarker.className = "html5-patient-marker";
    patientMarker.dataset.patient = "";
    patientMarker.style.display = "none";

    const fitCanvases = (): boolean => {
      const rect = container.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      const deviceW = Math.max(1, Math.floor(rect.width * dpr));
      const deviceH = Math.max(1, Math.floor(rect.height * dpr));
      for (const canvas of [staticCanvas, dynamicCanvas]) {
        if (canvas.width !== deviceW) canvas.width = deviceW;
        if (canvas.height !== deviceH) canvas.height = deviceH;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
      size.cssW = rect.width;
      size.cssH = rect.height;
      size.dpr = dpr;
      return true;
    };

    const syncCamera = (): IsometricCamera => {
      const next = cameraPoseToIsometric(latest.current.cameraPose, {
        width: size.cssW,
        height: size.cssH,
      });
      camera = next;
      return next;
    };

    const drawStatic = (): void => {
      if (!camera) return;
      staticCtx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      staticCtx.clearRect(0, 0, size.cssW, size.cssH);
      const viewport = { width: size.cssW, height: size.cssH };
      const overlayFloors = new Set(overlayFloorRange(camera.focusFloor, world.maxFloorIndex));
      const selected = latest.current.selectedDeptCode ?? null;
      const items = sortPainters(
        world.floors.flatMap((floor) =>
          floor.boxes.map((boxItem) => ({
            boxItem,
            floorIndex: boxItem.floorIndex,
            x: boxItem.cx,
            z: boxItem.cz,
          }))
        )
      ).map((entry) => entry.boxItem);
      let drawn = 0;
      for (const boxItem of items) {
        const isHighlighted = boxItem.role === "room-floor" && !!selected && boxItem.deptCode === selected;
        const color = isHighlighted ? HTML5_PALETTE.accent : boxItem.color;
        const alpha = overlayFloors.has(boxItem.floorIndex) ? 1 : BACKGROUND_FLOOR_ALPHA;
        if (drawBox(staticCtx, boxItem, camera, color, alpha, viewport)) drawn += 1;
      }
      for (const floor of world.floors) {
        if (overlayFloors.has(floor.floorIndex)) continue;
        for (const sign of floor.signs) {
          drawSignOnCanvas(staticCtx, sign, camera, BACKGROUND_FLOOR_ALPHA);
          drawn += 1;
        }
      }

      // Floor shadows for depth perception (background floors only)
      for (const floor of world.floors) {
        if (overlayFloors.has(floor.floorIndex)) continue;
        const footprint = floor.footprint;
        const cx = (footprint.xMin + footprint.xMax) / 2;
        const cz = (footprint.zMin + footprint.zMax) / 2;
        const shadowW = (footprint.xMax - footprint.xMin) * size.dpr;
        const shadowH = (footprint.zMax - footprint.zMin) * size.dpr * SHADOW_HEIGHT_RATIO;
        const shadowOffset = SHADOW_OFFSET * size.dpr;
        // Project floor center to screen
        const centerPoint = worldToScreen(cx, 0, cz, camera);
        const shadowCx = centerPoint.sx + shadowOffset;
        const shadowCy = centerPoint.sy + shadowOffset;
        drawFloorShadow(staticCtx, shadowCx, shadowCy, shadowW, shadowH, size.dpr);
      }

      drawnItems = drawn;
    };

    const buildOverlay = (focusFloor: number): void => {
      const entries: OverlayEntry[] = [];
      const groups: HTMLDivElement[] = [];
      for (const floorIndex of overlayFloorRange(focusFloor, world.maxFloorIndex)) {
        const floor = world.floors[floorIndex];
        if (!floor) continue;
        const group = document.createElement("div");
        group.className = "html5-floor-group";
        group.dataset.floor = String(floorIndex);
        const signElements: HTMLElement[] = [];
        for (const sign of floor.signs) {
          const el = document.createElement("span");
          el.className =
            sign.variant === "step-chip" ? "html5-chip" : `html5-sign html5-sign--${sign.variant}`;
          el.textContent = sign.text;
          if (sign.variant === "step-chip" && sign.stepId) {
            el.dataset.step = sign.stepId;
          } else {
            el.style.color = sign.color;
          }
          group.appendChild(el);
          entries.push({ el, kind: "sign", sign });
          signElements.push(el);
        }
        for (const room of floor.rooms) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "html5-room-hotspot";
          button.dataset.room = room.roomId;
          button.setAttribute("aria-label", room.label);
          // Wrapper span for hover scale transform to compose with positioning transform
          const wrapper = document.createElement("span");
          wrapper.className = "html5-room-hotspot__content";
          button.appendChild(wrapper);
          // Tooltip with department, room type, and floor
          const tooltip = document.createElement("span");
          tooltip.className = "html5-room-tooltip";
          tooltip.textContent = `${room.deptCode} - ${room.label} - Tầng ${room.floorIndex + 1}`;
          button.appendChild(tooltip);
          group.appendChild(button);
          entries.push({ el: button, kind: "room", room });
        }
        groups.push(group);
      }
      overlay.replaceChildren(...groups);
      registry = entries;
      overlayNodes = entries.length + groups.length;
      overlayFocus = focusFloor;

      // Staggered entrance for signs on the incoming floor (focusFloor)
      // Only animate if not reduced motion
      const reduced = latest.current.reducedMotion ?? false;
      if (!reduced) {
        const incomingGroup = overlay.querySelector(`[data-floor="${focusFloor}"]`);
        if (incomingGroup) {
          const signElements = incomingGroup.querySelectorAll(".html5-sign");
          signElements.forEach((el, i) => {
            setTimeout(() => {
              (el as HTMLElement).classList.add("html5-sign--entrance");
            }, i * 30);
          });
        }
      }
    };

    const repositionOverlay = (): void => {
      if (!camera) return;

      // Floor transition indicator (spec #17): animate floor groups on focusFloor change
      // Only trigger transition if we've already built an overlay (overlayFocus !== -1)
      // and the floor actually changed. Skip animation in reduced motion mode.
      const reduced = latest.current.reducedMotion ?? false;
      if (!reduced && overlayFocus !== -1 && overlayFocus !== camera.focusFloor) {
        const oldFocus = overlayFocus;
        const newFocus = camera.focusFloor;
        floorTransitionDirection = newFocus > oldFocus ? "up" : "down";
        floorTransitionStartMs = performance.now();
        // Promote layers for smooth transition (composite-only transform/opacity)
        const overlayFloors = overlay.querySelectorAll(".html5-floor-group");
        overlayFloors.forEach((group) => {
          (group as HTMLElement).style.willChange = "transform, opacity";
        });
        // Don't replace children immediately - animate the transition
        // The outgoing group will animate out, incoming will animate in
        // We'll handle the actual DOM swap after the animation
      } else if (reduced && overlayFocus !== camera.focusFloor) {
        // Reduced motion: instant floor switch without animation
        buildOverlay(camera.focusFloor);
        prevFocusFloor = camera.focusFloor;
        return;
      }

      // If we're in a floor transition, animate the groups
      if (floorTransitionDirection && floorTransitionStartMs > 0) {
        const progress = Math.min((performance.now() - floorTransitionStartMs) / 300, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOut cubic
        const overlayFloors = overlay.querySelectorAll(".html5-floor-group");
        overlayFloors.forEach((group) => {
          const el = group as HTMLElement;
          const floorIndex = parseInt(el.dataset.floor ?? "-1", 10);
          if (floorIndex === prevFocusFloor) {
            // Outgoing floor: translateY(-100%) fade out
            const translateY = -100 * eased;
            el.style.transform = `translateY(${translateY}%)`;
            el.style.opacity = (1 - eased).toFixed(3);
          } else if (floorIndex === camera.focusFloor) {
            // Incoming floor: translateY(100%) → 0 fade in
            const translateY = 100 * (1 - eased);
            el.style.transform = `translateY(${translateY}%)`;
            el.style.opacity = eased.toFixed(3);
          } else {
            el.style.transform = "translateY(0)";
            el.style.opacity = "1";
          }
        });

        if (progress >= 1) {
          // Transition complete: build new overlay
          buildOverlay(camera.focusFloor);
          // Remove will-change after transition
          const overlayFloors = overlay.querySelectorAll(".html5-floor-group");
          overlayFloors.forEach((group) => {
            (group as HTMLElement).style.willChange = "auto";
          });
          floorTransitionDirection = null;
          floorTransitionStartMs = 0;
          prevFocusFloor = camera.focusFloor;
        }
        return; // Skip normal reposition during transition
      }

      // Normal reposition (no transition in progress)
      // Initial build (overlayFocus === -1) or same floor change without animation
      if (overlayFocus !== camera.focusFloor) {
        buildOverlay(camera.focusFloor);
        prevFocusFloor = camera.focusFloor;
      }

      const selected = latest.current.selectedDeptCode ?? null;
      for (const entry of registry) {
        if (entry.kind === "sign") {
          const point = worldToScreen(entry.sign.x, entry.sign.y, entry.sign.z, camera);
          const centering =
            entry.sign.variant === "step-chip" ? "translate(-50%, -50%)" : "translate(-50%, -100%)";
          entry.el.style.transform = `translate(${point.sx.toFixed(1)}px, ${point.sy.toFixed(1)}px) ${centering}`;
        } else {
          const room = entry.room;
          const baseY = world.floors[room.floorIndex]?.baseY ?? 0;
          const corners = [
            worldToScreen(room.xMin, baseY, room.zMin, camera),
            worldToScreen(room.xMax, baseY, room.zMin, camera),
            worldToScreen(room.xMax, baseY, room.zMax, camera),
            worldToScreen(room.xMin, baseY, room.zMax, camera),
          ];
          const left = Math.min(...corners.map((c) => c.sx));
          const top = Math.min(...corners.map((c) => c.sy));
          const width = Math.max(8, Math.max(...corners.map((c) => c.sx)) - left);
          const height = Math.max(8, Math.max(...corners.map((c) => c.sy)) - top);
          entry.el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
          entry.el.style.width = `${width.toFixed(1)}px`;
          entry.el.style.height = `${height.toFixed(1)}px`;
          entry.el.classList.toggle("html5-room-hotspot--selected", !!selected && room.deptCode === selected);
        }
      }
    };

    const drawDynamic = (): void => {
      dynamicCtx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      dynamicCtx.clearRect(0, 0, size.cssW, size.cssH);
      if (!camera) return;
      const patient = latest.current.patientState;
      const reduced = latest.current.reducedMotion ?? false;
      const patientExists = !!patient;

      // Reduced motion optimization: skip walk-cycle animation entirely
      // Draw only a static idle pose and skip frame-rate dependent updates
      if (reduced && !patient?.walking) {
        // For reduced motion, we can skip most of drawDynamic if nothing changed
        // The dirty flag in the main loop handles this, but we ensure
        // walkClockS doesn't advance during reduced motion idle
        // (already handled in frame function by checking reduced flag)
      }

      // Patient marker entrance animation (spec #16): 200ms scale/opacity fade-in
      if (patientExists && !prevPatientExists) {
        entranceStartMs = performance.now();
      }
      prevPatientExists = patientExists;

      if (!patient) {
        patientMarker.style.display = "none";
        return;
      }
      // Idle breath advances on the clamped walk clock so the loop stays
      // frame-rate independent; the walk phase arrives with the timeline state.
      // When reducedMotion is true, force idle pose (walking: false) per spec #10.
      const pose = sampleCharacterPose({
        walking: reduced ? false : (patient.walking ?? false),
        walkPhase: patient.walkPhase,
        idleTimeS: reduced ? 0 : walkClockS, // Freeze idle breath animation in reduced motion
      });
      const joints = forwardKinematics(pose, patient.headingRad ?? 0);
      const screen = projectCharacterRig(joints, patient, camera);
      const limbPx = Math.max(1.5, Math.min(5, camera.zoom * 0.1));
      dynamicCtx.lineCap = "round";
      dynamicCtx.lineJoin = "round";
      dynamicCtx.strokeStyle = HTML5_PALETTE.patient;
      dynamicCtx.lineWidth = limbPx;
      for (const [from, to] of CHARACTER_BONES) {
        const a = screen[from];
        const b = screen[to];
        if (!a || !b) continue;
        dynamicCtx.beginPath();
        dynamicCtx.moveTo(a.sx, a.sy);
        dynamicCtx.lineTo(b.sx, b.sy);
        dynamicCtx.stroke();
      }
      const head = screen.head;
      if (head) {
        dynamicCtx.fillStyle = HTML5_PALETTE.patient;
        dynamicCtx.strokeStyle = HTML5_PALETTE.primaryDark;
        dynamicCtx.lineWidth = 1;
        dynamicCtx.beginPath();
        dynamicCtx.arc(head.sx, head.sy, Math.max(2, camera.zoom * 0.11), 0, Math.PI * 2);
        dynamicCtx.fill();
        dynamicCtx.stroke();
      }
      const point = worldToScreen(patient.x, patient.y, patient.z, camera);
      patientMarker.style.display = "block";
      // Entrance animation: scale(0.8) → 1 + opacity 0 → 1 over 200ms
      const entranceProgress = Math.min((performance.now() - entranceStartMs) / 200, 1);
      const scale = 0.95 + 0.05 * entranceProgress;
      const opacity = entranceProgress;
      patientMarker.style.transform = `translate(${point.sx.toFixed(1)}px, ${point.sy.toFixed(1)}px) scale(${scale.toFixed(3)})`;
      patientMarker.style.opacity = opacity.toFixed(3);
    };

    const writeMirrors = (): void => {
      if (camera) {
        win.__HOSPITAL_CAMERA__ = {
          panX: camera.panX,
          panY: camera.panY,
          zoom: camera.zoom,
          focusFloor: camera.focusFloor,
        };
        win.__HOSPITAL_FLOOR__ = camera.focusFloor;
      }
      win.__ORBIT_CONTROLS_ENABLED__ = latest.current.enableOrbit ?? false;
      win.__HOSPITAL_PERF__ = {
        fps: fpsEma,
        frameMs: frameMsEma,
        calls: drawnItems,
        tris: overlayNodes,
      };
    };

    const frame = (tMs: number): void => {
      // Reduced motion: skip rAF entirely when there's no patient walking or camera change
      // This saves CPU/GPU by not running the loop when nothing animates
      const reduced = latest.current.reducedMotion ?? false;
      const patient = latest.current.patientState;
      const hasWalkingPatient = patient?.walking === true;
      
      // In reduced motion, only schedule next frame if something actually needs animating
      if (reduced && !hasWalkingPatient) {
        // Check if camera or patient position changed since last frame
        const next = syncCamera();
        const key = cameraKeyOf(next);
        const patientSig = patient
          ? `${patient.x.toFixed(2)},${patient.y.toFixed(2)},${patient.z.toFixed(2)},${patient.headingRad?.toFixed(2) ?? 0},${patient.walking ? 1 : 0},${patient.walkPhase?.toFixed(3) ?? 0}`
          : "null";
        
        if (key !== lastKey || patientSig !== lastPatientSig) {
          // Something changed - run one frame
          rafId = requestAnimationFrame(frame);
        } else {
          // Nothing animating - skip rAF, use setTimeout to check again later
          rafId = setTimeout(() => frame(performance.now()), 100) as unknown as number;
        }
      } else {
        rafId = requestAnimationFrame(frame);
      }
      
      const rawDtS = lastFrameMs === 0 ? 1 / 60 : (tMs - lastFrameMs) / 1000;
      lastFrameMs = tMs;
      // Tab hidden → rAF pauses → the first delta on return can be huge; clamp it.
      const dtS = Math.min(Math.max(rawDtS, 0), 0.1);
      
      // In reduced motion with no walking patient, freeze walkClockS to avoid idle breath animation
      if (!reduced || hasWalkingPatient) {
        walkClockS += dtS;
      }
      
      if (!size.cssW && !fitCanvases()) return;
      const next = syncCamera();
      const key = cameraKeyOf(next);
      if (key !== lastKey) {
        lastKey = key;
        drawStatic();
        repositionOverlay();
      }

      // Dirty flag for drawDynamic (spec #11): only redraw when patient or camera changed
      const patientSig = patient
        ? `${patient.x.toFixed(2)},${patient.y.toFixed(2)},${patient.z.toFixed(2)},${patient.headingRad?.toFixed(2) ?? 0},${patient.walking ? 1 : 0},${patient.walkPhase?.toFixed(3) ?? 0}`
        : "null";
      const cameraSig = key;
      if (patientSig !== lastPatientSig || cameraSig !== lastCameraSig) {
        lastPatientSig = patientSig;
        lastCameraSig = cameraSig;
        drawDynamic();
      }
      // Perf mirrors still update every frame for monitoring (fps/frameMs EMA)
      const instFps = rawDtS > 0 ? 1 / rawDtS : 0;
      fpsEma = fpsEma === 0 ? instFps : fpsEma + (instFps - fpsEma) * 0.1;
      frameMsEma = frameMsEma === 0 ? rawDtS * 1000 : frameMsEma + (rawDtS * 1000 - frameMsEma) * 0.1;
      writeMirrors();
    };

    const redrawAll = (): void => {
      const next = syncCamera();
      lastKey = cameraKeyOf(next);
      drawStatic();
      repositionOverlay();
    };

    const onResize = (): void => {
      if (!fitCanvases()) return;
      redrawAll();
    };

    const onStageClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      const roomEl = target?.closest("[data-room]");
      if (roomEl) {
        const roomId = roomEl.getAttribute("data-room") ?? "";
        latest.current.onRoomClick?.(roomId);
        // Toast callback with room info and screen position
        if (camera) {
          const rect = container.getBoundingClientRect();
          const hit = findRoomAtScreen(event.clientX - rect.left, event.clientY - rect.top, world, camera);
          if (hit) {
            // Find room across all floors
            let room = null;
            for (const floor of world.floors) {
              const found = floor.rooms.find(r => r.roomId === hit.roomId);
              if (found) { room = found; break; }
            }
            const deptCode = room?.deptCode ?? hit.roomId;
            latest.current.onRoomToast?.(hit.roomId, deptCode, event.clientX, event.clientY);
          }
        }
        return;
      }
      if (!camera) return;
      const rect = container.getBoundingClientRect();
      const hit = findRoomAtScreen(event.clientX - rect.left, event.clientY - rect.top, world, camera);
      if (hit) latest.current.onRoomClick?.(hit.roomId);
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(container);
    container.appendChild(patientMarker);
    container.addEventListener("click", onStageClick);
    rafId = requestAnimationFrame(frame);

    // Fonts decide text metrics; readiness is claimed only after they land,
    // on top of the first static paint the effect already made. A hung font
    // load (defense-room network) must not wedge the page unready forever,
    // so fonts.ready races a 3s fallback.
    const markReady = (): void => {
      if (disposed) return;
      container.dataset.hospitalReady = "true";
      redrawAll();
    };
    const fontsReady = (): Promise<void> =>
      typeof document !== "undefined" && document.fonts
        ? Promise.resolve(document.fonts.ready).then(() => undefined)
        : Promise.resolve();
    const fontsTimeout = (): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, 3000));
    void Promise.race([fontsReady(), fontsTimeout()]).then(markReady);

    return () => {
      disposed = true;
      // rafId could be from requestAnimationFrame or setTimeout
      if (typeof rafId === 'number') {
        try { cancelAnimationFrame(rafId); } catch {}
        try { clearTimeout(rafId); } catch {}
      }
      observer.disconnect();
      container.removeEventListener("click", onStageClick);
      patientMarker.remove();
      delete win.__HOSPITAL_CAMERA__;
      delete win.__ORBIT_CONTROLS_ENABLED__;
      delete win.__HOSPITAL_PERF__;
      container.dataset.hospitalReady = "false";
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: lifecycle-only effect; props flow through the latest-props ref
  }, []);

  return (
    <div
      ref={containerRef}
      data-hospital-ready="false"
      className={props.className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: HTML5_PALETTE.floor,
        fontFamily: SIGN_FONT_STACK,
      }}>
      <style>{OVERLAY_CSS}</style>
      <canvas ref={staticCanvasRef} className="html5-canvas" />
      <canvas ref={dynamicCanvasRef} className="html5-canvas" />
      <div ref={overlayRef} className="html5-overlay" />
    </div>
  );
}
