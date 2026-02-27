import { StyleSheet, View } from "react-native";
import { AppInput, AppText, Surface } from "../primitives";
import { spacing } from "../theme/tokens";

type SettingsScreenProps = {
  apiBaseUrl: string;
  showInlineTitle?: boolean;
  onApiBaseUrlChange: (value: string) => void;
};

export function SettingsScreen({
  apiBaseUrl,
  showInlineTitle = true,
  onApiBaseUrlChange
}: SettingsScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {showInlineTitle ? (
          <AppText variant="label" tone="muted">
            Settings
          </AppText>
        ) : null}
        <AppText variant="bodySm" tone="muted">
          Configure application and backend connectivity.
        </AppText>
      </View>

      <Surface variant="card" style={styles.card}>
        <AppText variant="h3">Backend API</AppText>
        <AppInput
          value={apiBaseUrl}
          onChangeText={onApiBaseUrlChange}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://127.0.0.1:5001"
          hint="For phones on Wi-Fi, use your machine LAN IP."
        />
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
  },
});
