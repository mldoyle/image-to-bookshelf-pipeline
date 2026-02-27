import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { AppButton, AppText, BookCover, Surface } from "../primitives";
import { colors } from "../theme/colors";
import { fontFamilies, radius, spacing } from "../theme/tokens";
import type { LibraryBook, LibraryFriend, LibraryLoan } from "../types/library";
import { resolveBookCoverUri } from "./figmaAssets";
import { NewLoanSheet, type NewLoanSubmitPayload } from "./components/NewLoanSheet";

type LoansFilter = "all" | "active" | "returned";

type LoansScreenProps = {
  books: LibraryBook[];
  loans: LibraryLoan[];
  friends: LibraryFriend[];
  onOpenBook: (book: LibraryBook) => void;
  onCreateLoan: (payload: NewLoanSubmitPayload) => Promise<void>;
  onMarkReturned: (loanId: string) => Promise<void>;
};

const shortDate = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export function LoansScreen({
  books,
  loans,
  friends,
  onOpenBook,
  onCreateLoan,
  onMarkReturned,
}: LoansScreenProps) {
  const [filter, setFilter] = useState<LoansFilter>("all");
  const [loanSheetOpen, setLoanSheetOpen] = useState(false);
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null);

  const booksById = useMemo(() => {
    const map = new Map<string, LibraryBook>();
    books.forEach((book) => map.set(book.id, book));
    return map;
  }, [books]);

  const visibleLoans = useMemo(() => {
    if (filter === "active") {
      return loans.filter((loan) => loan.status === "active");
    }
    if (filter === "returned") {
      return loans.filter((loan) => loan.status === "returned");
    }
    return loans;
  }, [filter, loans]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <AppText variant="label" tone="muted" style={styles.headerTitle}>
          Loans
        </AppText>
        <AppText variant="bodySm" tone="muted">
          Track books you've lent to friends
        </AppText>
      </View>

      <View style={styles.topActions}>
        <View style={styles.filterRow}>
          <FilterButton label="All" active={filter === "all"} onPress={() => setFilter("all")} />
          <FilterButton label="Active" active={filter === "active"} onPress={() => setFilter("active")} />
          <FilterButton label="Returned" active={filter === "returned"} onPress={() => setFilter("returned")} />
        </View>
        <Pressable style={styles.newLoanButtonCompact} onPress={() => setLoanSheetOpen(true)}>
          <SwapIcon color={colors.background} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {visibleLoans.map((loan) => {
          const linkedBook = booksById.get(loan.userBookId) ?? loan.book;
          const dueLabel = shortDate(loan.dueAt);
          const returnedLabel = shortDate(loan.returnedAt);

          return (
            <Pressable key={loan.id} onPress={() => onOpenBook(linkedBook)}>
              <Surface variant="card" style={styles.loanCard}>
                <BookCover
                  uri={resolveBookCoverUri(linkedBook.title, linkedBook.coverThumbnail)}
                  width={40}
                  height={60}
                  borderRadius={radius.xs}
                />

                <View style={styles.loanBody}>
                  <AppText variant="h3" numberOfLines={1}>
                    {linkedBook.title}
                  </AppText>
                  <AppText variant="bodySm" tone="muted" numberOfLines={1}>
                    {linkedBook.author}
                  </AppText>
                  <AppText variant="bodySm" tone="accent" numberOfLines={1}>
                    → {loan.borrowerName}
                  </AppText>

                  {loan.status === "active" ? (
                    <AppText variant="caption" tone="muted">
                      {dueLabel ? `Due ${dueLabel}` : "No return date"}
                    </AppText>
                  ) : (
                    <AppText variant="caption" tone="muted">
                      {returnedLabel ? `Returned ${returnedLabel}` : "Returned"}
                    </AppText>
                  )}
                </View>

                <View style={styles.loanActions}>
                  {loan.status === "active" ? (
                    <Pressable
                      style={styles.returnButton}
                      disabled={busyLoanId === loan.id}
                      onPress={() => {
                        setBusyLoanId(loan.id);
                        void onMarkReturned(loan.id).finally(() => {
                          setBusyLoanId((current) => (current === loan.id ? null : current));
                        });
                      }}
                    >
                      <AppText variant="caption" tone="primary">
                        {busyLoanId === loan.id ? "..." : "Return"}
                      </AppText>
                    </Pressable>
                  ) : (
                    <View style={styles.returnedPill}>
                      <UndoIcon color={colors.warning} />
                    </View>
                  )}
                </View>
              </Surface>
            </Pressable>
          );
        })}

        {visibleLoans.length === 0 ? (
          <Surface variant="panel" style={styles.emptyState}>
            <AppText variant="h3">No loans in this filter</AppText>
            <AppText variant="bodySm" tone="muted">
              Start a new loan to track who has your books.
            </AppText>
          </Surface>
        ) : null}

        <AppButton
          label="New Loan"
          variant="primary"
          fullWidth
          size="md"
          onPress={() => setLoanSheetOpen(true)}
          style={styles.bottomButton}
        />
      </ScrollView>

      <NewLoanSheet
        visible={loanSheetOpen}
        books={books}
        friends={friends}
        onClose={() => setLoanSheetOpen(false)}
        onSubmit={onCreateLoan}
      />
    </View>
  );
}

type FilterButtonProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function FilterButton({ label, active, onPress }: FilterButtonProps) {
  return (
    <Pressable style={[styles.filterButton, active && styles.filterButtonActive]} onPress={onPress}>
      <AppText variant="bodySm" tone={active ? "inverse" : "muted"}>
        {label}
      </AppText>
    </Pressable>
  );
}

function SwapIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} fill="none" viewBox="0 0 24 24">
      <Path
        d="M7 7h10m0 0-3-3m3 3-3 3M17 17H7m0 0 3-3m-3 3 3 3"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function UndoIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} fill="none" viewBox="0 0 24 24">
      <Path
        d="M7 7h10m0 0-3-3m3 3-3 3M17 17H7m0 0 3-3m-3 3 3 3"
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
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  headerTitle: {
    fontFamily: fontFamilies.serifSemiBold,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flex: 1,
  },
  filterButton: {
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.07)",
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  filterButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  newLoanButtonCompact: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  loanCard: {
    minHeight: 114,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderColor: "rgba(212,165,116,0.07)",
  },
  loanBody: {
    flex: 1,
    gap: 2,
  },
  loanActions: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  returnButton: {
    minWidth: 62,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.25)",
    backgroundColor: "rgba(212,165,116,0.14)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  returnedPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  bottomButton: {
    marginTop: spacing.sm,
  },
});
