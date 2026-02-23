import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { CameraView, type CameraOrientation, useCameraPermissions } from "expo-camera";
import { runCaptureLookup } from "../api/extractionClient";
import BackIcon from "../icons/BackIcon";
import OrientationNoHintIcon from "../icons/OrientationNoHintIcon";
import RotatePortraitIcon from "../icons/RotatePortraitIcon";
import SelectCapturesIcon from "../icons/SelectCapturesIcon";
import SelectNoCapturesIcon from "../icons/SelectNoCapturesIcon";
import ZoomInHintIcon from "../icons/ZoomInHintIcon";
import ZoomOutHintIcon from "../icons/ZoomOutHintIcon";
import { GuideOverlay } from "../overlay/GuideOverlay";
import { colors } from "../theme/colors";
import type { CaptureScanResponse } from "../types/vision";
import { estimateGuideBoxFromJpegBase64, type GuideBox } from "./localGuideDetector";

type CameraScreenProps = {
  apiBaseUrl: string;
  reviewEnabled: boolean;
  onBack: () => void;
  onOpenReview: () => void;
  onCaptureProcessed: (capture: CaptureScanResponse) => void;
};

type OverlayLayout = {
  width: number;
  height: number;
};

type QueueItem = {
  photoUri: string;
};

type Point = {
  x: number;
  y: number;
};

type GuideHint = "zoom_in" | "zoom_out" | "steady";

const GUIDE_ANALYSIS_INTERVAL_MS = 900;
const CAPTURE_LOOKUP_MAX_RESULTS = 3;
const CAPTURE_DELAY_MS = 650;
const LANDSCAPE_HINT_FADE_DELAY_MS = 2000;
const LANDSCAPE_HINT_FADE_DURATION_MS = 280;
const GUIDE_AREA_RATIO_MIN = 0.28;
const GUIDE_AREA_RATIO_MAX = 0.72;
const TOP_BAR_INSET = 14;
const TOP_BAR_OFFSET = 52;

const makeEndpointUrl = (baseUrl: string, path: string): string => {
  const trimmedBase = baseUrl.trim().replace(/\/+$/, "");
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
};

export function CameraScreen({
  apiBaseUrl,
  reviewEnabled,
  onBack,
  onOpenReview,
  onCaptureProcessed
}: CameraScreenProps) {
  const cameraRef = useRef<CameraView | null>(null);
  const guideIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const guideAnalysisInFlightRef = useRef(false);
  const guideAnalysisTokenRef = useRef(0);
  const lookupQueueRef = useRef<QueueItem[]>([]);
  const lookupWorkerInFlightRef = useRef(false);
  const cooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewButtonLayoutRef = useRef<{ x: number; y: number; width: number; height: number } | null>(
    null
  );

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const landscapeHintOpacity = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const flyAnim = useRef(new Animated.Value(0)).current;

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [overlayLayout, setOverlayLayout] = useState<OverlayLayout>({ width: 0, height: 0 });
  const [cameraOrientation, setCameraOrientation] = useState<CameraOrientation | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureCooldown, setCaptureCooldown] = useState(false);
  const [detectedBox, setDetectedBox] = useState<GuideBox | null>(null);
  const [detectionFrameWidth, setDetectionFrameWidth] = useState(0);
  const [detectionFrameHeight, setDetectionFrameHeight] = useState(0);
  const [lookupInFlightCount, setLookupInFlightCount] = useState(0);
  const [queuedLookupCount, setQueuedLookupCount] = useState(0);
  const [showLandscapeNoArrowHint, setShowLandscapeNoArrowHint] = useState(false);

  const [flyThumbnailUri, setFlyThumbnailUri] = useState<string | null>(null);
  const [flyStart, setFlyStart] = useState<Point>({ x: 0, y: 0 });
  const [flyEnd, setFlyEnd] = useState<Point>({ x: 0, y: 0 });

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const phoneIsLandscape =
    cameraOrientation === "landscapeLeft" || cameraOrientation === "landscapeRight";
  const isLandscape =
    overlayLayout.width > 0 && overlayLayout.height > 0
      ? overlayLayout.width > overlayLayout.height
      : windowWidth > windowHeight;

  const rotateIconBaseRotation = useMemo(() => {
    if (cameraOrientation === "landscapeLeft") {
      return "90deg";
    }
    if (cameraOrientation === "landscapeRight") {
      return "-90deg";
    }
    if (cameraOrientation === "portraitUpsideDown") {
      return "180deg";
    }
    return "0deg";
  }, [cameraOrientation]);

  const noArrowHintRotation = useMemo(() => {
    if (cameraOrientation === "landscapeRight") {
      return "-90deg";
    }
    return "90deg";
  }, [cameraOrientation]);

  const stopGuideLoop = useCallback(() => {
    if (guideIntervalRef.current !== null) {
      clearInterval(guideIntervalRef.current);
      guideIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopGuideLoop();
      if (cooldownTimeoutRef.current !== null) {
        clearTimeout(cooldownTimeoutRef.current);
        cooldownTimeoutRef.current = null;
      }
    };
  }, [stopGuideLoop]);

  useEffect(() => {
    if (!permission || permission.granted || !permission.canAskAgain) {
      return;
    }

    void requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    if (phoneIsLandscape) {
      rotateAnim.stopAnimation();
      rotateAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      ])
    );

    loop.start();
    return () => {
      loop.stop();
    };
  }, [phoneIsLandscape, rotateAnim]);

  useEffect(() => {
    if (!phoneIsLandscape) {
      landscapeHintOpacity.stopAnimation();
      landscapeHintOpacity.setValue(0);
      setShowLandscapeNoArrowHint(false);
      return;
    }

    setShowLandscapeNoArrowHint(true);
    landscapeHintOpacity.stopAnimation();
    landscapeHintOpacity.setValue(1);

    const fade = Animated.timing(landscapeHintOpacity, {
      toValue: 0,
      delay: LANDSCAPE_HINT_FADE_DELAY_MS,
      duration: LANDSCAPE_HINT_FADE_DURATION_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    });

    fade.start(({ finished }) => {
      if (finished) {
        setShowLandscapeNoArrowHint(false);
      }
    });

    return () => {
      fade.stop();
    };
  }, [landscapeHintOpacity, phoneIsLandscape]);

  useEffect(() => {
    guideAnalysisTokenRef.current += 1;
    setDetectedBox(null);
    setDetectionFrameWidth(0);
    setDetectionFrameHeight(0);
  }, [phoneIsLandscape]);

  const runGuideAnalysis = useCallback(async () => {
    if (guideAnalysisInFlightRef.current || captureBusy || !cameraReady) {
      return;
    }

    const camera = cameraRef.current;
    if (!camera) {
      return;
    }

    guideAnalysisInFlightRef.current = true;
    const analysisToken = guideAnalysisTokenRef.current;

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

      if (analysisToken !== guideAnalysisTokenRef.current) {
        return;
      }

      setDetectionFrameWidth(estimate.frameWidth);
      setDetectionFrameHeight(estimate.frameHeight);
      setDetectedBox(estimate.box);
    } finally {
      guideAnalysisInFlightRef.current = false;
    }
  }, [cameraReady, captureBusy]);

  useEffect(() => {
    if (!cameraReady || !permission?.granted || captureBusy) {
      stopGuideLoop();
      return;
    }

    stopGuideLoop();
    void runGuideAnalysis();
    guideIntervalRef.current = setInterval(() => {
      void runGuideAnalysis();
    }, GUIDE_ANALYSIS_INTERVAL_MS);

    return () => {
      stopGuideLoop();
    };
  }, [cameraReady, captureBusy, permission?.granted, phoneIsLandscape, runGuideAnalysis, stopGuideLoop]);

  const processLookupQueue = useCallback(async () => {
    if (lookupWorkerInFlightRef.current) {
      return;
    }

    const next = lookupQueueRef.current.shift();
    setQueuedLookupCount(lookupQueueRef.current.length);
    if (!next) {
      return;
    }

    lookupWorkerInFlightRef.current = true;
    setLookupInFlightCount((count) => count + 1);

    try {
      const response = await runCaptureLookup({
        photoUri: next.photoUri,
        captureEndpointUrl: makeEndpointUrl(apiBaseUrl, "/scan/capture"),
        minArea: 300,
        maxDetections: 40,
        maxLookupResults: CAPTURE_LOOKUP_MAX_RESULTS,
        timeoutMs: 120000
      });

      onCaptureProcessed(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "capture_lookup_failed";
      setCaptureError(message);
    } finally {
      lookupWorkerInFlightRef.current = false;
      setLookupInFlightCount((count) => Math.max(0, count - 1));
      if (lookupQueueRef.current.length > 0) {
        void processLookupQueue();
      }
    }
  }, [apiBaseUrl, onCaptureProcessed]);

  const enqueueLookup = useCallback(
    (photoUri: string) => {
      lookupQueueRef.current.push({ photoUri });
      setQueuedLookupCount(lookupQueueRef.current.length);
      void processLookupQueue();
    },
    [processLookupQueue]
  );

  const onPreviewLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setOverlayLayout({ width, height });
  }, []);

  const onReviewButtonLayout = useCallback((event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    reviewButtonLayoutRef.current = {
      x,
      y,
      width,
      height
    };
  }, []);

  const captureEnabled = useMemo(
    () => cameraReady && !captureBusy && !captureCooldown,
    [cameraReady, captureBusy, captureCooldown]
  );

  const guideAreaRatio = useMemo(() => {
    if (!detectedBox || detectionFrameWidth <= 0 || detectionFrameHeight <= 0) {
      return 0;
    }
    return (detectedBox.w * detectedBox.h) / (detectionFrameWidth * detectionFrameHeight);
  }, [detectedBox, detectionFrameHeight, detectionFrameWidth]);

  const guideHint = useMemo<GuideHint>(() => {
    if (!detectedBox || guideAreaRatio <= 0) {
      return "steady";
    }
    if (guideAreaRatio < GUIDE_AREA_RATIO_MIN) {
      return "zoom_in";
    }
    if (guideAreaRatio > GUIDE_AREA_RATIO_MAX) {
      return "zoom_out";
    }
    return "steady";
  }, [detectedBox, guideAreaRatio]);

  const rotateInterpolation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-90deg"]
  });

  const triggerCaptureFeedback = useCallback(
    (photoUri: string) => {
      const destination = reviewButtonLayoutRef.current
        ? {
            x: reviewButtonLayoutRef.current.x + reviewButtonLayoutRef.current.width / 2 - 18,
            y: reviewButtonLayoutRef.current.y + reviewButtonLayoutRef.current.height / 2 - 18
          }
        : {
            x: windowWidth - 62,
            y: 52
          };

      const origin = {
        x: windowWidth / 2 - 44,
        y: windowHeight - 196
      };

      setFlyThumbnailUri(photoUri);
      setFlyStart(origin);
      setFlyEnd(destination);
      flashAnim.setValue(0.35);
      flyAnim.setValue(0);

      Animated.parallel([
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(flyAnim, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]).start(() => {
        setFlyThumbnailUri(null);
      });
    },
    [flashAnim, flyAnim, windowHeight, windowWidth]
  );

  const onCapturePress = useCallback(async () => {
    const camera = cameraRef.current;
    if (!captureEnabled || !camera || guideAnalysisInFlightRef.current) {
      return;
    }

    setCaptureError(null);
    setCaptureBusy(true);

    try {
      const capture = await camera.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
        shutterSound: false
      });

      if (!capture?.uri) {
        throw new Error("capture_uri_missing");
      }

      triggerCaptureFeedback(capture.uri);
      enqueueLookup(capture.uri);

      setCaptureCooldown(true);
      if (cooldownTimeoutRef.current !== null) {
        clearTimeout(cooldownTimeoutRef.current);
      }
      cooldownTimeoutRef.current = setTimeout(() => {
        setCaptureCooldown(false);
      }, CAPTURE_DELAY_MS);
    } catch (error) {
      const message = error instanceof Error ? error.message : "capture_failed";
      setCaptureError(message);
    } finally {
      setCaptureBusy(false);
    }
  }, [captureEnabled, enqueueLookup, triggerCaptureFeedback]);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.textPrimary} size="large" />
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

  const flyX = flyAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [flyStart.x, flyEnd.x]
  });

  const flyY = flyAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [flyStart.y, flyEnd.y]
  });

  const flyScale = flyAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.28]
  });

  const flyOpacity = flyAnim.interpolate({
    inputRange: [0, 0.9, 1],
    outputRange: [0.98, 0.95, 0]
  });

  const queueBusy = lookupInFlightCount > 0 || queuedLookupCount > 0;

  return (
    <View style={styles.screen} onLayout={onPreviewLayout}>
      <CameraView
        ref={(instance) => {
          cameraRef.current = instance;
        }}
        style={styles.camera}
        facing="back"
        responsiveOrientationWhenOrientationLocked
        onResponsiveOrientationChanged={(event) => {
          setCameraOrientation(event.orientation);
        }}
        onCameraReady={() => setCameraReady(true)}
      />

      <GuideOverlay
        width={overlayLayout.width}
        height={overlayLayout.height}
        isLandscape={isLandscape}
      />

      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flashAnim }]} />

      {flyThumbnailUri ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flyingThumb,
            {
              transform: [{ translateX: flyX }, { translateY: flyY }, { scale: flyScale }],
              opacity: flyOpacity
            }
          ]}
        >
          <Image source={{ uri: flyThumbnailUri }} style={styles.flyingThumbImage} />
        </Animated.View>
      ) : null}

      <Pressable style={[styles.topIconButton, styles.backButton]} onPress={onBack}>
        <BackIcon />
      </Pressable>

      <Pressable
        style={[styles.reviewButton, styles.reviewButtonAbsolute, !reviewEnabled && styles.reviewButtonDisabled]}
        onPress={onOpenReview}
        disabled={!reviewEnabled}
        onLayout={onReviewButtonLayout}
      >
        {reviewEnabled ? <SelectCapturesIcon /> : <SelectNoCapturesIcon />}
        {queueBusy ? <ActivityIndicator size="small" color={colors.textPrimary} style={styles.queueSpinner} /> : null}
      </Pressable>

      <View style={styles.iconStack} pointerEvents="none">
        {!phoneIsLandscape ? (
          <Animated.View
            style={{ transform: [{ rotate: rotateIconBaseRotation }, { rotate: rotateInterpolation }] }}
          >
            <RotatePortraitIcon />
          </Animated.View>
        ) : null}
        {phoneIsLandscape && showLandscapeNoArrowHint ? (
          <Animated.View style={{ opacity: landscapeHintOpacity, transform: [{ rotate: noArrowHintRotation }] }}>
            <OrientationNoHintIcon />
          </Animated.View>
        ) : null}
      </View>

      {captureError ? (
        <View style={styles.errorChip}>
          <Text style={styles.errorText}>{captureError}</Text>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.captureButton,
          styles.captureButtonAbsolute,
          pressed && captureEnabled && styles.captureButtonPressed,
          !captureEnabled && styles.captureButtonDisabled
        ]}
        onPress={() => void onCapturePress()}
        disabled={!captureEnabled}
      >
        {captureBusy ? (
          <ActivityIndicator color={colors.black} />
        ) : (
          <View style={styles.captureButtonInner} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  camera: {
    ...StyleSheet.absoluteFillObject
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.white
  },
  backButton: {
    position: "absolute",
    top: TOP_BAR_OFFSET,
    left: TOP_BAR_INSET
  },
  reviewButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    padding: 2
  },
  reviewButtonAbsolute: {
    position: "absolute",
    top: TOP_BAR_OFFSET,
    right: TOP_BAR_INSET
  },
  topIconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(20,24,28,0.35)"
  },
  reviewButtonDisabled: {
    opacity: 0.55
  },
  queueSpinner: {
    position: "absolute",
    right: -5,
    top: -5
  },
  iconStack: {
    position: "absolute",
    top: 108,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  errorChip: {
    position: "absolute",
    top: 154,
    left: 14,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(112,48,48,0.9)",
    borderWidth: 1,
    borderColor: colors.accent
  },
  errorText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "700"
  },
  captureButtonAbsolute: {
    position: "absolute",
    left: "50%",
    marginLeft: -37,
    bottom: 42
  },
  captureButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: colors.white
  },
  captureButtonPressed: {
    backgroundColor: "#c9c9c9"
  },
  captureButtonDisabled: {
    opacity: 0.65
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.18)",
    backgroundColor: "transparent"
  },
  flyingThumb: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.textPrimary,
    backgroundColor: colors.surfaceElevated
  },
  flyingThumbImage: {
    width: "100%",
    height: "100%"
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    gap: 12
  },
  title: {
    fontSize: 20,
    color: colors.textPrimary,
    fontWeight: "700"
  },
  helperText: {
    color: colors.textSecondary,
    textAlign: "center"
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  primaryButtonLabel: {
    color: colors.surface,
    fontWeight: "700"
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(20,24,28,0.5)"
  },
  secondaryButtonLabel: {
    color: colors.textPrimary,
    fontWeight: "700"
  }
});
