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
