import {
  parseDetectionPayload,
  type DetectionBox
} from "@bookshelf/scanner-core";
import type { FrameDetections } from "../types/vision";

export type DetectFrameOptions = {
  photoUri: string;
  frameTimestampMs: number;
  endpointUrl: string;
  endpointTimeoutMs?: number;
  minArea?: number;
  maxDetections?: number;
};

const resolveFrameDimensions = (
  payload: unknown
): { frameWidth: number; frameHeight: number } => {
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

  return { frameWidth, frameHeight };
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

  const { frameWidth, frameHeight } = resolveFrameDimensions(payload);
  const parsed = parseDetectionPayload(payload, {
    frameWidth,
    frameHeight,
    frameTimestampMs: options.frameTimestampMs,
    minBoxPixels: 2
  });
  const asRecord = payload as Record<string, unknown>;
  const backendBoxCount =
    typeof asRecord.count === "number" ? asRecord.count : parsed.boxes.length;

  return {
    frameWidth,
    frameHeight,
    boxes: parsed.boxes as DetectionBox[],
    frameTimestampMs: options.frameTimestampMs,
    detectorLatencyMs: Date.now() - startedAt,
    payloadCandidateCount: parsed.payloadCandidateCount,
    parsedBoxCount: parsed.boxes.length,
    backendBoxCount
  };
};
