# scanner-core

Shared tracking, quality scoring, and ready-state logic for webcam harness and React Native camera flows.

## Defaults

- `IOU_MATCH_THRESHOLD = 0.30`
- `TRACK_STALE_MS = 400`
- `READY_SCORE_THRESHOLD = 0.72`
- `READY_CONSECUTIVE_FRAMES = 10`
- `CAPTURE_COOLDOWN_MS = 1500`
- `MIN_BOX_AREA_RATIO = 0.015`
- `MIN_EDGE_MARGIN_RATIO = 0.03`

All values are runtime-configurable via constructor/function config overrides.
