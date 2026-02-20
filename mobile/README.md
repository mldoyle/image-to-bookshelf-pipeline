# Mobile Scanner (Step 3)

This folder contains the React Native camera loop for Android/iOS testing.

## What is implemented

- Start screen with `Open Camera` button.
- Live camera preview.
- On-device guide overlay (QR-style framing hints) during preview.
- Lightweight on-device shelf-band detection from preview snapshots for dynamic guide boxes.
- Animated rotate prompt when the phone is in portrait mode (`Rotate to capture more books.`).
- Manual `Capture & Lookup` controlled by the user.
- No live detector network polling during preview.
- One-card review flow with Tinder-style `Accept` / `Reject` actions.
- Only the first candidate per detected spine is shown in review.

## Install and run

1. Install dependencies:

```bash
cd /Users/mattdoyle/Projects/image-to-bookshelf/mobile
npm install
```

2. Start backend API from repo root (required):

```bash
cd /Users/mattdoyle/Projects/image-to-bookshelf
python -m bookshelf_scanner.web_api --host 0.0.0.0 --port 5001
```

3. Start Expo:

```bash
cd /Users/mattdoyle/Projects/image-to-bookshelf/mobile
npm run start
```

## Emulator and device setup

### Android emulator (camera loop validation)

- In Android Studio AVD settings, set `Camera Back` to `Webcam0`.
- Launch emulator.
- In app base URL field use `http://10.0.2.2:5001`.
- Run with:

```bash
npm run android
```

### iOS simulator (UI/state flow validation)

- iOS Simulator does not represent real camera quality, so use it for state flow checks only.
- In app base URL use `http://127.0.0.1:5001`.
- Run with:

```bash
npm run ios
```

### Physical iPhone (recommended for real validation)

- Install Expo Go on iPhone.
- Connect iPhone and Mac to the same Wi-Fi network.
- In app base URL use your Mac LAN IP, for example `http://192.168.1.12:5001`.
- From `npm run start`, scan the QR code in Expo Go.

## Notes

- This app reuses `@scanner-core` directly from `../packages/scanner-core/src` via Metro + TypeScript aliases.
- Preview guidance runs locally on device; the server pipeline runs only after capture.
- This app targets Expo SDK 54 (Expo Go iOS requires latest SDK support).
- Orientation is set to `default` so users can rotate to landscape for capture.
