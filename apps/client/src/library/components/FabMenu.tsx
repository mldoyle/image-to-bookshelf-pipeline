import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { radius, spacing } from "../../theme/tokens";

type FabMenuProps = {
  onSearchPress: () => void;
  onCameraPress: () => void;
};

export function FabMenu({ onSearchPress, onCameraPress }: FabMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      {open ? (
        <View style={styles.menu}>
          <Pressable
            style={styles.menuAction}
            onPress={() => {
              setOpen(false);
              onSearchPress();
            }}
          >
            <Text style={styles.menuActionText}>Search</Text>
          </Pressable>
          <Pressable
            style={styles.menuAction}
            onPress={() => {
              setOpen(false);
              onCameraPress();
            }}
          >
            <Text style={styles.menuActionText}>Camera</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable style={[styles.fab, open && styles.fabOpen]} onPress={() => setOpen((value) => !value)}>
        <Text style={styles.fabGlyph}>{open ? "×" : "+"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: spacing.xl,
    alignItems: "center"
  },
  menu: {
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.white,
    overflow: "hidden"
  },
  menuAction: {
    minWidth: 140,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg
  },
  menuActionText: {
    color: colors.background,
    textAlign: "center",
    fontWeight: "700"
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white
  },
  fabOpen: {
    backgroundColor: colors.white,
    borderColor: colors.white
  },
  fabGlyph: {
    color: colors.background,
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 34
  }
});
