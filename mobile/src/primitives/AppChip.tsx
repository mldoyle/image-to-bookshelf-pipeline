import { View, type ViewStyle, type StyleProp, StyleSheet } from "react-native";
import { AppText } from "./AppText";
import { colors } from "../theme/colors";
import { controlHeights, radius, spacing, statusTokens } from "../theme/tokens";

type ChipTone =
  | "neutral"
  | "genre"
  | "reading"
  | "wantToRead"
  | "read"
  | "abandoned"
  | "overdue"
  | "available"
  | "lent"
  | "requested";

type AppChipProps = {
  label: string;
  tone?: ChipTone;
  style?: StyleProp<ViewStyle>;
};

const baseStyles = StyleSheet.create({
  chip: {
    minHeight: controlHeights.chip,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  genre: {
    minHeight: controlHeights.chipGenre
  },
  lending: {
    minHeight: controlHeights.chipLending
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999
  }
});

const toneStyles: Record<ChipTone, { container: ViewStyle; textColor: string; dotColor?: string }> = {
  neutral: {
    container: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border
    },
    textColor: colors.textPrimary
  },
  genre: {
    container: {
      backgroundColor: colors.surfaceElevated,
      borderColor: "rgba(212,165,116,0.05)"
    },
    textColor: colors.textPrimary
  },
  reading: {
    container: {
      backgroundColor: statusTokens.reading.background,
      borderColor: statusTokens.reading.border
    },
    textColor: statusTokens.reading.text
  },
  wantToRead: {
    container: {
      backgroundColor: statusTokens.wantToRead.background,
      borderColor: statusTokens.wantToRead.border
    },
    textColor: statusTokens.wantToRead.text
  },
  read: {
    container: {
      backgroundColor: statusTokens.read.background,
      borderColor: statusTokens.read.border
    },
    textColor: statusTokens.read.text
  },
  abandoned: {
    container: {
      backgroundColor: statusTokens.abandoned.background,
      borderColor: statusTokens.abandoned.border
    },
    textColor: statusTokens.abandoned.text
  },
  overdue: {
    container: {
      backgroundColor: statusTokens.overdue.background,
      borderColor: statusTokens.overdue.border
    },
    textColor: statusTokens.overdue.text
  },
  available: {
    container: {
      backgroundColor: statusTokens.available.background,
      borderColor: statusTokens.available.border
    },
    textColor: statusTokens.available.text,
    dotColor: statusTokens.available.dot
  },
  lent: {
    container: {
      backgroundColor: statusTokens.lent.background,
      borderColor: statusTokens.lent.border
    },
    textColor: statusTokens.lent.text,
    dotColor: statusTokens.lent.dot
  },
  requested: {
    container: {
      backgroundColor: statusTokens.requested.background,
      borderColor: statusTokens.requested.border
    },
    textColor: statusTokens.requested.text,
    dotColor: statusTokens.requested.dot
  }
};

export function AppChip({ label, tone = "neutral", style }: AppChipProps) {
  const chipTone = toneStyles[tone];
  const isGenre = tone === "genre";
  const isLending = tone === "available" || tone === "lent" || tone === "requested";

  return (
    <View style={[baseStyles.chip, chipTone.container, isGenre && baseStyles.genre, isLending && baseStyles.lending, style]}>
      {chipTone.dotColor ? <View style={[baseStyles.dot, { backgroundColor: chipTone.dotColor }]} /> : null}
      <AppText variant="chip" style={{ color: chipTone.textColor }}>
        {label}
      </AppText>
    </View>
  );
}
