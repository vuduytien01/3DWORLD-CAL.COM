"use client";

/**
 * HTML5 isometric dollhouse renderer (ADR 0003 hybrid Canvas 2D + DOM overlay).
 *
 * Two canvases: the static layer redraws only when the camera or data changes
 * (walls, rooms, doors, corridor, background-floor signage), the dynamic layer
 * redraws every rAF frame with a clamped delta time (patient marker). The DOM
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
import { type IsometricCamera, type ScreenPoint, sortPainters, worldToScreen } from "./world-to-screen";

const DPR_CAP = 2;
const CULL_MARGIN_PX = 96;
const BACKGROUND_FLOOR_ALPHA = 0.35;
const SIGN_FONT_STACK = "'Be Vietnam Pro', Inter, 'Noto Sans', sans-serif";
const WALK_CYCLE_HZ = 2.2;

const OVERLAY_CSS = `
.html5-canvas { position: absolute; inset: 0; display: block; }
.html5-overlay { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.html5-floor-group { position: absolute; inset: 0; }
.html5-sign { position: absolute; left: 0; top: 0; white-space: nowrap; will-change: transform; text-shadow: 0 1px 2px rgba(248, 250, 252, 0.9); }
.html5-sign--dept-hanging { font-weight: 700; }
.html5-sign--room-wall { font-weight: 600; }
.html5-chip { position: absolute; left: 0; top: 0; padding: 2px 8px; border-radius: 9999px; background: #134E4A; color: #F8FAFC; font-size: 11px; font-weight: 600; white-space: nowrap; will-change: transform; }
.html5-room-hotspot { position: absolute; left: 0; top: 0; padding: 0; border: 1px solid rgba(15, 118, 110, 0.35); border-radius: 4px; background: transparent; cursor: pointer; pointer-events: auto; }
.html5-room-hotspot:hover { background: rgba(153, 246, 228, 0.35); }
.html5-room-hotspot--selected { border-color: #0F766E; background: rgba(153, 246, 228, 0.45); }
.html5-patient-marker { position: absolute; left: -5px; top: -5px; width: 10px; height: 10px; border-radius: 9999px; background: #BFDBFE; border: 1.5px solid #0F766E; will-change: transform; }
`;

export interface Html5PatientState {
  x: number;
  y: number;
  z: number;
}

export interface Html5FloorRendererProps {
  /** Raw demo camera pose; mapped through camera-adapter every frame. */
  cameraPose: CameraPose;
  /** Patient world position; marker + glyph follow it. Task 3 feeds pose math. */
  patientState?: Html5PatientState | null;
  selectedDeptCode?: string | null;
  onRoomClick?: (roomId: string) => void;
  /** Mirrored to the __ORBIT_CONTROLS_ENABLED__ seam (kept engine-agnostic). */
  enableOrbit?: boolean;
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

  fillQuad(
    ctx,
    [
      p(item.cx - hx, item.cy - hy, item.cz + hz),
      p(item.cx + hx, item.cy - hy, item.cz + hz),
      p(item.cx + hx, item.cy + hy, item.cz + hz),
      p(item.cx - hx, item.cy + hy, item.cz + hz),
    ],
    color,
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
    color,
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
    color,
    alpha
  );
  return true;
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
        }
        for (const room of floor.rooms) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "html5-room-hotspot";
          button.dataset.room = room.roomId;
          button.setAttribute("aria-label", room.label);
          group.appendChild(button);
          entries.push({ el: button, kind: "room", room });
        }
        groups.push(group);
      }
      overlay.replaceChildren(...groups);
      registry = entries;
      overlayNodes = entries.length + groups.length;
      overlayFocus = focusFloor;
    };

    const repositionOverlay = (): void => {
      if (!camera) return;
      if (overlayFocus !== camera.focusFloor) buildOverlay(camera.focusFloor);
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
      if (!patient) {
        patientMarker.style.display = "none";
        return;
      }
      // Idle bob advances on the clamped walk clock so the loop stays
      // frame-rate independent; Task 3 replaces the glyph with pose math.
      const bob = Math.sin(walkClockS * WALK_CYCLE_HZ * Math.PI * 2) * 0.03;
      const point = worldToScreen(patient.x, patient.y + bob, patient.z, camera);
      const r = Math.max(3, Math.min(10, camera.zoom * 0.22));
      dynamicCtx.fillStyle = HTML5_PALETTE.patient;
      dynamicCtx.strokeStyle = HTML5_PALETTE.primaryDark;
      dynamicCtx.lineWidth = 1;
      dynamicCtx.beginPath();
      dynamicCtx.ellipse(point.sx, point.sy - r * 1.6, r * 0.8, r * 1.6, 0, 0, Math.PI * 2);
      dynamicCtx.fill();
      dynamicCtx.stroke();
      dynamicCtx.beginPath();
      dynamicCtx.arc(point.sx, point.sy - r * 3.4, r * 0.75, 0, Math.PI * 2);
      dynamicCtx.fill();
      dynamicCtx.stroke();
      patientMarker.style.display = "block";
      patientMarker.style.transform = `translate(${point.sx.toFixed(1)}px, ${point.sy.toFixed(1)}px)`;
    };

    const writeMirrors = (): void => {
      if (camera) {
        win.__HOSPITAL_CAMERA__ = {
          panX: camera.panX,
          panY: camera.panY,
          zoom: camera.zoom,
          focusFloor: camera.focusFloor,
        };
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
      rafId = requestAnimationFrame(frame);
      const rawDtS = lastFrameMs === 0 ? 1 / 60 : (tMs - lastFrameMs) / 1000;
      lastFrameMs = tMs;
      // Tab hidden → rAF pauses → the first delta on return can be huge; clamp it.
      const dtS = Math.min(Math.max(rawDtS, 0), 0.1);
      walkClockS += dtS;
      if (!size.cssW && !fitCanvases()) return;
      const next = syncCamera();
      const key = cameraKeyOf(next);
      if (key !== lastKey) {
        lastKey = key;
        drawStatic();
        repositionOverlay();
      }
      drawDynamic();
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
        latest.current.onRoomClick?.(roomEl.getAttribute("data-room") ?? "");
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
    // on top of the first static paint the effect already made.
    const markReady = (): void => {
      if (disposed) return;
      container.dataset.hospitalReady = "true";
      redrawAll();
    };
    if (typeof document !== "undefined" && document.fonts) {
      void document.fonts.ready.then(markReady);
    } else {
      markReady();
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
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
