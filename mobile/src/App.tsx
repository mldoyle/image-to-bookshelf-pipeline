import { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { CameraScreen } from "./camera/CameraScreen";
import { applyDecision, buildFeedItems, summarizeDecisions } from "./capture/CaptureController";
import type { CaptureScanResponse, FeedItem } from "./types/vision";

type AppPhase = "idle" | "camera" | "results";

const defaultApiBaseUrl = Platform.select({
  android: "http://10.0.2.2:5001",
  ios: "http://127.0.0.1:5001",
  default: "http://127.0.0.1:5001"
});

const formatSource = (source: FeedItem["source"]): string =>
  source === "lookup" ? "Google Books" : "OCR fallback";

export default function App() {
  const [phase, setPhase] = useState<AppPhase>("idle");
  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiBaseUrl ?? "http://127.0.0.1:5001");
  const [captureResult, setCaptureResult] = useState<CaptureScanResponse | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);

  const decisionSummary = useMemo(() => summarizeDecisions(feedItems), [feedItems]);
  const currentItem = useMemo(
    () => feedItems.find((item) => item.decision === null) ?? null,
    [feedItems]
  );

  const acceptedItems = useMemo(
    () => feedItems.filter((item) => item.decision === "accepted"),
    [feedItems]
  );

  if (phase === "camera") {
    return (
      <>
        <StatusBar style="dark" />
        <CameraScreen
          apiBaseUrl={apiBaseUrl}
          onBack={() => setPhase("idle")}
          onCaptureComplete={(capture) => {
            setCaptureResult(capture);
            setFeedItems(buildFeedItems(capture));
            setPhase("results");
          }}
        />
      </>
    );
  }

  if (phase === "results") {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />

        <View style={styles.headerBlock}>
          <Text style={styles.title}>Review Books</Text>
          <Text style={styles.subtitle}>
            {captureResult?.spines.length ?? 0} detected spines | accepted: {decisionSummary.accepted} | rejected: {decisionSummary.rejected}
          </Text>
        </View>

        {currentItem ? (
          <View style={styles.stackWrap}>
            <View style={styles.bookCard}>
              <Text style={styles.bookTitle}>{currentItem.title}</Text>
              <Text style={styles.bookAuthor}>{currentItem.author}</Text>
              <Text style={styles.bookMeta}>
                source: {formatSource(currentItem.source)} | extraction confidence: {currentItem.confidence.toFixed(3)}
              </Text>
              {currentItem.hiddenAlternatives > 0 ? (
                <Text style={styles.bookMeta}>
                  {currentItem.hiddenAlternatives} alternate matches hidden for this spine.
                </Text>
              ) : null}
            </View>

            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() =>
                  setFeedItems((current) =>
                    applyDecision(current, currentItem.id, "rejected")
                  )
                }
              >
                <Text style={styles.actionGlyph}>✕</Text>
                <Text style={styles.actionText}>Reject</Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() =>
                  setFeedItems((current) =>
                    applyDecision(current, currentItem.id, "accepted")
                  )
                }
              >
                <Text style={styles.actionGlyph}>✓</Text>
                <Text style={styles.actionText}>Accept</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.doneWrap}>
            <Text style={styles.doneTitle}>Review complete</Text>
            <Text style={styles.subtitle}>
              Accepted {decisionSummary.accepted} books.
            </Text>

            <FlatList
              data={acceptedItems}
              keyExtractor={(item) => item.id}
              style={styles.acceptedList}
              contentContainerStyle={styles.acceptedListContent}
              renderItem={({ item }) => (
                <View style={styles.acceptedItem}>
                  <Text style={styles.acceptedTitle}>{item.title}</Text>
                  <Text style={styles.acceptedMeta}>{item.author}</Text>
                </View>
              )}
            />
          </View>
        )}

        <View style={styles.footerRow}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              setCaptureResult(null);
              setFeedItems([]);
              setPhase("camera");
            }}
          >
            <Text style={styles.secondaryButtonLabel}>Scan Again</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              setCaptureResult(null);
              setFeedItems([]);
              setPhase("idle");
            }}
          >
            <Text style={styles.secondaryButtonLabel}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.startCard}>
        <Text style={styles.title}>Bookshelf Scanner</Text>
        <Text style={styles.subtitle}>On-device guide + manual capture + one-card review flow.</Text>

        <Text style={styles.fieldLabel}>Backend base URL</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          value={apiBaseUrl}
          onChangeText={setApiBaseUrl}
          placeholder="http://127.0.0.1:5001"
        />
        <Text style={styles.helperText}>
          Android emulator: use 10.0.2.2. iPhone device: use your Mac LAN IP (for example 192.168.x.x).
        </Text>

        <Pressable style={styles.primaryButton} onPress={() => setPhase("camera")}>
          <Text style={styles.primaryButtonLabel}>Open Camera</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16
  },
  startCard: {
    marginTop: 64,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    gap: 10
  },
  headerBlock: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    gap: 6,
    marginBottom: 12
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0f172a"
  },
  subtitle: {
    fontSize: 14,
    color: "#334155"
  },
  fieldLabel: {
    marginTop: 10,
    fontSize: 13,
    color: "#475569",
    fontWeight: "700"
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    backgroundColor: "#ffffff"
  },
  helperText: {
    fontSize: 12,
    color: "#64748b"
  },
  primaryButton: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a"
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16
  },
  stackWrap: {
    flex: 1,
    gap: 16
  },
  bookCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 18,
    minHeight: 280,
    justifyContent: "center",
    gap: 8
  },
  bookTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a"
  },
  bookAuthor: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b"
  },
  bookMeta: {
    fontSize: 14,
    color: "#475569"
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10
  },
  actionButton: {
    width: 120,
    height: 120,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  rejectButton: {
    backgroundColor: "#fee2e2",
    borderWidth: 2,
    borderColor: "#dc2626"
  },
  acceptButton: {
    backgroundColor: "#dcfce7",
    borderWidth: 2,
    borderColor: "#16a34a"
  },
  actionGlyph: {
    fontSize: 36,
    fontWeight: "800",
    color: "#0f172a"
  },
  actionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a"
  },
  doneWrap: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    gap: 12
  },
  doneTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a"
  },
  acceptedList: {
    flex: 1
  },
  acceptedListContent: {
    gap: 8,
    paddingBottom: 12
  },
  acceptedItem: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  acceptedTitle: {
    fontSize: 16,
    color: "#0f172a",
    fontWeight: "700"
  },
  acceptedMeta: {
    fontSize: 13,
    color: "#475569"
  },
  footerRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#0f172a",
    borderRadius: 10,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonLabel: {
    color: "#0f172a",
    fontWeight: "700"
  }
});
