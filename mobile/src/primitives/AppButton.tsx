import { Pressable, type PressableProps, type StyleProp, StyleSheet, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { colors } from "../theme/colors";
import { controlHeights, radius, spacing } from "../theme/tokens";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type AppButtonProps = Omit<PressableProps, "style"> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

const sizeStyles = StyleSheet.create({
  sm: { height: controlHeights.buttonSm },
  md: { height: controlHeights.buttonMd },
  lg: { height: controlHeights.buttonLg }
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  secondary: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: colors.border
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger
  }
});

export function AppButton({
  label,
  variant = "secondary",
  size = "sm",
  disabled,
  fullWidth,
  style,
  ...props
}: AppButtonProps) {
  const labelTone = variant === "primary" ? "inverse" : "primary";

  return (
    <Pressable
      disabled={disabled}
      style={[
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style
      ]}
      {...props}
    >
      <AppText variant="label" tone={labelTone}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  fullWidth: {
    width: "100%"
  },
  disabled: {
    opacity: 0.45
  }
});
