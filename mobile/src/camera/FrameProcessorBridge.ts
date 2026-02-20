import type { DetectionBox } from "@scanner-core";
import type { FrameDetections } from "../types/vision";

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

export type DetectFrameOptions = {
  photoUri: string;
  frameTimestampMs: number;
  endpointUrl: string;
  endpointTimeoutMs?: number;
  minArea?: number;
  maxDetections?: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const parseBoxes = (
  payload: unknown,
  frameWidth: number,
  frameHeight: number,
  frameTimestampMs: number
): { boxes: DetectionBox[]; payloadCandidateCount: number } => {
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
        const x = normalizeToPixels(item.x, frameWidth);
        const y = normalizeToPixels(item.y, frameHeight);
        const w = normalizeToPixels(item.w, frameWidth);
        const h = normalizeToPixels(item.h, frameHeight);

        return {
          x,
          y,
          w,
          h,
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
        const x = normalizeToPixels(item.x, frameWidth);
        const y = normalizeToPixels(item.y, frameHeight);
        const w = normalizeToPixels(item.width, frameWidth);
        const h = normalizeToPixels(item.height, frameHeight);

        return {
          x,
          y,
          w,
          h,
          confidence: item.confidence ?? item.conf ?? item.score ?? 0.5
        };
      }

      return null;
    })
    .filter(
      (
        item
      ): item is { x: number; y: number; w: number; h: number; confidence: number } =>
        item !== null
    )
    .map((item) => {
      const x = clamp(item.x, 0, frameWidth);
      const y = clamp(item.y, 0, frameHeight);
      const maxW = Math.max(0, frameWidth - x);
      const maxH = Math.max(0, frameHeight - y);
      const w = clamp(item.w, 0, maxW);
      const h = clamp(item.h, 0, maxH);
      return {
        x,
        y,
        w,
        h,
        confidence: clamp(item.confidence, 0, 1),
        timestampMs: frameTimestampMs
      } satisfies DetectionBox;
    })
    .filter((box) => box.w > 1 && box.h > 1);

  return {
    boxes: parsed,
    payloadCandidateCount: candidate.length
  };
};

export const detectFrame = async (
  options: DetectFrameOptions
): Promise<FrameDetections> => {
  const startedAt = Date.now();

  const formData = new FormData();
  formData.append("image", {
    uri: options.photoUri,
    name: "frame.jpg",
    type: "image/jpeg"
  } as unknown as Blob);
  formData.append("minArea", String(Math.max(0, Math.round(options.minArea ?? 250))));
  formData.append(
    "maxDetections",
    String(Math.max(1, Math.round(options.maxDetections ?? 50)))
  );

  const controller = new AbortController();
  const timeoutMs = Math.max(200, options.endpointTimeoutMs ?? 1200);
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let payload: unknown;
  try {
    const response = await fetch(options.endpointUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`detect_http_${response.status}`);
    }

    payload = await response.json();
  } finally {
    clearTimeout(timeoutHandle);
  }

  const asRecord = payload as Record<string, unknown>;
  const frameWidth =
    typeof asRecord.frameWidth === "number"
      ? asRecord.frameWidth
      : typeof asRecord.width === "number"
        ? asRecord.width
        : 0;
  const frameHeight =
    typeof asRecord.frameHeight === "number"
      ? asRecord.frameHeight
      : typeof asRecord.height === "number"
        ? asRecord.height
        : 0;

  const parsed = parseBoxes(payload, frameWidth, frameHeight, options.frameTimestampMs);
  const backendBoxCount =
    typeof asRecord.count === "number" ? asRecord.count : parsed.boxes.length;

  return {
    frameWidth,
    frameHeight,
    boxes: parsed.boxes,
    frameTimestampMs: options.frameTimestampMs,
    detectorLatencyMs: Date.now() - startedAt,
    payloadCandidateCount: parsed.payloadCandidateCount,
    parsedBoxCount: parsed.boxes.length,
    backendBoxCount
  };
};
