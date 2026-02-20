import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { runCaptureLookup } from "../api/extractionClient";
import { GuideOverlay } from "../overlay/GuideOverlay";
import { estimateGuideBoxFromJpegBase64, type GuideBox } from "./localGuideDetector";
import type { CaptureScanResponse } from "../types/vision";

type CameraScreenProps = {
  apiBaseUrl: string;
  onBack: () => void;
  onCaptureComplete: (capture: CaptureScanResponse) => void;
};

type OverlayLayout = {
  width: number;
  height: number;
};

const GUIDE_ANALYSIS_INTERVAL_MS = 1400;
const CAPTURE_LOOKUP_MAX_RESULTS = 3;

const makeEndpointUrl = (baseUrl: string, path: string): string => {
  const trimmedBase = baseUrl.trim().replace(/\/+$/, "");
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
};

export function CameraScreen({ apiBaseUrl, onBack, onCaptureComplete }: CameraScreenProps) {
  const cameraRef = useRef<CameraView | null>(null);
  const guideIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const guideAnalysisInFlightRef = useRef(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [overlayLayout, setOverlayLayout] = useState<OverlayLayout>({ width: 0, height: 0 });
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureInFlight, setCaptureInFlight] = useState(false);
  const [detectedBox, setDetectedBox] = useState<GuideBox | null>(null);
  const [detectionFrameWidth, setDetectionFrameWidth] = useState(0);
  const [detectionFrameHeight, setDetectionFrameHeight] = useState(0);
  const [guideScore, setGuideScore] = useState(0);

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isLandscape = screenWidth > screenHeight;

  useEffect(() => {
    if (!permission || permission.granted || !permission.canAskAgain) {
      return;
    }

    void requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    if (isLandscape) {
      rotateAnim.stopAnimation();
      rotateAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      ])
    );

    loop.start();
    return () => {
      loop.stop();
    };
  }, [isLandscape, rotateAnim]);

  const stopGuideLoop = useCallback(() => {
    if (guideIntervalRef.current !== null) {
      clearInterval(guideIntervalRef.current);
      guideIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopGuideLoop();
    };
  }, [stopGuideLoop]);

  const runGuideAnalysis = useCallback(async () => {
    if (!isLandscape || guideAnalysisInFlightRef.current || captureInFlight || !cameraReady) {
      return;
    }

    const camera = cameraRef.current;
    if (!camera) {
      return;
    }

    guideAnalysisInFlightRef.current = true;

    try {
      const frame = await camera.takePictureAsync({
        quality: 0.2,
        skipProcessing: true,
        base64: true,
        shutterSound: false,
        exif: false
      });

      if (!frame?.base64) {
        return;
      }

      const estimate = estimateGuideBoxFromJpegBase64(frame.base64);
      if (!estimate) {
        return;
      }

      setDetectionFrameWidth(estimate.frameWidth);
      setDetectionFrameHeight(estimate.frameHeight);
      setDetectedBox(estimate.box);
      setGuideScore(estimate.score);
    } finally {
      guideAnalysisInFlightRef.current = false;
    }
  }, [cameraReady, captureInFlight, isLandscape]);

  useEffect(() => {
    if (!cameraReady || !permission?.granted || !isLandscape || captureInFlight) {
      stopGuideLoop();
      return;
    }

    stopGuideLoop();
    guideIntervalRef.current = setInterval(() => {
      void runGuideAnalysis();
    }, GUIDE_ANALYSIS_INTERVAL_MS);

    return () => {
      stopGuideLoop();
    };
  }, [cameraReady, captureInFlight, isLandscape, permission?.granted, runGuideAnalysis, stopGuideLoop]);

  useEffect(() => {
    if (isLandscape) {
      return;
    }

    setDetectedBox(null);
    setGuideScore(0);
    setDetectionFrameWidth(0);
    setDetectionFrameHeight(0);
  }, [isLandscape]);

  const onPreviewLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setOverlayLayout({ width, height });
  }, []);

  const captureEnabled = useMemo(
    () => cameraReady && isLandscape && !captureInFlight,
    [cameraReady, captureInFlight, isLandscape]
  );

  const guidanceText = useMemo(() => {
    if (!isLandscape) {
      return "Rotate to capture more books.";
    }
    if (guideScore >= 0.65) {
      return "Guide lock looks good. Capture when ready.";
    }
    if (detectedBox) {
      return "Adjust framing to include one full shelf row inside the guide.";
    }
    return "Center one shelf section in the guide and hold steady.";
  }, [detectedBox, guideScore, isLandscape]);

  const onCapturePress = useCallback(async () => {
    const camera = cameraRef.current;
    if (!captureEnabled || !camera) {
      return;
    }

    setCaptureError(null);
    setCaptureInFlight(true);

    try {
      const capture = await camera.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
        shutterSound: false
      });

      if (!capture?.uri) {
        throw new Error("capture_uri_missing");
      }

      const response = await runCaptureLookup({
        photoUri: capture.uri,
        captureEndpointUrl: makeEndpointUrl(apiBaseUrl, "/scan/capture"),
        minArea: 300,
        maxDetections: 40,
        maxLookupResults: CAPTURE_LOOKUP_MAX_RESULTS,
        timeoutMs: 120000
      });

      onCaptureComplete(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "capture_lookup_failed";
      setCaptureError(message);
    } finally {
      setCaptureInFlight(false);
    }
  }, [apiBaseUrl, captureEnabled, onCaptureComplete]);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#0f172a" size="large" />
        <Text style={styles.helperText}>Checking camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.helperText}>
          This app needs camera access to scan bookshelf photos.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => void requestPermission()}>
          <Text style={styles.primaryButtonLabel}>Allow Camera</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonLabel}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const rotateInterpolation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "90deg"]
  });

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonLabel}>Back</Text>
        </Pressable>
        <View style={styles.statusChip}>
          <Text style={styles.statusChipText}>{isLandscape ? "Aligned" : "Rotate"}</Text>
        </View>
      </View>

      <View style={styles.previewContainer} onLayout={onPreviewLayout}>
        <CameraView
          ref={(instance) => {
            cameraRef.current = instance;
          }}
          style={styles.camera}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
        />

        <GuideOverlay
          width={overlayLayout.width}
          height={overlayLayout.height}
          isLandscape={isLandscape}
          detectedBox={detectedBox}
          detectionFrameWidth={detectionFrameWidth}
          detectionFrameHeight={detectionFrameHeight}
          detectionScore={guideScore}
        />
      </View>

      <View style={styles.panel}>
        {!isLandscape ? (
          <View style={styles.rotatePromptRow}>
            <Animated.View
              style={[styles.rotateIcon, { transform: [{ rotate: rotateInterpolation }] }]}
            />
            <Text style={styles.rotatePromptText}>Rotate to capture more books.</Text>
          </View>
        ) : null}

        <Text style={styles.guidanceText}>{guidanceText}</Text>
        <Text style={styles.metricText}>local guide score: {guideScore.toFixed(3)}</Text>
        {captureError ? <Text style={styles.errorText}>capture error: {captureError}</Text> : null}

        <Pressable
          style={[styles.captureButton, !captureEnabled && styles.captureButtonDisabled]}
          onPress={() => void onCapturePress()}
          disabled={!captureEnabled}
        >
          {captureInFlight ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.captureButtonLabel}>Capture & Lookup</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#0f172a"
  },
  statusChipText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  previewContainer: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#111827",
    aspectRatio: 3 / 4
  },
  camera: {
    width: "100%",
    height: "100%"
  },
  panel: {
    gap: 8,
    backgroundColor: "#ffffff",
    padding: 14,
    borderRadius: 14
  },
  rotatePromptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  rotateIcon: {
    width: 16,
    height: 28,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#0f172a"
  },
  rotatePromptText: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "700"
  },
  guidanceText: {
    fontSize: 15,
    color: "#0f172a",
    fontWeight: "600"
  },
  metricText: {
    fontSize: 13,
    color: "#475569"
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c"
  },
  captureButton: {
    marginTop: 6,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#15803d"
  },
  captureButtonDisabled: {
    backgroundColor: "#94a3b8"
  },
  captureButtonLabel: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 24,
    gap: 12
  },
  title: {
    fontSize: 20,
    color: "#0f172a",
    fontWeight: "700"
  },
  helperText: {
    color: "#475569",
    textAlign: "center"
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#0f172a",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  secondaryButtonLabel: {
    color: "#0f172a",
    fontWeight: "600"
  }
});
