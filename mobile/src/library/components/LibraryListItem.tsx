import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { radius, shadows, spacing, typography } from "../../theme/tokens";
import type { LibraryBook } from "../../types/library";

type LibraryListItemProps = {
  book: LibraryBook;
  onToggleLoaned: (id: string) => void;
};

const renderYear = (year: number | null): string => (year === null ? "Year Unknown" : String(year));
const renderGenres = (genres: string[]): string =>
  genres.length > 0 ? genres.slice(0, 2).join(" • ") : "Genre Unknown";
const renderRating = (rating: number | null): string =>
  rating === null ? "Unrated" : `★ ${rating.toFixed(1)}`;

export function LibraryListItem({ book, onToggleLoaned }: LibraryListItemProps) {
  return (
    <View style={styles.card}>
      <View style={styles.coverWrap}>
        {book.coverThumbnail ? (
          <Image source={{ uri: book.coverThumbnail }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverFallback}>
            <Text style={styles.coverFallbackText}>No Cover</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={styles.author} numberOfLines={1}>
          {book.author}
        </Text>
        <Text style={styles.meta}>
          {renderYear(book.publishedYear)} • {renderGenres(book.genres)}
        </Text>
        <Text style={styles.meta}>{renderRating(book.rating)}</Text>
      </View>

      <Pressable style={[styles.loanButton, book.loaned && styles.loanButtonActive]} onPress={() => onToggleLoaned(book.id)}>
        <Text style={styles.loanButtonText}>{book.loaned ? "Mark Returned" : "Mark Loaned"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadows.card
  },
  coverWrap: {
    width: 54,
    height: 78,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted
  },
  coverImage: {
    width: "100%",
    height: "100%"
  },
  coverFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs
  },
  coverFallbackText: {
    fontSize: typography.caption,
    color: colors.textMuted,
    textAlign: "center"
  },
  body: {
    flex: 1,
    gap: 2
  },
  title: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: typography.h3
  },
  author: {
    color: colors.textSecondary,
    fontSize: typography.body,
    fontWeight: "600"
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption
  },
  loanButton: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  loanButtonActive: {
    backgroundColor: colors.warning
  },
  loanButtonText: {
    color: colors.textPrimary,
    fontSize: typography.caption,
    fontWeight: "700"
  }
});

