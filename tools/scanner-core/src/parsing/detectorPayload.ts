import type { DetectionBox } from "../types";

type RawBox = {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  width?: number;
  height?: number;
  bbox?: unknown;
  xyxy?: unknown;
  score?: number;
  conf?: number;
  confidence?: number;
};

export type ParseDetectionPayloadOptions = {
  frameWidth: number;
  frameHeight: number;
  frameTimestampMs: number;
  minBoxPixels?: number;
};

export type ParseDetectionPayloadResult = {
  boxes: DetectionBox[];
  payloadCandidateCount: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const normalizeToPixels = (value: number, axisLength: number): number => {
  if (value >= 0 && value <= 1) {
    return value * axisLength;
  }
  return value;
};

const parseArrayAsBox = (raw: unknown): RawBox | null => {
  if (!Array.isArray(raw) || raw.length < 4) {
    return null;
  }

  const [a, b, c, d, score] = raw;
  if (
    typeof a !== "number" ||
    typeof b !== "number" ||
    typeof c !== "number" ||
    typeof d !== "number"
  ) {
    return null;
  }

  return {
    x1: a,
    y1: b,
    x2: c,
    y2: d,
    confidence: typeof score === "number" ? score : undefined
  };
};

export const parseDetectionPayload = (
  payload: unknown,
  options: ParseDetectionPayloadOptions
): ParseDetectionPayloadResult => {
  const { frameWidth, frameHeight, frameTimestampMs, minBoxPixels = 2 } = options;
  const asRecord = payload as Record<string, unknown>;
  const candidate =
    (Array.isArray(payload) ? payload : null) ??
    (Array.isArray(asRecord?.boxes) ? asRecord.boxes : null) ??
    (Array.isArray(asRecord?.detections) ? asRecord.detections : null) ??
    (Array.isArray(asRecord?.predictions) ? asRecord.predictions : null) ??
    (Array.isArray(asRecord?.results) ? asRecord.results : null) ??
    [];

  const parsed = candidate
    .map((item) => {
      if (Array.isArray(item)) {
        return parseArrayAsBox(item);
      }
      return item as RawBox;
    })
    .filter((item): item is RawBox => item !== null)
    .map((item) => {
      const bboxArray = Array.isArray(item.bbox) ? item.bbox : null;
      const xyxyArray = Array.isArray(item.xyxy) ? item.xyxy : null;

      const x1Candidate =
        item.x1 ??
        item.left ??
        (bboxArray?.[0] as number | undefined) ??
        (xyxyArray?.[0] as number | undefined);
      const y1Candidate =
        item.y1 ??
        item.top ??
        (bboxArray?.[1] as number | undefined) ??
        (xyxyArray?.[1] as number | undefined);
      const x2Candidate =
        item.x2 ??
        item.right ??
        (bboxArray?.[2] as number | undefined) ??
        (xyxyArray?.[2] as number | undefined);
      const y2Candidate =
        item.y2 ??
        item.bottom ??
        (bboxArray?.[3] as number | undefined) ??
        (xyxyArray?.[3] as number | undefined);

      if (
        typeof item.x === "number" &&
        typeof item.y === "number" &&
        typeof item.w === "number" &&
        typeof item.h === "number"
      ) {
        return {
          x: normalizeToPixels(item.x, frameWidth),
          y: normalizeToPixels(item.y, frameHeight),
          w: normalizeToPixels(item.w, frameWidth),
          h: normalizeToPixels(item.h, frameHeight),
          confidence: item.confidence ?? item.conf ?? item.score ?? 0.5
        };
      }

      if (
        typeof x1Candidate === "number" &&
        typeof y1Candidate === "number" &&
        typeof x2Candidate === "number" &&
        typeof y2Candidate === "number"
      ) {
        const x1 = normalizeToPixels(x1Candidate, frameWidth);
        const y1 = normalizeToPixels(y1Candidate, frameHeight);
        const x2 = normalizeToPixels(x2Candidate, frameWidth);
        const y2 = normalizeToPixels(y2Candidate, frameHeight);

        return {
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          w: Math.abs(x2 - x1),
          h: Math.abs(y2 - y1),
          confidence: item.confidence ?? item.conf ?? item.score ?? 0.5
        };
      }

      if (
        typeof item.x === "number" &&
        typeof item.y === "number" &&
        typeof item.width === "number" &&
        typeof item.height === "number"
      ) {
        return {
          x: normalizeToPixels(item.x, frameWidth),
          y: normalizeToPixels(item.y, frameHeight),
          w: normalizeToPixels(item.width, frameWidth),
          h: normalizeToPixels(item.height, frameHeight),
          confidence: item.confidence ?? item.conf ?? item.score ?? 0.5
        };
      }

      return null;
    })
    .filter(
      (
        parsedBox
      ): parsedBox is { x: number; y: number; w: number; h: number; confidence: number } =>
        parsedBox !== null
    )
    .map((item) => {
      const x = clamp(item.x, 0, frameWidth);
      const y = clamp(item.y, 0, frameHeight);
      const w = clamp(item.w, 0, Math.max(0, frameWidth - x));
      const h = clamp(item.h, 0, Math.max(0, frameHeight - y));
      return {
        x,
        y,
        w,
        h,
        confidence: clamp(item.confidence, 0, 1),
        timestampMs: frameTimestampMs
      } satisfies DetectionBox;
    })
    .filter((box) => box.w >= minBoxPixels && box.h >= minBoxPixels);

  return {
    boxes: parsed,
    payloadCandidateCount: candidate.length
  };
};
