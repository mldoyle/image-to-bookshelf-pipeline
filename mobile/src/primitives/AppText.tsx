import { Text, type StyleProp, StyleSheet, type TextProps, type TextStyle } from "react-native";
import { colors } from "../theme/colors";
import { fontFamilies, lineHeights, typography } from "../theme/tokens";

type TextVariant = "display" | "title" | "h2" | "h3" | "body" | "bodySm" | "caption" | "label" | "chip";
type TextTone = "primary" | "secondary" | "muted" | "accent" | "danger" | "inverse";

type AppTextProps = TextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
};

const toneStyles = StyleSheet.create({
  primary: { color: colors.textPrimary },
  secondary: { color: colors.textSecondary },
  muted: { color: colors.textMuted },
  accent: { color: colors.accent },
  danger: { color: colors.danger },
  inverse: { color: colors.background }
});

const variantStyles = StyleSheet.create({
  display: {
    fontFamily: fontFamilies.serifBold,
    fontSize: typography.display,
    lineHeight: lineHeights.display
  },
  title: {
    fontFamily: fontFamilies.serifBold,
    fontSize: typography.title,
    lineHeight: lineHeights.title
  },
  h2: {
    fontFamily: fontFamilies.serifSemiBold,
    fontSize: typography.h2,
    lineHeight: lineHeights.h2
  },
  h3: {
    fontFamily: fontFamilies.serifRegular,
    fontSize: typography.h3,
    lineHeight: lineHeights.h3
  },
  body: {
    fontFamily: fontFamilies.sansRegular,
    fontSize: typography.body,
    lineHeight: lineHeights.body
  },
  bodySm: {
    fontFamily: fontFamilies.sansRegular,
    fontSize: typography.bodySm,
    lineHeight: lineHeights.bodySm
  },
  caption: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: typography.caption,
    lineHeight: lineHeights.caption
  },
  label: {
    fontFamily: fontFamilies.sansBold,
    fontSize: typography.label,
    lineHeight: lineHeights.label,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  chip: {
    fontFamily: fontFamilies.sansBold,
    fontSize: typography.chip,
    lineHeight: lineHeights.chip,
    textTransform: "uppercase",
    letterSpacing: 0.6
  }
});

export function AppText({ variant = "body", tone = "primary", style, ...props }: AppTextProps) {
  return <Text style={[variantStyles[variant], toneStyles[tone], style]} {...props} />;
}
