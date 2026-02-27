export type DetectionBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
  timestampMs: number;
};

export type Track = {
  trackId: number;
  box: DetectionBox;
  stableFrames: number;
  lastSeenMs: number;
};

export type ReadyResult = {
  ready: boolean;
  score: number;
  reasons: string[];
};

export type QualityBreakdown = {
  confidenceNorm: number;
  areaNorm: number;
  marginNorm: number;
  stabilityNorm: number;
  score: number;
};

export type QualityScoreResult = {
  score: number;
  breakdown: QualityBreakdown;
  reasons: string[];
};
