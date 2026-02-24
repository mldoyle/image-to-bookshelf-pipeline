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
import BackIcon from "./icons/BackIcon";
import { CameraScreen } from "./camera/CameraScreen";
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
import { BookApprovalStack, type ReviewStackCard } from "./review/BookApprovalStack";
import { colors } from "./theme/colors";
import { DEFAULT_LIBRARY_FILTERS, type LibraryBook, type LibraryFilters, type LibraryViewMode } from "./types/library";
import type { CaptureScanResponse, CaptureScanSpine, FeedItem, LookupBookItem } from "./types/vision";

type AppPhase = "library" | "camera" | "results" | "search" | "book_profile";
type ReviewSpineStatus = "pending" | "accepted" | "rejected";

type ReviewSpineState = {
  id: string;
  spineIndex: number;
  candidates: FeedItem[];
  candidateIndex: number;
  status: ReviewSpineStatus;
  acceptedItem: FeedItem | null;
};

type ReviewCaptureState = {
  id: string;
  captureId: number;
  spines: ReviewSpineState[];
};

type ReviewSummary = {
  accepted: number;
  rejected: number;
  pending: number;
  total: number;
};

const TOP_BAR_INSET = 14;
const TOP_BAR_OFFSET = 52;
const OVERLAY_BASE = "#55656B";
const BOTTOM_GRADIENT_STEPS = [
  "rgba(94, 68, 71, 0.00)",
  "rgba(109, 92, 95, 0.04)",
  "rgba(135, 124, 126, 0.08)",
  "rgba(163, 154, 155, 0.12)",
  "rgba(195, 190, 190, 0.16)",
  "rgba(255, 255, 255, 0.20)"
] as const;

function AppBackground() {
  return (
    <View pointerEvents="none" style={styles.appBackground}>
      <View style={styles.appBackgroundBase} />
      <View style={styles.bottomGradient}>
        {BOTTOM_GRADIENT_STEPS.map((color, index) => (
          <View key={`${color}-${index}`} style={[styles.bottomGradientStep, { backgroundColor: color }]} />
        ))}
      </View>
    </View>
  );
}

const defaultApiBaseUrl = Platform.select({
  android: "http://10.0.2.2:5001",
  ios: "http://127.0.0.1:5001",
  default: "http://127.0.0.1:5001"
});

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const reviewDedupeKey = (item: FeedItem): string => {
  const lookupId = item.metadata?.id?.trim();
  if (lookupId) {
    return `lookup:${lookupId.toLowerCase()}`;
  }
  return `${normalize(item.title)}::${normalize(item.author)}`;
};

const summarizeReview = (captures: ReviewCaptureState[]): ReviewSummary => {
  let accepted = 0;
  let rejected = 0;
  let pending = 0;

  captures.forEach((capture) => {
    capture.spines.forEach((spine) => {
      if (spine.status === "accepted") {
        accepted += 1;
        return;
      }
      if (spine.status === "rejected") {
        rejected += 1;
        return;
      }
      pending += 1;
    });
  });

  return {
    accepted,
    rejected,
    pending,
    total: accepted + rejected + pending
  };
};

const getAcceptedKeySet = (captures: ReviewCaptureState[]): Set<string> => {
  const accepted = new Set<string>();
  captures.forEach((capture) => {
    capture.spines.forEach((spine) => {
      if (spine.status === "accepted" && spine.acceptedItem) {
        accepted.add(reviewDedupeKey(spine.acceptedItem));
      }
    });
  });
  return accepted;
};

const findNextUniqueCandidateIndex = (
  spine: ReviewSpineState,
  startIndex: number,
  acceptedKeys: Set<string>
): number | null => {
  let cursor = startIndex;
  while (cursor < spine.candidates.length) {
    const nextCandidate = spine.candidates[cursor];
    if (!acceptedKeys.has(reviewDedupeKey(nextCandidate))) {
      return cursor;
    }
    cursor += 1;
  }
  return null;
};

const createLookupCandidateItem = (
  spine: CaptureScanSpine,
  lookupItem: LookupBookItem,
  captureId: number,
  candidateIndex: number,
  totalCandidates: number
): FeedItem => {
  const title = lookupItem.title?.trim() || spine.extraction.title.trim() || "Untitled";
  const author =
    lookupItem.authors?.filter(Boolean).join(", ") || spine.extraction.author?.trim() || "Unknown author";

  return {
    id: `capture-${captureId}-spine-${spine.spineIndex}-lookup-${candidateIndex}`,
    spineIndex: spine.spineIndex,
    title,
    author,
    source: "lookup",
    confidence: spine.extraction.confidence,
    raw: spine,
    metadata: lookupItem,
    hiddenAlternatives: Math.max(0, totalCandidates - candidateIndex - 1),
    decision: null
  };
};

const createFallbackCandidateItem = (spine: CaptureScanSpine, captureId: number): FeedItem => ({
  id: `capture-${captureId}-spine-${spine.spineIndex}-extraction`,
  spineIndex: spine.spineIndex,
  title: spine.extraction.title.trim() || "Untitled",
  author: spine.extraction.author?.trim() || "Unknown author",
  source: "extraction",
  confidence: spine.extraction.confidence,
  raw: spine,
  hiddenAlternatives: 0,
  decision: null
});

const buildReviewCapture = (
  capture: CaptureScanResponse,
  captureId: number,
  seenCandidateKeys: Set<string>
): ReviewCaptureState => {
  const spines = capture.spines.map((spine) => {
    const lookupItems = spine.lookup.items ?? [];
    const rawCandidates =
      lookupItems.length > 0
        ? lookupItems.map((lookupItem, index) =>
            createLookupCandidateItem(spine, lookupItem, captureId, index, lookupItems.length)
          )
        : [createFallbackCandidateItem(spine, captureId)];

    const candidates = rawCandidates.filter((candidate) => {
      const key = reviewDedupeKey(candidate);
      if (seenCandidateKeys.has(key)) {
        return false;
      }
      seenCandidateKeys.add(key);
      return true;
    });

    return {
      id: `capture-${captureId}-spine-${spine.spineIndex}`,
      spineIndex: spine.spineIndex,
      candidates,
      candidateIndex: 0,
      status: candidates.length > 0 ? ("pending" as const) : ("rejected" as const),
      acceptedItem: null
    };
  });

  return {
    id: `capture-${captureId}`,
    captureId,
    spines
  };
};

const collectAcceptedItems = (captures: ReviewCaptureState[]): FeedItem[] => {
  const seen = new Set<string>();
  const accepted: FeedItem[] = [];

  captures.forEach((capture) => {
    capture.spines.forEach((spine) => {
      if (spine.status !== "accepted" || !spine.acceptedItem) {
        return;
      }
      const key = reviewDedupeKey(spine.acceptedItem);
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      accepted.push(spine.acceptedItem);
    });
  });

  return accepted;
};

const collectCandidateKeys = (captures: ReviewCaptureState[]): Set<string> => {
  const seen = new Set<string>();
  captures.forEach((capture) => {
    capture.spines.forEach((spine) => {
      spine.candidates.forEach((candidate) => {
        seen.add(reviewDedupeKey(candidate));
      });
    });
  });
  return seen;
};

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
  const [reviewCaptures, setReviewCaptures] = useState<ReviewCaptureState[]>([]);

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

  const reviewSummary = useMemo(() => summarizeReview(reviewCaptures), [reviewCaptures]);
  const acceptedKeys = useMemo(() => getAcceptedKeySet(reviewCaptures), [reviewCaptures]);
  const acceptedItems = useMemo(() => collectAcceptedItems(reviewCaptures), [reviewCaptures]);

  const activeCaptureIndex = useMemo(
    () => reviewCaptures.findIndex((capture) => capture.spines.some((spine) => spine.status === "pending")),
    [reviewCaptures]
  );

  const activeCapture = useMemo(
    () => (activeCaptureIndex >= 0 ? reviewCaptures[activeCaptureIndex] : null),
    [activeCaptureIndex, reviewCaptures]
  );

  const activeCards = useMemo<ReviewStackCard[]>(() => {
    if (!activeCapture) {
      return [];
    }

    return activeCapture.spines
      .filter((spine) => spine.status === "pending")
      .map((spine) => ({
        spineId: spine.id,
        item: spine.candidates[spine.candidateIndex],
        captureNumber: activeCapture.captureId + 1,
        candidateIndex: spine.candidateIndex,
        candidateCount: spine.candidates.length,
        hasMoreCandidates:
          findNextUniqueCandidateIndex(spine, spine.candidateIndex + 1, acceptedKeys) !== null
      }));
  }, [acceptedKeys, activeCapture]);

  const setRecentlyAddedDefaults = useCallback(() => {
    setLibraryFilters(DEFAULT_LIBRARY_FILTERS);
    void saveLibraryFilters(DEFAULT_LIBRARY_FILTERS);
  }, []);

  const resetCaptureSession = useCallback(() => {
    captureSequenceRef.current = 0;
    setCaptureSessionCount(0);
    setCaptureSessionSpineCount(0);
    setReviewCaptures([]);
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

  const onApproveSpine = useCallback((spineId: string) => {
    setReviewCaptures((current) => {
      let acceptedItem: FeedItem | null = null;

      current.forEach((capture) => {
        capture.spines.forEach((spine) => {
          if (spine.id === spineId && spine.status === "pending") {
            acceptedItem = spine.candidates[spine.candidateIndex] ?? null;
          }
        });
      });

      if (!acceptedItem) {
        return current;
      }

      const acceptedKey = reviewDedupeKey(acceptedItem);
      const acceptedKeySet = getAcceptedKeySet(current);
      acceptedKeySet.add(acceptedKey);

      return current.map((capture) => ({
        ...capture,
        spines: capture.spines.map((spine) => {
          if (spine.id === spineId && spine.status === "pending") {
            return {
              ...spine,
              status: "accepted",
              acceptedItem
            };
          }

          if (spine.status !== "pending") {
            return spine;
          }

          const nextIndex = findNextUniqueCandidateIndex(spine, spine.candidateIndex, acceptedKeySet);
          if (nextIndex === null) {
            return {
              ...spine,
              status: "rejected"
            };
          }
          if (nextIndex !== spine.candidateIndex) {
            return {
              ...spine,
              candidateIndex: nextIndex
            };
          }
          return spine;
        })
      }));
    });
  }, []);

  const onRejectSpine = useCallback((spineId: string) => {
    setReviewCaptures((current) => {
      const acceptedKeySet = getAcceptedKeySet(current);

      return current.map((capture) => ({
        ...capture,
        spines: capture.spines.map((spine) => {
          if (spine.id !== spineId || spine.status !== "pending") {
            return spine;
          }

          const nextIndex = findNextUniqueCandidateIndex(spine, spine.candidateIndex + 1, acceptedKeySet);
          if (nextIndex === null) {
            return {
              ...spine,
              status: "rejected"
            };
          }

          return {
            ...spine,
            candidateIndex: nextIndex
          };
        })
      }));
    });
  }, []);

  const closeReviewOverlay = useCallback(() => {
    const acceptedBooks = acceptedItems.map((item) => toLibraryBookFromFeedItem(item));

    if (acceptedBooks.length > 0) {
      setLibraryBooks((current) => {
        const merged = mergeLibraryBooks(current, acceptedBooks);
        void saveLibraryBooks(merged);
        return merged;
      });
    }

    resetCaptureSession();
    setRecentlyAddedDefaults();
    setPhase("library");
  }, [acceptedItems, resetCaptureSession, setRecentlyAddedDefaults]);

  if (!libraryReady) {
    return (
      <View style={styles.appShell}>
        <AppBackground />
        <SafeAreaView style={styles.loadingScreen}>
          <StatusBar style="light" />
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Loading library...</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === "camera") {
    return (
      <View style={styles.appShell}>
        <AppBackground />
        <StatusBar style="light" />
        <CameraScreen
          apiBaseUrl={apiBaseUrl}
          reviewEnabled={captureSessionCount > 0}
          onBack={() => {
            resetCaptureSession();
            setPhase("library");
          }}
          onOpenReview={() => {
            setPhase("results");
          }}
          onCaptureProcessed={(capture: CaptureScanResponse) => {
            const captureId = captureSequenceRef.current;
            captureSequenceRef.current += 1;

            setReviewCaptures((current) => {
              const seenCandidateKeys = collectCandidateKeys(current);
              return [...current, buildReviewCapture(capture, captureId, seenCandidateKeys)];
            });
            setCaptureSessionCount((count) => count + 1);
            setCaptureSessionSpineCount((count) => count + capture.spines.length);
          }}
        />
      </View>
    );
  }

  if (phase === "search") {
    return (
      <View style={styles.appShell}>
        <AppBackground />
        <StatusBar style="light" />
        <SearchScreen
          apiBaseUrl={apiBaseUrl}
          onBack={() => setPhase("library")}
          onAddLookupItem={(item: LookupBookItem) => {
            updateBooks([toLibraryBookFromLookupItem(item, "search")]);
          }}
        />
      </View>
    );
  }

  if (phase === "book_profile" && selectedBook) {
    return (
      <View style={styles.appShell}>
        <AppBackground />
        <StatusBar style="light" />
        <BookProfileScreen
          book={selectedBook}
          onBack={() => {
            setPhase("library");
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.appShell}>
      <AppBackground />
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

      {phase === "results" ? (
        <View style={styles.overlayScrim}>
          <View pointerEvents="none" style={styles.bottomGradient}>
            {BOTTOM_GRADIENT_STEPS.map((color, index) => (
              <View key={`${color}-${index}`} style={[styles.bottomGradientStep, { backgroundColor: color }]} />
            ))}
          </View>

          <SafeAreaView style={styles.resultsScreen}>
            <Pressable
              style={[styles.topIconButton, styles.resultsBackButton]}
              onPress={() => {
                closeReviewOverlay();
              }}
            >
              <BackIcon color={OVERLAY_BASE} />
            </Pressable>

            <View style={styles.resultsContent}>
              <View style={styles.headerBlock}>
                <Text style={styles.title}>Adding {captureSessionSpineCount} books to library</Text>
              </View>

              {activeCards.length > 0 ? (
                <View style={styles.stackWrap}>
                  <BookApprovalStack
                    cards={activeCards}
                    onApprove={onApproveSpine}
                    onReject={onRejectSpine}
                  />
                </View>
              ) : (
                <View style={styles.doneWrap}>
                  <Text style={styles.doneTitle}>All done!</Text>
                  <Text style={styles.subtitle}>Accepted {reviewSummary.accepted} books.</Text>

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
            </View>
          </SafeAreaView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1
  },
  appBackground: {
    ...StyleSheet.absoluteFillObject
  },
  appBackgroundBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAY_BASE
  },
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
  overlayScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAY_BASE
  },
  bottomGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "36%"
  },
  bottomGradientStep: {
    flex: 1
  },
  resultsScreen: {
    flex: 1
  },
  resultsBackButton: {
    position: "absolute",
    top: TOP_BAR_OFFSET,
    left: TOP_BAR_INSET
  },
  topIconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.white,
    zIndex: 30
  },
  resultsContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 110,
    paddingBottom: 16
  },
  headerBlock: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    padding: 14,
    gap: 6,
    marginBottom: 12
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.white
  },
  subtitle: {
    fontSize: 14,
    color: colors.white
  },
  stackWrap: {
    flex: 1
  },
  doneWrap: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    padding: 14,
    gap: 12
  },
  doneTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.white
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
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)"
  },
  acceptedTitle: {
    fontSize: 16,
    color: colors.white,
    fontWeight: "700"
  },
  acceptedMeta: {
    fontSize: 13,
    color: colors.white
  }
});
