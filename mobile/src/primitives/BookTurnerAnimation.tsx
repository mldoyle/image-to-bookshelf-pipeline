import LottieView from "lottie-react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";

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
      <LottieView
        source={require("../../assets/animations/book-turner.json")}
        autoPlay
        loop={loop}
        speed={speed}
        style={styles.animation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center"
  },
  animation: {
    width: "100%",
    height: "100%"
  }
});
