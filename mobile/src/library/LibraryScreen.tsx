import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText, Surface } from "../primitives";
import { LibraryGridItem } from "./components/LibraryGridItem";
import { LibraryListItem } from "./components/LibraryListItem";
import { selectVisibleLibraryBooks } from "./selectors";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/tokens";
import type { LibraryBook, LibraryFilters, LibraryViewMode } from "../types/library";

type LibraryCategory = "read" | "reviews";

type LibraryScreenProps = {
  books: LibraryBook[];
  viewMode: LibraryViewMode;
  filters: LibraryFilters;
  onViewModeChange: (mode: LibraryViewMode) => void;
  onToggleLoaned: (bookId: string) => void;
  onOpenBook: (book: LibraryBook) => void;
};

export function LibraryScreen({ books, viewMode, filters, onViewModeChange, onToggleLoaned, onOpenBook }: LibraryScreenProps) {
  const [category, setCategory] = useState<LibraryCategory>("read");
  const visibleBooks = useMemo(() => selectVisibleLibraryBooks(books, filters), [books, filters]);
  const loanedCount = useMemo(() => books.filter((book) => book.loaned).length, [books]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <AppText variant="label" tone="muted">
          Library
        </AppText>
        <AppText variant="bodySm" tone="muted">
          {books.length} books · {loanedCount} currently lent out
        </AppText>
      </View>

      <Surface variant="card" style={styles.panel}>
        <View style={styles.panelTopRow}>
          <View style={styles.categoryRow}>
            <CategoryButton label="READ" active={category === "read"} onPress={() => setCategory("read")} />
            <CategoryButton
              label="REVIEWS"
              active={category === "reviews"}
              onPress={() => setCategory("reviews")}
            />
          </View>

          <View style={styles.viewToggle}>
            <Pressable
              style={[styles.viewButton, viewMode === "grid" && styles.viewButtonActive]}
              onPress={() => onViewModeChange("grid")}
            >
              <AppText variant="caption" tone={viewMode === "grid" ? "inverse" : "muted"}>
                ▦
              </AppText>
            </Pressable>
            <Pressable
              style={[styles.viewButton, viewMode === "list" && styles.viewButtonActive]}
              onPress={() => onViewModeChange("list")}
            >
              <AppText variant="caption" tone={viewMode === "list" ? "inverse" : "muted"}>
                ≣
              </AppText>
            </Pressable>
          </View>
        </View>

        {category !== "read" ? (
          <View style={styles.placeholderWrap}>
            <AppText variant="h3">Reviews</AppText>
            <AppText variant="bodySm" tone="muted">
              This view is ready for your next data integration pass.
            </AppText>
          </View>
        ) : viewMode === "grid" ? (
          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {visibleBooks.map((book) => (
              <LibraryGridItem key={book.id} book={book} onOpenBook={onOpenBook} />
            ))}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {visibleBooks.map((book) => (
              <LibraryListItem
                key={book.id}
                book={book}
                onOpenBook={onOpenBook}
                onToggleLoaned={onToggleLoaned}
              />
            ))}
          </ScrollView>
        )}
      </Surface>
    </View>
  );
}

type CategoryButtonProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function CategoryButton({ label, active, onPress }: CategoryButtonProps) {
  return (
    <Pressable style={[styles.categoryButton, active && styles.categoryButtonActive]} onPress={onPress}>
      <AppText variant="label" tone={active ? "accent" : "muted"}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.sm
  },
  header: {
    gap: spacing.xs
  },
  panel: {
    flex: 1,
    borderColor: "rgba(212,165,116,0.07)",
    overflow: "hidden"
  },
  panelTopRow: {
    height: 59,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,165,116,0.07)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  categoryButton: {
    minHeight: 24,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "transparent"
  },
  categoryButtonActive: {
    borderBottomColor: colors.accent
  },
  viewToggle: {
    flexDirection: "row",
    gap: 4
  },
  viewButton: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.05)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated
  },
  viewButtonActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(212,165,116,0.1)"
  },
  placeholderWrap: {
    padding: spacing.lg,
    gap: spacing.sm
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 6,
    columnGap: 6,
    justifyContent: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xxl
  },
  list: {
    paddingBottom: spacing.xxl
  }
});
