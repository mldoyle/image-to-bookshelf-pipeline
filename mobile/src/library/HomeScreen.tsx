import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import FriendsIcon from "../icons/FriendsIcon";
import ReadIcon from "../icons/ReadIcon";
import ShelvesIcon from "../icons/ShelvesIcon";
import { BookCover, RatingStars, AppText, Surface } from "../primitives";
import { resolveBookCoverUri } from "./figmaAssets";
import { colors } from "../theme/colors";
import { fontFamilies, radius, spacing } from "../theme/tokens";
import type { LibraryBook } from "../types/library";

type HomeScreenProps = {
  books: LibraryBook[];
  onOpenBook: (book: LibraryBook) => void;
  onViewLibrary: () => void;
};

const byNewest = (left: LibraryBook, right: LibraryBook): number =>
  new Date(right.addedAt).getTime() - new Date(left.addedAt).getTime();

export function HomeScreen({ books, onOpenBook, onViewLibrary }: HomeScreenProps) {
  const recentBooks = useMemo(() => [...books].sort(byNewest).slice(0, 6), [books]);

  const booksReadThisYear = useMemo(() => {
    const thisYear = new Date().getFullYear();
    return books.filter((book) => new Date(book.addedAt).getFullYear() === thisYear).length;
  }, [books]);

  const loanedCount = useMemo(() => books.filter((book) => book.loaned).length, [books]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <AppText variant="label" tone="muted" style={styles.headerTitle}>
          Home
        </AppText>
        <AppText variant="bodySm" tone="muted">
          Track your reads, lend to friends, and build shelves of your favourite books.
        </AppText>
      </View>

      <View style={styles.statsStack}>
        <StatCard value={booksReadThisYear} label="Books Read · this year" icon="read" />
        <StatCard value={books.length} label="In Library · total" icon="library" />
        <StatCard value={loanedCount} label="Books Lent · currently out" icon="lent" />
      </View>

      <Surface variant="card" style={styles.recentPanel}>
        <View style={styles.recentHeader}>
          <AppText variant="h3">Recently Added</AppText>
          <Pressable onPress={onViewLibrary}>
            <AppText variant="bodySm" tone="accent">
              View Library →
            </AppText>
          </Pressable>
        </View>

        <View style={styles.recentGrid}>
          {recentBooks.map((book) => {
            const coverUri = resolveBookCoverUri(book.title, book.coverThumbnail);
            return (
              <Pressable key={book.id} style={styles.recentItem} onPress={() => onOpenBook(book)}>
                <BookCover uri={coverUri} width={70} height={105} lent={book.loaned} />
                <AppText variant="bodySm" numberOfLines={1} style={styles.recentTitle}>
                  {book.title}
                </AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.recentAuthor}>
                  {book.author}
                </AppText>
                <RatingStars rating={book.rating} size="sm" />
              </Pressable>
            );
          })}
        </View>
      </Surface>
    </ScrollView>
  );
}

type StatCardProps = {
  value: number;
  label: string;
  icon: "read" | "library" | "lent";
};

function StatCard({ value, label, icon }: StatCardProps) {
  return (
    <Surface variant="card" style={styles.statCard}>
      <View style={styles.statIcon}>
        <StatIcon icon={icon} />
      </View>
      <View style={styles.statBody}>
        <AppText variant="h3">{value}</AppText>
        <AppText variant="body" tone="muted" style={styles.statLabel}>
          {label}
        </AppText>
      </View>
    </Surface>
  );
}

function StatIcon({ icon }: { icon: StatCardProps["icon"] }) {
  if (icon === "library") {
    return <ShelvesIcon color={colors.accent} />;
  }

  if (icon === "read") {
    return <ReadIcon color={colors.accent} />;
  }

  return <FriendsIcon color={colors.accent} />;
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.lg
  },
  header: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm
  },
  headerTitle: {
    fontFamily: fontFamilies.serifSemiBold
  },
  statsStack: {
    gap: spacing.md
  },
  statCard: {
    minHeight: 128,
    borderColor: "rgba(212,165,116,0.07)",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg
  },
  statIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  statBody: {
    gap: 2
  },
  statLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  recentPanel: {
    borderColor: "rgba(212,165,116,0.07)",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.lg
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  recentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: spacing.md,
    justifyContent: "space-between"
  },
  recentItem: {
    width: 88,
    alignItems: "center",
    gap: 1
  },
  recentTitle: {
    textAlign: "center",
    marginTop: spacing.xs
  },
  recentAuthor: {
    textAlign: "center"
  }
});
