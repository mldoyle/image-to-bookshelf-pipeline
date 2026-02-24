import type { ReactNode } from "react";
import { TextInput, View, type StyleProp, StyleSheet, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { colors } from "../theme/colors";
import { controlHeights, radius, spacing } from "../theme/tokens";

type InputVariant = "default" | "search" | "textarea";

type AppInputProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  leftAccessory?: ReactNode;
  variant?: InputVariant;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export function AppInput({
  label,
  hint,
  error,
  leftAccessory,
  variant = "default",
  placeholderTextColor = colors.textMuted,
  multiline,
  containerStyle,
  inputStyle,
  ...props
}: AppInputProps) {
  const resolvedMultiline = multiline ?? variant === "textarea";

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <AppText variant="caption" tone="muted">{label}</AppText> : null}
      <View style={[styles.inputWrap, variant === "textarea" && styles.inputWrapTextarea]}>
        {leftAccessory ? <View style={styles.leftAccessory}>{leftAccessory}</View> : null}
        <TextInput
          multiline={resolvedMultiline}
          style={[
            styles.input,
            variant === "search" && styles.inputSearch,
            variant === "textarea" && styles.inputTextarea,
            inputStyle
          ]}
          placeholderTextColor={placeholderTextColor}
          {...props}
        />
      </View>
      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4
  },
  inputWrap: {
    minHeight: controlHeights.input,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center"
  },
  inputWrapTextarea: {
    minHeight: controlHeights.textarea,
    alignItems: "flex-start",
    paddingVertical: spacing.sm
  },
  leftAccessory: {
    marginRight: spacing.sm,
    alignItems: "center",
    justifyContent: "center"
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16
  },
  inputSearch: {
    paddingLeft: spacing.sm
  },
  inputTextarea: {
    textAlignVertical: "top",
    minHeight: controlHeights.textarea - spacing.sm * 2
  }
});
