import { describe, expect, it } from "vitest";
import type { ChoreographySegment } from "../../demo/camera-choreography";
import { applyEasing, samplePoseAt } from "../../demo/camera-choreography";
import { composeDemoTimeline } from "../../demo/demo-timeline";
import { STEP_LOCATION_BY_ID, STEP_LOCATIONS } from "../../step-graph/step-locations";
import { cameraPoseToIsometric } from "../camera-adapter";
import { patientWalkAt, sampleRestackedPoseAt, WALK_CYCLE_HZ } from "../patient-walk";

const timeline = composeDemoTimeline();
const segments = timeline.segments;

function segmentById(id: string): ChoreographySegment {
  const segment = segments.find((s) => s.id === id);
  if (!segment) throw new Error(`missing segment: ${id}`);
  return segment;
}

/** DemoStateAt pinned to one segment at an exact elapsed second. */
function stateAtSegment(segment: ChoreographySegment, elapsedDemoSeconds: number) {
  return { narration: undefined, cameraSegment: segment, wait: undefined, elapsedDemoSeconds };
}

describe("patientWalkAt — approach segments walk between stations", () => {
  it("midpoint of ticket-to-queue is halfway along the STEP_LOCATIONS path", () => {
    const walk = patientWalkAt(timeline.stateAt(27));
    expect(walk).not.toBeNull();
    const ticket = STEP_LOCATION_BY_ID.get("step-ticket");
    const queue = STEP_LOCATION_BY_ID.get("step-queue");
    expect(ticket && queue).toBeTruthy();
    if (!walk || !ticket || !queue) return;
    expect(walk.x).toBeCloseTo((ticket.position.x + queue.position.x) / 2, 6);
    expect(walk.z).toBeCloseTo((ticket.position.z + queue.position.z) / 2, 6);
    expect(walk.walking).toBe(true);
    // Ticket and queue share floor 0: no elevation change on this leg.
    expect(walk.floor).toBe(0);
    expect(walk.y).toBe(0);
    // Straight +Z leg: the patient faces the corridor axis.
    expect(walk.headingRad).toBeCloseTo(Math.atan2(0, 5), 6);
  });

  it("uses the segment easing so patient and camera arrive together", () => {
    const segment = segmentById("ticket-to-queue");
    const walk = patientWalkAt(timeline.stateAt(segment.startS + segment.durationS * 0.25));
    expect(walk).not.toBeNull();
    if (!walk) return;
    const ticket = STEP_LOCATION_BY_ID.get("step-ticket")!;
    const queue = STEP_LOCATION_BY_ID.get("step-queue")!;
    const eased = applyEasing(segment.easing, 0.25);
    expect(walk.z).toBeCloseTo(ticket.position.z + (queue.position.z - ticket.position.z) * eased, 6);
  });

  it("arrives exactly at the target station when the approach ends", () => {
    const segment = segmentById("queue-to-consultation");
    const walk = patientWalkAt(stateAtSegment(segment, segment.endS));
    const consultation = STEP_LOCATION_BY_ID.get("step-consultation")!;
    expect(walk).not.toBeNull();
    if (!walk) return;
    expect(walk.x).toBe(consultation.position.x);
    expect(walk.z).toBe(consultation.position.z);
    expect(walk.floor).toBe(consultation.floor);
  });

  it("restacks the floor transition continuously: mid-walk floor 0.5 means y 1.5", () => {
    const walk = patientWalkAt(timeline.stateAt(47));
    expect(walk).not.toBeNull();
    if (!walk) return;
    expect(walk.floor).toBeCloseTo(0.5, 6);
    expect(walk.y).toBeCloseTo(1.5, 6);
  });

  it("rides the queue (floor 0) to consultation (floor 1) elevation over the walk", () => {
    const segment = segmentById("queue-to-consultation");
    const first = patientWalkAt(timeline.stateAt(segment.startS + 0.01));
    const last = patientWalkAt(timeline.stateAt(segment.endS - 0.01));
    expect(first && last).toBeTruthy();
    if (!first || !last) return;
    expect(first.y).toBeLessThan(0.01);
    expect(last.y).toBeGreaterThan(2.99);
    expect(last.floor).toBeGreaterThan(0.99);
  });

  it("faces the travel direction on a diagonal leg", () => {
    const walk = patientWalkAt(timeline.stateAt(47));
    expect(walk).not.toBeNull();
    if (!walk) return;
    // queue (-7.5, 3) → consultation (0, 8): dx = 7.5, dz = 5
    expect(walk.headingRad).toBeCloseTo(Math.atan2(7.5, 5), 6);
  });
});

describe("patientWalkAt — action and outro stand idle at the station", () => {
  it("consultation action holds the restacked station position", () => {
    const walk = patientWalkAt(timeline.stateAt(57));
    const consultation = STEP_LOCATION_BY_ID.get("step-consultation")!;
    expect(walk).not.toBeNull();
    if (!walk) return;
    expect(walk.x).toBe(consultation.position.x);
    expect(walk.z).toBe(consultation.position.z);
    expect(walk.floor).toBe(consultation.floor);
    expect(walk.y).toBe(consultation.floor * 3);
    expect(walk.walking).toBe(false);
    expect(walk.walkPhase).toBe(0);
  });

  it("faces the arrival direction while idle (previous station → station)", () => {
    const walk = patientWalkAt(timeline.stateAt(57));
    expect(walk).not.toBeNull();
    if (!walk) return;
    // queue (-7.5, 3) → consultation (0, 8) is the leg the patient arrived on
    expect(walk.headingRad).toBeCloseTo(Math.atan2(7.5, 5), 6);
  });

  it("the intro approach has no origin, so the patient waits at the ticket counter", () => {
    const walk = patientWalkAt(timeline.stateAt(5));
    const ticket = STEP_LOCATION_BY_ID.get("step-ticket")!;
    expect(walk).not.toBeNull();
    if (!walk) return;
    expect(walk.x).toBe(ticket.position.x);
    expect(walk.z).toBe(ticket.position.z);
    expect(walk.walking).toBe(false);
    expect(walk.headingRad).toBe(0);
  });

  it("the outro keeps the patient at the payment counter", () => {
    const walk = patientWalkAt(timeline.stateAt(170));
    const payment = STEP_LOCATION_BY_ID.get("step-payment")!;
    expect(walk).not.toBeNull();
    if (!walk) return;
    expect(walk.x).toBe(payment.position.x);
    expect(walk.z).toBe(payment.position.z);
    expect(walk.floor).toBe(0);
    expect(walk.y).toBe(0);
    expect(walk.walking).toBe(false);
  });
});

describe("patientWalkAt — walk phase and null windows", () => {
  it("walk phase advances with demo seconds while walking", () => {
    const a = patientWalkAt(timeline.stateAt(27));
    const b = patientWalkAt(timeline.stateAt(27.5));
    expect(a && b).toBeTruthy();
    if (!a || !b) return;
    expect(a.walkPhase).toBeCloseTo((27 * WALK_CYCLE_HZ) % 1, 6);
    expect(b.walkPhase).toBeCloseTo((27.5 * WALK_CYCLE_HZ) % 1, 6);
    expect(a.walkPhase).not.toBeCloseTo(b.walkPhase, 3);
  });

  it("returns null before the intro and after the outro", () => {
    expect(patientWalkAt(timeline.stateAt(-1))).toBeNull();
    expect(patientWalkAt(timeline.stateAt(180))).toBeNull();
  });

  it("returns null for a segment referencing an unknown station", () => {
    const fake = { ...segmentById("ticket-action"), stepId: "step-unknown" };
    expect(patientWalkAt(stateAtSegment(fake, 12))).toBeNull();
  });
});

describe("sampleRestackedPoseAt — dollhouse heights for the camera adapter", () => {
  it("every action segment focuses its own floor once heights are restacked", () => {
    for (const segment of segments) {
      if (segment.phase !== "action") continue;
      const pose = sampleRestackedPoseAt(segments, segment.startS + segment.durationS / 2);
      expect(pose).not.toBeNull();
      if (!pose) continue;
      const step = STEP_LOCATION_BY_ID.get(segment.stepId)!;
      const camera = cameraPoseToIsometric(pose);
      expect(camera.focusFloor).toBe(step.floor);
    }
  });

  it("adds 3 m per floor to the sampled target and leaves x, z untouched", () => {
    const raw = samplePoseAt(segments, 47);
    const restacked = sampleRestackedPoseAt(segments, 47);
    expect(raw && restacked).toBeTruthy();
    if (!raw || !restacked) return;
    expect(restacked.position.x).toBe(raw.position.x);
    expect(restacked.position.z).toBe(raw.position.z);
    expect(raw.target.y).toBeCloseTo(1.5, 6);
    expect(restacked.target.y).toBeCloseTo(1.5 + 3 * 0.5, 6);
  });

  it("crosses floors during the queue-to-consultation approach", () => {
    const early = cameraPoseToIsometric(sampleRestackedPoseAt(segments, 45)!);
    const mid = cameraPoseToIsometric(sampleRestackedPoseAt(segments, 47)!);
    const late = cameraPoseToIsometric(sampleRestackedPoseAt(segments, 49.9)!);
    expect(early.focusFloor).toBe(0);
    expect(mid.focusFloor).toBe(1);
    expect(late.focusFloor).toBe(1);
  });

  it("the intro and outro aerials end focused on the ground floor", () => {
    expect(cameraPoseToIsometric(sampleRestackedPoseAt(segments, 5)!).focusFloor).toBe(0);
    expect(cameraPoseToIsometric(sampleRestackedPoseAt(segments, 179.9)!).focusFloor).toBe(0);
  });

  it("keeps the same segment matching and null window as samplePoseAt", () => {
    expect(sampleRestackedPoseAt(segments, -1)).toBeNull();
    expect(sampleRestackedPoseAt(segments, 181)).toBeNull();
    expect(sampleRestackedPoseAt(segments, 180)).not.toBeNull();
  });
});

describe("patientWalkAt — every pipeline station is reachable", () => {
  it("each action segment holds its patient on the station floor with the marker at its feet", () => {
    for (const step of STEP_LOCATIONS) {
      const segment = segments.find((s) => s.stepId === step.stepId && s.phase === "action");
      expect(segment).toBeDefined();
      if (!segment) continue;
      const walk = patientWalkAt(timeline.stateAt(segment.startS + 0.01));
      expect(walk).not.toBeNull();
      if (!walk) continue;
      expect(walk.x).toBe(step.position.x);
      expect(walk.z).toBe(step.position.z);
      expect(walk.floor).toBe(step.floor);
      expect(walk.y).toBe(step.floor * 3);
    }
  });
});
