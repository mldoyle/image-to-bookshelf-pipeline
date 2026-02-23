import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../../theme/colors";
import { radius, spacing, typography } from "../../theme/tokens";
import { UNKNOWN_GENRE, UNKNOWN_YEAR, UNRATED, type LibraryFilters } from "../../types/library";
import type { LibraryFilterOptions } from "../selectors";

type FilterKey = "genre" | "year" | "rating" | "loaned";

type FilterBarProps = {
  filters: LibraryFilters;
  options: LibraryFilterOptions;
  onFiltersChange: (filters: LibraryFilters) => void;
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

const asNullableYear = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const year = Number(trimmed);
  if (!Number.isFinite(year)) {
    return null;
  }
  return Math.max(0, Math.min(3000, Math.round(year)));
};

export function FilterBar({ filters, options, onFiltersChange, onClearFilters }: FilterBarProps) {
  const [openKey, setOpenKey] = useState<FilterKey | null>(null);

  const hasFilters =
    filters.genres.length > 0 ||
    filters.yearMin !== null ||
    filters.yearMax !== null ||
    filters.includeUnknownYear ||
    filters.minRating !== null ||
    filters.includeUnrated ||
    filters.loaned !== "all";

  const knownGenres = useMemo(
    () => options.genres.filter((genre) => genre !== UNKNOWN_GENRE),
    [options.genres]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable
            style={[styles.chip, filters.genres.length > 0 && styles.chipActive, openKey === "genre" && styles.chipOpen]}
            onPress={() => setOpenKey((current) => (current === "genre" ? null : "genre"))}
          >
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
                styles.chipActive,
              openKey === "year" && styles.chipOpen
            ]}
            onPress={() => setOpenKey((current) => (current === "year" ? null : "year"))}
          >
            <Text style={styles.chipText}>
              {chipLabel(
                yearSummary(filters),
                filters.yearMin !== null || filters.yearMax !== null || filters.includeUnknownYear
              )}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.chip,
              (filters.minRating !== null || filters.includeUnrated) && styles.chipActive,
              openKey === "rating" && styles.chipOpen
            ]}
            onPress={() => setOpenKey((current) => (current === "rating" ? null : "rating"))}
          >
            <Text style={styles.chipText}>
              {chipLabel(ratingSummary(filters), filters.minRating !== null || filters.includeUnrated)}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.chip,
              filters.loaned !== "all" && styles.chipActive,
              openKey === "loaned" && styles.chipOpen
            ]}
            onPress={() => setOpenKey((current) => (current === "loaned" ? null : "loaned"))}
          >
            <Text style={styles.chipText}>{chipLabel(loanedSummary(filters), filters.loaned !== "all")}</Text>
          </Pressable>
        </ScrollView>

        {hasFilters ? (
          <Pressable
            style={styles.clearButton}
            onPress={() => {
              onClearFilters();
              setOpenKey(null);
            }}
          >
            <Text style={styles.clearButtonLabel}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {openKey === "genre" ? (
        <View style={[styles.dropdown, styles.dropdownFloating]}>
          <Text style={styles.dropdownTitle}>Genre</Text>
          <View style={styles.dropdownBody}>
            {knownGenres.map((genre) => {
              const selected = filters.genres.includes(genre);
              return (
                <Pressable
                  key={genre}
                  style={[styles.optionChip, selected && styles.optionChipActive]}
                  onPress={() => {
                    onFiltersChange({
                      ...filters,
                      genres: selected
                        ? filters.genres.filter((entry) => entry !== genre)
                        : [...filters.genres, genre]
                    });
                  }}
                >
                  <Text style={[styles.optionChipText, selected && styles.optionChipTextActive]}>{genre}</Text>
                </Pressable>
              );
            })}
            {options.genres.includes(UNKNOWN_GENRE) ? (
              <Pressable
                style={[styles.optionChip, filters.genres.includes(UNKNOWN_GENRE) && styles.optionChipActive]}
                onPress={() =>
                  onFiltersChange({
                    ...filters,
                    genres: filters.genres.includes(UNKNOWN_GENRE)
                      ? filters.genres.filter((entry) => entry !== UNKNOWN_GENRE)
                      : [...filters.genres, UNKNOWN_GENRE]
                  })
                }
              >
                <Text
                  style={[
                    styles.optionChipText,
                    filters.genres.includes(UNKNOWN_GENRE) && styles.optionChipTextActive
                  ]}
                >
                  {UNKNOWN_GENRE}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {openKey === "year" ? (
        <View style={[styles.dropdown, styles.dropdownFloating]}>
          <Text style={styles.dropdownTitle}>Year</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={filters.yearMin === null ? "" : String(filters.yearMin)}
              onChangeText={(value) =>
                onFiltersChange({
                  ...filters,
                  yearMin: asNullableYear(value)
                })
              }
              placeholder="Min"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={filters.yearMax === null ? "" : String(filters.yearMax)}
              onChangeText={(value) =>
                onFiltersChange({
                  ...filters,
                  yearMax: asNullableYear(value)
                })
              }
              placeholder="Max"
              placeholderTextColor={colors.textMuted}
            />
            {options.years.includes(UNKNOWN_YEAR) ? (
              <Pressable
                style={[styles.optionChip, filters.includeUnknownYear && styles.optionChipActive]}
                onPress={() =>
                  onFiltersChange({
                    ...filters,
                    includeUnknownYear: !filters.includeUnknownYear
                  })
                }
              >
                <Text style={[styles.optionChipText, filters.includeUnknownYear && styles.optionChipTextActive]}>
                  {UNKNOWN_YEAR}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {openKey === "rating" ? (
        <View style={[styles.dropdown, styles.dropdownFloating]}>
          <Text style={styles.dropdownTitle}>Rating</Text>
          <View style={styles.dropdownBody}>
            <Pressable
              style={[styles.optionChip, filters.minRating === null && styles.optionChipActive]}
              onPress={() =>
                onFiltersChange({
                  ...filters,
                  minRating: null
                })
              }
            >
              <Text style={[styles.optionChipText, filters.minRating === null && styles.optionChipTextActive]}>
                Any
              </Text>
            </Pressable>
            {[1, 2, 3, 4, 5].map((rating) => {
              const selected = filters.minRating === rating;
              return (
                <Pressable
                  key={rating}
                  style={[styles.optionChip, selected && styles.optionChipActive]}
                  onPress={() =>
                    onFiltersChange({
                      ...filters,
                      minRating: rating
                    })
                  }
                >
                  <Text style={[styles.optionChipText, selected && styles.optionChipTextActive]}>{rating}+</Text>
                </Pressable>
              );
            })}
            {options.ratings.includes(UNRATED) ? (
              <Pressable
                style={[styles.optionChip, filters.includeUnrated && styles.optionChipActive]}
                onPress={() =>
                  onFiltersChange({
                    ...filters,
                    includeUnrated: !filters.includeUnrated
                  })
                }
              >
                <Text style={[styles.optionChipText, filters.includeUnrated && styles.optionChipTextActive]}>
                  {UNRATED}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {openKey === "loaned" ? (
        <View style={[styles.dropdown, styles.dropdownFloating]}>
          <Text style={styles.dropdownTitle}>Loaned</Text>
          <View style={styles.dropdownBody}>
            <Pressable
              style={[styles.optionChip, filters.loaned === "all" && styles.optionChipActive]}
              onPress={() =>
                onFiltersChange({
                  ...filters,
                  loaned: "all"
                })
              }
            >
              <Text style={[styles.optionChipText, filters.loaned === "all" && styles.optionChipTextActive]}>
                All
              </Text>
            </Pressable>
            <Pressable
              style={[styles.optionChip, filters.loaned === "loaned" && styles.optionChipActive]}
              onPress={() =>
                onFiltersChange({
                  ...filters,
                  loaned: "loaned"
                })
              }
            >
              <Text style={[styles.optionChipText, filters.loaned === "loaned" && styles.optionChipTextActive]}>
                Loaned
              </Text>
            </Pressable>
            <Pressable
              style={[styles.optionChip, filters.loaned === "not_loaned" && styles.optionChipActive]}
              onPress={() =>
                onFiltersChange({
                  ...filters,
                  loaned: "not_loaned"
                })
              }
            >
              <Text
                style={[styles.optionChipText, filters.loaned === "not_loaned" && styles.optionChipTextActive]}
              >
                Available
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
    position: "relative",
    overflow: "visible",
    zIndex: 30,
    elevation: 30
  },
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
  chipOpen: {
    borderColor: colors.textPrimary
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
  },
  dropdown: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    gap: spacing.sm
  },
  dropdownFloating: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "100%",
    marginTop: spacing.xs,
    zIndex: 40,
    elevation: 40
  },
  dropdownTitle: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: typography.caption
  },
  dropdownBody: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  optionChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  optionChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted
  },
  optionChipText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: typography.caption
  },
  optionChipTextActive: {
    color: colors.textPrimary
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  input: {
    flex: 1,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm
  }
});
