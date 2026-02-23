import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { CameraScreen } from "./camera/CameraScreen";
import { applyDecision, buildFeedItems, summarizeDecisions } from "./capture/CaptureController";
import { LibraryScreen } from "./library/LibraryScreen";
import { SearchScreen } from "./library/SearchScreen";
import { mergeLibraryBooks, toLibraryBookFromFeedItem, toLibraryBookFromLookupItem } from "./library/merge";
import {
  loadLibraryBooks,
  loadLibraryFilters,
  loadLibraryViewMode,
  saveLibraryBooks,
  saveLibraryFilters,
  saveLibraryViewMode
} from "./library/storage";
import { colors } from "./theme/colors";
import { DEFAULT_LIBRARY_FILTERS, type LibraryBook, type LibraryFilters, type LibraryViewMode } from "./types/library";
import type { CaptureScanResponse, FeedItem, LookupBookItem } from "./types/vision";

type AppPhase = "library" | "camera" | "results" | "search";

const defaultApiBaseUrl = Platform.select({
  android: "http://10.0.2.2:5001",
  ios: "http://127.0.0.1:5001",
  default: "http://127.0.0.1:5001"
});

const formatSource = (source: FeedItem["source"]): string =>
  source === "lookup" ? "Google Books" : "OCR fallback";

export default function App() {
  const [phase, setPhase] = useState<AppPhase>("library");
  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiBaseUrl ?? "http://127.0.0.1:5001");
  const [captureResult, setCaptureResult] = useState<CaptureScanResponse | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);

  const [libraryReady, setLibraryReady] = useState(false);
  const [libraryBooks, setLibraryBooks] = useState<LibraryBook[]>([]);
  const [libraryViewMode, setLibraryViewMode] = useState<LibraryViewMode>("list");
  const [libraryFilters, setLibraryFilters] = useState<LibraryFilters>(DEFAULT_LIBRARY_FILTERS);

  useEffect(() => {
    let cancelled = false;

    const loadLibraryState = async () => {
      try {
        const [books, viewMode, filters] = await Promise.all([
          loadLibraryBooks(),
          loadLibraryViewMode(),
          loadLibraryFilters()
        ]);

        if (cancelled) {
          return;
        }

        setLibraryBooks(books);
        setLibraryViewMode(viewMode);
        setLibraryFilters(filters);
      } finally {
        if (!cancelled) {
          setLibraryReady(true);
        }
      }
    };

    void loadLibraryState();

    return () => {
      cancelled = true;
    };
  }, []);

  const decisionSummary = useMemo(() => summarizeDecisions(feedItems), [feedItems]);
  const currentItem = useMemo(
    () => feedItems.find((item) => item.decision === null) ?? null,
    [feedItems]
  );

  const acceptedItems = useMemo(
    () => feedItems.filter((item) => item.decision === "accepted"),
    [feedItems]
  );

  const updateBooks = useCallback((incoming: LibraryBook[]) => {
    setLibraryBooks((current) => {
      const merged = mergeLibraryBooks(current, incoming);
      void saveLibraryBooks(merged);
      return merged;
    });
  }, []);

  const onToggleLoaned = useCallback((bookId: string) => {
    setLibraryBooks((current) => {
      const next = current.map((book) => {
        if (book.id !== bookId) {
          return book;
        }
        return {
          ...book,
          loaned: !book.loaned
        };
      });
      void saveLibraryBooks(next);
      return next;
    });
  }, []);

  const onViewModeChange = useCallback((viewMode: LibraryViewMode) => {
    setLibraryViewMode(viewMode);
    void saveLibraryViewMode(viewMode);
  }, []);

  const onFiltersChange = useCallback((filters: LibraryFilters) => {
    setLibraryFilters(filters);
    void saveLibraryFilters(filters);
  }, []);

  const onScanReviewDone = useCallback(() => {
    const acceptedBooks = acceptedItems.map((item) => toLibraryBookFromFeedItem(item));

    if (acceptedBooks.length > 0) {
      setLibraryBooks((current) => {
        const merged = mergeLibraryBooks(current, acceptedBooks);
        void saveLibraryBooks(merged);
        return merged;
      });
    }

    setCaptureResult(null);
    setFeedItems([]);
    setPhase("library");
  }, [acceptedItems]);

  if (!libraryReady) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>Loading library...</Text>
      </SafeAreaView>
    );
  }

  if (phase === "camera") {
    return (
      <>
        <StatusBar style="dark" />
        <CameraScreen
          apiBaseUrl={apiBaseUrl}
          onBack={() => setPhase("library")}
          onCaptureComplete={(capture) => {
            setCaptureResult(capture);
            setFeedItems(buildFeedItems(capture));
            setPhase("results");
          }}
        />
      </>
    );
  }

  if (phase === "search") {
    return (
      <>
        <StatusBar style="light" />
        <SearchScreen
          apiBaseUrl={apiBaseUrl}
          onBack={() => setPhase("library")}
          onAddLookupItem={(item: LookupBookItem) => {
            updateBooks([toLibraryBookFromLookupItem(item, "search")]);
          }}
        />
      </>
    );
  }

  if (phase === "results") {
    return (
      <SafeAreaView style={styles.resultsScreen}>
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
              void onScanReviewDone();
            }}
          >
            <Text style={styles.secondaryButtonLabel}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <LibraryScreen
        books={libraryBooks}
        viewMode={libraryViewMode}
        filters={libraryFilters}
        apiBaseUrl={apiBaseUrl}
        onApiBaseUrlChange={setApiBaseUrl}
        onViewModeChange={onViewModeChange}
        onFiltersChange={onFiltersChange}
        onToggleLoaned={onToggleLoaned}
        onOpenCamera={() => setPhase("camera")}
        onOpenSearch={() => setPhase("search")}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14
  },
  resultsScreen: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16
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
