import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText, Surface } from "../primitives";
import { LibraryGridItem } from "./components/LibraryGridItem";
import { LibraryListItem } from "./components/LibraryListItem";
import { FilterBar } from "./components/FilterBar";
import { deriveLibraryFilterOptions, selectVisibleLibraryBooks } from "./selectors";
import { colors } from "../theme/colors";
import { fontFamilies, radius, spacing } from "../theme/tokens";
import {
  DEFAULT_LIBRARY_FILTERS,
  type LibraryBook,
  type LibraryFilters,
  type LibrarySortMode,
  type LibraryViewMode
} from "../types/library";

type LibraryCategory = "read" | "reviews";

type LibraryScreenProps = {
  books: LibraryBook[];
  viewMode: LibraryViewMode;
  sortMode: LibrarySortMode;
  filters: LibraryFilters;
  onSortModeChange: (sortMode: LibrarySortMode) => void;
  onFiltersChange: (filters: LibraryFilters) => void;
  onViewModeChange: (mode: LibraryViewMode) => void;
  onToggleLoaned: (bookId: string) => void;
  onOpenBook: (book: LibraryBook) => void;
};

export function LibraryScreen({
  books,
  viewMode,
  sortMode,
  filters,
  onSortModeChange,
  onFiltersChange,
  onViewModeChange,
  onToggleLoaned,
  onOpenBook
}: LibraryScreenProps) {
  const [category, setCategory] = useState<LibraryCategory>("read");
  const visibleBooks = useMemo(
    () => selectVisibleLibraryBooks(books, filters, sortMode),
    [books, filters, sortMode]
  );
  const filterOptions = useMemo(() => deriveLibraryFilterOptions(books), [books]);
  const loanedCount = useMemo(() => books.filter((book) => book.loaned).length, [books]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <AppText variant="label" tone="muted" style={styles.headerTitle}>
          Library
        </AppText>
        <AppText variant="bodySm" tone="muted">
          {books.length} books · {loanedCount} currently lent out
        </AppText>
      </View>

      <FilterBar
        filters={filters}
        options={filterOptions}
        onFiltersChange={onFiltersChange}
        onClearFilters={() => onFiltersChange(DEFAULT_LIBRARY_FILTERS)}
      />

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

          <View style={styles.controlsRow}>
            <Pressable
              style={styles.sortButton}
              onPress={() =>
                onSortModeChange(sortMode === "recent_desc" ? "recent_asc" : "recent_desc")
              }
            >
              <AppText variant="caption" tone="muted" style={styles.sortButtonText}>
                {sortMode === "recent_desc" ? "↓" : "↑"}
              </AppText>
            </Pressable>

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
            {visibleBooks.map((book, index) => (
              <LibraryGridItem key={`grid-${book.id}-${index}`} book={book} onOpenBook={onOpenBook} />
            ))}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {visibleBooks.map((book, index) => (
              <LibraryListItem
                key={`list-${book.id}-${index}`}
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
  headerTitle: {
    fontFamily: fontFamilies.serifSemiBold
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
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  sortButton: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.05)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated
  },
  sortButtonText: {
    fontSize: 14,
    lineHeight: 14
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
