import type { DetectionBox, QualityScoreResult } from "./types";

export type QualityScorerConfig = {
  minBoxAreaRatio: number;
  minEdgeMarginRatio: number;
  readyConsecutiveFrames: number;
};

export const DEFAULT_QUALITY_SCORER_CONFIG: QualityScorerConfig = {
  minBoxAreaRatio: 0.015,
  minEdgeMarginRatio: 0.03,
  readyConsecutiveFrames: 10
};

export type QualityScoreInput = {
  box: DetectionBox;
  frameWidth: number;
  frameHeight: number;
  stableFrames: number;
};

const clamp01 = (value: number): number => {
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
};

const normalizeArea = (
  box: DetectionBox,
  frameWidth: number,
  frameHeight: number,
  minBoxAreaRatio: number
): { areaNorm: number; areaRatio: number } => {
  const frameArea = frameWidth * frameHeight;
  if (frameArea <= 0) {
    return { areaNorm: 0, areaRatio: 0 };
  }

  const boxArea = Math.max(0, box.w) * Math.max(0, box.h);
  const areaRatio = boxArea / frameArea;
  return {
    areaNorm: clamp01(areaRatio / minBoxAreaRatio),
    areaRatio
  };
};

const normalizeMargin = (
  box: DetectionBox,
  frameWidth: number,
  frameHeight: number,
  minEdgeMarginRatio: number
): { marginNorm: number; marginRatio: number } => {
  const rightMargin = frameWidth - (box.x + box.w);
  const bottomMargin = frameHeight - (box.y + box.h);
  const minMarginPx = Math.min(box.x, box.y, rightMargin, bottomMargin);

  const normalizer = Math.min(frameWidth, frameHeight);
  if (normalizer <= 0) {
    return { marginNorm: 0, marginRatio: 0 };
  }

  const marginRatio = Math.max(0, minMarginPx) / normalizer;
  return {
    marginNorm: clamp01(marginRatio / minEdgeMarginRatio),
    marginRatio
  };
};

export const scoreDetectionQuality = (
  input: QualityScoreInput,
  config: Partial<QualityScorerConfig> = {}
): QualityScoreResult => {
  const effectiveConfig = { ...DEFAULT_QUALITY_SCORER_CONFIG, ...config };
  const reasons: string[] = [];

  const confidenceNorm = clamp01(input.box.confidence);

  const { areaNorm, areaRatio } = normalizeArea(
    input.box,
    input.frameWidth,
    input.frameHeight,
    effectiveConfig.minBoxAreaRatio
  );

  const { marginNorm, marginRatio } = normalizeMargin(
    input.box,
    input.frameWidth,
    input.frameHeight,
    effectiveConfig.minEdgeMarginRatio
  );

  const stabilityNorm = clamp01(
    input.stableFrames / effectiveConfig.readyConsecutiveFrames
  );

  if (confidenceNorm < 0.5) {
    reasons.push("low_confidence");
  }
  if (areaRatio < effectiveConfig.minBoxAreaRatio) {
    reasons.push("box_too_small");
  }
  if (marginRatio < effectiveConfig.minEdgeMarginRatio) {
    reasons.push("too_close_to_edge");
  }
  if (stabilityNorm < 1) {
    reasons.push("not_stable_enough");
  }

  const score =
    0.35 * confidenceNorm +
    0.25 * areaNorm +
    0.2 * marginNorm +
    0.2 * stabilityNorm;

  return {
    score,
    breakdown: {
      confidenceNorm,
      areaNorm,
      marginNorm,
      stabilityNorm,
      score
    },
    reasons
  };
};
