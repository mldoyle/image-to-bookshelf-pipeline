import type { DetectionBox } from "@scanner-core";

export type DetectorMode = "mock" | "endpoint";

export type DetectFrameOptions = {
  mode: DetectorMode;
  videoEl: HTMLVideoElement;
  frameTimestampMs: number;
  endpointUrl?: string;
  endpointTimeoutMs?: number;
  endpointMinArea?: number;
  endpointMaxDetections?: number;
};

export type FrameDetections = {
  frameWidth: number;
  frameHeight: number;
  boxes: DetectionBox[];
  frameTimestampMs: number;
  detectorLatencyMs: number;
  detectorSource: DetectorMode;
  payloadCandidateCount: number;
  parsedBoxCount: number;
  backendBoxCount: number | null;
};

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

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const getVideoFrameDimensions = (
  videoEl: HTMLVideoElement
): { frameWidth: number; frameHeight: number } => ({
  frameWidth: videoEl.videoWidth || 0,
  frameHeight: videoEl.videoHeight || 0
});

const buildMockDetections = (
  frameWidth: number,
  frameHeight: number,
  frameTimestampMs: number
): FrameDetections => {
  const t = frameTimestampMs;
  const primaryW = Math.max(50, frameWidth * 0.12);
  const primaryH = Math.max(140, frameHeight * 0.56);
  const x =
    frameWidth * 0.42 + Math.sin(t / 650) * 18 - primaryW / 2;
  const y = frameHeight * 0.5 + Math.cos(t / 530) * 8 - primaryH / 2;

  const confidence = clamp(0.84 + Math.sin(t / 700) * 0.12, 0.5, 0.99);

  const boxes: DetectionBox[] = [
    {
      x: clamp(x, 0, Math.max(0, frameWidth - primaryW)),
      y: clamp(y, 0, Math.max(0, frameHeight - primaryH)),
      w: primaryW,
      h: primaryH,
      confidence,
      timestampMs: frameTimestampMs
    }
  ];

  if (Math.sin(t / 900) > 0.55) {
    const secondaryW = primaryW * 0.85;
    const secondaryH = primaryH * 0.7;
    boxes.push({
      x: clamp(frameWidth * 0.64, 0, Math.max(0, frameWidth - secondaryW)),
      y: clamp(frameHeight * 0.18, 0, Math.max(0, frameHeight - secondaryH)),
      w: secondaryW,
      h: secondaryH,
      confidence: 0.58,
      timestampMs: frameTimestampMs
    });
  }

  return {
    frameWidth,
    frameHeight,
    boxes,
    frameTimestampMs,
    detectorLatencyMs: 0,
    detectorSource: "mock",
    payloadCandidateCount: boxes.length,
    parsedBoxCount: boxes.length,
    backendBoxCount: null
  };
};

const frameToBlob = async (videoEl: HTMLVideoElement): Promise<Blob> => {
  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2d_canvas_unavailable");
  }
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("failed_to_encode_frame_blob"));
      }
    }, "image/jpeg", 0.8);
  });
};

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
        item.x1 ?? item.left ?? (bboxArray?.[0] as number | undefined) ?? (xyxyArray?.[0] as number | undefined);
      const y1Candidate =
        item.y1 ?? item.top ?? (bboxArray?.[1] as number | undefined) ?? (xyxyArray?.[1] as number | undefined);
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
        parsedBox
      ): parsedBox is { x: number; y: number; w: number; h: number; confidence: number } =>
        Boolean(parsedBox)
    )
    .map((item) => {
      const x = clamp(item.x, 0, frameWidth);
      const y = clamp(item.y, 0, frameHeight);
      const w = clamp(item.w, 0, frameWidth - x);
      const h = clamp(item.h, 0, frameHeight - y);

      return {
        x,
        y,
        w,
        h,
        confidence: clamp(item.confidence, 0, 1),
        timestampMs: frameTimestampMs
      };
    })
    .filter((item) => item.w >= 2 && item.h >= 2);

  return {
    boxes: parsed,
    payloadCandidateCount: candidate.length
  };
};

const detectViaEndpoint = async (
  options: DetectFrameOptions,
  frameWidth: number,
  frameHeight: number
): Promise<FrameDetections> => {
  const endpointUrl = options.endpointUrl?.trim();
  if (!endpointUrl) {
    throw new Error("endpoint_url_required");
  }

  const startedAt = performance.now();
  const controller = new AbortController();
  const timeoutMs = options.endpointTimeoutMs ?? 1200;
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const frameBlob = await frameToBlob(options.videoEl);
    const formData = new FormData();
    formData.append("image", frameBlob, "frame.jpg");
    formData.append("frameWidth", String(frameWidth));
    formData.append("frameHeight", String(frameHeight));
    formData.append("timestampMs", String(options.frameTimestampMs));
    formData.append("minArea", String(Math.max(0, Math.round(options.endpointMinArea ?? 250))));
    formData.append(
      "maxDetections",
      String(Math.max(1, Math.round(options.endpointMaxDetections ?? 50)))
    );

    const response = await fetch(endpointUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`endpoint_http_${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const payloadRecord = payload as Record<string, unknown>;
    const backendBoxCount =
      typeof payloadRecord?.count === "number"
        ? payloadRecord.count
        : Array.isArray(payloadRecord?.boxes)
          ? payloadRecord.boxes.length
          : null;

    const parsed = parseBoxes(
      payload,
      frameWidth,
      frameHeight,
      options.frameTimestampMs
    );

    return {
      frameWidth,
      frameHeight,
      boxes: parsed.boxes,
      frameTimestampMs: options.frameTimestampMs,
      detectorLatencyMs: performance.now() - startedAt,
      detectorSource: "endpoint",
      payloadCandidateCount: parsed.payloadCandidateCount,
      parsedBoxCount: parsed.boxes.length,
      backendBoxCount
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const detectFrame = async (
  options: DetectFrameOptions
): Promise<FrameDetections> => {
  const { frameWidth, frameHeight } = getVideoFrameDimensions(options.videoEl);
  if (frameWidth <= 0 || frameHeight <= 0) {
    return {
      frameWidth: 0,
      frameHeight: 0,
      boxes: [],
      frameTimestampMs: options.frameTimestampMs,
      detectorLatencyMs: 0,
      detectorSource: options.mode,
      payloadCandidateCount: 0,
      parsedBoxCount: 0,
      backendBoxCount: null
    };
  }

  if (options.mode === "endpoint") {
    return detectViaEndpoint(options, frameWidth, frameHeight);
  }

  return buildMockDetections(frameWidth, frameHeight, options.frameTimestampMs);
};
