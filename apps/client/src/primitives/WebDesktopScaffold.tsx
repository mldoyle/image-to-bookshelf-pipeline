import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { AppText } from "./AppText";
import { colors } from "../theme/colors";
import { fontFamilies } from "../theme/tokens";
import type { MainTabKey } from "./MobileScaffold";

type WebDesktopScaffoldProps = {
  activeTab: MainTabKey;
  onTabPress: (tab: MainTabKey) => void;
  onSearchPress: () => void;
  onBellPress: () => void;
  onAvatarPress: () => void;
  onSettingsPress: () => void;
  onLogoutPress?: () => void;
  children: ReactNode;
};

const tabs: Array<{ key: MainTabKey; label: string }> = [
  { key: "home", label: "Home" },
  { key: "library", label: "Library" },
  { key: "loans", label: "Loans" },
  { key: "profile", label: "Profile" }
];

export function WebDesktopScaffold({
  activeTab,
  onTabPress,
  onSearchPress,
  onBellPress,
  onAvatarPress,
  onSettingsPress,
  onLogoutPress,
  children
}: WebDesktopScaffoldProps) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  return (
    <View style={styles.screen}>
      <GlowBackdrop />
      {profileMenuOpen ? (
        <Pressable
          style={styles.menuScrim}
          onPress={() => {
            setProfileMenuOpen(false);
          }}
        />
      ) : null}

      <View style={styles.navWrap}>
        <View style={styles.navBar}>
          <View style={styles.leftSide}>
            <Pressable
              style={styles.brand}
              onPress={() => {
                setProfileMenuOpen(false);
                onTabPress("home");
              }}
            >
              <ShelfIcon color={colors.accent} />
              <AppText variant="body" style={styles.brandLabel}>
                Shelf
              </AppText>
            </Pressable>

            <View style={styles.tabRow}>
              {tabs.map((tab) => {
                const active = tab.key === activeTab;
                return (
                  <Pressable
                    key={tab.key}
                    style={[styles.tabButton, active && styles.tabButtonActive]}
                    onPress={() => {
                      setProfileMenuOpen(false);
                      onTabPress(tab.key);
                    }}
                  >
                    <AppText variant="body" style={[styles.tabLabel, active && styles.tabLabelActive]}>
                      {tab.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.rightSide}>
            <View style={styles.searchWrap}>
              <SearchIcon color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search books..."
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={onSearchPress}
              />
            </View>

            <Pressable style={styles.bellButton} onPress={onBellPress}>
              <BellIcon color={colors.textMuted} />
              <View style={styles.bellDot} />
            </Pressable>

            <View style={styles.profileWrap}>
              <Pressable
                style={[styles.avatarButton, profileMenuOpen && styles.avatarButtonOpen]}
                onPress={() => setProfileMenuOpen((open) => !open)}
              >
                <AppText variant="caption" style={styles.avatarLabel}>
                  JD
                </AppText>
              </Pressable>

              {profileMenuOpen ? (
                <View style={styles.profileMenu}>
                  <View style={styles.profileHeader}>
                    <AppText variant="body">Jordan Diaz</AppText>
                    <AppText variant="caption" tone="muted">
                      jordan@shelf.app
                    </AppText>
                  </View>

                  <Pressable
                    style={styles.profileItem}
                    onPress={() => {
                      setProfileMenuOpen(false);
                      onAvatarPress();
                    }}
                  >
                    <AccountIcon color={colors.textMuted} />
                    <AppText variant="body">Account</AppText>
                  </Pressable>

                  <Pressable
                    style={styles.profileItem}
                    onPress={() => {
                      setProfileMenuOpen(false);
                      onSettingsPress();
                    }}
                  >
                    <SettingsIcon color={colors.textMuted} />
                    <AppText variant="body">Settings</AppText>
                  </Pressable>

                  <Pressable
                    style={styles.profileItem}
                    onPress={() => {
                      setProfileMenuOpen(false);
                      onLogoutPress?.();
                    }}
                  >
                    <LogoutIcon color={colors.danger} />
                    <AppText variant="body" tone="danger">
                      Log out
                    </AppText>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.contentWrap}>{children}</View>
    </View>
  );
}

function GlowBackdrop() {
  return (
    <View pointerEvents="none" style={styles.glowCanvas}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="desktopWarmGlowCore" cx="50%" cy="130%" r="72%">
            <Stop offset="0%" stopColor="#FFBD48" stopOpacity={0.34} />
            <Stop offset="24%" stopColor="#FFC86E" stopOpacity={0.24} />
            <Stop offset="54%" stopColor="#E1AA64" stopOpacity={0.14} />
            <Stop offset="100%" stopColor="#C88C46" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="desktopWarmGlowFalloff" cx="50%" cy="140%" r="90%">
            <Stop offset="0%" stopColor="#FFCE84" stopOpacity={0.12} />
            <Stop offset="50%" stopColor="#B88145" stopOpacity={0.05} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#desktopWarmGlowCore)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#desktopWarmGlowFalloff)" />
      </Svg>
    </View>
  );
}

function ShelfIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} fill="none" viewBox="0 0 24 24">
      <Path d="M4 5.5c0-1.1.9-2 2-2h5v15H6a2 2 0 0 0-2 2v-15Z" stroke={color} strokeWidth={1.8} />
      <Path d="M20 5.5c0-1.1-.9-2-2-2h-5v15h5a2 2 0 0 1 2 2v-15Z" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} fill="none" viewBox="0 0 24 24">
      <Circle cx={11} cy={11} r={6.5} stroke={color} strokeWidth={1.8} />
      <Path d="m16 16 4 4" stroke={color} strokeLinecap="round" strokeWidth={1.8} />
    </Svg>
  );
}

function BellIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} fill="none" viewBox="0 0 24 24">
      <Path
        d="M6 9a6 6 0 1 1 12 0v4l2 2H4l2-2V9Zm4.5 9a1.5 1.5 0 0 0 3 0"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function AccountIcon({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} fill="none" viewBox="0 0 24 24">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={1.8} />
      <Path d="M4 20c1.8-3.2 4.2-4.8 8-4.8S18.2 16.8 20 20" stroke={color} strokeLinecap="round" strokeWidth={1.8} />
    </Svg>
  );
}

function SettingsIcon({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} fill="none" viewBox="0 0 24 24">
      <Path
        d="m10.2 2.8 1.6 0 1 2a7.8 7.8 0 0 1 1.8.7l2-.8 1.1 1.1-.8 2a7.8 7.8 0 0 1 .7 1.8l2 1 0 1.6-2 1a7.8 7.8 0 0 1-.7 1.8l.8 2-1.1 1.1-2-.8a7.8 7.8 0 0 1-1.8.7l-1 2-1.6 0-1-2a7.8 7.8 0 0 1-1.8-.7l-2 .8-1.1-1.1.8-2a7.8 7.8 0 0 1-.7-1.8l-2-1 0-1.6 2-1a7.8 7.8 0 0 1 .7-1.8l-.8-2 1.1-1.1 2 .8a7.8 7.8 0 0 1 1.8-.7l1-2Z"
        stroke={color}
        strokeWidth={1.4}
      />
      <Circle cx={12} cy={12} r={3.2} stroke={color} strokeWidth={1.4} />
    </Svg>
  );
}

function LogoutIcon({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} fill="none" viewBox="0 0 24 24">
      <Path d="M14 16 18 12 14 8" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
      <Path d="M6 12h11" stroke={color} strokeLinecap="round" strokeWidth={1.8} />
      <Path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5" stroke={color} strokeLinecap="round" strokeWidth={1.8} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  glowCanvas: {
    ...StyleSheet.absoluteFillObject
  },
  menuScrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20
  },
  navWrap: {
    height: 63,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,165,116,0.09)",
    backgroundColor: "#141722",
    zIndex: 30
  },
  navBar: {
    width: "100%",
    maxWidth: 1152,
    height: 62,
    marginHorizontal: "auto",
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  leftSide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 32
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  brandLabel: {
    fontFamily: fontFamilies.serifRegular,
    fontSize: 16,
    lineHeight: 24
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  tabButton: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center"
  },
  tabButtonActive: {
    backgroundColor: colors.accent
  },
  tabLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.sansRegular,
    fontSize: 16,
    lineHeight: 24
  },
  tabLabelActive: {
    color: colors.background
  },
  rightSide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  searchWrap: {
    width: 192,
    height: 38,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.18)",
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    paddingLeft: 10,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fontFamilies.sansRegular,
    fontSize: 14,
    lineHeight: 19,
    paddingVertical: 0,
    height: 19
  },
  bellButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center"
  },
  bellDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: colors.accent
  },
  profileWrap: {
    position: "relative"
  },
  avatarButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.3)",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarButtonOpen: {
    borderColor: colors.accent
  },
  avatarLabel: {
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.2
  },
  profileMenu: {
    position: "absolute",
    top: 44,
    right: 0,
    width: 176,
    backgroundColor: "#202739",
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.2)",
    borderRadius: 3,
    overflow: "hidden",
    shadowColor: colors.black,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 12,
    zIndex: 40
  },
  profileHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,165,116,0.14)",
    gap: 2
  },
  profileItem: {
    minHeight: 36,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,165,116,0.12)"
  },
  contentWrap: {
    flex: 1,
    width: "100%",
    maxWidth: 1104,
    marginHorizontal: "auto",
    paddingTop: 40,
    paddingBottom: 24
  }
});
