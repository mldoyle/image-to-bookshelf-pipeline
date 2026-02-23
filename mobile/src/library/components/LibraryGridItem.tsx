import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { radius, spacing, typography } from "../../theme/tokens";
import type { LibraryBook } from "../../types/library";

type LibraryGridItemProps = {
  book: LibraryBook;
  onToggleLoaned: (id: string) => void;
};

const yearText = (year: number | null): string => (year === null ? "Unknown" : String(year));

export function LibraryGridItem({ book, onToggleLoaned }: LibraryGridItemProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cover}>
        {book.coverThumbnail ? (
          <Image source={{ uri: book.coverThumbnail }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverFallback}>
            <Text style={styles.coverFallbackText}>No Cover</Text>
          </View>
        )}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {book.title}
      </Text>
      <Text style={styles.author} numberOfLines={1}>
        {book.author}
      </Text>
      <Text style={styles.meta}>
        {yearText(book.publishedYear)}{book.rating !== null ? ` • ★${book.rating.toFixed(1)}` : " • Unrated"}
      </Text>

      <Pressable
        style={[styles.loanTag, book.loaned && styles.loanTagActive]}
        onPress={() => onToggleLoaned(book.id)}
      >
        <Text style={styles.loanTagText}>{book.loaned ? "Loaned" : "Available"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.xs
  },
  cover: {
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
    aspectRatio: 0.68
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
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: "center"
  },
  title: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: typography.body
  },
  author: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: typography.caption
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption
  },
  loanTag: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3
  },
  loanTagActive: {
    borderColor: colors.warning,
    backgroundColor: "#61420a"
  },
  loanTagText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: "700"
  }
});

