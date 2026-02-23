import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  NativeModules,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { CameraScreen } from "./camera/CameraScreen";
import { applyDecision, buildFeedItems, dedupeFeedItems, summarizeDecisions } from "./capture/CaptureController";
import { BookProfileScreen } from "./library/BookProfileScreen";
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
import type { FeedItem, LookupBookItem } from "./types/vision";

type AppPhase = "library" | "camera" | "results" | "search" | "book_profile";

const defaultApiBaseUrl = Platform.select({
  android: "http://10.0.2.2:5001",
  ios: "http://127.0.0.1:5001",
  default: "http://127.0.0.1:5001"
});

const resolveMetroHost = (): string | null => {
  const sourceCode = NativeModules.SourceCode as { scriptURL?: string } | undefined;
  const scriptURL = sourceCode?.scriptURL;
  if (!scriptURL) {
    return null;
  }

  const match = scriptURL.match(/^https?:\/\/([^/:]+):\d+/i);
  if (!match) {
    return null;
  }

  const host = match[1];
  if (!host) {
    return null;
  }

  return host;
};

const formatSource = (source: FeedItem["source"]): string =>
  source === "lookup" ? "Google Books" : "OCR fallback";

export default function App() {
  const metroHost = resolveMetroHost();
  const resolvedDefaultApiBaseUrl = useMemo(() => {
    if (Platform.OS === "android") {
      return defaultApiBaseUrl ?? "http://10.0.2.2:5001";
    }
    if (!metroHost || metroHost === "localhost" || metroHost === "127.0.0.1") {
      return defaultApiBaseUrl ?? "http://127.0.0.1:5001";
    }
    return `http://${metroHost}:5001`;
  }, [metroHost]);

  const [phase, setPhase] = useState<AppPhase>("library");
  const [apiBaseUrl, setApiBaseUrl] = useState(resolvedDefaultApiBaseUrl);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);

  const [captureSessionItems, setCaptureSessionItems] = useState<FeedItem[]>([]);
  const [captureSessionCount, setCaptureSessionCount] = useState(0);
  const [captureSessionSpineCount, setCaptureSessionSpineCount] = useState(0);
  const captureSequenceRef = useRef(0);

  const [libraryReady, setLibraryReady] = useState(false);
  const [libraryBooks, setLibraryBooks] = useState<LibraryBook[]>([]);
  const [libraryViewMode, setLibraryViewMode] = useState<LibraryViewMode>("list");
  const [libraryFilters, setLibraryFilters] = useState<LibraryFilters>(DEFAULT_LIBRARY_FILTERS);
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);

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

  const resetCaptureSession = useCallback(() => {
    captureSequenceRef.current = 0;
    setCaptureSessionItems([]);
    setCaptureSessionCount(0);
    setCaptureSessionSpineCount(0);
    setFeedItems([]);
  }, []);

  const startCameraSession = useCallback(() => {
    resetCaptureSession();
    setPhase("camera");
  }, [resetCaptureSession]);

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

    resetCaptureSession();
    setPhase("library");
  }, [acceptedItems, resetCaptureSession]);

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
        <StatusBar style="light" />
        <CameraScreen
          apiBaseUrl={apiBaseUrl}
          reviewEnabled={captureSessionItems.length > 0}
          onBack={() => {
            resetCaptureSession();
            setPhase("library");
          }}
          onOpenReview={() => {
            const dedupedItems = dedupeFeedItems(captureSessionItems).map((item) => ({
              ...item,
              decision: null
            }));
            setFeedItems(dedupedItems);
            setPhase("results");
          }}
          onCaptureProcessed={(capture) => {
            const captureId = captureSequenceRef.current;
            captureSequenceRef.current += 1;
            const prefixedItems = buildFeedItems(capture).map((item) => ({
              ...item,
              id: `capture-${captureId}-${item.id}`,
              decision: null
            }));

            setCaptureSessionItems((current) => [...current, ...prefixedItems]);
            setCaptureSessionCount((count) => count + 1);
            setCaptureSessionSpineCount((count) => count + capture.spines.length);
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

  if (phase === "book_profile" && selectedBook) {
    return (
      <>
        <StatusBar style="light" />
        <BookProfileScreen
          book={selectedBook}
          onBack={() => {
            setPhase("library");
          }}
        />
      </>
    );
  }

  if (phase === "results") {
    return (
      <SafeAreaView style={styles.resultsScreen}>
        <StatusBar style="light" />

        <View style={styles.headerBlock}>
          <Text style={styles.title}>Review Books</Text>
          <Text style={styles.subtitle}>
            {captureSessionCount} captures | {captureSessionSpineCount} detected spines | {feedItems.length} unique books
          </Text>
          <Text style={styles.subtitle}>
            accepted: {decisionSummary.accepted} | rejected: {decisionSummary.rejected}
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
              startCameraSession();
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
        onOpenBook={(book) => {
          setSelectedBook(book);
          setPhase("book_profile");
        }}
        onOpenCamera={startCameraSession}
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
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16
  },
  headerBlock: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
    marginBottom: 12
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.textPrimary
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary
  },
  stackWrap: {
    flex: 1,
    gap: 16
  },
  bookCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    minHeight: 280,
    justifyContent: "center",
    gap: 8
  },
  bookTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary
  },
  bookAuthor: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.textSecondary
  },
  bookMeta: {
    fontSize: 14,
    color: colors.textMuted
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
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.warning
  },
  acceptButton: {
    backgroundColor: colors.accentMuted,
    borderWidth: 2,
    borderColor: colors.accent
  },
  actionGlyph: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.textPrimary
  },
  actionText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary
  },
  doneWrap: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12
  },
  doneTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.textPrimary
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
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border
  },
  acceptedTitle: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: "700"
  },
  acceptedMeta: {
    fontSize: 13,
    color: colors.textSecondary
  },
  footerRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: 10,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  secondaryButtonLabel: {
    color: colors.textPrimary,
    fontWeight: "700"
  }
});
