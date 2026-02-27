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
};

export function LibraryListItem({ book, onOpenBook }: LibraryListItemProps) {
  const yearLabel = book.publishedYear ? String(book.publishedYear) : "----";
  return (
    <Pressable style={styles.row} onPress={() => onOpenBook(book)}>
      <View style={styles.bookCell}>
        <BookCover uri={resolveBookCoverUri(book.title, book.coverThumbnail)} width={35} height={52} lent={book.loaned} />
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
        <AppText variant="caption" tone="muted" style={styles.yearText}>
          {yearLabel}
        </AppText>
        <RatingStars rating={book.rating} size="sm" />
        <View style={styles.statusIconRow}>
          {book.liked ? <HeartIcon /> : null}
          {book.reread ? <RereadIcon /> : null}
          {book.review ? <ReviewIcon /> : null}
        </View>
        <View style={styles.loanIconWrap}>
          <LoanStatusIcon loaned={book.loaned} />
        </View>
      </View>
    </Pressable>
  );
}

function HeartIcon() {
  return (
    <Svg width={14} height={14} fill="none" viewBox="0 0 24 24">
      <Path
        d="m12 20-1.25-1.14C6.1 14.66 3 11.84 3 8.4 3 5.58 5.24 3.4 8.05 3.4c1.59 0 3.11.74 4.1 1.9.99-1.16 2.51-1.9 4.1-1.9 2.81 0 5.05 2.18 5.05 5 0 3.45-3.1 6.27-7.75 10.48L12 20Z"
        fill={colors.accent}
      />
    </Svg>
  );
}

function ReviewIcon() {
  return (
    <Svg width={14} height={14} fill="none" viewBox="0 0 24 24">
      <Path
        d="M5 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 4V5a1 1 0 0 1 1-1Z"
        stroke={colors.accent}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function RereadIcon() {
  return (
    <Svg width={14} height={14} fill="none" viewBox="0 0 24 24">
      <Path
        d="M17 1v4h-4M7 23v-4h4M20.5 9a8.5 8.5 0 0 0-14.8-4M3.5 15a8.5 8.5 0 0 0 14.8 4"
        stroke={colors.accent}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
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
  row: {
    minHeight: 74,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,165,116,0.04)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  bookCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  metaCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  yearText: {
    width: 34,
    textAlign: "right",
  },
  statusIconRow: {
    minWidth: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },
  loanIconWrap: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
