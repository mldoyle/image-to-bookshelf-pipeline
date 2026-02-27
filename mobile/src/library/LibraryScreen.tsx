import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
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
  type LibraryViewMode,
} from "../types/library";

type LibraryCategory = "read" | "reviews";
type SortField = "recent" | "title" | "author" | "rating" | "published";
type SortDirection = "asc" | "desc";

type LibraryScreenProps = {
  books: LibraryBook[];
  viewMode: LibraryViewMode;
  sortMode: LibrarySortMode;
  filters: LibraryFilters;
  onSortModeChange: (sortMode: LibrarySortMode) => void;
  onFiltersChange: (filters: LibraryFilters) => void;
  onViewModeChange: (mode: LibraryViewMode) => void;
  onOpenBook: (book: LibraryBook) => void;
};

const sortChoices: Array<{ field: SortField; label: string }> = [
  { field: "recent", label: "Date Added" },
  { field: "title", label: "Title" },
  { field: "author", label: "Author" },
  { field: "rating", label: "Rating" },
  { field: "published", label: "Year Published" },
];

const splitSortMode = (sortMode: LibrarySortMode): { field: SortField; direction: SortDirection } => {
  if (sortMode.startsWith("recent_")) {
    return { field: "recent", direction: sortMode.endsWith("asc") ? "asc" : "desc" };
  }
  if (sortMode.startsWith("title_")) {
    return { field: "title", direction: sortMode.endsWith("asc") ? "asc" : "desc" };
  }
  if (sortMode.startsWith("author_")) {
    return { field: "author", direction: sortMode.endsWith("asc") ? "asc" : "desc" };
  }
  if (sortMode.startsWith("rating_")) {
    return { field: "rating", direction: sortMode.endsWith("asc") ? "asc" : "desc" };
  }
  return { field: "published", direction: sortMode.endsWith("asc") ? "asc" : "desc" };
};

const sortModeFor = (field: SortField, direction: SortDirection): LibrarySortMode => {
  if (field === "recent") {
    return direction === "asc" ? "recent_asc" : "recent_desc";
  }
  if (field === "title") {
    return direction === "asc" ? "title_asc" : "title_desc";
  }
  if (field === "author") {
    return direction === "asc" ? "author_asc" : "author_desc";
  }
  if (field === "rating") {
    return direction === "asc" ? "rating_asc" : "rating_desc";
  }
  return direction === "asc" ? "published_asc" : "published_desc";
};

export function LibraryScreen({
  books,
  viewMode,
  sortMode,
  filters,
  onSortModeChange,
  onFiltersChange,
  onViewModeChange,
  onOpenBook,
}: LibraryScreenProps) {
  const [category, setCategory] = useState<LibraryCategory>("read");
  const [sortOpen, setSortOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const visibleBooksByFilter = useMemo(
    () => selectVisibleLibraryBooks(books, filters, sortMode),
    [books, filters, sortMode]
  );
  const filterOptions = useMemo(() => deriveLibraryFilterOptions(books), [books]);
  const loanedCount = useMemo(() => books.filter((book) => book.loaned).length, [books]);
  const sortSelection = splitSortMode(sortMode);
  const currentSortLabel = sortChoices.find((choice) => choice.field === sortSelection.field)?.label ?? "Date Added";
  const searchLower = searchQuery.trim().toLowerCase();

  const visibleBooks = useMemo(() => {
    if (!searchLower) {
      return visibleBooksByFilter;
    }
    return visibleBooksByFilter.filter((book) => {
      return book.title.toLowerCase().includes(searchLower) || book.author.toLowerCase().includes(searchLower);
    });
  }, [searchLower, visibleBooksByFilter]);

  const reviewsBooks = useMemo(
    () => visibleBooks.filter((book) => Boolean(book.review)),
    [visibleBooks]
  );

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

      <View style={styles.searchWrap}>
        <SearchIcon color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search your library..."
          placeholderTextColor={colors.textMuted}
        />
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
            <View style={styles.sortWrap}>
              <Pressable style={styles.sortButton} onPress={() => setSortOpen((open) => !open)}>
                {sortSelection.direction === "asc" ? (
                  <ArrowUpIcon color={colors.textMuted} />
                ) : (
                  <ArrowDownIcon color={colors.textMuted} />
                )}
                <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.sortButtonLabel}>
                  {currentSortLabel}
                </AppText>
                <ChevronDownIcon color={colors.textMuted} open={sortOpen} />
              </Pressable>

              {sortOpen ? (
                <View style={styles.sortMenu}>
                  {sortChoices.map((choice) => {
                    const active = choice.field === sortSelection.field;
                    return (
                      <Pressable
                        key={choice.field}
                        style={[styles.sortMenuItem, active ? styles.sortMenuItemActive : null]}
                        onPress={() => {
                          const nextDirection =
                            choice.field === sortSelection.field
                              ? sortSelection.direction === "asc"
                                ? "desc"
                                : "asc"
                              : "desc";
                          onSortModeChange(sortModeFor(choice.field, nextDirection));
                          setSortOpen(false);
                        }}
                      >
                        <AppText variant="caption" tone={active ? "accent" : "primary"}>
                          {choice.label}
                        </AppText>
                        {active ? (
                          sortSelection.direction === "asc" ? (
                            <ArrowUpIcon color={colors.accent} />
                          ) : (
                            <ArrowDownIcon color={colors.accent} />
                          )
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
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
        </View>

        {category === "reviews" ? (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {reviewsBooks.length === 0 ? (
              <View style={styles.placeholderWrap}>
                <AppText variant="h3">No reviews yet</AppText>
                <AppText variant="bodySm" tone="muted">
                  Add notes from Book Detail to populate this view.
                </AppText>
              </View>
            ) : (
              reviewsBooks.map((book, index) => (
                <LibraryListItem key={`review-${book.id}-${index}`} book={book} onOpenBook={onOpenBook} />
              ))
            )}
          </ScrollView>
        ) : viewMode === "grid" ? (
          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {visibleBooks.map((book, index) => (
              <LibraryGridItem key={`grid-${book.id}-${index}`} book={book} onOpenBook={onOpenBook} />
            ))}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {visibleBooks.map((book, index) => (
              <LibraryListItem key={`list-${book.id}-${index}`} book={book} onOpenBook={onOpenBook} />
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

function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} fill="none" viewBox="0 0 24 24">
      <Path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4" stroke={color} strokeLinecap="round" strokeWidth={1.8} />
    </Svg>
  );
}

function ArrowUpIcon({ color }: { color: string }) {
  return (
    <Svg width={11} height={11} fill="none" viewBox="0 0 24 24">
      <Path d="m12 19-.01-14M6 11l6-6 6 6" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
    </Svg>
  );
}

function ArrowDownIcon({ color }: { color: string }) {
  return (
    <Svg width={11} height={11} fill="none" viewBox="0 0 24 24">
      <Path d="m12 5 .01 14M18 13l-6 6-6-6" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
    </Svg>
  );
}

function ChevronDownIcon({ color, open }: { color: string; open: boolean }) {
  return (
    <View style={[styles.chevronWrap, open ? styles.chevronWrapOpen : null]}>
      <Svg width={10} height={10} fill="none" viewBox="0 0 24 24">
        <Path d="m6 9 6 6 6-6" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.sm,
  },
  header: {
    gap: spacing.xs,
  },
  headerTitle: {
    fontFamily: fontFamilies.serifSemiBold,
  },
  searchWrap: {
    minHeight: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.12)",
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  panel: {
    flex: 1,
    borderColor: "rgba(212,165,116,0.07)",
    overflow: "visible",
  },
  panelTopRow: {
    height: 59,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,165,116,0.07)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    zIndex: 25,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  categoryButton: {
    minHeight: 24,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
  },
  categoryButtonActive: {
    borderBottomColor: colors.accent,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sortWrap: {
    position: "relative",
  },
  sortButton: {
    minWidth: 140,
    maxWidth: 180,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.12)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    gap: spacing.xs,
  },
  sortButtonLabel: {
    flexShrink: 1,
  },
  chevronWrap: {
    transform: [{ rotate: "0deg" }],
  },
  chevronWrapOpen: {
    transform: [{ rotate: "180deg" }],
  },
  sortMenu: {
    position: "absolute",
    right: 0,
    top: 38,
    width: 170,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.18)",
    backgroundColor: colors.surface,
    zIndex: 40,
    overflow: "hidden",
  },
  sortMenuItem: {
    minHeight: 36,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(212,165,116,0.14)",
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sortMenuItemActive: {
    backgroundColor: "rgba(212,165,116,0.12)",
  },
  viewToggle: {
    flexDirection: "row",
    gap: 4,
  },
  viewButton: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.08)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  viewButtonActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(212,165,116,0.1)",
  },
  placeholderWrap: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
    columnGap: 8,
    justifyContent: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  list: {
    paddingBottom: spacing.xxl,
  },
});
