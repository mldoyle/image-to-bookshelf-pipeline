import { useMemo, useState, type ReactNode } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { AppButton, AppText, BookCover, RatingStars, Surface } from "../primitives";
import { colors } from "../theme/colors";
import { fontFamilies, radius, spacing } from "../theme/tokens";
import type { LibraryBook, LibraryFriend, LibraryLoan } from "../types/library";
import { resolveBookCoverUri } from "./figmaAssets";
import { NewLoanSheet, type NewLoanSubmitPayload } from "./components/NewLoanSheet";

type BookProfileScreenProps = {
  book: LibraryBook;
  books: LibraryBook[];
  friends: LibraryFriend[];
  loans: LibraryLoan[];
  onBack: () => void;
  onPatchBook: (
    bookId: string,
    patch: Partial<Pick<LibraryBook, "liked" | "reread" | "review">>
  ) => Promise<void>;
  onCreateLoan: (payload: NewLoanSubmitPayload) => Promise<void>;
};

const genreLabel = (genres: string[]): string => (genres.length > 0 ? genres[0] : "Genre Unknown");

const dateLabel = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export function BookProfileScreen({
  book,
  books,
  friends,
  loans,
  onBack,
  onPatchBook,
  onCreateLoan,
}: BookProfileScreenProps) {
  const [savingField, setSavingField] = useState<"liked" | "reread" | "review" | null>(null);
  const [draftReview, setDraftReview] = useState(book.review || "");
  const [editingReview, setEditingReview] = useState(false);
  const [loanSheetOpen, setLoanSheetOpen] = useState(false);

  const activeLoan = useMemo(() => {
    return loans.find((loan) => loan.userBookId === book.id && loan.status === "active") ?? null;
  }, [book.id, loans]);

  const onTogglePatch = async (field: "liked" | "reread") => {
    if (savingField) {
      return;
    }
    setSavingField(field);
    try {
      await onPatchBook(book.id, { [field]: !book[field] });
    } finally {
      setSavingField((current) => (current === field ? null : current));
    }
  };

  const onSaveReview = async () => {
    setSavingField("review");
    try {
      await onPatchBook(book.id, { review: draftReview.trim() || null });
      setEditingReview(false);
    } finally {
      setSavingField(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={onBack}>
          <ChevronLeftIcon color={colors.textSecondary} />
        </Pressable>
        <AppText variant="h3" numberOfLines={1} style={styles.headerTitle}>
          {book.title}
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <BookCover
            uri={resolveBookCoverUri(book.title, book.coverThumbnail)}
            width={140}
            height={210}
            borderRadius={4}
            lent={book.loaned}
          />
          <AppText variant="h2" style={styles.bookTitle}>
            {book.title}
          </AppText>
          <AppText variant="bodySm" tone="muted">
            {book.author}
          </AppText>
          <RatingStars rating={book.rating} size="md" />
        </View>

        <View style={styles.metaRow}>
          <Pill>{genreLabel(book.genres)}</Pill>
          {book.publishedYear ? <Pill>{book.publishedYear}</Pill> : null}
          {book.pageCount ? <Pill>{`${book.pageCount} pages`}</Pill> : null}
        </View>

        <View style={styles.actionRow}>
          <ActionChip
            label={book.liked ? "Liked" : "Like"}
            active={book.liked}
            busy={savingField === "liked"}
            onPress={() => {
              void onTogglePatch("liked");
            }}
            icon={<HeartIcon color={book.liked ? colors.accent : colors.textMuted} filled={book.liked} />}
          />
          <ActionChip
            label={book.review ? "Reviewed" : "Review"}
            active={Boolean(book.review)}
            busy={savingField === "review"}
            onPress={() => setEditingReview(true)}
            icon={<BookIcon color={book.review ? colors.accent : colors.textMuted} />}
          />
          <ActionChip
            label="Reread"
            active={book.reread}
            busy={savingField === "reread"}
            onPress={() => {
              void onTogglePatch("reread");
            }}
            icon={<RereadIcon color={book.reread ? colors.accent : colors.textMuted} />}
          />
        </View>

        {activeLoan ? (
          <Surface variant="panel" style={styles.loanStatus}>
            <View style={styles.loanStatusIconWrap}>
              <ClockIcon color={colors.accent} />
            </View>
            <View style={styles.loanStatusBody}>
              <AppText variant="body">
                Currently lent to <AppText variant="body" tone="accent">{activeLoan.borrowerName}</AppText>
              </AppText>
              <AppText variant="caption" tone="muted">
                {activeLoan.dueAt ? `Due ${dateLabel(activeLoan.dueAt)}` : "No return date"}
              </AppText>
            </View>
          </Surface>
        ) : null}

        <View style={styles.section}>
          <AppText variant="label" tone="muted">
            Synopsis
          </AppText>
          <AppText variant="bodySm" tone="secondary">
            {book.synopsis || "No synopsis yet."}
          </AppText>
        </View>

        <View style={styles.section}>
          <AppText variant="label" tone="muted">
            Your Review
          </AppText>

          {editingReview ? (
            <View style={styles.reviewEditor}>
              <TextInput
                style={styles.reviewInput}
                multiline
                value={draftReview}
                onChangeText={setDraftReview}
                placeholder="Write a review..."
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.reviewActions}>
                <Pressable
                  style={styles.reviewActionGhost}
                  onPress={() => {
                    setDraftReview(book.review || "");
                    setEditingReview(false);
                  }}
                >
                  <AppText variant="caption" tone="muted">
                    Cancel
                  </AppText>
                </Pressable>
                <Pressable
                  style={styles.reviewActionSave}
                  disabled={savingField === "review"}
                  onPress={() => {
                    void onSaveReview();
                  }}
                >
                  <AppText variant="caption" tone="inverse">
                    {savingField === "review" ? "Saving..." : "Save"}
                  </AppText>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={styles.reviewPlaceholder} onPress={() => setEditingReview(true)}>
              <AppText variant="bodySm" tone={book.review ? "secondary" : "muted"}>
                {book.review || "Write a review..."}
              </AppText>
            </Pressable>
          )}
        </View>

        <AppButton
          label="Loan this Book"
          variant="primary"
          fullWidth
          size="md"
          onPress={() => setLoanSheetOpen(true)}
          style={styles.loanButton}
        />
      </ScrollView>

      <NewLoanSheet
        visible={loanSheetOpen}
        books={books}
        friends={friends}
        preselectedBookId={book.id}
        onClose={() => setLoanSheetOpen(false)}
        onSubmit={async (payload) => {
          await onCreateLoan(payload);
          setLoanSheetOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function Pill({ children }: { children: string | number }) {
  return (
    <View style={styles.pill}>
      <AppText variant="caption" tone="muted">
        {children}
      </AppText>
    </View>
  );
}

function ActionChip({
  label,
  active,
  busy,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  busy: boolean;
  onPress: () => void;
  icon: ReactNode;
}) {
  return (
    <Pressable style={styles.actionChip} disabled={busy} onPress={onPress}>
      <View style={[styles.actionChipIcon, active ? styles.actionChipIconActive : null]}>{icon}</View>
      <AppText variant="caption" tone="muted">
        {busy ? "..." : label}
      </AppText>
    </Pressable>
  );
}

function ChevronLeftIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} fill="none" viewBox="0 0 24 24">
      <Path d="m15 5-7 7 7 7" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
    </Svg>
  );
}

function HeartIcon({ color, filled }: { color: string; filled: boolean }) {
  return (
    <Svg width={18} height={18} fill="none" viewBox="0 0 24 24">
      <Path
        d="m12 20-1.25-1.14C6.1 14.66 3 11.84 3 8.4 3 5.58 5.24 3.4 8.05 3.4c1.59 0 3.11.74 4.1 1.9.99-1.16 2.51-1.9 4.1-1.9 2.81 0 5.05 2.18 5.05 5 0 3.45-3.1 6.27-7.75 10.48L12 20Z"
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function BookIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} fill="none" viewBox="0 0 24 24">
      <Path d="M4 5.5c0-1.1.9-2 2-2h5v15H6a2 2 0 0 0-2 2v-15Z" stroke={color} strokeWidth={1.8} />
      <Path d="M20 5.5c0-1.1-.9-2-2-2h-5v15h5a2 2 0 0 1 2 2v-15Z" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

function RereadIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} fill="none" viewBox="0 0 24 24">
      <Path
        d="M17 1v4h-4M7 23v-4h4M20.5 9a8.5 8.5 0 0 0-14.8-4M3.5 15a8.5 8.5 0 0 0 14.8 4"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function ClockIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} fill="none" viewBox="0 0 24 24">
      <Path
        d="M12 7v5l3 2m7-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 63,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,165,116,0.12)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  headerButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamilies.serifRegular,
  },
  headerSpacer: {
    width: 30,
    height: 30,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: spacing.xxl,
  },
  hero: {
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  bookTitle: {
    textAlign: "center",
    marginTop: spacing.sm,
  },
  metaRow: {
    marginTop: spacing.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pill: {
    minHeight: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.18)",
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  actionRow: {
    marginTop: spacing.lg,
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  actionChip: {
    alignItems: "center",
    gap: spacing.xs,
  },
  actionChipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.18)",
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  actionChipIconActive: {
    backgroundColor: "rgba(212,165,116,0.12)",
    borderColor: colors.accent,
  },
  loanStatus: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderColor: "rgba(212,165,116,0.22)",
  },
  loanStatusIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  loanStatusBody: {
    flex: 1,
    gap: 2,
  },
  section: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  reviewPlaceholder: {
    minHeight: 58,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.2)",
    borderStyle: "dashed",
    backgroundColor: "rgba(46,52,72,0.2)",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  reviewEditor: {
    gap: spacing.sm,
  },
  reviewInput: {
    minHeight: 120,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.2)",
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    textAlignVertical: "top",
  },
  reviewActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  reviewActionGhost: {
    minWidth: 76,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewActionSave: {
    minWidth: 76,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  loanButton: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
  },
});
