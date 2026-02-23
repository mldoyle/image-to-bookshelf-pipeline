import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { radius, spacing, typography } from "../../theme/tokens";
import type { LibraryFilters } from "../../types/library";

type FilterBarProps = {
  filters: LibraryFilters;
  onOpenFilters: () => void;
  onClearFilters: () => void;
};

const yearSummary = (filters: LibraryFilters): string => {
  const min = filters.yearMin;
  const max = filters.yearMax;
  if (min === null && max === null) {
    return filters.includeUnknownYear ? "Year + Unknown" : "Year";
  }
  if (min !== null && max !== null) {
    return min === max ? String(min) : `${min}-${max}`;
  }
  if (min !== null) {
    return `Year ${min}+`;
  }
  return `Year <=${max}`;
};

const ratingSummary = (filters: LibraryFilters): string => {
  if (filters.minRating === null) {
    return filters.includeUnrated ? "Unrated only" : "Rating";
  }
  return filters.includeUnrated ? `${filters.minRating}+ + Unrated` : `${filters.minRating}+`;
};

const loanedSummary = (filters: LibraryFilters): string => {
  if (filters.loaned === "all") {
    return "Loaned";
  }
  return filters.loaned === "loaned" ? "Loaned only" : "Available only";
};

const chipLabel = (label: string, active: boolean): string =>
  active ? `${label} •` : label;

export function FilterBar({ filters, onOpenFilters, onClearFilters }: FilterBarProps) {
  const hasFilters =
    filters.genres.length > 0 ||
    filters.yearMin !== null ||
    filters.yearMax !== null ||
    filters.includeUnknownYear ||
    filters.minRating !== null ||
    filters.includeUnrated ||
    filters.loaned !== "all";

  return (
    <View style={styles.row}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable style={[styles.chip, filters.genres.length > 0 && styles.chipActive]} onPress={onOpenFilters}>
          <Text style={styles.chipText}>
            {chipLabel(
              filters.genres.length > 0 ? `Genre (${filters.genres.length})` : "Genre",
              filters.genres.length > 0
            )}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.chip,
            (filters.yearMin !== null || filters.yearMax !== null || filters.includeUnknownYear) &&
              styles.chipActive
          ]}
          onPress={onOpenFilters}
        >
          <Text style={styles.chipText}>
            {chipLabel(
              yearSummary(filters),
              filters.yearMin !== null || filters.yearMax !== null || filters.includeUnknownYear
            )}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, (filters.minRating !== null || filters.includeUnrated) && styles.chipActive]}
          onPress={onOpenFilters}
        >
          <Text style={styles.chipText}>
            {chipLabel(ratingSummary(filters), filters.minRating !== null || filters.includeUnrated)}
          </Text>
        </Pressable>
        <Pressable style={[styles.chip, filters.loaned !== "all" && styles.chipActive]} onPress={onOpenFilters}>
          <Text style={styles.chipText}>{chipLabel(loanedSummary(filters), filters.loaned !== "all")}</Text>
        </Pressable>
      </ScrollView>
      {hasFilters ? (
        <Pressable style={styles.clearButton} onPress={onClearFilters}>
          <Text style={styles.clearButtonLabel}>Clear</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  chips: {
    paddingVertical: spacing.sm,
    gap: spacing.sm
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceElevated
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: typography.body,
    fontWeight: "600"
  },
  clearButton: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceMuted
  },
  clearButtonLabel: {
    color: colors.textPrimary,
    fontSize: typography.caption,
    fontWeight: "700"
  }
});

