import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUALITY_SCORER_CONFIG,
  scoreDetectionQuality
} from "../src/qualityScorer";
import type { DetectionBox } from "../src/types";

const baseBox: DetectionBox = {
  x: 20,
  y: 20,
  w: 100,
  h: 100,
  confidence: 0.9,
  timestampMs: 0
};

describe("scoreDetectionQuality", () => {
  it("calculates weighted score from normalized components", () => {
    const result = scoreDetectionQuality({
      box: baseBox,
      frameWidth: 1000,
      frameHeight: 1000,
      stableFrames: 5
    });

    const expectedAreaNorm = (baseBox.w * baseBox.h) / (1000 * 1000) / 0.015;
    const expectedMarginNorm = (20 / 1000) / 0.03;
    const expectedStabilityNorm = 5 / 10;
    const expectedScore =
      0.35 * 0.9 +
      0.25 * expectedAreaNorm +
      0.2 * expectedMarginNorm +
      0.2 * expectedStabilityNorm;

    expect(result.breakdown.confidenceNorm).toBe(0.9);
    expect(result.breakdown.areaNorm).toBeCloseTo(expectedAreaNorm, 6);
    expect(result.breakdown.marginNorm).toBeCloseTo(expectedMarginNorm, 6);
    expect(result.breakdown.stabilityNorm).toBeCloseTo(expectedStabilityNorm, 6);
    expect(result.score).toBeCloseTo(expectedScore, 6);
  });

  it("clamps area, margin, and stability at 1", () => {
    const highSignalBox: DetectionBox = {
      x: 100,
      y: 100,
      w: 500,
      h: 500,
      confidence: 1,
      timestampMs: 0
    };

    const result = scoreDetectionQuality({
      box: highSignalBox,
      frameWidth: 1000,
      frameHeight: 1000,
      stableFrames: 20
    });

    expect(result.breakdown.areaNorm).toBe(1);
    expect(result.breakdown.marginNorm).toBe(1);
    expect(result.breakdown.stabilityNorm).toBe(1);
    expect(result.score).toBe(1);
  });

  it("adds reasons when a box fails quality gates", () => {
    const lowQualityBox: DetectionBox = {
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      confidence: 0.2,
      timestampMs: 0
    };

    const result = scoreDetectionQuality({
      box: lowQualityBox,
      frameWidth: 1000,
      frameHeight: 1000,
      stableFrames: 1
    });

    expect(result.reasons).toContain("low_confidence");
    expect(result.reasons).toContain("box_too_small");
    expect(result.reasons).toContain("too_close_to_edge");
    expect(result.reasons).toContain("not_stable_enough");
  });

  it("uses runtime-configurable normalization constants", () => {
    const result = scoreDetectionQuality(
      {
        box: baseBox,
        frameWidth: 1000,
        frameHeight: 1000,
        stableFrames: 5
      },
      {
        ...DEFAULT_QUALITY_SCORER_CONFIG,
        minBoxAreaRatio: 0.03,
        minEdgeMarginRatio: 0.06,
        readyConsecutiveFrames: 20
      }
    );

    expect(result.breakdown.areaNorm).toBeLessThan(1);
    expect(result.breakdown.marginNorm).toBeLessThan(1);
    expect(result.breakdown.stabilityNorm).toBe(0.25);
  });
});
