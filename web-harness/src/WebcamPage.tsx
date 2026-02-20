import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_IOU_TRACKER_CONFIG,
  DEFAULT_QUALITY_SCORER_CONFIG,
  DEFAULT_READY_STATE_CONFIG,
  IouTracker,
  ReadyStateMachine,
  scoreDetectionQuality,
  type Track,
  type QualityBreakdown
} from "@scanner-core";
import { detectFrame, type DetectorMode } from "./detectorAdapter";

type HarnessThresholds = {
  iouMatchThreshold: number;
  trackStaleMs: number;
  readyScoreThreshold: number;
  readyConsecutiveFrames: number;
  captureCooldownMs: number;
  minBoxAreaRatio: number;
  minEdgeMarginRatio: number;
  minDetectionsForReady: number;
  minTotalBoxAreaRatioForReady: number;
  minHorizontalSpreadRatioForReady: number;
  minMeanAspectRatioForReady: number;
};

type DebugView = {
  detectorSource: DetectorMode;
  detectorLatencyMs: number;
  processedFrames: number;
  fps: number;
  detectionCount: number;
  payloadCandidateCount: number;
  parsedBoxCount: number;
  backendBoxCount: number | null;
  trackCount: number;
  scenePasses: boolean;
  totalBoxAreaRatio: number;
  horizontalSpreadRatio: number;
  meanAspectRatio: number;
  bestTrackId: number | null;
  bestScore: number;
  ready: boolean;
  triggered: boolean;
  triggerCount: number;
  consecutiveReadyFrames: number;
  cooldownRemainingMs: number;
  reasons: string[];
  breakdown: QualityBreakdown | null;
  lastError: string | null;
};

type LookupBookItem = {
  id?: string;
  title?: string;
  authors?: string[];
  publishedDate?: string;
  publisher?: string;
  infoLink?: string;
};

type CaptureScanSpine = {
  spineIndex: number;
  bbox: [number, number, number, number];
  confidence: number;
  extraction: {
    title: string;
    author: string | null;
    confidence: number;
  };
  lookup: {
    totalItems: number;
    items: LookupBookItem[];
    error: string | null;
  };
};

type CaptureScanResponse = {
  count: number;
  frameWidth: number;
  frameHeight: number;
  spines: CaptureScanSpine[];
  timingsMs?: {
    detect: number;
    extractLookup: number;
    total: number;
  };
};

const DEFAULT_THRESHOLDS: HarnessThresholds = {
  iouMatchThreshold: DEFAULT_IOU_TRACKER_CONFIG.iouMatchThreshold,
  trackStaleMs: DEFAULT_IOU_TRACKER_CONFIG.trackStaleMs,
  readyScoreThreshold: DEFAULT_READY_STATE_CONFIG.readyScoreThreshold,
  readyConsecutiveFrames: DEFAULT_READY_STATE_CONFIG.readyConsecutiveFrames,
  captureCooldownMs: DEFAULT_READY_STATE_CONFIG.captureCooldownMs,
  minBoxAreaRatio: DEFAULT_QUALITY_SCORER_CONFIG.minBoxAreaRatio,
  minEdgeMarginRatio: DEFAULT_QUALITY_SCORER_CONFIG.minEdgeMarginRatio,
  minDetectionsForReady: 3,
  minTotalBoxAreaRatioForReady: 0.08,
  minHorizontalSpreadRatioForReady: 0.28,
  minMeanAspectRatioForReady: 1.35
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const ensureValue = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

const createInitialDebugView = (): DebugView => ({
  detectorSource: "mock",
  detectorLatencyMs: 0,
  processedFrames: 0,
  fps: 0,
  detectionCount: 0,
  payloadCandidateCount: 0,
  parsedBoxCount: 0,
  backendBoxCount: null,
  trackCount: 0,
  scenePasses: false,
  totalBoxAreaRatio: 0,
  horizontalSpreadRatio: 0,
  meanAspectRatio: 0,
  bestTrackId: null,
  bestScore: 0,
  ready: false,
  triggered: false,
  triggerCount: 0,
  consecutiveReadyFrames: 0,
  cooldownRemainingMs: 0,
  reasons: [],
  breakdown: null,
  lastError: null
});

type SceneQuality = {
  passes: boolean;
  reasons: string[];
  totalBoxAreaRatio: number;
  horizontalSpreadRatio: number;
  meanAspectRatio: number;
};

const computeSceneQuality = (
  tracks: Track[],
  frameWidth: number,
  frameHeight: number,
  thresholds: HarnessThresholds
): SceneQuality => {
  if (frameWidth <= 0 || frameHeight <= 0 || tracks.length === 0) {
    return {
      passes: false,
      reasons: ["scene_empty"],
      totalBoxAreaRatio: 0,
      horizontalSpreadRatio: 0,
      meanAspectRatio: 0
    };
  }

  const frameArea = frameWidth * frameHeight;
  const totalBoxArea = tracks.reduce(
    (acc, track) => acc + Math.max(0, track.box.w) * Math.max(0, track.box.h),
    0
  );
  const totalBoxAreaRatio = frameArea > 0 ? totalBoxArea / frameArea : 0;

  const xMin = Math.min(...tracks.map((track) => track.box.x));
  const xMax = Math.max(...tracks.map((track) => track.box.x + track.box.w));
  const horizontalSpreadRatio =
    frameWidth > 0 ? Math.max(0, xMax - xMin) / frameWidth : 0;

  const meanAspectRatio =
    tracks.reduce((acc, track) => {
      const safeW = Math.max(1, track.box.w);
      const safeH = Math.max(1, track.box.h);
      return acc + safeH / safeW;
    }, 0) / tracks.length;

  const reasons: string[] = [];
  if (tracks.length < thresholds.minDetectionsForReady) {
    reasons.push("scene_too_few_books");
  }
  if (totalBoxAreaRatio < thresholds.minTotalBoxAreaRatioForReady) {
    reasons.push("scene_low_coverage");
  }
  if (horizontalSpreadRatio < thresholds.minHorizontalSpreadRatioForReady) {
    reasons.push("scene_not_wide_enough");
  }
  if (meanAspectRatio < thresholds.minMeanAspectRatioForReady) {
    reasons.push("scene_boxes_not_spine_like");
  }

  return {
    passes: reasons.length === 0,
    reasons,
    totalBoxAreaRatio,
    horizontalSpreadRatio,
    meanAspectRatio
  };
};

const waitForVideoMetadata = async (videoEl: HTMLVideoElement): Promise<void> => {
  if (videoEl.readyState >= 1) {
    return;
  }

  await new Promise<void>((resolve) => {
    const onLoaded = () => {
      videoEl.removeEventListener("loadedmetadata", onLoaded);
      resolve();
    };
    videoEl.addEventListener("loadedmetadata", onLoaded);
  });
};

const drawOverlay = (
  canvas: HTMLCanvasElement,
  frameWidth: number,
  frameHeight: number,
  tracks: Array<{ trackId: number; x: number; y: number; w: number; h: number }>,
  bestTrackId: number | null,
  ready: boolean
): void => {
  if (canvas.width !== frameWidth || canvas.height !== frameHeight) {
    canvas.width = frameWidth;
    canvas.height = frameHeight;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, frameWidth, frameHeight);
  if (tracks.length === 0) {
    return;
  }

  const strokeWidth = Math.max(2, frameWidth * 0.004);
  ctx.lineWidth = strokeWidth;
  ctx.font = `${Math.max(12, frameWidth * 0.016)}px "Sora", "Avenir Next", sans-serif`;

  tracks.forEach((track) => {
    const isBestReadyTrack = ready && track.trackId === bestTrackId;
    const color = isBestReadyTrack ? "#30d158" : "#ffd166";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    ctx.strokeRect(track.x, track.y, track.w, track.h);
    const label = `T${track.trackId}`;
    ctx.fillText(label, track.x + 4, Math.max(14, track.y - 6));
  });
};

const captureVideoFrame = (
  videoEl: HTMLVideoElement,
  snapshotCanvas: HTMLCanvasElement
): string => {
  snapshotCanvas.width = videoEl.videoWidth;
  snapshotCanvas.height = videoEl.videoHeight;
  const ctx = snapshotCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("snapshot_canvas_unavailable");
  }
  ctx.drawImage(videoEl, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
  return snapshotCanvas.toDataURL("image/jpeg", 0.9);
};

const snapshotCanvasToBlob = async (
  snapshotCanvas: HTMLCanvasElement
): Promise<Blob> => {
  return new Promise<Blob>((resolve, reject) => {
    snapshotCanvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("capture_blob_encode_failed"));
      }
    }, "image/jpeg", 0.9);
  });
};

export function WebcamPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const processingRef = useRef(false);
  const fpsWindowStartRef = useRef(performance.now());
  const fpsFrameCountRef = useRef(0);
  const fpsRef = useRef(0);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectorMode, setDetectorMode] = useState<DetectorMode>("endpoint");
  const [endpointUrl, setEndpointUrl] = useState("http://127.0.0.1:5000/detect/spines");
  const [captureEndpointUrl, setCaptureEndpointUrl] = useState(
    "http://127.0.0.1:5000/scan/capture"
  );
  const [endpointTimeoutMs, setEndpointTimeoutMs] = useState(1200);
  const [endpointMinArea, setEndpointMinArea] = useState(250);
  const [endpointMaxDetections, setEndpointMaxDetections] = useState(50);
  const [captureLookupMaxResults, setCaptureLookupMaxResults] = useState(3);
  const [captureInFlight, setCaptureInFlight] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureResults, setCaptureResults] = useState<CaptureScanSpine[]>([]);
  const [captureTimings, setCaptureTimings] = useState<{
    detect: number;
    extractLookup: number;
    total: number;
  } | null>(null);
  const [verboseLogs, setVerboseLogs] = useState(false);
  const [logEveryNFrames, setLogEveryNFrames] = useState(20);
  const [frameIntervalMs, setFrameIntervalMs] = useState(120);
  const [thresholds, setThresholds] = useState<HarnessThresholds>(DEFAULT_THRESHOLDS);
  const [latestCaptureDataUrl, setLatestCaptureDataUrl] = useState<string | null>(null);
  const [debugView, setDebugView] = useState<DebugView>(createInitialDebugView);

  const thresholdsRef = useRef(thresholds);
  useEffect(() => {
    thresholdsRef.current = thresholds;
  }, [thresholds]);

  const detectorSettingsRef = useRef({
    detectorMode,
    endpointUrl,
    endpointTimeoutMs,
    endpointMinArea,
    endpointMaxDetections,
    verboseLogs,
    logEveryNFrames
  });
  useEffect(() => {
    detectorSettingsRef.current = {
      detectorMode,
      endpointUrl,
      endpointTimeoutMs,
      endpointMinArea,
      endpointMaxDetections,
      verboseLogs,
      logEveryNFrames
    };
  }, [
    detectorMode,
    endpointUrl,
    endpointTimeoutMs,
    endpointMinArea,
    endpointMaxDetections,
    verboseLogs,
    logEveryNFrames
  ]);

  const trackerRef = useRef(
    new IouTracker({
      iouMatchThreshold: thresholds.iouMatchThreshold,
      trackStaleMs: thresholds.trackStaleMs
    })
  );
  const readyMachineRef = useRef(
    new ReadyStateMachine({
      readyScoreThreshold: thresholds.readyScoreThreshold,
      readyConsecutiveFrames: thresholds.readyConsecutiveFrames,
      captureCooldownMs: thresholds.captureCooldownMs
    })
  );

  useEffect(() => {
    trackerRef.current = new IouTracker({
      iouMatchThreshold: thresholds.iouMatchThreshold,
      trackStaleMs: thresholds.trackStaleMs
    });
    readyMachineRef.current = new ReadyStateMachine({
      readyScoreThreshold: thresholds.readyScoreThreshold,
      readyConsecutiveFrames: thresholds.readyConsecutiveFrames,
      captureCooldownMs: thresholds.captureCooldownMs
    });
    setDebugView((previous) => ({
      ...previous,
      ready: false,
      triggered: false,
      bestScore: 0,
      bestTrackId: null,
      consecutiveReadyFrames: 0,
      cooldownRemainingMs: 0,
      breakdown: null,
      reasons: ["thresholds_updated"]
    }));
  }, [thresholds]);

  const stopCamera = useCallback(() => {
    if (loopRef.current !== null) {
      window.clearInterval(loopRef.current);
      loopRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    stopCamera();

    const videoEl = videoRef.current;
    if (!videoEl) {
      setCameraError("video_element_missing");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      videoEl.srcObject = stream;
      await waitForVideoMetadata(videoEl);
      await videoEl.play();

      setCameraReady(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "camera_permission_or_device_error";
      setCameraError(message);
      setCameraReady(false);
    }
  }, [stopCamera]);

  const processFrame = useCallback(async () => {
    if (processingRef.current || !cameraReady) {
      return;
    }

    const videoEl = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const snapshotCanvas = snapshotCanvasRef.current;
    if (!videoEl || !overlayCanvas || !snapshotCanvas || videoEl.videoWidth === 0) {
      return;
    }

    processingRef.current = true;
    const timestampMs = performance.now();

    try {
      const detections = await detectFrame({
        mode: detectorSettingsRef.current.detectorMode,
        videoEl,
        frameTimestampMs: timestampMs,
        endpointUrl: detectorSettingsRef.current.endpointUrl,
        endpointTimeoutMs: detectorSettingsRef.current.endpointTimeoutMs,
        endpointMinArea: detectorSettingsRef.current.endpointMinArea,
        endpointMaxDetections: detectorSettingsRef.current.endpointMaxDetections
      });

      const tracks = trackerRef.current.update(
        detections.boxes,
        detections.frameTimestampMs
      );
      const sceneQuality = computeSceneQuality(
        tracks,
        detections.frameWidth,
        detections.frameHeight,
        thresholdsRef.current
      );

      const qualityResults = tracks.map((track) => {
        const quality = scoreDetectionQuality(
          {
            box: track.box,
            frameWidth: detections.frameWidth,
            frameHeight: detections.frameHeight,
            stableFrames: track.stableFrames
          },
          {
            minBoxAreaRatio: thresholdsRef.current.minBoxAreaRatio,
            minEdgeMarginRatio: thresholdsRef.current.minEdgeMarginRatio,
            readyConsecutiveFrames: thresholdsRef.current.readyConsecutiveFrames
          }
        );

        return {
          track,
          quality
        };
      });

      const best = qualityResults.reduce<
        (typeof qualityResults)[number] | null
      >((currentBest, current) => {
        if (!currentBest) {
          return current;
        }
        return current.quality.score > currentBest.quality.score
          ? current
          : currentBest;
      }, null);

      const readyUpdate = sceneQuality.passes
        ? readyMachineRef.current.updateFromCandidates(
            detections.frameTimestampMs,
            qualityResults.map((result) => ({
              ready: false,
              score: result.quality.score,
              reasons: result.quality.reasons
            }))
          )
        : readyMachineRef.current.update({
            timestampMs: detections.frameTimestampMs,
            score: null,
            reasons: sceneQuality.reasons
          });

      drawOverlay(
        overlayCanvas,
        detections.frameWidth,
        detections.frameHeight,
        tracks.map((track) => ({
          trackId: track.trackId,
          x: track.box.x,
          y: track.box.y,
          w: track.box.w,
          h: track.box.h
        })),
        best?.track.trackId ?? null,
        readyUpdate.ready
      );

      let frameTriggered = false;
      if (readyUpdate.triggered) {
        const snapshot = captureVideoFrame(videoEl, snapshotCanvas);
        setLatestCaptureDataUrl(snapshot);
        frameTriggered = true;
      }

      fpsFrameCountRef.current += 1;
      const elapsedMs = timestampMs - fpsWindowStartRef.current;
      let fps = fpsRef.current;
      if (elapsedMs >= 1000) {
        fps = (fpsFrameCountRef.current / elapsedMs) * 1000;
        fpsFrameCountRef.current = 0;
        fpsWindowStartRef.current = timestampMs;
        fpsRef.current = fps;
      }

      setDebugView((previous) => ({
        ...previous,
        detectorSource: detections.detectorSource,
        detectorLatencyMs: detections.detectorLatencyMs,
        processedFrames: previous.processedFrames + 1,
        fps,
        detectionCount: detections.boxes.length,
        payloadCandidateCount: detections.payloadCandidateCount,
        parsedBoxCount: detections.parsedBoxCount,
        backendBoxCount: detections.backendBoxCount,
        trackCount: tracks.length,
        scenePasses: sceneQuality.passes,
        totalBoxAreaRatio: sceneQuality.totalBoxAreaRatio,
        horizontalSpreadRatio: sceneQuality.horizontalSpreadRatio,
        meanAspectRatio: sceneQuality.meanAspectRatio,
        bestTrackId: best?.track.trackId ?? null,
        bestScore: best?.quality.score ?? 0,
        ready: readyUpdate.ready,
        triggered: frameTriggered,
        triggerCount: frameTriggered ? previous.triggerCount + 1 : previous.triggerCount,
        consecutiveReadyFrames: readyUpdate.consecutiveReadyFrames,
        cooldownRemainingMs: readyUpdate.cooldownRemainingMs,
        reasons: sceneQuality.passes
          ? best?.quality.reasons ?? readyUpdate.reasons
          : sceneQuality.reasons,
        breakdown: best?.quality.breakdown ?? null,
        lastError: null
      }));

      const processedFrameCount = debugView.processedFrames + 1;
      if (
        detectorSettingsRef.current.verboseLogs &&
        processedFrameCount % Math.max(1, detectorSettingsRef.current.logEveryNFrames) === 0
      ) {
        const summary = {
          frame: processedFrameCount,
          source: detections.detectorSource,
          detectorLatencyMs: Number(detections.detectorLatencyMs.toFixed(1)),
          payloadCandidateCount: detections.payloadCandidateCount,
          backendBoxCount: detections.backendBoxCount,
          parsedBoxCount: detections.parsedBoxCount,
          trackCount: tracks.length,
          bestTrackId: best?.track.trackId ?? null,
          bestScore: Number((best?.quality.score ?? 0).toFixed(3)),
          scenePasses: sceneQuality.passes,
          totalBoxAreaRatio: Number(sceneQuality.totalBoxAreaRatio.toFixed(3)),
          horizontalSpreadRatio: Number(sceneQuality.horizontalSpreadRatio.toFixed(3)),
          meanAspectRatio: Number(sceneQuality.meanAspectRatio.toFixed(3)),
          ready: readyUpdate.ready,
          reasons: sceneQuality.passes
            ? best?.quality.reasons ?? readyUpdate.reasons
            : sceneQuality.reasons
        };
        // eslint-disable-next-line no-console
        console.log("[web-harness] frame summary", summary);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "frame_processing_error";
      setDebugView((previous) => ({
        ...previous,
        triggered: false,
        lastError: message
      }));
    } finally {
      processingRef.current = false;
    }
  }, [cameraReady]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (!cameraReady) {
      return;
    }

    if (loopRef.current !== null) {
      window.clearInterval(loopRef.current);
    }

    loopRef.current = window.setInterval(() => {
      void processFrame();
    }, frameIntervalMs);

    return () => {
      if (loopRef.current !== null) {
        window.clearInterval(loopRef.current);
        loopRef.current = null;
      }
    };
  }, [cameraReady, frameIntervalMs, processFrame]);

  const updateThreshold = useCallback(
    <K extends keyof HarnessThresholds>(key: K, value: number) => {
      setThresholds((previous) => ({
        ...previous,
        [key]: ensureValue(value, previous[key])
      }));
    },
    []
  );

  const applyCapturePromptPreset = useCallback(() => {
    setThresholds((previous) => ({
      ...previous,
      readyScoreThreshold: 0.76,
      readyConsecutiveFrames: 12,
      minBoxAreaRatio: 0.018,
      minEdgeMarginRatio: 0.04,
      minDetectionsForReady: 3,
      minTotalBoxAreaRatioForReady: 0.08,
      minHorizontalSpreadRatioForReady: 0.28,
      minMeanAspectRatioForReady: 1.35
    }));
  }, []);

  const runCaptureLookup = useCallback(async () => {
    if (captureInFlight) {
      return;
    }

    const videoEl = videoRef.current;
    const snapshotCanvas = snapshotCanvasRef.current;
    if (!videoEl || !snapshotCanvas || videoEl.videoWidth === 0) {
      setCaptureError("camera_not_ready");
      return;
    }

    setCaptureInFlight(true);
    setCaptureError(null);

    try {
      const snapshotDataUrl = captureVideoFrame(videoEl, snapshotCanvas);
      setLatestCaptureDataUrl(snapshotDataUrl);

      const frameBlob = await snapshotCanvasToBlob(snapshotCanvas);
      const formData = new FormData();
      formData.append("image", frameBlob, "capture.jpg");
      formData.append("minArea", String(Math.max(0, Math.round(endpointMinArea))));
      formData.append(
        "maxDetections",
        String(Math.max(1, Math.round(endpointMaxDetections)))
      );
      formData.append(
        "maxLookupResults",
        String(Math.max(1, Math.round(captureLookupMaxResults)))
      );

      const response = await fetch(captureEndpointUrl, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(`capture_http_${response.status}`);
      }

      const payload = (await response.json()) as CaptureScanResponse;
      const spines = Array.isArray(payload.spines) ? payload.spines : [];
      setCaptureResults(spines);
      setCaptureTimings(payload.timingsMs ?? null);

      if (verboseLogs) {
        // eslint-disable-next-line no-console
        console.log("[web-harness] capture response", {
          count: payload.count,
          timingsMs: payload.timingsMs ?? null,
          sample: spines.slice(0, 2)
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "capture_lookup_failed";
      setCaptureError(message);
    } finally {
      setCaptureInFlight(false);
    }
  }, [
    captureEndpointUrl,
    captureInFlight,
    captureLookupMaxResults,
    endpointMaxDetections,
    endpointMinArea,
    verboseLogs
  ]);

  const readyBadgeClassName = useMemo(() => {
    if (debugView.ready) {
      return "status-badge ready";
    }
    return "status-badge waiting";
  }, [debugView.ready]);

  return (
    <main className="harness-page">
      <section className="hero">
        <h1>Bookshelf Scanner Webcam Harness</h1>
        <p>
          Live webcam loop with shared tracking/scoring logic from
          <code> scanner-core</code>.
        </p>
      </section>

      <section className="controls-grid">
        <article className="card">
          <h2>Camera</h2>
          <div className="row">
            <button type="button" onClick={() => void startCamera()}>
              Restart camera
            </button>
            <button type="button" className="secondary" onClick={stopCamera}>
              Stop camera
            </button>
          </div>
          <p className="muted">Status: {cameraReady ? "running" : "stopped"}</p>
          {cameraError ? <p className="error">{cameraError}</p> : null}
        </article>

        <article className="card">
          <h2>Detector Adapter</h2>
          {detectorMode === "mock" ? (
            <p className="warning">
              Using mock mode: boxes are synthetic and do not come from your Flask model.
            </p>
          ) : null}
          <label>
            Mode
            <select
              value={detectorMode}
              onChange={(event) => setDetectorMode(event.target.value as DetectorMode)}
            >
              <option value="mock">Mock detections</option>
              <option value="endpoint">POST to backend endpoint</option>
            </select>
          </label>
          <label>
            Endpoint URL
            <input
              type="text"
              value={endpointUrl}
              onChange={(event) => setEndpointUrl(event.target.value)}
              disabled={detectorMode !== "endpoint"}
              spellCheck={false}
            />
          </label>
          <label>
            Capture endpoint URL
            <input
              type="text"
              value={captureEndpointUrl}
              onChange={(event) => setCaptureEndpointUrl(event.target.value)}
              spellCheck={false}
            />
          </label>
          <label>
            Endpoint timeout (ms)
            <input
              type="number"
              min={100}
              step={50}
              value={endpointTimeoutMs}
              onChange={(event) =>
                setEndpointTimeoutMs(
                  clamp(Number(event.target.value), 100, 10000)
                )
              }
            />
          </label>
          <label>
            Endpoint min area (px²)
            <input
              type="number"
              min={0}
              step={50}
              value={endpointMinArea}
              onChange={(event) =>
                setEndpointMinArea(clamp(Number(event.target.value), 0, 500000))
              }
              disabled={detectorMode !== "endpoint"}
            />
          </label>
          <label>
            Endpoint max detections
            <input
              type="number"
              min={1}
              step={1}
              value={endpointMaxDetections}
              onChange={(event) =>
                setEndpointMaxDetections(
                  clamp(Math.round(Number(event.target.value)), 1, 500)
                )
              }
              disabled={detectorMode !== "endpoint"}
            />
          </label>
          <label>
            Capture lookup max results
            <input
              type="number"
              min={1}
              step={1}
              value={captureLookupMaxResults}
              onChange={(event) =>
                setCaptureLookupMaxResults(
                  clamp(Math.round(Number(event.target.value)), 1, 10)
                )
              }
            />
          </label>
          <label>
            Verbose logs
            <input
              type="checkbox"
              checked={verboseLogs}
              onChange={(event) => setVerboseLogs(event.target.checked)}
            />
          </label>
          <label>
            Log every N frames
            <input
              type="number"
              min={1}
              step={1}
              value={logEveryNFrames}
              onChange={(event) =>
                setLogEveryNFrames(clamp(Math.round(Number(event.target.value)), 1, 300))
              }
              disabled={!verboseLogs}
            />
          </label>
          <label>
            Frame interval (ms)
            <input
              type="number"
              min={50}
              step={10}
              value={frameIntervalMs}
              onChange={(event) =>
                setFrameIntervalMs(clamp(Number(event.target.value), 50, 2000))
              }
            />
          </label>
        </article>

        <article className="card">
          <h2>Thresholds</h2>
          <div className="row">
            <button type="button" onClick={applyCapturePromptPreset}>
              Apply capture preset
            </button>
          </div>
          <label>
            IoU match threshold
            <input
              type="number"
              step={0.01}
              value={thresholds.iouMatchThreshold}
              onChange={(event) =>
                updateThreshold(
                  "iouMatchThreshold",
                  clamp(Number(event.target.value), 0.05, 0.95)
                )
              }
            />
          </label>
          <label>
            Track stale (ms)
            <input
              type="number"
              step={10}
              value={thresholds.trackStaleMs}
              onChange={(event) =>
                updateThreshold(
                  "trackStaleMs",
                  clamp(Number(event.target.value), 100, 5000)
                )
              }
            />
          </label>
          <label>
            Ready score threshold
            <input
              type="number"
              step={0.01}
              value={thresholds.readyScoreThreshold}
              onChange={(event) =>
                updateThreshold(
                  "readyScoreThreshold",
                  clamp(Number(event.target.value), 0.05, 1)
                )
              }
            />
          </label>
          <label>
            Ready consecutive frames
            <input
              type="number"
              step={1}
              value={thresholds.readyConsecutiveFrames}
              onChange={(event) =>
                updateThreshold(
                  "readyConsecutiveFrames",
                  clamp(Math.round(Number(event.target.value)), 1, 120)
                )
              }
            />
          </label>
          <label>
            Capture cooldown (ms)
            <input
              type="number"
              step={50}
              value={thresholds.captureCooldownMs}
              onChange={(event) =>
                updateThreshold(
                  "captureCooldownMs",
                  clamp(Number(event.target.value), 100, 10000)
                )
              }
            />
          </label>
          <label>
            Min box area ratio
            <input
              type="number"
              step={0.001}
              value={thresholds.minBoxAreaRatio}
              onChange={(event) =>
                updateThreshold(
                  "minBoxAreaRatio",
                  clamp(Number(event.target.value), 0.001, 0.5)
                )
              }
            />
          </label>
          <label>
            Min edge margin ratio
            <input
              type="number"
              step={0.001}
              value={thresholds.minEdgeMarginRatio}
              onChange={(event) =>
                updateThreshold(
                  "minEdgeMarginRatio",
                  clamp(Number(event.target.value), 0.001, 0.25)
                )
              }
            />
          </label>
          <label>
            Min detections for ready
            <input
              type="number"
              step={1}
              value={thresholds.minDetectionsForReady}
              onChange={(event) =>
                updateThreshold(
                  "minDetectionsForReady",
                  clamp(Math.round(Number(event.target.value)), 1, 30)
                )
              }
            />
          </label>
          <label>
            Min total box area ratio
            <input
              type="number"
              step={0.01}
              value={thresholds.minTotalBoxAreaRatioForReady}
              onChange={(event) =>
                updateThreshold(
                  "minTotalBoxAreaRatioForReady",
                  clamp(Number(event.target.value), 0.01, 0.8)
                )
              }
            />
          </label>
          <label>
            Min horizontal spread ratio
            <input
              type="number"
              step={0.01}
              value={thresholds.minHorizontalSpreadRatioForReady}
              onChange={(event) =>
                updateThreshold(
                  "minHorizontalSpreadRatioForReady",
                  clamp(Number(event.target.value), 0.05, 1)
                )
              }
            />
          </label>
          <label>
            Min mean aspect ratio
            <input
              type="number"
              step={0.05}
              value={thresholds.minMeanAspectRatioForReady}
              onChange={(event) =>
                updateThreshold(
                  "minMeanAspectRatioForReady",
                  clamp(Number(event.target.value), 0.4, 8)
                )
              }
            />
          </label>
        </article>
      </section>

      <section className="preview-grid">
        <article className="card preview-card">
          <div className="preview-header">
            <h2>Live Preview</h2>
            <span className={readyBadgeClassName}>
              {debugView.ready ? "READY" : "WAITING"}
            </span>
          </div>
          <div className="camera-stage">
            <video ref={videoRef} className="camera-layer" playsInline muted />
            <canvas ref={overlayCanvasRef} className="overlay-layer" />
          </div>
          <p className="muted">
            Yellow boxes: detected tracks. Green box: best track when ready.
          </p>
        </article>

        <article className="card debug-card">
          <h2>Live Debug</h2>
          <dl>
            <dt>Detector source</dt>
            <dd>{debugView.detectorSource}</dd>
            <dt>Processed frames</dt>
            <dd>{debugView.processedFrames}</dd>
            <dt>Effective FPS</dt>
            <dd>{debugView.fps.toFixed(1)}</dd>
            <dt>Detector latency</dt>
            <dd>{debugView.detectorLatencyMs.toFixed(1)} ms</dd>
            <dt>Payload candidates</dt>
            <dd>{debugView.payloadCandidateCount}</dd>
            <dt>Backend box count</dt>
            <dd>{debugView.backendBoxCount ?? "n/a"}</dd>
            <dt>Parsed boxes</dt>
            <dd>{debugView.parsedBoxCount}</dd>
            <dt>Detections</dt>
            <dd>{debugView.detectionCount}</dd>
            <dt>Tracks</dt>
            <dd>{debugView.trackCount}</dd>
            <dt>Scene gates</dt>
            <dd>{debugView.scenePasses ? "pass" : "blocked"}</dd>
            <dt>Total box area ratio</dt>
            <dd>{debugView.totalBoxAreaRatio.toFixed(3)}</dd>
            <dt>Horizontal spread ratio</dt>
            <dd>{debugView.horizontalSpreadRatio.toFixed(3)}</dd>
            <dt>Mean aspect ratio</dt>
            <dd>{debugView.meanAspectRatio.toFixed(3)}</dd>
            <dt>Best track</dt>
            <dd>{debugView.bestTrackId ?? "none"}</dd>
            <dt>Best score</dt>
            <dd>{debugView.bestScore.toFixed(3)}</dd>
            <dt>Consecutive ready frames</dt>
            <dd>{debugView.consecutiveReadyFrames}</dd>
            <dt>Cooldown remaining</dt>
            <dd>{Math.ceil(debugView.cooldownRemainingMs)} ms</dd>
            <dt>Auto-capture triggers</dt>
            <dd>{debugView.triggerCount}</dd>
          </dl>

          {debugView.breakdown ? (
            <div className="breakdown">
              <h3>Score Breakdown</h3>
              <p>confidence: {debugView.breakdown.confidenceNorm.toFixed(3)}</p>
              <p>area: {debugView.breakdown.areaNorm.toFixed(3)}</p>
              <p>margin: {debugView.breakdown.marginNorm.toFixed(3)}</p>
              <p>stability: {debugView.breakdown.stabilityNorm.toFixed(3)}</p>
            </div>
          ) : null}

          <div className="breakdown">
            <h3>Reasons</h3>
            <p>{debugView.reasons.length ? debugView.reasons.join(", ") : "none"}</p>
          </div>

          {debugView.lastError ? <p className="error">{debugView.lastError}</p> : null}
        </article>
      </section>

      <section className="capture-strip">
        <article className="card">
          <div className="capture-header">
            <h2>Capture & Lookup</h2>
            <button
              type="button"
              onClick={() => void runCaptureLookup()}
              disabled={captureInFlight}
            >
              {captureInFlight ? "Running..." : "Capture & Lookup"}
            </button>
          </div>
          {captureTimings ? (
            <p className="muted">
              detect: {captureTimings.detect.toFixed(1)}ms | extract+lookup:{" "}
              {captureTimings.extractLookup.toFixed(1)}ms | total:{" "}
              {captureTimings.total.toFixed(1)}ms
            </p>
          ) : null}
          {captureError ? <p className="error">{captureError}</p> : null}

          <h3 className="capture-subtitle">Latest Capture Preview</h3>
          {latestCaptureDataUrl ? (
            <img
              src={latestCaptureDataUrl}
              alt="Latest auto-capture"
              className="capture-image"
            />
          ) : (
            <p className="muted">No capture yet. Press Capture & Lookup.</p>
          )}

          <h3 className="capture-subtitle">Lookup Results</h3>
          {captureResults.length ? (
            <div className="lookup-results">
              {captureResults.map((spine) => {
                const firstMatch = spine.lookup.items[0];
                return (
                  <div key={spine.spineIndex} className="lookup-row">
                    <p>
                      <strong>Spine {spine.spineIndex}</strong> | detector{" "}
                      {spine.confidence.toFixed(2)}
                    </p>
                    <p>
                      extracted: "{spine.extraction.title}"
                      {spine.extraction.author
                        ? ` by ${spine.extraction.author}`
                        : ""}
                    </p>
                    {spine.lookup.error ? (
                      <p className="error">{spine.lookup.error}</p>
                    ) : firstMatch ? (
                      <p>
                        top match:{" "}
                        <a
                          href={firstMatch.infoLink || "#"}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {firstMatch.title || "[Untitled]"}
                        </a>
                        {firstMatch.authors?.length
                          ? ` (${firstMatch.authors.join(", ")})`
                          : ""}
                      </p>
                    ) : (
                      <p>top match: none</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted">
              Press Capture & Lookup to run extraction and Google Books search.
            </p>
          )}
        </article>
      </section>

      <canvas ref={snapshotCanvasRef} className="hidden-canvas" />
    </main>
  );
}
