import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { AppButton, AppText, BookCover, Surface } from "../../primitives";
import { colors } from "../../theme/colors";
import { radius, spacing } from "../../theme/tokens";
import type { LibraryBook, LibraryFriend } from "../../types/library";
import { resolveBookCoverUri } from "../figmaAssets";

type NewLoanStep = "book" | "friend" | "date" | "confirm";

export type NewLoanSubmitPayload = {
  userBookId: string;
  friendId: string | null;
  borrowerName: string;
  dueDate: string | null;
  noReturnDate: boolean;
};

type NewLoanSheetProps = {
  visible: boolean;
  books: LibraryBook[];
  friends: LibraryFriend[];
  preselectedBookId?: string | null;
  onClose: () => void;
  onSubmit: (payload: NewLoanSubmitPayload) => Promise<void>;
};

const asLower = (value: string): string => value.trim().toLowerCase();

const dueDateLabel = (value: string): string => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const quickPickDate = (daysFromNow: number): string => {
  const next = new Date();
  next.setDate(next.getDate() + daysFromNow);
  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, "0");
  const day = String(next.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const minDateIso = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function NewLoanSheet({
  visible,
  books,
  friends,
  preselectedBookId,
  onClose,
  onSubmit,
}: NewLoanSheetProps) {
  const hasPreselectedBook = Boolean(preselectedBookId);
  const [step, setStep] = useState<NewLoanStep>(hasPreselectedBook ? "friend" : "book");
  const [bookQuery, setBookQuery] = useState("");
  const [friendQuery, setFriendQuery] = useState("");
  const [selectedBookId, setSelectedBookId] = useState<string | null>(preselectedBookId ?? null);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [borrowerName, setBorrowerName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [noReturnDate, setNoReturnDate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const sortedBooks = useMemo(
    () => [...books].sort((left, right) => left.title.localeCompare(right.title)),
    [books]
  );

  const selectedBook = useMemo(
    () => sortedBooks.find((book) => book.id === selectedBookId) ?? null,
    [selectedBookId, sortedBooks]
  );

  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.id === selectedFriendId) ?? null,
    [friends, selectedFriendId]
  );

  const filteredBooks = useMemo(() => {
    const query = asLower(bookQuery);
    if (!query) {
      return sortedBooks;
    }
    return sortedBooks.filter((book) => {
      return asLower(book.title).includes(query) || asLower(book.author).includes(query);
    });
  }, [bookQuery, sortedBooks]);

  const filteredFriends = useMemo(() => {
    const query = asLower(friendQuery);
    if (!query) {
      return friends;
    }
    return friends.filter((friend) => asLower(friend.name).includes(query));
  }, [friendQuery, friends]);

  const currentBorrowerName = borrowerName.trim();
  const canConfirm = Boolean(selectedBook && currentBorrowerName && (noReturnDate || dueDate));

  useEffect(() => {
    if (!visible) {
      return;
    }
    const nextStep = preselectedBookId ? "friend" : "book";
    setStep(nextStep);
    setBookQuery("");
    setFriendQuery("");
    setSelectedBookId(preselectedBookId ?? null);
    setSelectedFriendId(null);
    setBorrowerName("");
    setDueDate("");
    setNoReturnDate(false);
    setSubmitting(false);
    setSubmitError(null);
  }, [preselectedBookId, visible]);

  const onBack = () => {
    if (step === "confirm") {
      onClose();
      return;
    }
    if (step === "date") {
      setStep("friend");
      return;
    }
    if (step === "friend") {
      if (hasPreselectedBook) {
        onClose();
      } else {
        setStep("book");
      }
      return;
    }
    onClose();
  };

  const onConfirm = async () => {
    if (!selectedBook || !canConfirm || submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        userBookId: selectedBook.id,
        friendId: selectedFriendId,
        borrowerName: currentBorrowerName,
        dueDate: noReturnDate ? null : dueDate,
        noReturnDate,
      });
      setStep("confirm");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create loan.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const quickPicks = [
    { label: "2 weeks", days: 14 },
    { label: "1 month", days: 30 },
    { label: "2 months", days: 60 },
    { label: "3 months", days: 90 },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropHitBox} onPress={onClose} />
        <SafeSheet>
          <View style={styles.header}>
            <Pressable style={styles.headerIconButton} onPress={onBack}>
              <ChevronLeftIcon color={colors.textSecondary} />
            </Pressable>
            <AppText variant="h3">New Loan</AppText>
            <View style={styles.headerSpacer} />
          </View>

          {step !== "confirm" ? (
            <View style={styles.stepRow}>
              <StepPill label="Book" complete={Boolean(selectedBook)} active={step === "book"} hidden={hasPreselectedBook} />
              <StepPill label="Friend" complete={Boolean(currentBorrowerName)} active={step === "friend"} />
              <StepPill
                label="Date"
                complete={Boolean(noReturnDate || dueDate)}
                active={step === "date"}
              />
            </View>
          ) : null}

          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
            {step === "book" ? (
              <>
                <AppText variant="caption" tone="muted">
                  Search your library
                </AppText>
                <TextInput
                  style={styles.input}
                  placeholder="Title or author..."
                  placeholderTextColor={colors.textMuted}
                  value={bookQuery}
                  onChangeText={setBookQuery}
                />
                <View style={styles.list}>
                  {filteredBooks.map((book) => (
                    <Pressable
                      key={book.id}
                      style={styles.listRow}
                      onPress={() => {
                        setSelectedBookId(book.id);
                        setStep("friend");
                      }}
                    >
                      <BookCover
                        uri={resolveBookCoverUri(book.title, book.coverThumbnail)}
                        width={32}
                        height={48}
                        borderRadius={radius.xs}
                      />
                      <View style={styles.listRowBody}>
                        <AppText variant="h3" numberOfLines={1}>
                          {book.title}
                        </AppText>
                        <AppText variant="caption" tone="muted" numberOfLines={1}>
                          {book.author}
                        </AppText>
                      </View>
                      <ChevronRightIcon color={colors.textMuted} />
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {step === "friend" ? (
              <>
                {selectedBook ? (
                  <Surface variant="panel" style={styles.selectedCard}>
                    <BookCover
                      uri={resolveBookCoverUri(selectedBook.title, selectedBook.coverThumbnail)}
                      width={32}
                      height={48}
                      borderRadius={radius.xs}
                    />
                    <View style={styles.listRowBody}>
                      <AppText variant="h3" numberOfLines={1}>
                        {selectedBook.title}
                      </AppText>
                      <AppText variant="caption" tone="muted" numberOfLines={1}>
                        {selectedBook.author}
                      </AppText>
                    </View>
                  </Surface>
                ) : null}

                <AppText variant="caption" tone="muted">
                  Loan to
                </AppText>
                <TextInput
                  style={styles.input}
                  placeholder="Search friends..."
                  placeholderTextColor={colors.textMuted}
                  value={friendQuery}
                  onChangeText={(value) => {
                    setFriendQuery(value);
                    setBorrowerName(value);
                    setSelectedFriendId(null);
                  }}
                />

                <View style={styles.list}>
                  {filteredFriends.map((friend) => (
                    <Pressable
                      key={friend.id}
                      style={[
                        styles.listRow,
                        selectedFriendId === friend.id ? styles.listRowSelected : null,
                      ]}
                      onPress={() => {
                        setSelectedFriendId(friend.id);
                        setBorrowerName(friend.name);
                        setFriendQuery(friend.name);
                        setStep("date");
                      }}
                    >
                      <View style={styles.friendAvatar}>
                        <AppText variant="caption">{friend.initials}</AppText>
                      </View>
                      <View style={styles.listRowBody}>
                        <AppText variant="body">{friend.name}</AppText>
                        {friend.email ? (
                          <AppText variant="caption" tone="muted" numberOfLines={1}>
                            {friend.email}
                          </AppText>
                        ) : null}
                      </View>
                      <ChevronRightIcon color={colors.textMuted} />
                    </Pressable>
                  ))}
                </View>

                {currentBorrowerName && !filteredFriends.some((friend) => asLower(friend.name) === asLower(currentBorrowerName)) ? (
                  <Pressable
                    style={styles.useTypedButton}
                    onPress={() => {
                      setSelectedFriendId(null);
                      setStep("date");
                    }}
                  >
                    <AppText variant="bodySm">Use "{currentBorrowerName}"</AppText>
                  </Pressable>
                ) : null}
              </>
            ) : null}

            {step === "date" ? (
              <>
                {selectedBook ? (
                  <Surface variant="panel" style={styles.selectedCard}>
                    <BookCover
                      uri={resolveBookCoverUri(selectedBook.title, selectedBook.coverThumbnail)}
                      width={32}
                      height={48}
                      borderRadius={radius.xs}
                    />
                    <View style={styles.listRowBody}>
                      <AppText variant="h3" numberOfLines={1}>
                        {selectedBook.title}
                      </AppText>
                      <AppText variant="caption" tone="accent" numberOfLines={1}>
                        {currentBorrowerName || "Borrower"}
                      </AppText>
                    </View>
                  </Surface>
                ) : null}

                <AppText variant="caption" tone="muted">
                  Return date
                </AppText>
                <TextInput
                  style={[styles.input, noReturnDate ? styles.inputDisabled : null]}
                  editable={!noReturnDate}
                  value={dueDate}
                  onChangeText={setDueDate}
                  placeholder={minDateIso()}
                  placeholderTextColor={colors.textMuted}
                />

                <Pressable
                  style={[styles.noDateButton, noReturnDate ? styles.noDateButtonActive : null]}
                  onPress={() => {
                    const nextValue = !noReturnDate;
                    setNoReturnDate(nextValue);
                    if (nextValue) {
                      setDueDate("");
                    }
                  }}
                >
                  <View style={[styles.radio, noReturnDate ? styles.radioActive : null]}>
                    {noReturnDate ? <CheckIcon color={colors.background} /> : null}
                  </View>
                  <AppText variant="body">No return date</AppText>
                </Pressable>

                <View style={styles.quickPickWrap}>
                  {quickPicks.map((pick) => {
                    const value = quickPickDate(pick.days);
                    const active = !noReturnDate && dueDate === value;
                    return (
                      <Pressable
                        key={pick.label}
                        style={[styles.quickPickButton, active ? styles.quickPickButtonActive : null]}
                        onPress={() => {
                          setDueDate(value);
                          setNoReturnDate(false);
                        }}
                      >
                        <AppText variant="caption" tone={active ? "inverse" : "muted"}>
                          {pick.label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {step === "confirm" ? (
              <View style={styles.confirmWrap}>
                <View style={styles.confirmIcon}>
                  <CheckIcon color={colors.accent} />
                </View>
                <AppText variant="h2">Loan Created</AppText>
                <AppText variant="bodySm" tone="muted" style={styles.confirmText}>
                  {selectedBook?.title} loaned to {currentBorrowerName}
                  {noReturnDate ? " with no return date." : dueDate ? `, due ${dueDateLabel(dueDate)}.` : "."}
                </AppText>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {step === "date" ? (
              <AppButton
                label={submitting ? "Saving..." : "Confirm Loan"}
                variant="primary"
                fullWidth
                size="md"
                disabled={!canConfirm || submitting}
                onPress={() => {
                  void onConfirm();
                }}
              />
            ) : null}
            {submitError ? (
              <View style={styles.errorWrap}>
                <AppText variant="caption" tone="danger">
                  {submitError}
                </AppText>
              </View>
            ) : null}

            {step === "confirm" ? (
              <AppButton label="Done" variant="primary" fullWidth size="md" onPress={onClose} />
            ) : null}
          </View>
        </SafeSheet>
      </View>
    </Modal>
  );
}

function SafeSheet({ children }: { children: ReactNode }) {
  return (
    <View style={styles.sheetWrap}>
      <View style={styles.sheet}>{children}</View>
    </View>
  );
}

function StepPill({
  label,
  complete,
  active,
  hidden,
}: {
  label: string;
  complete: boolean;
  active: boolean;
  hidden?: boolean;
}) {
  if (hidden) {
    return null;
  }
  return (
    <View style={[styles.stepPill, active ? styles.stepPillActive : null]}>
      <View style={[styles.stepDot, complete ? styles.stepDotComplete : null]} />
      <AppText variant="caption" tone={active ? "accent" : "muted"}>
        {label}
      </AppText>
    </View>
  );
}

function ChevronLeftIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} fill="none" viewBox="0 0 24 24">
      <Path d="m15 5-7 7 7 7" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
    </Svg>
  );
}

function ChevronRightIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} fill="none" viewBox="0 0 24 24">
      <Path d="m9 5 7 7-7 7" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
    </Svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} fill="none" viewBox="0 0 24 24">
      <Path d="m5 12 5 5 9-10" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.1} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "flex-end",
  },
  backdropHitBox: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetWrap: {
    flex: 1,
    width: "100%",
    alignItems: "flex-end",
  },
  sheet: {
    width: Platform.OS === "web" ? 420 : "100%",
    maxWidth: "100%",
    height: "100%",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.2)",
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  header: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,165,116,0.12)",
    gap: spacing.sm,
  },
  headerIconButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 28,
    height: 28,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,165,116,0.08)",
  },
  stepPill: {
    minHeight: 30,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.2)",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  stepPillActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(212,165,116,0.1)",
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
  stepDotComplete: {
    backgroundColor: colors.accent,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  input: {
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  list: {
    gap: 6,
    marginTop: spacing.sm,
  },
  listRow: {
    minHeight: 64,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.1)",
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  listRowSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(212,165,116,0.12)",
  },
  listRowBody: {
    flex: 1,
    gap: 2,
  },
  selectedCard: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderColor: "rgba(212,165,116,0.14)",
  },
  friendAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.25)",
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  useTypedButton: {
    marginTop: spacing.sm,
    minHeight: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.2)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  noDateButton: {
    minHeight: 50,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.2)",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    marginTop: spacing.sm,
  },
  noDateButtonActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(212,165,116,0.12)",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(212,165,116,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  quickPickWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  quickPickButton: {
    minHeight: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.2)",
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  quickPickButtonActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  confirmWrap: {
    paddingTop: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  confirmIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.3)",
    backgroundColor: "rgba(212,165,116,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    textAlign: "center",
    maxWidth: 320,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(212,165,116,0.1)",
  },
  errorWrap: {
    marginTop: spacing.sm,
  },
});
