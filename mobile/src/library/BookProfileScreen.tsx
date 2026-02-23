import { Image, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { radius, spacing, typography } from "../theme/tokens";
import type { LibraryBook } from "../types/library";

type BookProfileScreenProps = {
  book: LibraryBook;
  onBack: () => void;
};

const yearLabel = (year: number | null): string => (year === null ? "Year Unknown" : String(year));
const ratingLabel = (rating: number | null): string => (rating === null ? "Unrated" : `★ ${rating.toFixed(1)}`);
const genreLabel = (genres: string[]): string => (genres.length > 0 ? genres.join(" • ") : "Genre Unknown");

export function BookProfileScreen({ book, onBack }: BookProfileScreenProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Book</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.coverWrap}>
          {book.coverThumbnail ? (
            <Image source={{ uri: book.coverThumbnail }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverFallback}>
              <Text style={styles.coverFallbackText}>No Cover</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.bookTitle}>{book.title}</Text>
          <Text style={styles.bookAuthor}>{book.author}</Text>
          <Text style={styles.metaText}>{yearLabel(book.publishedYear)}</Text>
          <Text style={styles.metaText}>{genreLabel(book.genres)}</Text>
          <Text style={styles.metaText}>{ratingLabel(book.rating)}</Text>
          <Text style={styles.metaText}>{book.loaned ? "Currently loaned" : "Available"}</Text>
          <Text style={styles.noteText}>Full profile editing/details screen will be added next.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg
  },
  backButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  backButtonText: {
    color: colors.textPrimary,
    fontWeight: "700"
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.h2,
    fontWeight: "800"
  },
  spacer: {
    width: 64
  },
  content: {
    gap: spacing.md
  },
  coverWrap: {
    width: 140,
    alignSelf: "center",
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    aspectRatio: 0.66
  },
  coverImage: {
    width: "100%",
    height: "100%"
  },
  coverFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  coverFallbackText: {
    color: colors.textMuted,
    fontSize: typography.caption
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs
  },
  bookTitle: {
    color: colors.textPrimary,
    fontSize: typography.h2,
    fontWeight: "900"
  },
  bookAuthor: {
    color: colors.textSecondary,
    fontSize: typography.body,
    fontWeight: "700",
    marginBottom: spacing.xs
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: typography.body
  },
  noteText: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: typography.caption
  }
});
