import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { runCaptureLookup } from "../api/extractionClient";
import SelectCapturesIcon from "../icons/SelectCapturesIcon";
import { GuideOverlay } from "../overlay/GuideOverlay";
import { PulsingLoader } from "../primitives/PulsingLoader";
import { colors } from "../theme/colors";
import { fontFamilies } from "../theme/tokens";
import type { CaptureScanResponse } from "../types/vision";

type CameraScreenProps = {
  apiBaseUrl: string;
  reviewEnabled: boolean;
  onBack: () => void;
  onOpenReview: () => void;
  onCaptureProcessed: (capture: CaptureScanResponse) => void;
  onLookupQueueStateChange?: (state: { inFlightCount: number; queuedCount: number }) => void;
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

const CAPTURE_LOOKUP_MAX_RESULTS = 3;
const CAPTURE_DELAY_MS = 300;
const TOP_BAR_HEIGHT = 55;
const TOP_SAFE_INSET = Platform.select({ ios: 44, android: 0, default: 0 }) ?? 0;

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
  onCaptureProcessed,
  onLookupQueueStateChange
}: CameraScreenProps) {
  const cameraRef = useRef<CameraView | null>(null);
  const lookupQueueRef = useRef<QueueItem[]>([]);
  const lookupWorkerInFlightRef = useRef(false);
  const cooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewButtonLayoutRef = useRef<{ x: number; y: number; width: number; height: number } | null>(
    null
  );

  const flashAnim = useRef(new Animated.Value(0)).current;
  const flyAnim = useRef(new Animated.Value(0)).current;

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [overlayLayout, setOverlayLayout] = useState<OverlayLayout>({ width: 0, height: 0 });
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureCooldown, setCaptureCooldown] = useState(false);
  const [lookupInFlightCount, setLookupInFlightCount] = useState(0);
  const [queuedLookupCount, setQueuedLookupCount] = useState(0);

  const [flyThumbnailUri, setFlyThumbnailUri] = useState<string | null>(null);
  const [flyStart, setFlyStart] = useState<Point>({ x: 0, y: 0 });
  const [flyEnd, setFlyEnd] = useState<Point>({ x: 0, y: 0 });

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape =
    overlayLayout.width > 0 && overlayLayout.height > 0
      ? overlayLayout.width > overlayLayout.height
      : windowWidth > windowHeight;

  useEffect(() => {
    return () => {
      if (cooldownTimeoutRef.current !== null) {
        clearTimeout(cooldownTimeoutRef.current);
        cooldownTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!permission || permission.granted || !permission.canAskAgain) {
      return;
    }

    void requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    onLookupQueueStateChange?.({
      inFlightCount: lookupInFlightCount,
      queuedCount: queuedLookupCount
    });
  }, [lookupInFlightCount, onLookupQueueStateChange, queuedLookupCount]);

  useEffect(() => {
    return () => {
      onLookupQueueStateChange?.({
        inFlightCount: 0,
        queuedCount: 0
      });
    };
  }, [onLookupQueueStateChange]);

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
    if (!captureEnabled || !camera) {
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
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.permissionButtonPressed]}
          onPress={() => void requestPermission()}
        >
          <Text style={styles.primaryButtonLabel}>Allow Camera</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.permissionButtonPressed]} onPress={onBack}>
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
        flash="off"
        responsiveOrientationWhenOrientationLocked
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

      <View style={styles.topBar}>
        <Pressable
          style={({ pressed }) => [styles.topBarCloseButton, pressed && styles.topBarButtonPressed]}
          onPress={onBack}
        >
          <Text style={styles.topBarCloseText}>×</Text>
        </Pressable>

        <View style={styles.topBarTitleWrap}>
          <TinyShelfIcon color={colors.accent} />
          <Text style={styles.topBarTitle}>Scan Books</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.reviewButton,
            !reviewEnabled && styles.reviewButtonDisabled,
            pressed && reviewEnabled && styles.topBarButtonPressed
          ]}
          onPress={onOpenReview}
          onLayout={onReviewButtonLayout}
          disabled={!reviewEnabled}
        >
          <SelectCapturesIcon
            width={14}
            height={14}
            color={reviewEnabled ? colors.textPrimary : "rgba(142,149,168,0.9)"}
          />
          {queueBusy ? (
            <View pointerEvents="none" style={styles.reviewButtonPulse}>
              <PulsingLoader size={20} color={colors.accent} durationMs={920} ringOnly />
            </View>
          ) : null}
        </Pressable>
      </View>

      <View pointerEvents="none" style={styles.scanHint}>
        <Text style={styles.scanHintText}>Point at your bookshelf to scan</Text>
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
          <CaptureTargetIcon color={colors.background} />
        )}
      </Pressable>
    </View>
  );
}

function TinyShelfIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} fill="none" viewBox="0 0 24 24">
      <Path d="M4 5.5c0-1.1.9-2 2-2h5v15H6a2 2 0 0 0-2 2v-15Z" stroke={color} strokeWidth={1.8} />
      <Path d="M20 5.5c0-1.1-.9-2-2-2h-5v15h5a2 2 0 0 1 2 2v-15Z" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

function CaptureTargetIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} fill="none" viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
      <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={1.8} />
      <Rect x={11.2} y={4.3} width={1.6} height={3} fill={color} />
      <Rect x={11.2} y={16.7} width={1.6} height={3} fill={color} />
      <Rect x={4.3} y={11.2} width={3} height={1.6} fill={color} />
      <Rect x={16.7} y={11.2} width={3} height={1.6} fill={color} />
    </Svg>
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
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: TOP_BAR_HEIGHT + TOP_SAFE_INSET,
    paddingTop: TOP_SAFE_INSET,
    backgroundColor: "rgba(20,23,34,0.94)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,165,116,0.16)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10
  },
  topBarCloseButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  topBarCloseText: {
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 22
  },
  topBarTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  topBarTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.serifRegular,
    fontSize: 14
  },
  topBarButtonPressed: {
    opacity: 0.82
  },
  reviewButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.2)"
  },
  reviewButtonDisabled: {
    borderColor: "rgba(142,149,168,0.22)",
    backgroundColor: "rgba(255,255,255,0.05)"
  },
  reviewButtonPulse: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -10,
    marginLeft: -10
  },
  scanHint: {
    position: "absolute",
    left: "50%",
    bottom: 108,
    transform: [{ translateX: -96 }],
    width: 192,
    height: 30,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.45)",
    backgroundColor: "rgba(34,38,54,0.62)",
    alignItems: "center",
    justifyContent: "center"
  },
  scanHintText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: fontFamilies.sansRegular
  },
  errorChip: {
    position: "absolute",
    top: 64,
    alignSelf: "center",
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
    marginLeft: -32,
    bottom: 18
  },
  captureButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#F0CC9E",
    backgroundColor: colors.accent,
    shadowColor: colors.black,
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 5
  },
  captureButtonPressed: {
    backgroundColor: "#C99661"
  },
  captureButtonDisabled: {
    opacity: 0.55
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
    fontFamily: fontFamilies.serifBold
  },
  helperText: {
    color: colors.textSecondary,
    textAlign: "center"
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  permissionButtonPressed: {
    opacity: 0.8
  },
  primaryButtonLabel: {
    color: colors.background,
    fontWeight: "700"
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.white
  },
  secondaryButtonLabel: {
    color: colors.background,
    fontWeight: "700"
  }
});
