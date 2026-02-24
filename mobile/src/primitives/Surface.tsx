import { View, type ViewProps, type ViewStyle, type StyleProp, StyleSheet } from "react-native";
import { colors } from "../theme/colors";
import { radius, shadows } from "../theme/tokens";

type SurfaceVariant = "screen" | "card" | "panel" | "menu" | "muted";

type SurfaceProps = ViewProps & {
  variant?: SurfaceVariant;
  style?: StyleProp<ViewStyle>;
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card
  },
  panel: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  menu: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.menu
  },
  muted: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm
  }
});

export function Surface({ variant = "card", style, ...props }: SurfaceProps) {
  return <View style={[styles[variant], style]} {...props} />;
}
