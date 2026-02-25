import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { AppText, BookCover, Surface } from "../primitives";
import { resolveBookCoverUri } from "./figmaAssets";
import { colors } from "../theme/colors";
import { fontFamilies, radius, spacing } from "../theme/tokens";
import type { LibraryBook } from "../types/library";

type LoansFilter = "all" | "active" | "returned";

type LoanMeta = {
  borrower: string;
  due?: string;
};

const LOAN_META_BY_TITLE: Record<string, LoanMeta> = {
  "the secret history": { borrower: "Sarah M.", due: "Due Jul 2, 2025" },
  "the remains of the day": { borrower: "James K.", due: "Due Jun 18, 2025" },
  "a little life": { borrower: "Maya C." },
  pachinko: { borrower: "Jordan L." },
  "the goldfinch": { borrower: "Alex R." }
};

const normalizeTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

type LoansScreenProps = {
  books: LibraryBook[];
  onOpenBook: (book: LibraryBook) => void;
  onToggleLoaned: (bookId: string) => void;
};

export function LoansScreen({ books, onOpenBook, onToggleLoaned }: LoansScreenProps) {
  const [filter, setFilter] = useState<LoansFilter>("all");

  const activeBooks = useMemo(() => books.filter((book) => book.loaned), [books]);
  const returnedBooks = useMemo(() => books.filter((book) => !book.loaned).slice(0, 8), [books]);

  const visibleBooks = useMemo(() => {
    if (filter === "active") {
      return activeBooks;
    }
    if (filter === "returned") {
      return returnedBooks;
    }
    return [...activeBooks, ...returnedBooks];
  }, [activeBooks, filter, returnedBooks]);

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

      <View style={styles.filterRow}>
        <FilterButton label="All" active={filter === "all"} onPress={() => setFilter("all")} />
        <FilterButton label="Active" active={filter === "active"} onPress={() => setFilter("active")} />
        <FilterButton label="Returned" active={filter === "returned"} onPress={() => setFilter("returned")} />
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {visibleBooks.map((book) => {
          const key = normalizeTitle(book.title);
          const meta = LOAN_META_BY_TITLE[key] ?? { borrower: "Friend" };

          return (
            <Pressable key={book.id} onPress={() => onOpenBook(book)}>
              <Surface variant="card" style={styles.loanCard}>
                <BookCover
                  uri={resolveBookCoverUri(book.title, book.coverThumbnail)}
                  width={40}
                  height={60}
                  borderRadius={radius.xs}
                />

                <View style={styles.loanBody}>
                  <AppText variant="h3" numberOfLines={1}>
                    {book.title}
                  </AppText>
                  <AppText variant="body" tone="muted" numberOfLines={1}>
                    {book.author}
                  </AppText>
                  <AppText variant="body" tone="accent" numberOfLines={1}>
                    → {meta.borrower}
                  </AppText>
                </View>

                <Pressable style={styles.statusWrap} onPress={() => onToggleLoaned(book.id)}>
                  <LoanStatusIcon loaned={book.loaned} />
                </Pressable>
              </Surface>
            </Pressable>
          );
        })}

        {visibleBooks.length === 0 ? (
          <Surface variant="panel" style={styles.emptyState}>
            <AppText variant="h3">No loans in this filter</AppText>
            <AppText variant="bodySm" tone="muted">
              Mark books as loaned from the library list to track them here.
            </AppText>
          </Surface>
        ) : null}
      </ScrollView>
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
      <AppText variant="body" tone={active ? "inverse" : "muted"}>
        {label}
      </AppText>
    </Pressable>
  );
}

function LoanStatusIcon({ loaned }: { loaned: boolean }) {
  if (loaned) {
    return (
      <Svg width={16} height={16} fill="none" viewBox="0 0 24 24">
        <Path
          d="M12 7v5l3 2m7-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z"
          stroke="#AB7878"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
        />
      </Svg>
    );
  }

  return (
    <Svg width={16} height={16} fill="none" viewBox="0 0 24 24">
      <Path
        d="M7 7h10m0 0-3-3m3 3-3 3M17 17H7m0 0 3-3m-3 3 3 3"
        stroke={colors.warning}
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
    gap: spacing.lg
  },
  header: {
    gap: spacing.xs
  },
  headerTitle: {
    fontFamily: fontFamilies.serifSemiBold
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  filterButton: {
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.07)",
    paddingHorizontal: spacing.md,
    justifyContent: "center"
  },
  filterButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.lg
  },
  loanCard: {
    minHeight: 110,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderColor: "rgba(212,165,116,0.07)"
  },
  loanBody: {
    flex: 1,
    gap: 1
  },
  statusWrap: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyState: {
    padding: spacing.lg,
    gap: spacing.sm
  }
});
