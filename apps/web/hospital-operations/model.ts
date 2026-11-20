import { STEP_LOCATIONS } from "../../../packages/features/hospital-pipeline/lib/step-graph/step-locations";

export const timeZone = "Asia/Ho_Chi_Minh";
export const clinic = "Khám Nội tổng quát";
export const slots = ["09:00", "09:30", "10:00"];
export const today = () => new Date().toLocaleDateString("sv-SE", { timeZone });
export const formatTime = (start: string) =>
  new Date(start).toLocaleTimeString("vi-VN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });

function station(stepId: string) {
  const value = STEP_LOCATIONS.find((step) => step.stepId === stepId);
  if (!value) throw new Error(`Missing hospital station ${stepId}`);
  return value;
}

export const room = { ...station("step-consultation"), label: "Phòng khám 01" };
export const markers = {
  lobby: { ...station("step-ticket"), label: "Sảnh tiếp nhận" },
  waiting: { ...station("step-queue"), label: "Khu chờ" },
};
export type Marker = keyof typeof markers;
export function isMarker(value: unknown): value is Marker {
  return value === "lobby" || value === "waiting";
}

export type Appointment = { uid: string; start: string };
export type Visit = Appointment & { number: number; marker: Marker | null; seenAt: string | null };
