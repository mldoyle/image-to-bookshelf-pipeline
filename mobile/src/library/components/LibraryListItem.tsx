import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { AppText, BookCover, RatingStars } from "../../primitives";
import { resolveBookCoverUri } from "../figmaAssets";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/tokens";
import type { LibraryBook } from "../../types/library";

type LibraryListItemProps = {
  book: LibraryBook;
  onOpenBook: (book: LibraryBook) => void;
  onToggleLoaned: (id: string) => void;
};

export function LibraryListItem({ book, onOpenBook, onToggleLoaned }: LibraryListItemProps) {
  return (
    <Pressable style={styles.row} onPress={() => onOpenBook(book)}>
      <View style={styles.bookCell}>
        <BookCover uri={resolveBookCoverUri(book.title, book.coverThumbnail)} width={35} height={52} />
        <View style={styles.textBlock}>
          <AppText variant="h3" numberOfLines={1}>
            {book.title}
          </AppText>
          <AppText variant="bodySm" tone="muted" numberOfLines={1}>
            {book.author}
          </AppText>
        </View>
      </View>

      <View style={styles.metaCell}>
        <RatingStars rating={book.rating} size="sm" />
        <Pressable style={styles.loanIconButton} onPress={() => onToggleLoaned(book.id)}>
          <LoanStatusIcon loaned={book.loaned} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function LoanStatusIcon({ loaned }: { loaned: boolean }) {
  const color = loaned ? "#AB7878" : colors.warning;

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
  row: {
    minHeight: 74,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,165,116,0.04)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    gap: spacing.sm
  },
  bookCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  textBlock: {
    flex: 1,
    gap: 2
  },
  metaCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  loanIconButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center"
  }
});
