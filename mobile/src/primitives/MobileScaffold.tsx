import { useState, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { AppText } from "./AppText";
import { colors } from "../theme/colors";
import { fontFamilies, spacing } from "../theme/tokens";

export type MainTabKey = "home" | "library" | "loans" | "profile";

type MobileScaffoldProps = {
  activeTab: MainTabKey;
  onTabPress: (tab: MainTabKey) => void;
  onSearchPress: () => void;
  onCameraPress: () => void;
  cameraEnabled?: boolean;
  onBellPress: () => void;
  onAvatarPress: () => void;
  onSettingsPress: () => void;
  onLogoutPress?: () => void;
  children: ReactNode;
};

const tabs: Array<{ key: MainTabKey; label: string }> = [
  { key: "home", label: "HOME" },
  { key: "library", label: "LIBRARY" },
  { key: "loans", label: "LOANS" },
  { key: "profile", label: "PROFILE" }
];

const TOP_SAFE_INSET = Platform.select({ ios: 44, android: 0, default: 0 }) ?? 0;

export function MobileScaffold({
  activeTab,
  onTabPress,
  onSearchPress,
  onCameraPress,
  cameraEnabled = true,
  onBellPress,
  onAvatarPress,
  onSettingsPress,
  onLogoutPress,
  children
}: MobileScaffoldProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
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

      <View style={styles.topBar}>
        <Pressable
          style={styles.brand}
          onPress={() => {
            setAddMenuOpen(false);
            setProfileMenuOpen(false);
            onTabPress("home");
          }}
        >
          <ShelfIcon color={colors.accent} />
          <AppText variant="h3" tone="primary" style={styles.brandTitle}>
            Shelf
          </AppText>
        </Pressable>

        <View style={styles.topActions}>
          <Pressable style={styles.bellButton} onPress={onBellPress}>
            <BellIcon color={colors.textMuted} />
            <View style={styles.bellDot} />
          </Pressable>
          <View style={styles.profileMenuWrap}>
            <Pressable
              style={[styles.avatarButton, profileMenuOpen && styles.avatarButtonOpen]}
              onPress={() => setProfileMenuOpen((open) => !open)}
            >
              <AppText variant="caption" tone="primary" style={styles.avatarText}>
                JD
              </AppText>
            </Pressable>

            {profileMenuOpen ? (
              <SurfaceMenu>
                <View style={styles.profileMenuHeader}>
                  <AppText variant="body">Jordan Diaz</AppText>
                  <AppText variant="bodySm" tone="muted">
                    jordan@shelf.app
                  </AppText>
                </View>
                <Pressable
                  style={styles.profileMenuItem}
                  onPress={() => {
                    setProfileMenuOpen(false);
                    onAvatarPress();
                  }}
                >
                  <AppText variant="body">Account</AppText>
                </Pressable>
                <Pressable
                  style={styles.profileMenuItem}
                  onPress={() => {
                    setProfileMenuOpen(false);
                    onSettingsPress();
                  }}
                >
                  <AppText variant="body">Settings</AppText>
                </Pressable>
                <Pressable
                  style={styles.profileMenuItem}
                  onPress={() => {
                    setProfileMenuOpen(false);
                    onLogoutPress?.();
                  }}
                >
                  <AppText variant="body" tone="danger">
                    Log out
                  </AppText>
                </Pressable>
              </SurfaceMenu>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.content}>{children}</View>

      <View style={styles.bottomWrap}>
        <View style={styles.bottomBar}>
          {tabs.slice(0, 2).map((tab) => (
            <TabItem
              key={tab.key}
              tab={tab.key}
              label={tab.label}
              activeTab={activeTab}
              onPress={(nextTab) => {
                setAddMenuOpen(false);
                setProfileMenuOpen(false);
                onTabPress(nextTab);
              }}
            />
          ))}
          <View style={styles.addSpacer} />
          {tabs.slice(2).map((tab) => (
            <TabItem
              key={tab.key}
              tab={tab.key}
              label={tab.label}
              activeTab={activeTab}
              onPress={(nextTab) => {
                setAddMenuOpen(false);
                setProfileMenuOpen(false);
                onTabPress(nextTab);
              }}
            />
          ))}
        </View>

        {addMenuOpen ? (
          <View style={[styles.quickActionsRow, !cameraEnabled && styles.quickActionsRowSingle]}>
            <QuickActionButton
              label="SEARCH"
              onPress={() => {
                setAddMenuOpen(false);
                setProfileMenuOpen(false);
                onSearchPress();
              }}
              icon={<SearchActionIcon color={colors.background} />}
            />
            {cameraEnabled ? (
              <QuickActionButton
                label="SCAN"
                onPress={() => {
                  setAddMenuOpen(false);
                  setProfileMenuOpen(false);
                  onCameraPress();
                }}
                icon={<ScanActionIcon color={colors.background} />}
              />
            ) : null}
          </View>
        ) : null}

        <Pressable
          style={[styles.addButton, addMenuOpen && styles.addButtonOpen]}
          onPress={() => {
            setProfileMenuOpen(false);
            setAddMenuOpen((open) => !open);
          }}
        >
          <PlusIcon color={addMenuOpen ? colors.textPrimary : colors.background} open={addMenuOpen} />
        </Pressable>
        <AppText variant="caption" tone="muted" style={styles.addLabel}>
          ADD
        </AppText>
      </View>
    </View>
  );
}

function SurfaceMenu({ children }: { children: ReactNode }) {
  return <View style={styles.profileMenu}>{children}</View>;
}

function GlowBackdrop() {
  return (
    <View pointerEvents="none" style={styles.glowCanvas}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="warmGlowCore" cx="50%" cy="118%" r="72%">
            <Stop offset="0%" stopColor="#FFBD48" stopOpacity={0.34} />
            <Stop offset="24%" stopColor="#FFC86E" stopOpacity={0.24} />
            <Stop offset="54%" stopColor="#E1AA64" stopOpacity={0.14} />
            <Stop offset="100%" stopColor="#C88C46" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="warmGlowFalloff" cx="50%" cy="126%" r="90%">
            <Stop offset="0%" stopColor="#FFCE84" stopOpacity={0.12} />
            <Stop offset="50%" stopColor="#B88145" stopOpacity={0.05} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#warmGlowCore)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#warmGlowFalloff)" />
      </Svg>
    </View>
  );
}

type TabItemProps = {
  tab: MainTabKey;
  label: string;
  activeTab: MainTabKey;
  onPress: (tab: MainTabKey) => void;
};

function TabItem({ tab, label, activeTab, onPress }: TabItemProps) {
  const active = activeTab === tab;
  const color = active ? colors.accent : colors.textMuted;

  return (
    <Pressable style={styles.tabItem} onPress={() => onPress(tab)}>
      {tab === "home" ? <HomeIcon color={color} /> : null}
      {tab === "library" ? <LibraryIcon color={color} /> : null}
      {tab === "loans" ? <LoansIcon color={color} /> : null}
      {tab === "profile" ? <ProfileIcon color={color} /> : null}
      <AppText variant="caption" style={[styles.tabLabel, { color }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

function ShelfIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} fill="none" viewBox="0 0 24 24">
      <Path d="M4 5.5c0-1.1.9-2 2-2h5v15H6a2 2 0 0 0-2 2v-15Z" stroke={color} strokeWidth={1.8} />
      <Path d="M20 5.5c0-1.1-.9-2-2-2h-5v15h5a2 2 0 0 1 2 2v-15Z" stroke={color} strokeWidth={1.8} />
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

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} fill="none" viewBox="0 0 24 24">
      <Path
        d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function LibraryIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} fill="none" viewBox="0 0 24 24">
      <Path d="M6 5v14M11 4v16M16 6v12M20 5v14" stroke={color} strokeLinecap="round" strokeWidth={1.8} />
    </Svg>
  );
}

function LoansIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} fill="none" viewBox="0 0 24 24">
      <Path d="M7 7h12m0 0-3-3m3 3-3 3M17 17H5m0 0 3-3m-3 3 3 3" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
    </Svg>
  );
}

function ProfileIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} fill="none" viewBox="0 0 24 24">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={1.8} />
      <Path d="M4 20c1.8-3.2 4.2-4.8 8-4.8S18.2 16.8 20 20" stroke={color} strokeLinecap="round" strokeWidth={1.8} />
    </Svg>
  );
}

function PlusIcon({ color, open }: { color: string; open: boolean }) {
  return (
    <Svg width={26} height={26} fill="none" viewBox="0 0 24 24">
      {open ? (
        <Path d="m6 6 12 12M18 6 6 18" stroke={color} strokeLinecap="round" strokeWidth={2.2} />
      ) : (
        <Path d="M12 5v14M5 12h14" stroke={color} strokeLinecap="round" strokeWidth={2} />
      )}
    </Svg>
  );
}

function SearchActionIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} fill="none" viewBox="0 0 24 24">
      <Circle cx={11} cy={11} r={6.5} stroke={color} strokeWidth={1.8} />
      <Path d="m16 16 4 4" stroke={color} strokeLinecap="round" strokeWidth={1.8} />
    </Svg>
  );
}

function ScanActionIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} fill="none" viewBox="0 0 24 24">
      <Rect x={4} y={5} width={16} height={14} rx={2.4} stroke={color} strokeWidth={1.8} />
      <Circle cx={12} cy={12} r={3.2} stroke={color} strokeWidth={1.8} />
      <Path d="M8 5.5 9.8 3h4.4L16 5.5" stroke={color} strokeLinecap="round" strokeWidth={1.8} />
    </Svg>
  );
}

type QuickActionButtonProps = {
  label: string;
  icon: ReactNode;
  onPress: () => void;
};

function QuickActionButton({ label, icon, onPress }: QuickActionButtonProps) {
  return (
    <Pressable style={styles.quickActionWrap} onPress={onPress}>
      <View style={styles.quickActionCircle}>{icon}</View>
      <AppText variant="caption" tone="primary" style={styles.quickActionLabel}>
        {label}
      </AppText>
    </Pressable>
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
  topBar: {
    height: 59 + TOP_SAFE_INSET,
    paddingTop: TOP_SAFE_INSET,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,165,116,0.09)",
    backgroundColor: "#141722",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    zIndex: 20
  },
  menuScrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 18
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  brandTitle: {
    fontFamily: fontFamilies.serifBold
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  profileMenuWrap: {
    position: "relative",
    zIndex: 25
  },
  bellButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center"
  },
  bellDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: colors.accent,
    right: 5,
    top: 4
  },
  avatarButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.3)",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarButtonOpen: {
    borderColor: colors.accent
  },
  avatarText: {
    fontSize: 9,
    letterSpacing: 0.4
  },
  profileMenu: {
    position: "absolute",
    right: 0,
    top: 38,
    minWidth: 190,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.2)",
    backgroundColor: "#202739",
    overflow: "hidden",
    shadowColor: colors.black,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 12
  },
  profileMenuHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,165,116,0.14)",
    gap: 2
  },
  profileMenuItem: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    alignItems: "flex-start",
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(212,165,116,0.14)"
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xl,
    paddingBottom: 76
  },
  bottomWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 82,
    alignItems: "center"
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#101525",
    borderTopWidth: 1,
    borderColor: "rgba(212,165,116,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8
  },
  tabItem: {
    width: 62,
    alignItems: "center",
    gap: 3
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.5
  },
  addSpacer: {
    width: 64
  },
  addButton: {
    position: "absolute",
    top: 0,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.8)",
    shadowColor: colors.black,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 6
  },
  addButtonOpen: {
    backgroundColor: "#5A5A5A",
    borderColor: "rgba(0,0,0,0.22)"
  },
  addLabel: {
    position: "absolute",
    bottom: 8,
    letterSpacing: 0.5
  },
  quickActionsRow: {
    position: "absolute",
    bottom: 56,
    width: 170,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  quickActionsRowSingle: {
    width: 86,
    justifyContent: "center"
  },
  quickActionWrap: {
    alignItems: "center",
    gap: 6
  },
  quickActionCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.8)",
    alignItems: "center",
    justifyContent: "center"
  },
  quickActionLabel: {
    fontSize: 10,
    letterSpacing: 0.4
  }
});
