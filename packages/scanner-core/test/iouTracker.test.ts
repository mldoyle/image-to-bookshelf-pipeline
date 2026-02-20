import { describe, expect, it } from "vitest";
import { IouTracker, intersectionOverUnion } from "../src/iouTracker";
import type { DetectionBox } from "../src/types";

const box = (
  x: number,
  y: number,
  w: number,
  h: number,
  confidence: number,
  timestampMs: number
): DetectionBox => ({ x, y, w, h, confidence, timestampMs });

describe("intersectionOverUnion", () => {
  it("returns 0 for non-overlapping boxes", () => {
    const a = box(0, 0, 100, 100, 1, 0);
    const b = box(200, 200, 100, 100, 1, 0);
    expect(intersectionOverUnion(a, b)).toBe(0);
  });

  it("returns expected overlap ratio for partial overlap", () => {
    const a = box(0, 0, 100, 100, 1, 0);
    const b = box(50, 0, 100, 100, 1, 0);
    expect(intersectionOverUnion(a, b)).toBeCloseTo(1 / 3, 6);
  });
});

describe("IouTracker", () => {
  it("matches detections to existing tracks and increments stability", () => {
    const tracker = new IouTracker({ iouMatchThreshold: 0.3, trackStaleMs: 400 });

    const frame1 = tracker.update([box(10, 10, 100, 200, 0.9, 0)], 0);
    expect(frame1).toHaveLength(1);
    expect(frame1[0].trackId).toBe(1);
    expect(frame1[0].stableFrames).toBe(1);

    const frame2 = tracker.update([box(14, 12, 100, 200, 0.92, 100)], 100);
    expect(frame2).toHaveLength(1);
    expect(frame2[0].trackId).toBe(1);
    expect(frame2[0].stableFrames).toBe(2);
  });

  it("starts new tracks for unmatched detections", () => {
    const tracker = new IouTracker({ iouMatchThreshold: 0.3, trackStaleMs: 400 });

    tracker.update([box(10, 10, 100, 200, 0.9, 0)], 0);
    const frame2 = tracker.update(
      [
        box(10, 10, 100, 200, 0.9, 100),
        box(500, 500, 100, 200, 0.9, 100)
      ],
      100
    );

    expect(frame2).toHaveLength(2);
    expect(frame2[0].trackId).toBe(1);
    expect(frame2[1].trackId).toBe(2);
  });

  it("drops stale tracks not seen within trackStaleMs", () => {
    const tracker = new IouTracker({ iouMatchThreshold: 0.3, trackStaleMs: 400 });

    tracker.update([box(10, 10, 100, 200, 0.9, 0)], 0);
    expect(tracker.getTracks()).toHaveLength(1);

    tracker.update([], 399);
    expect(tracker.getTracks()).toHaveLength(1);

    tracker.update([], 400);
    expect(tracker.getTracks()).toHaveLength(0);
  });

  it("resets stability when a track misses a frame", () => {
    const tracker = new IouTracker({ iouMatchThreshold: 0.3, trackStaleMs: 400 });

    tracker.update([box(10, 10, 100, 200, 0.9, 0)], 0);
    tracker.update([box(12, 12, 100, 200, 0.9, 100)], 100);
    const missingFrame = tracker.update([], 200);
    expect(missingFrame[0].stableFrames).toBe(0);

    const rematch = tracker.update([box(14, 14, 100, 200, 0.9, 300)], 300);
    expect(rematch[0].stableFrames).toBe(1);
  });
});
