# React Native Scanner Plan (Current State + Next Steps)

## 0) Current implementation snapshot

### Complete

1. Shared scanner logic (`packages/scanner-core`)
- IoU tracking, quality scoring, ready-state logic.
- Unit tests for core deterministic behavior.

2. Web harness (`web-harness`)
- Live webcam preview and overlays.
- `mock` and backend `endpoint` detector modes.
- Manual `Capture & Lookup` path to `/scan/capture`.
- Debug/threshold controls for tuning.

3. Backend support
- `/detect/spines`, `/scan/capture`, `/books/search`.
- `/library/me/*` persistence endpoints.

4. Mobile app (`mobile`)
- Camera preview + local guide overlays.
- Manual capture flow to backend.
- Candidate review and accept/reject workflow.
- Local library caching plus backend upsert integration.

### Partially complete / open

1. End-to-end validation matrix is incomplete.
- Android emulator, iOS simulator, and physical device runs need a consolidated test report.

2. Cross-device live library refresh behavior is not implemented yet.
- Current sync model is startup/API-base-change driven.

## 1) MVP scope

Build and validate a mobile flow that:

1. Captures shelf images.
2. Calls backend scan/lookup.
3. Lets users confirm/reject candidate books.
4. Persists accepted books to user library.

Not in MVP:

- Full auth/session UX.
- Real-time multi-device collaboration features.
- On-device OCR replacement for backend extraction.

## 2) Shared interfaces

Keep these as the shared contract boundaries:

1. `scanner-core` detection tracking and readiness APIs.
2. Backend response shape for `/detect/spines` and `/scan/capture`.
3. Library API shape for `/library/me/books*`.

## 3) Current mobile flow

1. User opens camera.
2. User manually triggers capture.
3. App sends image to `/scan/capture`.
4. App presents candidate review stack.
5. Accepted items are merged into local library and upserted to backend.

Known current behavior:

- Preview does not continuously call backend detector.
- Library sync from backend is not live; cache is authoritative between sync points.

## 4) Validation plan

### Step A: Android emulator validation

1. Configure AVD camera passthrough.
2. Validate capture + review + library write.
3. Verify behavior across repeated sessions.

Exit criteria:

- Three stable runs with no blocking errors.

### Step B: iOS simulator validation

1. Validate state transitions and API integration.
2. Confirm URL/base-host behavior.

Exit criteria:

- No state-machine regressions in camera/review/library navigation.

### Step C: physical device validation

1. Validate on at least one iPhone and one Android phone.
2. Run in multiple lighting conditions.
3. Measure practical capture-to-result latency and success rate.

Exit criteria:

- Reliable capture + review completion in normal indoor conditions.

## 5) Next engineering milestones

### Milestone 1: Sync UX hardening

1. Add explicit manual refresh in library UI.
2. Add foreground re-sync when app becomes active.
3. Optional periodic polling (configurable interval).

### Milestone 2: Identity hardening

1. Move from dev-user fallback to authenticated user identity.
2. Pass auth context in all mobile library requests.
3. Add logout/login state handling in mobile.

### Milestone 3: Error handling hardening

1. Show recoverable network error states for capture and library sync.
2. Add retry controls for failed writes.
3. Preserve pending local writes for later retry.

### Milestone 4: Observability

1. Add structured client-side logging around capture and sync.
2. Add request IDs to correlate mobile and backend events.

## 6) Done criteria for this plan

This plan is complete when:

1. Validation report exists for emulator + physical devices.
2. Manual refresh (or equivalent re-sync trigger) is implemented.
3. Identity model is no longer shared-dev-user by default for normal app use.
