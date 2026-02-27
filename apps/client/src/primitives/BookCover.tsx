import { Image, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors } from "../theme/colors";
import { radius, spacing, typography } from "../theme/tokens";

type BookCoverProps = {
  uri: string | null;
  width: number;
  height: number;
  lent?: boolean;
  borderRadius?: number;
};

export function BookCover({ uri, width, height, lent = false, borderRadius = radius.sm }: BookCoverProps) {
  return (
    <View style={[styles.wrap, { width, height, borderRadius }]}> 
      {uri ? (
        <Image source={{ uri }} style={styles.image} />
      ) : (
        <View style={styles.fallback}>
          <AppText variant="caption" tone="muted" style={styles.fallbackText}>
            No Cover
          </AppText>
        </View>
      )}
      <View style={[styles.frame, { borderRadius }]} />
      {lent ? (
        <View style={styles.lentBadge}>
          <AppText variant="caption" tone="inverse" style={styles.lentLabel}>
            LENT
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    position: "relative"
  },
  image: {
    width: "100%",
    height: "100%"
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs
  },
  fallbackText: {
    fontSize: typography.caption,
    textAlign: "center"
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)"
  },
  lentBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: colors.accent,
    borderRadius: radius.xs,
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  lentLabel: {
    fontSize: 9,
    letterSpacing: 0.4
  }
});
