import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { searchBooks } from "../api/booksClient";
import AcceptBookIcon from "../icons/AcceptBookIcon";
import { colors } from "../theme/colors";
import { radius, spacing, typography } from "../theme/tokens";
import type { LookupBookItem } from "../types/vision";

type SearchScreenProps = {
  apiBaseUrl: string;
  onBack: () => void;
  onAddLookupItem: (item: LookupBookItem) => void;
};

const extractYear = (publishedDate: string | undefined): string => {
  if (!publishedDate) {
    return "Year Unknown";
  }
  const match = publishedDate.match(/\d{4}/);
  return match ? match[0] : "Year Unknown";
};

const infoLine = (item: LookupBookItem): string => {
  const year = extractYear(item.publishedDate);
  const genre = item.categories?.[0] || "Genre Unknown";
  const rating =
    typeof item.averageRating === "number" && Number.isFinite(item.averageRating)
      ? `★ ${item.averageRating.toFixed(1)}`
      : "Unrated";
  return `${year} • ${genre} • ${rating}`;
};

export function SearchScreen({ apiBaseUrl, onBack, onAddLookupItem }: SearchScreenProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<LookupBookItem[]>([]);

  const canSearch = query.trim().length > 1;
  const resultCountLabel = useMemo(() => `${results.length} result${results.length === 1 ? "" : "s"}`, [results.length]);

  const onSearch = async () => {
    if (!canSearch || loading) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await searchBooks({
        apiBaseUrl,
        query,
        maxResults: 20,
        timeoutMs: 15000
      });
      setResults(response.items);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "search_failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Search Books</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void onSearch()}
          placeholder="Title or author"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable
          style={[styles.searchButton, !canSearch && styles.searchButtonDisabled]}
          disabled={!canSearch}
          onPress={() => void onSearch()}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </Pressable>
      </View>

      <Text style={styles.resultCount}>{resultCountLabel}</Text>
      {error ? <Text style={styles.errorText}>Search error: {error}</Text> : null}

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, index) => item.id || `${item.title || "unknown"}-${index}`}
          contentContainerStyle={styles.resultsContent}
          renderItem={({ item }) => {
            return (
              <View style={styles.resultCard}>
                <View style={styles.coverWrap}>
                  {item.imageLinks?.thumbnail || item.imageLinks?.smallThumbnail ? (
                    <Image
                      source={{ uri: item.imageLinks?.thumbnail || item.imageLinks?.smallThumbnail || "" }}
                      style={styles.coverImage}
                    />
                  ) : (
                    <View style={styles.coverFallback}>
                      <Text style={styles.coverFallbackText}>No Cover</Text>
                    </View>
                  )}
                </View>

                <View style={styles.resultBody}>
                  <Text style={styles.resultTitle} numberOfLines={2}>
                    {item.title || "Untitled"}
                  </Text>
                  <Text style={styles.resultAuthor} numberOfLines={1}>
                    {item.authors?.join(", ") || "Unknown author"}
                  </Text>
                  <Text style={styles.resultMeta} numberOfLines={1}>
                    {infoLine(item)}
                  </Text>
                </View>

                <Pressable
                  style={styles.addButton}
                  onPress={() => {
                    onAddLookupItem(item);
                    onBack();
                  }}
                >
                  <AcceptBookIcon width={24} height={24} color="#55656B" />
                </Pressable>
              </View>
            );
          }}
        />
      )}
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
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md
  },
  backButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.white,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  backButtonText: {
    color: colors.background,
    fontWeight: "700"
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.h2,
    fontWeight: "800"
  },
  spacer: {
    width: 64
  },
  searchRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  searchInput: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md
  },
  searchButton: {
    minWidth: 86,
    height: 46,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white
  },
  searchButtonDisabled: {
    opacity: 0.4
  },
  searchButtonText: {
    color: colors.background,
    fontWeight: "800"
  },
  resultCount: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    color: colors.textSecondary
  },
  errorText: {
    color: colors.danger,
    marginBottom: spacing.sm
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  resultsContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xxl
  },
  resultCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.sm,
    flexDirection: "row",
    alignItems: "center"
  },
  coverWrap: {
    width: 50,
    height: 72,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted
  },
  coverImage: {
    width: "100%",
    height: "100%"
  },
  coverFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs
  },
  coverFallbackText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: "center"
  },
  resultBody: {
    flex: 1,
    gap: 2
  },
  resultTitle: {
    color: colors.textPrimary,
    fontSize: typography.h3,
    fontWeight: "800"
  },
  resultAuthor: {
    color: colors.textSecondary
  },
  resultMeta: {
    color: colors.textMuted,
    fontSize: typography.caption
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
  }
});
