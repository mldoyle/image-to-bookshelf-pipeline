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
  layoutMode?: "mobile" | "web-desktop";
  showInlineTitle?: boolean;
  onOpenBook: (book: LibraryBook) => void;
  onViewLibrary: () => void;
};

const byNewest = (left: LibraryBook, right: LibraryBook): number =>
  new Date(right.addedAt).getTime() - new Date(left.addedAt).getTime();

export function HomeScreen({
  books,
  layoutMode = "mobile",
  showInlineTitle = true,
  onOpenBook,
  onViewLibrary
}: HomeScreenProps) {
  const isDesktop = layoutMode === "web-desktop";
  const recentBooks = useMemo(() => [...books].sort(byNewest).slice(0, 6), [books]);

  const booksReadThisYear = useMemo(() => {
    const thisYear = new Date().getFullYear();
    return books.filter((book) => new Date(book.addedAt).getFullYear() === thisYear).length;
  }, [books]);

  const loanedCount = useMemo(() => books.filter((book) => book.loaned).length, [books]);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, isDesktop ? styles.contentDesktop : styles.contentMobile]}
      showsVerticalScrollIndicator={false}
    >
      {isDesktop ? (
        <View style={styles.desktopHeader}>
          <AppText variant="display" style={styles.desktopTitle}>
            Welcome back
          </AppText>
          <AppText variant="bodySm" tone="muted" style={styles.desktopSubtitle}>
            Track your reads, lend to friends, and build shelves of your favourite books.
          </AppText>
        </View>
      ) : showInlineTitle ? (
        <View style={styles.header}>
          <AppText variant="label" tone="muted" style={styles.headerTitle}>
            Home
          </AppText>
          <AppText variant="bodySm" tone="muted">
            Track your reads, lend to friends, and build shelves of your favourite books.
          </AppText>
        </View>
      ) : (
        <View style={styles.mobileSubtitleOnly}>
          <AppText variant="bodySm" tone="muted">
            Track your reads, lend to friends, and build shelves of your favourite books.
          </AppText>
        </View>
      )}

      <View style={[styles.statsStack, isDesktop && styles.statsRow]}>
        <StatCard value={booksReadThisYear} label="Books Read · this year" icon="read" desktop={isDesktop} />
        <StatCard value={books.length} label="In Library · total" icon="library" desktop={isDesktop} />
        <StatCard value={loanedCount} label="Books Lent · currently out" icon="lent" desktop={isDesktop} />
      </View>

      <Surface variant="card" style={[styles.recentPanel, isDesktop && styles.recentPanelDesktop]}>
        <View style={styles.recentHeader}>
          <AppText variant={isDesktop ? "body" : "h3"}>Recently Added</AppText>
          <Pressable onPress={onViewLibrary}>
            <AppText variant={isDesktop ? "body" : "bodySm"} tone="accent">
              View Library →
            </AppText>
          </Pressable>
        </View>

        <View style={[styles.recentGrid, isDesktop && styles.recentGridDesktop]}>
          {recentBooks.map((book) => {
            const coverUri = resolveBookCoverUri(book.title, book.coverThumbnail);
            return (
              <Pressable
                key={book.id}
                style={[styles.recentItem, isDesktop && styles.recentItemDesktop]}
                onPress={() => onOpenBook(book)}
              >
                <BookCover uri={coverUri} width={70} height={105} lent={book.loaned} />
                <AppText
                  variant={isDesktop ? "body" : "bodySm"}
                  numberOfLines={1}
                  style={[styles.recentTitle, isDesktop && styles.recentTitleDesktop]}
                >
                  {book.title}
                </AppText>
                <AppText
                  variant="caption"
                  tone="muted"
                  numberOfLines={1}
                  style={[styles.recentAuthor, isDesktop && styles.recentAuthorDesktop]}
                >
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
  desktop: boolean;
};

function StatCard({ value, label, icon, desktop }: StatCardProps) {
  return (
    <Surface variant="card" style={[styles.statCard, desktop && styles.statCardDesktop]}>
      <View style={[styles.statIcon, desktop && styles.statIconDesktop]}>
        <StatIcon icon={icon} />
      </View>
      <View style={[styles.statBody, desktop && styles.statBodyDesktop]}>
        <AppText variant="h3" style={desktop ? styles.statValueDesktop : null}>
          {value}
        </AppText>
        <AppText variant="body" tone="muted" style={[styles.statLabel, desktop && styles.statLabelDesktop]}>
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
    gap: spacing.xl
  },
  contentMobile: {
    paddingBottom: spacing.lg
  },
  contentDesktop: {
    gap: 48,
    paddingBottom: 24
  },
  header: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm
  },
  headerTitle: {
    fontFamily: fontFamilies.serifSemiBold
  },
  mobileSubtitleOnly: {
    paddingHorizontal: spacing.sm
  },
  desktopHeader: {
    width: "100%",
    minHeight: 151.578,
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  desktopTitle: {
    fontFamily: fontFamilies.serifSemiBold,
    fontSize: 36,
    lineHeight: 47
  },
  desktopSubtitle: {
    width: 448,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 22
  },
  statsStack: {
    gap: spacing.md
  },
  statsRow: {
    flexDirection: "row",
    gap: 24
  },
  statCard: {
    minHeight: 128,
    borderColor: "rgba(212,165,116,0.07)",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg
  },
  statCardDesktop: {
    flex: 1,
    minHeight: 122,
    height: 122,
    paddingHorizontal: 25,
    gap: 16
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
  statIconDesktop: {
    width: 46,
    height: 46
  },
  statBody: {
    gap: 2
  },
  statBodyDesktop: {
    flex: 1
  },
  statValueDesktop: {
    fontFamily: fontFamilies.serifRegular,
    fontSize: 16,
    lineHeight: 24
  },
  statLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  statLabelDesktop: {
    fontFamily: fontFamilies.sansRegular,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.8
  },
  recentPanel: {
    borderColor: "rgba(212,165,116,0.07)",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.lg
  },
  recentPanelDesktop: {
    minHeight: 260,
    paddingHorizontal: 25,
    paddingTop: 25,
    paddingBottom: 25,
    gap: 20
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
  recentGridDesktop: {
    flexWrap: "nowrap",
    rowGap: 0,
    justifyContent: "space-between"
  },
  recentItem: {
    width: 88,
    alignItems: "center",
    gap: 1
  },
  recentItemDesktop: {
    width: 162.328,
    justifyContent: "flex-start"
  },
  recentTitle: {
    textAlign: "center",
    marginTop: spacing.xs
  },
  recentTitleDesktop: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 24
  },
  recentAuthor: {
    textAlign: "center"
  },
  recentAuthorDesktop: {
    fontSize: 10,
    lineHeight: 15
  }
});
