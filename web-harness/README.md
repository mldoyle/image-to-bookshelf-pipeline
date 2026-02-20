# Web Harness

Laptop webcam harness for tuning scanner tracking/readiness logic before React Native camera integration.

## Features

- Live webcam preview with overlay boxes.
- Shared `scanner-core` IoU tracking + quality scoring + ready-state machine.
- Auto-capture on ready rising-edge trigger.
- Manual `Capture & Lookup` button that sends one frame to backend for extraction + Google Books.
- Detector adapter modes:
  - `mock`: synthetic moving detections.
  - `endpoint`: POST current frame to a backend detector endpoint.
- Runtime threshold controls and live score breakdown.
- Scene-level readiness gates (count/coverage/spread/aspect-ratio checks).
- Verbose frame logging controls for diagnostics.

## Run

```bash
cd /Users/mattdoyle/Projects/image-to-bookshelf/web-harness
npm install
npm run dev
```

Open the local Vite URL in a browser and grant camera access.

To run real backend detections from this repo:

```bash
cd /Users/mattdoyle/Projects/image-to-bookshelf
python -m bookshelf_scanner.web_api --host 127.0.0.1 --port 5000
```

Stop API with `Ctrl+C` (not `Ctrl+Z`).

## Recommended Harness Configuration

For real backend testing:

1. Set `Mode` to `endpoint`.
2. Set `Endpoint URL` to `http://127.0.0.1:5000/detect/spines`.
3. Set `Capture endpoint URL` to `http://127.0.0.1:5000/scan/capture`.
4. Click `Apply capture preset` in Thresholds to start from tuned defaults.

The `Capture & Lookup` button always sends a one-shot frame to `/scan/capture` and renders extraction + top lookup matches.

## Endpoint Mode Contract

`POST` endpoint should accept multipart form-data:

- `image`: JPEG frame
- `frameWidth`: number
- `frameHeight`: number
- `timestampMs`: number

Response can be either:

```json
[
  {"x": 120, "y": 40, "w": 90, "h": 420, "confidence": 0.91}
]
```

or:

```json
{
  "boxes": [
    {"x": 120, "y": 40, "w": 90, "h": 420, "confidence": 0.91}
  ]
}
```

Debug fields in UI:

- `Detector source`: confirms `mock` vs `endpoint`.
- `Payload candidates` / `Parsed boxes` / `Backend box count`: parser and backend contract health.
- `Scene gates`: whether scene-level readiness conditions pass.
- `Reasons`: active blockers for readiness.

Additional accepted box formats (for compatibility):

- `bbox: [x1, y1, x2, y2]`
- `xyxy: [x1, y1, x2, y2]`
- flat keys: `x1,y1,x2,y2` or `left,top,right,bottom`
- normalized coords in `[0,1]` are auto-scaled to frame size

If no boxes appear:

1. In harness, set mode to `mock` and confirm yellow boxes appear.
2. Switch to `endpoint` and use `http://127.0.0.1:5000/detect/spines`.
3. Check `lastError` in the debug panel (CORS/HTTP/timeouts show here).
4. Confirm Flask `/health` returns `{ "status": "ok" }`.

## Capture Lookup Endpoint Contract

The manual capture button posts to `/scan/capture` with multipart form-data:

- `image`: JPEG frame
- `minArea`: detector min area (optional)
- `maxDetections`: detector max detections (optional)
- `maxLookupResults`: max Google Books matches returned per spine (optional)

Response:

```json
{
  "count": 2,
  "spines": [
    {
      "spineIndex": 0,
      "bbox": [100, 50, 180, 420],
      "confidence": 0.93,
      "extraction": {"title": "Dune", "author": "Frank Herbert", "confidence": 0.8},
      "lookup": {
        "totalItems": 5,
        "items": [{"title": "Dune", "authors": ["Frank Herbert"], "infoLink": "..."}],
        "error": null
      }
    }
  ],
  "timingsMs": {"detect": 42.1, "extractLookup": 320.4, "total": 367.8}
}
```

## Troubleshooting

1. Boxes appear but do not come from model:
- Check `Detector source` is `endpoint`.
- `mock` mode will always draw synthetic boxes.

2. Backend runs but no detections:
- Lower `Endpoint min area`.
- Lower backend confidence (`--confidence`).
- Confirm YOLO class IDs match model labels (`--classes`).

3. Ready state triggers too easily:
- Increase `Min detections for ready`.
- Increase `Min horizontal spread ratio`.
- Increase `Min total box area ratio`.

4. Port 5000 appears stuck:
- Bring suspended process to foreground with `fg` and stop with `Ctrl+C`.
