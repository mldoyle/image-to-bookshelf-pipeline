import { Pressable, StyleSheet, View } from "react-native";
import { BookCover } from "../../primitives";
import { resolveBookCoverUri } from "../figmaAssets";
import type { LibraryBook } from "../../types/library";

type LibraryGridItemProps = {
  book: LibraryBook;
  onOpenBook: (book: LibraryBook) => void;
};

export function LibraryGridItem({ book, onOpenBook }: LibraryGridItemProps) {
  return (
    <Pressable onPress={() => onOpenBook(book)}>
      <View style={styles.item}>
        <BookCover
          uri={resolveBookCoverUri(book.title, book.coverThumbnail)}
          width={78}
          height={117}
          lent={book.loaned}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    width: 78,
    height: 117
  }
});
