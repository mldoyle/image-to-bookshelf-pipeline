import { StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors } from "../theme/colors";

type RatingStarsProps = {
  rating: number | null;
  size?: "sm" | "md";
};

const maxStars = 5;

export function RatingStars({ rating, size = "sm" }: RatingStarsProps) {
  if (rating === null) {
    return (
      <AppText variant="caption" tone="muted">
        Unrated
      </AppText>
    );
  }

  const roundedToHalf = Math.max(0, Math.min(maxStars, Math.round(rating * 2) / 2));
  const full = Math.floor(roundedToHalf);
  const hasHalf = roundedToHalf - full >= 0.5;
  const empty = maxStars - full - (hasHalf ? 1 : 0);

  return (
    <View style={styles.row}>
      <AppText variant={size === "sm" ? "caption" : "bodySm"} style={styles.starText}>
        {"★".repeat(full)}
        {hasHalf ? "½" : ""}
        {"☆".repeat(empty)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center"
  },
  starText: {
    color: colors.accent,
    letterSpacing: 0.6
  }
});
