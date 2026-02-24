import { StyleSheet, View } from "react-native";
import { AppInput, AppText, Surface } from "../primitives";
import { spacing } from "../theme/tokens";
import type { LibraryBook } from "../types/library";

type ProfileScreenProps = {
  books: LibraryBook[];
  apiBaseUrl: string;
  onApiBaseUrlChange: (value: string) => void;
};

const USER_NAME = "Matt Doyle";

export function ProfileScreen({ books, apiBaseUrl, onApiBaseUrlChange }: ProfileScreenProps) {
  const loanedCount = books.filter((book) => book.loaned).length;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <AppText variant="bodySm" tone="muted">
          {USER_NAME}
        </AppText>
        <AppText variant="bodySm" tone="muted">
          Keep your shelf synced across scans and search.
        </AppText>
      </View>

      <Surface variant="card" style={styles.summaryCard}>
        <Metric label="Books in library" value={books.length} />
        <Metric label="Books currently lent" value={loanedCount} />
      </Surface>

      <Surface variant="card" style={styles.apiCard}>
        <AppText variant="h3">Backend API</AppText>
        <AppInput
          value={apiBaseUrl}
          onChangeText={onApiBaseUrlChange}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://127.0.0.1:5001"
          hint="On iPhone over Wi-Fi, use your Mac LAN IP."
        />
      </Surface>
    </View>
  );
}

type MetricProps = {
  label: string;
  value: number;
};

function Metric({ label, value }: MetricProps) {
  return (
    <View style={styles.metricRow}>
      <AppText variant="bodySm" tone="muted">
        {label}
      </AppText>
      <AppText variant="h3">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.lg
  },
  header: {
    gap: spacing.xs
  },
  summaryCard: {
    padding: spacing.lg,
    gap: spacing.sm
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  apiCard: {
    padding: spacing.lg,
    gap: spacing.md
  }
});
