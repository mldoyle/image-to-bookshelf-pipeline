import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies, radius, spacing, typography } from "../../theme/tokens";
import {
  DEFAULT_LIBRARY_FILTERS,
  UNKNOWN_GENRE,
  UNKNOWN_YEAR,
  UNRATED,
  type LibraryFilters
} from "../../types/library";
import type { LibraryFilterOptions } from "../selectors";

type FilterSheetProps = {
  visible: boolean;
  filters: LibraryFilters;
  options: LibraryFilterOptions;
  onClose: () => void;
  onApply: (filters: LibraryFilters) => void;
};

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

const asNullableRating = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const rating = Number(trimmed);
  if (!Number.isFinite(rating)) {
    return null;
  }
  const rounded = Math.round(rating);
  return Math.max(1, Math.min(5, rounded));
};

const isYearUnknownOptionPresent = (options: LibraryFilterOptions): boolean =>
  options.years.includes(UNKNOWN_YEAR);

const isUnratedOptionPresent = (options: LibraryFilterOptions): boolean =>
  options.ratings.includes(UNRATED);

const formatYearValue = (value: number | null): string => (value === null ? "" : String(value));
const formatRatingValue = (value: number | null): string => (value === null ? "" : String(value));

export function FilterSheet({ visible, filters, options, onClose, onApply }: FilterSheetProps) {
  const [draft, setDraft] = useState<LibraryFilters>(filters);

  useEffect(() => {
    if (visible) {
      setDraft(filters);
    }
  }, [filters, visible]);

  const knownGenres = useMemo(
    () => options.genres.filter((genre) => genre !== UNKNOWN_GENRE),
    [options.genres]
  );

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissHitBox} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Filters</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.dismissText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Genre</Text>
              <View style={styles.wrapRow}>
                {knownGenres.map((genre) => {
                  const selected = draft.genres.includes(genre);
                  return (
                    <Pressable
                      key={genre}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() => {
                        setDraft((current) => ({
                          ...current,
                          genres: selected
                            ? current.genres.filter((entry) => entry !== genre)
                            : [...current.genres, genre]
                        }));
                      }}
                    >
                      <Text style={styles.chipText}>{genre}</Text>
                    </Pressable>
                  );
                })}
                {options.genres.includes(UNKNOWN_GENRE) ? (
                  <Pressable
                    style={[styles.chip, draft.genres.includes(UNKNOWN_GENRE) && styles.chipActive]}
                    onPress={() => {
                      setDraft((current) => ({
                        ...current,
                        genres: current.genres.includes(UNKNOWN_GENRE)
                          ? current.genres.filter((entry) => entry !== UNKNOWN_GENRE)
                          : [...current.genres, UNKNOWN_GENRE]
                      }));
                    }}
                  >
                    <Text style={styles.chipText}>{UNKNOWN_GENRE}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Year</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={formatYearValue(draft.yearMin)}
                  onChangeText={(value) =>
                    setDraft((current) => ({
                      ...current,
                      yearMin: asNullableYear(value)
                    }))
                  }
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={formatYearValue(draft.yearMax)}
                  onChangeText={(value) =>
                    setDraft((current) => ({
                      ...current,
                      yearMax: asNullableYear(value)
                    }))
                  }
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              {isYearUnknownOptionPresent(options) ? (
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{UNKNOWN_YEAR}</Text>
                  <Switch
                    value={draft.includeUnknownYear}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        includeUnknownYear: value
                      }))
                    }
                    trackColor={{ true: colors.accentMuted, false: colors.surfaceMuted }}
                    thumbColor={draft.includeUnknownYear ? colors.accent : colors.textSecondary}
                  />
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rating</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={formatRatingValue(draft.minRating)}
                onChangeText={(value) =>
                  setDraft((current) => ({
                    ...current,
                    minRating: asNullableRating(value)
                  }))
                }
                placeholder="Minimum (1-5)"
                placeholderTextColor={colors.textMuted}
              />
              {isUnratedOptionPresent(options) ? (
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{UNRATED}</Text>
                  <Switch
                    value={draft.includeUnrated}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        includeUnrated: value
                      }))
                    }
                    trackColor={{ true: colors.accentMuted, false: colors.surfaceMuted }}
                    thumbColor={draft.includeUnrated ? colors.accent : colors.textSecondary}
                  />
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Loaned</Text>
              <View style={styles.wrapRow}>
                <Pressable
                  style={[styles.chip, draft.loaned === "all" && styles.chipActive]}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      loaned: "all"
                    }))
                  }
                >
                  <Text style={styles.chipText}>All</Text>
                </Pressable>
                <Pressable
                  style={[styles.chip, draft.loaned === "loaned" && styles.chipActive]}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      loaned: "loaned"
                    }))
                  }
                >
                  <Text style={styles.chipText}>Loaned</Text>
                </Pressable>
                <Pressable
                  style={[styles.chip, draft.loaned === "not_loaned" && styles.chipActive]}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      loaned: "not_loaned"
                    }))
                  }
                >
                  <Text style={styles.chipText}>Not loaned</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={styles.ghostButton}
              onPress={() => {
                setDraft(DEFAULT_LIBRARY_FILTERS);
                onApply(DEFAULT_LIBRARY_FILTERS);
              }}
            >
              <Text style={styles.ghostButtonText}>Reset</Text>
            </Pressable>
            <Pressable
              style={styles.applyButton}
              onPress={() => {
                onApply(draft);
                onClose();
              }}
            >
              <Text style={styles.applyButtonText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end"
  },
  dismissHitBox: {
    flex: 1
  },
  sheet: {
    maxHeight: "85%",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.h2,
    fontFamily: fontFamilies.serifBold
  },
  dismissText: {
    color: colors.textSecondary,
    fontWeight: "600"
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg
  },
  section: {
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.h3,
    fontFamily: fontFamilies.serifSemiBold
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted
  },
  chipText: {
    color: colors.textPrimary,
    fontWeight: "600"
  },
  inputRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs
  },
  switchLabel: {
    color: colors.textSecondary,
    fontSize: typography.body
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    gap: spacing.sm
  },
  ghostButton: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  ghostButtonText: {
    color: colors.textPrimary,
    fontWeight: "700"
  },
  applyButton: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  applyButtonText: {
    color: "#003125",
    fontWeight: "800"
  }
});
