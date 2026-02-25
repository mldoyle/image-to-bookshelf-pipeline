import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

type PulsingLoaderProps = {
  size?: number;
  color?: string;
  durationMs?: number;
  ringOnly?: boolean;
};

export function PulsingLoader({
  size = 16,
  color = "#D4A574",
  durationMs = 1000,
  ringOnly = false
}: PulsingLoaderProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: Math.round(durationMs * 0.6),
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: Math.round(durationMs * 0.4),
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        })
      ])
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [durationMs, pulse]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1.25]
  });

  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0]
  });

  const dotOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 0.5]
  });

  const dotScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1]
  });

  const dotSize = useMemo(() => Math.max(4, size * 0.42), [size]);
  const dotRadius = dotSize / 2;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }]
          }
        ]}
      />
      {!ringOnly ? (
        <Animated.View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotRadius,
              backgroundColor: color,
              opacity: dotOpacity,
              transform: [{ scale: dotScale }]
            }
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center"
  },
  ring: {
    position: "absolute",
    borderWidth: 1
  },
  dot: {
    position: "absolute"
  }
});
