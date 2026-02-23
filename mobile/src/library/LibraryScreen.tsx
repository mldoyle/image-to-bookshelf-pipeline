import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { FilterBar } from "./components/FilterBar";
import { FilterSheet } from "./components/FilterSheet";
import { LibraryListItem } from "./components/LibraryListItem";
import { LibraryGridItem } from "./components/LibraryGridItem";
import { FabMenu } from "./components/FabMenu";
import { deriveLibraryFilterOptions, hasActiveFilters, selectVisibleLibraryBooks } from "./selectors";
import { colors } from "../theme/colors";
import { radius, spacing, typography } from "../theme/tokens";
import {
  DEFAULT_LIBRARY_FILTERS,
  type LibraryBook,
  type LibraryFilters,
  type LibraryViewMode
} from "../types/library";

type LibraryScreenProps = {
  books: LibraryBook[];
  viewMode: LibraryViewMode;
  filters: LibraryFilters;
  apiBaseUrl: string;
  onApiBaseUrlChange: (value: string) => void;
  onViewModeChange: (mode: LibraryViewMode) => void;
  onFiltersChange: (filters: LibraryFilters) => void;
  onToggleLoaned: (bookId: string) => void;
  onOpenCamera: () => void;
  onOpenSearch: () => void;
};

const listBottomPadding = 120;

export function LibraryScreen({
  books,
  viewMode,
  filters,
  apiBaseUrl,
  onApiBaseUrlChange,
  onViewModeChange,
  onFiltersChange,
  onToggleLoaned,
  onOpenCamera,
  onOpenSearch
}: LibraryScreenProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const visibleBooks = useMemo(() => selectVisibleLibraryBooks(books, filters), [books, filters]);
  const filterOptions = useMemo(() => deriveLibraryFilterOptions(books), [books]);
  const hasFilters = hasActiveFilters(filters);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Library</Text>
          <Text style={styles.subtitle}>Recently Added</Text>
        </View>
        <View style={styles.viewToggle}>
          <Pressable
            style={[styles.toggleButton, viewMode === "list" && styles.toggleButtonActive]}
            onPress={() => onViewModeChange("list")}
          >
            <Text style={styles.toggleLabel}>List</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleButton, viewMode === "grid" && styles.toggleButtonActive]}
            onPress={() => onViewModeChange("grid")}
          >
            <Text style={styles.toggleLabel}>Grid</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.apiWrap}>
        <Text style={styles.apiLabel}>API</Text>
        <TextInput
          style={styles.apiInput}
          autoCapitalize="none"
          autoCorrect={false}
          value={apiBaseUrl}
          onChangeText={onApiBaseUrlChange}
          placeholder="http://127.0.0.1:5001"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <FilterBar
        filters={filters}
        onOpenFilters={() => setFiltersOpen(true)}
        onClearFilters={() => onFiltersChange(DEFAULT_LIBRARY_FILTERS)}
      />

      <View style={styles.content}>
        {books.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No books yet</Text>
            <Text style={styles.emptyBody}>Use the + button to scan a shelf or add books from search.</Text>
          </View>
        ) : visibleBooks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No results for current filters</Text>
            <Text style={styles.emptyBody}>Clear or adjust filters to show your library.</Text>
            {hasFilters ? (
              <Pressable style={styles.emptyAction} onPress={() => onFiltersChange(DEFAULT_LIBRARY_FILTERS)}>
                <Text style={styles.emptyActionText}>Reset Filters</Text>
              </Pressable>
            ) : null}
          </View>
        ) : viewMode === "list" ? (
          <FlatList
            data={visibleBooks}
            key="list"
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <LibraryListItem
                book={item}
                onToggleLoaned={onToggleLoaned}
              />
            )}
          />
        ) : (
          <FlatList
            data={visibleBooks}
            key="grid"
            keyExtractor={(item) => item.id}
            numColumns={3}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <LibraryGridItem
                book={item}
                onToggleLoaned={onToggleLoaned}
              />
            )}
          />
        )}
      </View>

      <FilterSheet
        visible={filtersOpen}
        filters={filters}
        options={filterOptions}
        onApply={onFiltersChange}
        onClose={() => setFiltersOpen(false)}
      />

      <FabMenu onCameraPress={onOpenCamera} onSearchPress={onOpenSearch} />
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.title,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.body
  },
  viewToggle: {
    flexDirection: "row",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden"
  },
  toggleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface
  },
  toggleButtonActive: {
    backgroundColor: colors.accentMuted
  },
  toggleLabel: {
    color: colors.textPrimary,
    fontWeight: "700"
  },
  apiWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs
  },
  apiLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    width: 28
  },
  apiInput: {
    flex: 1,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md
  },
  content: {
    flex: 1
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: listBottomPadding
  },
  gridRow: {
    gap: spacing.sm
  },
  emptyState: {
    marginTop: spacing.xxl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.h2,
    fontWeight: "800"
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: typography.body
  },
  emptyAction: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  emptyActionText: {
    color: "#003125",
    fontWeight: "800"
  }
});

