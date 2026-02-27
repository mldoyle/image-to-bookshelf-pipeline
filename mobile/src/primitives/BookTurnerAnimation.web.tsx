import type { StyleProp, ViewStyle } from "react-native";
import { ActivityIndicator, StyleSheet, View } from "react-native";

type BookTurnerAnimationProps = {
  size?: number;
  loop?: boolean;
  speed?: number;
  style?: StyleProp<ViewStyle>;
};

export function BookTurnerAnimation({
  size = 64,
  loop = true,
  speed = 1,
  style
}: BookTurnerAnimationProps) {
  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      <ActivityIndicator
        animating={loop}
        color="#D4A574"
        size={Math.max(16, Math.round((size * Math.max(speed, 0.5)) / 2))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center"
  }
});
