import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { radius, spacing, typography } from "../../theme/tokens";
import type { LibraryBook } from "../../types/library";

type LibraryGridItemProps = {
  book: LibraryBook;
  onOpenBook: (book: LibraryBook) => void;
};

export function LibraryGridItem({ book, onOpenBook }: LibraryGridItemProps) {
  return (
    <Pressable style={styles.card} onPress={() => onOpenBook(book)}>
      <View style={styles.cover}>
        {book.coverThumbnail ? (
          <Image source={{ uri: book.coverThumbnail }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverFallback}>
            <Text style={styles.coverFallbackText}>No Cover</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs
  },
  cover: {
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
    aspectRatio: 0.66
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
  }
});
