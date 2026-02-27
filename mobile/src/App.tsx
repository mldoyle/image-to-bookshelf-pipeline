import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  NativeModules,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  batchUpsertLibraryBooks,
  createLoan,
  fetchFriends,
  fetchLibraryBooks,
  fetchLoans,
  fetchProfile,
  patchLibraryBook,
  patchLoan,
  patchProfile,
  upsertFriend
} from "./api/libraryClient";
import { CameraScreen } from "./camera/CameraScreen";
import { BookProfileScreen } from "./library/BookProfileScreen";
import { HomeScreen } from "./library/HomeScreen";
import { LibraryScreen } from "./library/LibraryScreen";
import { LoansScreen } from "./library/LoansScreen";
import { ProfileScreen } from "./library/ProfileScreen";
import { SearchScreen } from "./library/SearchScreen";
import { SettingsScreen } from "./library/SettingsScreen";
import type { NewLoanSubmitPayload } from "./library/components/NewLoanSheet";
import { mergeLibraryBooks, toLibraryBookFromFeedItem, toLibraryBookFromLookupItem } from "./library/merge";
import { BookTurnerAnimation, MobileScaffold, type MainTabKey } from "./primitives";
import {
  loadLibrarySortMode,
  loadLibraryBooks,
  loadLibraryFilters,
  loadLibraryViewMode,
  saveLibraryBooks,
  saveLibraryFilters,
  saveLibrarySortMode,
  saveLibraryViewMode
} from "./library/storage";
import { BookApprovalStack, type ReviewStackCard } from "./review/BookApprovalStack";
import { colors } from "./theme/colors";
import { fontFamilies } from "./theme/tokens";
import { useAppFonts } from "./utils/fonts";
import {
  DEFAULT_LIBRARY_FILTERS,
  DEFAULT_LIBRARY_SORT_MODE,
  type LibraryBook,
  type LibraryFriend,
  type LibraryFilters,
  type LibraryLoan,
  type LibrarySortMode,
  type LibraryViewMode,
  type UserProfile
} from "./types/library";
import type { CaptureScanResponse, CaptureScanSpine, FeedItem, LookupBookItem } from "./types/vision";

type AppPhase = "library" | "camera" | "results" | "search" | "book_profile" | "settings";
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

const normalizeCoverUri = (uri?: string): string | null => {
  if (!uri) {
    return null;
  }
  return uri.replace(/^http:\/\//i, "https://");
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
  const [fontsLoaded, fontError] = useAppFonts({
    "SourceSerif4-Regular": require("../assets/fonts/Source_Serif_4/static/SourceSerif4-Regular.ttf"),
    "SourceSerif4-SemiBold": require("../assets/fonts/Source_Serif_4/static/SourceSerif4-SemiBold.ttf"),
    "SourceSerif4-Bold": require("../assets/fonts/Source_Serif_4/static/SourceSerif4-Bold.ttf")
  });
  const metroHost = resolveMetroHost();
  const resolvedDefaultApiBaseUrl = useMemo(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return `${window.location.protocol}//${window.location.hostname}:5001`;
    }
    if (Platform.OS === "android") {
      return defaultApiBaseUrl ?? "http://10.0.2.2:5001";
    }
    if (!metroHost || metroHost === "localhost" || metroHost === "127.0.0.1") {
      return defaultApiBaseUrl ?? "http://127.0.0.1:5001";
    }
    return `http://${metroHost}:5001`;
  }, [metroHost]);

  const [phase, setPhase] = useState<AppPhase>("library");
  const [activeTab, setActiveTab] = useState<MainTabKey>("library");
  const [apiBaseUrl, setApiBaseUrl] = useState(resolvedDefaultApiBaseUrl);
  const [reviewCaptures, setReviewCaptures] = useState<ReviewCaptureState[]>([]);

  const [captureSessionCount, setCaptureSessionCount] = useState(0);
  const [captureQueueState, setCaptureQueueState] = useState({ inFlightCount: 0, queuedCount: 0 });
  const [resultsScrollEnabled, setResultsScrollEnabled] = useState(true);
  const captureSequenceRef = useRef(0);

  const [libraryReady, setLibraryReady] = useState(false);
  const [libraryBooks, setLibraryBooks] = useState<LibraryBook[]>([]);
  const [libraryViewMode, setLibraryViewMode] = useState<LibraryViewMode>("list");
  const [librarySortMode, setLibrarySortMode] = useState<LibrarySortMode>(DEFAULT_LIBRARY_SORT_MODE);
  const [libraryFilters, setLibraryFilters] = useState<LibraryFilters>(DEFAULT_LIBRARY_FILTERS);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [libraryFriends, setLibraryFriends] = useState<LibraryFriend[]>([]);
  const [libraryLoans, setLibraryLoans] = useState<LibraryLoan[]>([]);
  const cameraEnabled = Platform.OS !== "web";

  const selectedBook = useMemo(
    () => (selectedBookId ? libraryBooks.find((book) => book.id === selectedBookId) ?? null : null),
    [libraryBooks, selectedBookId]
  );

  useEffect(() => {
    if (phase === "book_profile" && !selectedBook) {
      setPhase("library");
    }
  }, [phase, selectedBook]);

  useEffect(() => {
    let cancelled = false;

    const loadLibraryState = async () => {
      try {
        const [books, viewMode, sortMode, filters] = await Promise.all([
          loadLibraryBooks(),
          loadLibraryViewMode(),
          loadLibrarySortMode(),
          loadLibraryFilters()
        ]);

        if (cancelled) {
          return;
        }

        const normalizedBooks = mergeLibraryBooks([], books);
        setLibraryBooks(normalizedBooks);
        setLibraryViewMode(viewMode);
        setLibrarySortMode(sortMode);
        setLibraryFilters(filters);
        if (normalizedBooks.length !== books.length) {
          void saveLibraryBooks(normalizedBooks);
        }
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

  useEffect(() => {
    if (!libraryReady) {
      return;
    }

    let cancelled = false;

    const syncLibraryFromBackend = async () => {
      const rawCachedBooks = await loadLibraryBooks();
      const cachedBooks = mergeLibraryBooks([], rawCachedBooks);
      if (cachedBooks.length !== rawCachedBooks.length) {
        void saveLibraryBooks(cachedBooks);
      }
      let merged = cachedBooks;

      try {
        const remoteBooks = await fetchLibraryBooks(apiBaseUrl, 10000);
        merged = mergeLibraryBooks(remoteBooks, cachedBooks);
      } catch {
        // Keep cached data when backend is unavailable.
      }

      if (cancelled) {
        return;
      }

      setLibraryBooks(merged);
      void saveLibraryBooks(merged);

      try {
        const syncedBooks = await batchUpsertLibraryBooks(apiBaseUrl, merged, 12000);
        if (cancelled || syncedBooks.length === 0) {
          // Continue into profile/friends/loans sync even when book batch is empty.
        } else {
          const next = mergeLibraryBooks(merged, syncedBooks);
          setLibraryBooks(next);
          void saveLibraryBooks(next);
          merged = next;
        }
      } catch {
        // Local cache remains valid; next successful sync will reconcile.
      }

      const [profileResult, friendsResult, loansResult] = await Promise.allSettled([
        fetchProfile(apiBaseUrl, 12000),
        fetchFriends(apiBaseUrl, 12000),
        fetchLoans(apiBaseUrl, { timeoutMs: 12000 }),
      ]);

      if (cancelled) {
        return;
      }

      if (profileResult.status === "fulfilled") {
        setUserProfile(profileResult.value);
      }
      if (friendsResult.status === "fulfilled") {
        setLibraryFriends(friendsResult.value);
      }
      if (loansResult.status === "fulfilled") {
        setLibraryLoans(loansResult.value);
      }
    };

    void syncLibraryFromBackend();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, libraryReady]);

  const reviewSummary = useMemo(() => summarizeReview(reviewCaptures), [reviewCaptures]);
  const acceptedKeys = useMemo(() => getAcceptedKeySet(reviewCaptures), [reviewCaptures]);
  const acceptedItems = useMemo(() => collectAcceptedItems(reviewCaptures), [reviewCaptures]);
  const pendingCaptureJobs = captureQueueState.inFlightCount + captureQueueState.queuedCount;
  const reviewTotalWithProcessing = reviewSummary.total + pendingCaptureJobs;

  const captureSections = useMemo(() => {
    return reviewCaptures.map((capture) => {
      const pendingSpines = capture.spines.filter((spine) => spine.status === "pending");
      const acceptedCount = capture.spines.filter((spine) => spine.status === "accepted").length;
      const cards: ReviewStackCard[] = pendingSpines.map((spine) => ({
        spineId: spine.id,
        item: spine.candidates[spine.candidateIndex],
        captureNumber: capture.captureId + 1,
        candidateIndex: spine.candidateIndex,
        candidateCount: spine.candidates.length,
        hasMoreCandidates:
          findNextUniqueCandidateIndex(spine, spine.candidateIndex + 1, acceptedKeys) !== null
      }));

      const firstAccepted = capture.spines.find(
        (spine) => spine.status === "accepted" && spine.acceptedItem
      )?.acceptedItem;
      const firstPending =
        pendingSpines.length > 0 ? pendingSpines[0].candidates[pendingSpines[0].candidateIndex] : null;

      return {
        captureId: capture.captureId,
        total: capture.spines.length,
        pendingCount: pendingSpines.length,
        acceptedCount,
        cards,
        previewItem: firstAccepted ?? firstPending ?? null
      };
    });
  }, [acceptedKeys, reviewCaptures]);

  const setRecentlyAddedDefaults = useCallback(() => {
    setLibrarySortMode(DEFAULT_LIBRARY_SORT_MODE);
    void saveLibrarySortMode(DEFAULT_LIBRARY_SORT_MODE);
    setLibraryFilters(DEFAULT_LIBRARY_FILTERS);
    void saveLibraryFilters(DEFAULT_LIBRARY_FILTERS);
  }, []);

  const resetCaptureSession = useCallback(() => {
    captureSequenceRef.current = 0;
    setCaptureSessionCount(0);
    setCaptureQueueState({ inFlightCount: 0, queuedCount: 0 });
    setResultsScrollEnabled(true);
    setReviewCaptures([]);
  }, []);

  const startCameraSession = useCallback(() => {
    if (!cameraEnabled) {
      Alert.alert("Camera unavailable", "Camera scan is currently available on native iOS/Android only.");
      return;
    }
    resetCaptureSession();
    setPhase("camera");
  }, [cameraEnabled, resetCaptureSession]);

  const updateBooks = useCallback((incoming: LibraryBook[]) => {
    if (incoming.length === 0) {
      return;
    }

    const previewMerged = mergeLibraryBooks(libraryBooks, incoming);
    const previewAdded = Math.max(0, previewMerged.length - libraryBooks.length);
    const duplicateCount = Math.max(0, incoming.length - previewAdded);
    if (duplicateCount > 0) {
      Alert.alert(
        "Already in library",
        duplicateCount === 1
          ? "That book is already in your library."
          : `${duplicateCount} books are already in your library.`
      );
    }

    setLibraryBooks((current) => {
      const merged = mergeLibraryBooks(current, incoming);
      void saveLibraryBooks(merged);
      return merged;
    });

    void batchUpsertLibraryBooks(apiBaseUrl, incoming, 12000)
      .then((syncedBooks) => {
        if (syncedBooks.length === 0) {
          return;
        }
        setLibraryBooks((current) => {
          const merged = mergeLibraryBooks(current, syncedBooks);
          void saveLibraryBooks(merged);
          return merged;
        });
      })
      .catch(() => {
        // Cache-first behavior: keep local state and retry on next sync cycle.
      });
  }, [apiBaseUrl, libraryBooks]);

  const onPatchBook = useCallback(async (
    bookId: string,
    patch: Partial<Pick<LibraryBook, "loaned" | "liked" | "reread" | "review" | "rating" | "synopsis" | "pageCount">>
  ) => {
    const currentBook = libraryBooks.find((book) => book.id === bookId);
    if (!currentBook) {
      return;
    }

    const updatedBook: LibraryBook = {
      ...currentBook,
      ...patch
    };

    setLibraryBooks((current) => {
      const next = current.map((book) => (book.id === bookId ? updatedBook : book));
      void saveLibraryBooks(next);
      return next;
    });

    try {
      const syncedBook = await patchLibraryBook(apiBaseUrl, bookId, patch, 10000);
      setLibraryBooks((current) => {
        const merged = mergeLibraryBooks(current, [syncedBook]);
        void saveLibraryBooks(merged);
        return merged;
      });
    } catch {
      try {
        const syncedBooks = await batchUpsertLibraryBooks(apiBaseUrl, [updatedBook], 12000);
        if (syncedBooks.length === 0) {
          return;
        }
        setLibraryBooks((current) => {
          const merged = mergeLibraryBooks(current, syncedBooks);
          void saveLibraryBooks(merged);
          return merged;
        });
      } catch {
        // Cache-first behavior: keep local state and retry on later sync.
      }
    }
  }, [apiBaseUrl, libraryBooks]);

  const onCreateLoan = useCallback(async (payload: NewLoanSubmitPayload) => {
    let resolvedFriendId = payload.friendId;
    const borrowerName = payload.borrowerName.trim();
    if (!borrowerName) {
      throw new Error("missing_borrower_name");
    }

    if (!resolvedFriendId) {
      try {
        const createdFriend = await upsertFriend(apiBaseUrl, { name: borrowerName, email: null }, 12000);
        resolvedFriendId = createdFriend.id;
        setLibraryFriends((current) => {
          const byId = new Map(current.map((friend) => [friend.id, friend]));
          byId.set(createdFriend.id, createdFriend);
          return Array.from(byId.values()).sort((left, right) => left.name.localeCompare(right.name));
        });
      } catch {
        // Loan can still be created without a persisted friend row.
      }
    }

    const createdLoan = await createLoan(
      apiBaseUrl,
      {
        userBookId: payload.userBookId,
        friendId: resolvedFriendId,
        borrowerName,
        dueDate: payload.noReturnDate ? null : payload.dueDate,
      },
      12000
    );

    setLibraryLoans((current) => {
      const next = [createdLoan, ...current.filter((loan) => loan.id !== createdLoan.id)];
      return next;
    });
    setLibraryBooks((current) => {
      const merged = mergeLibraryBooks(current, [createdLoan.book]);
      void saveLibraryBooks(merged);
      return merged;
    });

    try {
      const refreshedProfile = await fetchProfile(apiBaseUrl, 10000);
      setUserProfile(refreshedProfile);
    } catch {
      // Profile can lag until next refresh cycle.
    }
  }, [apiBaseUrl]);

  const onMarkLoanReturned = useCallback(async (loanId: string) => {
    const updatedLoan = await patchLoan(apiBaseUrl, loanId, { status: "returned" }, 12000);
    setLibraryLoans((current) => current.map((loan) => (loan.id === loanId ? updatedLoan : loan)));
    setLibraryBooks((current) => {
      const merged = mergeLibraryBooks(current, [updatedLoan.book]);
      void saveLibraryBooks(merged);
      return merged;
    });

    try {
      const refreshedProfile = await fetchProfile(apiBaseUrl, 10000);
      setUserProfile(refreshedProfile);
    } catch {
      // Profile can lag until next refresh cycle.
    }
  }, [apiBaseUrl]);

  const onSaveProfile = useCallback(async (
    patch: Partial<Pick<UserProfile, "displayName" | "bio" | "location" | "website" | "badge" | "avatarUrl">>
  ) => {
    const nextProfile = await patchProfile(apiBaseUrl, patch, 12000);
    setUserProfile(nextProfile);
  }, [apiBaseUrl]);

  const onViewModeChange = useCallback((viewMode: LibraryViewMode) => {
    setLibraryViewMode(viewMode);
    void saveLibraryViewMode(viewMode);
  }, []);

  const onSortModeChange = useCallback((sortMode: LibrarySortMode) => {
    setLibrarySortMode(sortMode);
    void saveLibrarySortMode(sortMode);
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

  const onRejectCandidate = useCallback((spineId: string) => {
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

  const onSkipSpine = useCallback((spineId: string) => {
    setReviewCaptures((current) =>
      current.map((capture) => ({
        ...capture,
        spines: capture.spines.map((spine) => {
          if (spine.id !== spineId || spine.status !== "pending") {
            return spine;
          }
          return {
            ...spine,
            status: "rejected"
          };
        })
      }))
    );
  }, []);

  const commitAcceptedItems = useCallback(() => {
    const acceptedBooks = acceptedItems.map((item) => toLibraryBookFromFeedItem(item));
    if (acceptedBooks.length > 0) {
      updateBooks(acceptedBooks);
    }
  }, [acceptedItems, updateBooks]);

  const closeReviewOverlay = useCallback(() => {
    commitAcceptedItems();
    resetCaptureSession();
    setRecentlyAddedDefaults();
    setActiveTab("library");
    setPhase("library");
  }, [commitAcceptedItems, resetCaptureSession, setRecentlyAddedDefaults]);

  const onScanMore = useCallback(() => {
    commitAcceptedItems();
    resetCaptureSession();
    setPhase("camera");
  }, [commitAcceptedItems, resetCaptureSession]);

  const appReady = libraryReady && (fontsLoaded || Boolean(fontError));

  if (!appReady) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style="light" />
        <BookTurnerAnimation size={164} speed={1.02} />
        <Text style={styles.loadingText}>Loading app...</Text>
      </SafeAreaView>
    );
  }

  const resultsOverlay =
    phase === "results" ? (
      <View style={styles.overlayScrim}>
        <SafeAreaView style={styles.resultsScreen}>
          <View style={styles.resultsTopBar}>
            <Pressable
              style={styles.resultsBackButton}
              onPress={() => {
                setPhase("camera");
              }}
            >
              <Text style={styles.resultsBackText}>←</Text>
            </Pressable>
            <Text style={styles.resultsTopTitle}>Review Books</Text>
            <Pressable style={styles.resultsDoneButton} onPress={closeReviewOverlay}>
              <Text style={styles.resultsDoneText}>DONE</Text>
            </Pressable>
          </View>

          <View style={styles.resultsSummaryWrap}>
            <Text style={styles.resultsSummaryText}>
              {reviewSummary.accepted} added • {reviewSummary.rejected} skipped of {reviewTotalWithProcessing}
            </Text>
            {pendingCaptureJobs > 0 ? (
              <View style={styles.resultsProcessingRow}>
                <BookTurnerAnimation size={20} speed={0.98} />
                <Text style={styles.resultsProcessingText}>
                  Processing {pendingCaptureJobs} capture{pendingCaptureJobs === 1 ? "" : "s"}...
                </Text>
              </View>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={styles.resultsContent}
            scrollEnabled={resultsScrollEnabled}
            showsVerticalScrollIndicator={false}
          >
            {captureSections.map((capture) => {
              const collapsed = capture.pendingCount === 0;
              const coverUri = normalizeCoverUri(
                capture.previewItem?.metadata?.imageLinks?.thumbnail ??
                  capture.previewItem?.metadata?.imageLinks?.smallThumbnail
              );

              return (
                <View key={`capture-${capture.captureId}`} style={styles.captureSection}>
                  <View style={styles.captureHeaderRow}>
                    <View style={styles.captureHeaderLeft}>
                      <View style={styles.captureBullet} />
                      <Text style={styles.captureHeaderText}>
                        Scan {capture.captureId + 1} · {capture.total} books
                      </Text>
                    </View>
                    <Text style={styles.captureHeaderStatus}>
                      {collapsed ? `${capture.acceptedCount} added` : `${capture.pendingCount} left`}
                    </Text>
                  </View>

                  {collapsed ? (
                    <View style={styles.captureCollapsedRow}>
                      <View style={styles.captureCollapsedLeft}>
                        <View style={styles.captureDonePill}>
                          <Text style={styles.captureDoneText}>✓</Text>
                        </View>
                        <Text style={styles.captureCollapsedText}>
                          {capture.acceptedCount > 0 ? `${capture.acceptedCount} added` : "Skipped"}
                        </Text>
                      </View>
                      {coverUri ? <Image source={{ uri: coverUri }} style={styles.capturePreviewThumb} /> : null}
                    </View>
                  ) : (
                    <View style={styles.captureStackWrap}>
                      <BookApprovalStack
                        cards={capture.cards}
                        onApprove={onApproveSpine}
                        onRejectCandidate={onRejectCandidate}
                        onSkipSpine={onSkipSpine}
                        onSwipeStateChange={(isSwiping) => {
                          setResultsScrollEnabled(!isSwiping);
                        }}
                      />
                    </View>
                  )}
                </View>
              );
            })}

            {pendingCaptureJobs > 0
              ? Array.from({ length: pendingCaptureJobs }).map((_, index) => (
                  <View key={`processing-capture-${index}`} style={styles.captureSection}>
                    <View style={styles.captureHeaderRow}>
                      <View style={styles.captureHeaderLeft}>
                        <View style={styles.captureBullet} />
                        <Text style={styles.captureHeaderText}>Processing capture</Text>
                      </View>
                      <Text style={styles.captureHeaderStatus}>…</Text>
                    </View>
                    <View style={styles.processingCaptureCard}>
                      <BookTurnerAnimation size={52} speed={0.98} />
                    </View>
                  </View>
                ))
              : null}

            {reviewSummary.pending === 0 && pendingCaptureJobs === 0 ? (
              <View style={styles.allDoneWrap}>
                <View style={styles.allDoneIcon}>
                  <Text style={styles.allDoneIconText}>✓</Text>
                </View>
                <Text style={styles.allDoneTitle}>All done!</Text>
                <Text style={styles.allDoneSubtitle}>{reviewSummary.accepted} books added to your library</Text>
                <View style={styles.allDoneActions}>
                  <Pressable style={styles.scanMoreButton} onPress={onScanMore}>
                    <Text style={styles.scanMoreText}>Scan More</Text>
                  </Pressable>
                  <Pressable style={styles.backToLibraryButton} onPress={closeReviewOverlay}>
                    <Text style={styles.backToLibraryText}>Back to library</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    ) : null;

  if (phase === "camera" || phase === "results") {
    return (
      <>
        <StatusBar style="light" />
        <View style={styles.cameraPhaseRoot}>
          <CameraScreen
            apiBaseUrl={apiBaseUrl}
            reviewEnabled={captureSessionCount > 0}
            onBack={() => {
              resetCaptureSession();
              setPhase("library");
            }}
            onOpenReview={() => {
              setResultsScrollEnabled(true);
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
            }}
            onLookupQueueStateChange={setCaptureQueueState}
          />
          {resultsOverlay}
        </View>
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
          books={libraryBooks}
          friends={libraryFriends}
          loans={libraryLoans}
          onPatchBook={onPatchBook}
          onCreateLoan={onCreateLoan}
          onBack={() => {
            setPhase("library");
          }}
        />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.mainSafeArea}>
        <MobileScaffold
          activeTab={activeTab}
          onTabPress={(tab) => {
            setPhase("library");
            setActiveTab(tab);
          }}
          onSearchPress={() => setPhase("search")}
          onCameraPress={startCameraSession}
          cameraEnabled={cameraEnabled}
          onBellPress={() => {}}
          onAvatarPress={() => {
            setPhase("library");
            setActiveTab("profile");
          }}
          onSettingsPress={() => {
            setPhase("settings");
          }}
          onLogoutPress={() => {
            Alert.alert("Logged out", "Sign-out wiring is not connected yet.");
          }}
        >
          {phase === "settings" ? (
            <SettingsScreen apiBaseUrl={apiBaseUrl} onApiBaseUrlChange={setApiBaseUrl} />
          ) : null}

          {phase !== "settings" && activeTab === "home" ? (
            <HomeScreen
              books={libraryBooks}
              onOpenBook={(book) => {
                setSelectedBookId(book.id);
                setPhase("book_profile");
              }}
              onViewLibrary={() => {
                setPhase("library");
                setActiveTab("library");
              }}
            />
          ) : null}

          {phase !== "settings" && activeTab === "library" ? (
            <LibraryScreen
              books={libraryBooks}
              viewMode={libraryViewMode}
              sortMode={librarySortMode}
              filters={libraryFilters}
              onSortModeChange={onSortModeChange}
              onFiltersChange={onFiltersChange}
              onViewModeChange={onViewModeChange}
              onOpenBook={(book) => {
                setSelectedBookId(book.id);
                setPhase("book_profile");
              }}
            />
          ) : null}

          {phase !== "settings" && activeTab === "loans" ? (
            <LoansScreen
              books={libraryBooks}
              loans={libraryLoans}
              friends={libraryFriends}
              onCreateLoan={onCreateLoan}
              onMarkReturned={onMarkLoanReturned}
              onOpenBook={(book) => {
                setSelectedBookId(book.id);
                setPhase("book_profile");
              }}
            />
          ) : null}

          {phase !== "settings" && activeTab === "profile" ? (
            <ProfileScreen
              profile={userProfile}
              books={libraryBooks}
              friends={libraryFriends}
              onSaveProfile={onSaveProfile}
            />
          ) : null}
        </MobileScaffold>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  mainSafeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  cameraPhaseRoot: {
    flex: 1,
    backgroundColor: colors.background
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
    backgroundColor: "#171B2B",
    zIndex: 60
  },
  resultsScreen: {
    flex: 1,
    backgroundColor: "#171B2B"
  },
  resultsTopBar: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,165,116,0.1)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12
  },
  resultsBackButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  resultsBackText: {
    color: colors.textPrimary,
    fontSize: 18
  },
  resultsTopTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.serifRegular,
    fontSize: 15
  },
  resultsDoneButton: {
    minWidth: 38,
    alignItems: "flex-end"
  },
  resultsDoneText: {
    color: colors.accent,
    fontSize: 12,
    letterSpacing: 0.3
  },
  resultsSummaryWrap: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,165,116,0.07)"
  },
  resultsSummaryText: {
    color: "rgba(245,237,224,0.72)",
    fontSize: 12
  },
  resultsProcessingRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  resultsProcessingText: {
    color: colors.textSecondary,
    fontSize: 12
  },
  resultsContent: {
    paddingHorizontal: 10,
    paddingBottom: 24,
    gap: 10
  },
  captureSection: {
    gap: 6
  },
  captureStackWrap: {
    marginTop: 4
  },
  captureHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  captureHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  captureBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent
  },
  captureHeaderText: {
    color: colors.textSecondary,
    fontSize: 13
  },
  captureHeaderStatus: {
    color: colors.textMuted,
    fontSize: 12
  },
  captureCollapsedRow: {
    height: 40,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.12)",
    backgroundColor: "rgba(46,52,72,0.72)",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  processingCaptureCard: {
    height: 278,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.16)",
    backgroundColor: "rgba(46,52,72,0.56)",
    alignItems: "center",
    justifyContent: "center"
  },
  captureCollapsedLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  captureDonePill: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(142,149,168,0.24)",
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.2)"
  },
  captureDoneText: {
    color: colors.textSecondary,
    fontSize: 11
  },
  captureCollapsedText: {
    color: colors.textSecondary,
    fontSize: 13
  },
  capturePreviewThumb: {
    width: 32,
    height: 22,
    borderRadius: 1,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.22)"
  },
  allDoneWrap: {
    marginTop: 6,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.14)",
    backgroundColor: "rgba(46,52,72,0.36)",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 8
  },
  allDoneIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(142,149,168,0.24)",
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.24)",
    alignItems: "center",
    justifyContent: "center"
  },
  allDoneIconText: {
    color: colors.textSecondary,
    fontSize: 20
  },
  allDoneTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.serifRegular,
    fontSize: 20
  },
  allDoneSubtitle: {
    color: colors.textSecondary,
    fontSize: 13
  },
  allDoneActions: {
    marginTop: 4,
    flexDirection: "row",
    gap: 8
  },
  scanMoreButton: {
    minWidth: 104,
    height: 34,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.2)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  scanMoreText: {
    color: colors.textSecondary,
    fontSize: 13
  },
  backToLibraryButton: {
    minWidth: 122,
    height: 34,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent
  },
  backToLibraryText: {
    color: "#3D2C19",
    fontSize: 13,
    fontWeight: "600"
  }
});
