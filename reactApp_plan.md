# React Native Live Scanner Implementation Plan

## 1. Scope (MVP Only)

Build a React Native app that:
1. Streams camera preview.
2. Detects book spines in realtime and draws boxes.
3. Turns boxes green when capture quality is sufficient.
4. Auto-captures one photo when readiness is stable.
5. Sends captured photo to the existing backend extraction flow and returns parsed book candidates.

Not in MVP:
- Full on-device OCR.
- Model training pipeline.
- OBB migration (keep as post-MVP improvement).

## 2. Testing Reality and Order

1. Laptop camera first (required): use a web harness with `getUserMedia` to tune readiness logic quickly.
2. Emulator second (required):
- Android emulator with webcam passthrough for camera-loop behavior.
- iOS simulator for UI/state flow only.
3. Physical phones third (required): final validation for autofocus, blur, FPS, latency.

Important constraint:
- This current CLI environment cannot run GUI camera testing end-to-end.

## 3. Code Structure to Create

```text
mobile/
  app/
  src/
    camera/
      CameraScreen.tsx
      FrameProcessorBridge.ts
    overlay/
      BoxOverlay.tsx
    capture/
      CaptureController.ts
    api/
      extractionClient.ts
    types/
      vision.ts
packages/
  scanner-core/
    src/
      types.ts
      iouTracker.ts
      qualityScorer.ts
      readyStateMachine.ts
    test/
      iouTracker.test.ts
      qualityScorer.test.ts
      readyStateMachine.test.ts
web-harness/
  src/
    WebcamPage.tsx
    detectorAdapter.ts
```

## 4. Required Interfaces

Implement these interfaces first so all environments share behavior:

```ts
// packages/scanner-core/src/types.ts
export type DetectionBox = {
  x: number; y: number; w: number; h: number;
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
```

```ts
// mobile/src/camera/FrameProcessorBridge.ts
export type FrameDetections = {
  frameWidth: number;
  frameHeight: number;
  boxes: DetectionBox[];
  frameTimestampMs: number;
};
```

## 5. Step-by-Step Execution Plan

## Step 1: Build shared scoring/tracking core (required first)

Actions:
1. Create `packages/scanner-core` with TypeScript build config.
2. Implement IoU tracker:
- Match detections to existing tracks by IoU >= 0.3.
- Start new tracks for unmatched detections.
- Drop tracks not seen for 400ms.
3. Implement quality scoring:
- Inputs: confidence, area ratio, edge margin, stableFrames.
- Score formula:
  - `score = 0.35*confidence + 0.25*area + 0.20*margin + 0.20*stability`
4. Implement ready rule:
- `score >= 0.72` for at least 10 consecutive processed frames.
5. Implement cooldown rule:
- after capture trigger, ignore new triggers for 1500ms.
6. Add unit tests for all rules.

Deliverables:
- `packages/scanner-core/src/*`
- Passing tests in `packages/scanner-core/test/*`

Exit criteria:
- Deterministic replay test proves one trigger fires once for a stable sequence.

## Step 2: Build laptop webcam harness (required before mobile tuning)

Actions:
1. Create `web-harness` app (Vite + React TS).
2. Use `navigator.mediaDevices.getUserMedia({ video: true })`.
3. Add detector adapter (temporary options):
- Option A: call local detection endpoint.
- Option B: use mock detections first, then replace with real detector.
4. Pipe detections through `scanner-core`.
5. Render boxes on `<canvas>`:
- yellow when detected.
- green when `ReadyResult.ready === true`.
6. Auto-capture snapshot when state machine emits trigger.
7. Add debug panel for thresholds and live score breakdown.

Deliverables:
- `web-harness/src/WebcamPage.tsx`
- `web-harness/src/detectorAdapter.ts`

Exit criteria:
- Laptop webcam run shows stable green transition and single auto-capture event.

## Step 3: Create RN app camera loop

Actions:
1. Scaffold RN app under `mobile/`.
2. Install and configure:
- `react-native-vision-camera`
- frame processor dependency required by chosen setup.
3. Implement `CameraScreen.tsx`:
- request permissions.
- start preview.
4. Implement native frame processor bridge to emit `FrameDetections`.
5. Reuse `scanner-core` unchanged for track/score/ready decisions.
6. Render overlay boxes above camera preview.

Deliverables:
- `mobile/src/camera/CameraScreen.tsx`
- `mobile/src/camera/FrameProcessorBridge.ts`
- `mobile/src/overlay/BoxOverlay.tsx`

Exit criteria:
- Live preview + boxes + green readiness running on Android emulator build.

## Step 4: Implement capture controller

Actions:
1. Add `CaptureController.ts`:
- listens for ready-state trigger events.
- calls camera photo capture once.
- enforces 1500ms cooldown.
2. Save photo path + detection metadata JSON locally.
3. Add manual capture button as fallback.

Deliverables:
- `mobile/src/capture/CaptureController.ts`

Exit criteria:
- Exactly one capture per ready event; no duplicate captures during cooldown.

## Step 5: Emulator validation (must pass before phone testing)

Actions:
1. Android Emulator:
- set camera source to webcam in AVD settings.
- run app and validate full live loop.
2. iOS Simulator:
- validate UI state transitions and capture flow logic.
- do not use as camera-quality validation.

Deliverables:
- Validation notes with observed FPS and trigger behavior.

Exit criteria:
- Android emulator behaves reliably for 3 continuous test runs.

## Step 6: Real device validation (required for release decisions)

Actions:
1. Run on one iPhone and one Android phone.
2. Validate in 3 scenes:
- good light.
- low light.
- angled shelf.
3. Record metrics:
- preview FPS.
- detection latency.
- trigger-to-capture delay.
4. Tune thresholds only in `scanner-core` config (single source of truth).

Deliverables:
- Device test report with final threshold values.

Exit criteria:
- FPS >= 18, trigger-to-capture delay <= 300ms, stable capture in good light.

## Step 7: Integrate backend extraction

Actions:
1. Define POST endpoint contract:
- request: image file + session metadata.
- response: array of candidate books.
2. Implement `mobile/src/api/extractionClient.ts`.
3. After capture, upload image and render results screen.
4. Handle failures: timeout, non-200, empty results.

Deliverables:
- `mobile/src/api/extractionClient.ts`
- Capture-to-results UI flow

Exit criteria:
- From live scan to parsed book candidates in one uninterrupted flow.

## 6. Critical Configuration Values (initial)

These must be implemented as runtime-configurable constants:

- `IOU_MATCH_THRESHOLD = 0.30`
- `TRACK_STALE_MS = 400`
- `READY_SCORE_THRESHOLD = 0.72`
- `READY_CONSECUTIVE_FRAMES = 10`
- `CAPTURE_COOLDOWN_MS = 1500`
- `MIN_BOX_AREA_RATIO = 0.015`
- `MIN_EDGE_MARGIN_RATIO = 0.03`

## 7. Completion Criteria (MVP Done)

MVP is done only when all are true:
1. Live camera boxes render in RN app.
2. Boxes turn green based on shared scoring logic.
3. App auto-captures exactly once per ready event.
4. Capture uploads to backend and returns candidate book list.
5. Workflow validated on both a physical Android and physical iPhone.
