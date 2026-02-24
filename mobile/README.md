# Mobile App

React Native (Expo) client for camera capture, candidate review, and local library browsing.

## Current behavior

- Camera preview with on-device guide overlays and orientation hints.
- Manual `Capture & Lookup` flow (no live backend polling during preview).
- Capture posts to `/scan/capture`, then user reviews candidates.
- Review supports multiple candidates per spine; rejecting advances to the next unique candidate if available.
- Accepted books are merged into local cache and upserted to backend `/library/me/books*`.
- Library data sync from backend currently runs on startup and when API base URL changes.

## Run locally

1. Start backend (from repo root):

```bash
cd /Users/mattdoyle/Projects/image-to-bookshelf
source .venv/bin/activate
bookshelf-scanner-api --host 0.0.0.0 --port 5001
```

2. Start Expo app:

```bash
cd /Users/mattdoyle/Projects/image-to-bookshelf/mobile
npm install
npm run start
```

## Base URL by target

Android emulator:

- URL: `http://10.0.2.2:5001`
- AVD should map `Camera Back` to `Webcam0` for camera-loop validation.
- Launch: `npm run android`

iOS simulator:

- URL: `http://127.0.0.1:5001`
- Use for UI/state flow checks, not real camera quality validation.
- Launch: `npm run ios`

Physical device:

- URL: `http://<your-mac-lan-ip>:5001` (for example `http://192.168.1.12:5001`)
- Mac and phone must be on the same Wi-Fi network.
- Start with `npm run start` and open via Expo Go.

## Library sync and identity notes

- Backend library routes default to a shared dev user unless user headers are sent.
- Because of that, multiple clients can write into the same library by default.
- Remote changes from another device are not live-streamed; they appear after app restart, API URL change, or when future manual/periodic refresh is added.

## Implementation notes

- `@scanner-core` is reused from `../packages/scanner-core/src` via Metro + TypeScript aliases.
- Preview guidance logic runs locally; backend pipeline runs after manual capture.
- Targets Expo SDK 54.
- Orientation is `default` so capture can rotate to landscape.

## SVG icon build

```bash
cd /Users/mattdoyle/Projects/image-to-bookshelf/mobile
npm run icons:build
```

Generated icon components are written to `mobile/src/icons`.
