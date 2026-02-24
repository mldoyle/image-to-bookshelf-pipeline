import { colors } from "./colors";

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
} as const;

export const radius = {
  xs: 2,
  sm: 3,
  md: 3,
  lg: 6,
  xl: 12,
  pill: 999
} as const;

export const typography = {
  display: 36,
  title: 32,
  h2: 24,
  h3: 18,
  body: 16,
  bodySm: 14,
  caption: 12,
  label: 13,
  chip: 11
} as const;

export const lineHeights = {
  display: 42,
  title: 36,
  h2: 30,
  h3: 24,
  body: 26,
  bodySm: 22,
  caption: 16,
  label: 16,
  chip: 13
} as const;

export const fontFamilies = {
  serifRegular: "SourceSerif4-Regular",
  serifSemiBold: "SourceSerif4-SemiBold",
  serifBold: "SourceSerif4-Bold",
  sansRegular: "Raleway-Regular",
  sansMedium: "Raleway-Medium",
  sansBold: "Raleway-Bold"
} as const;

export const controlHeights = {
  input: 46,
  textarea: 118,
  buttonSm: 38,
  buttonMd: 46,
  buttonLg: 52,
  chip: 30,
  chipGenre: 34,
  chipLending: 38,
  menuItem: 40,
  listRow: 72,
  activityRow: 74
} as const;

export const avatarSizes = {
  sm: 32,
  md: 40,
  lg: 56
} as const;

export const statusTokens = {
  reading: {
    background: "#D4A574",
    text: "#1A1E2A",
    border: "transparent"
  },
  wantToRead: {
    background: "#ECDDAE",
    text: "#1A1E2A",
    border: "transparent"
  },
  read: {
    background: "#2E3448",
    text: "#F5EDE0",
    border: "transparent"
  },
  abandoned: {
    background: "#232838",
    text: "#8E95A8",
    border: "rgba(212,165,116,0.18)"
  },
  overdue: {
    background: "#C45B5B",
    text: "#FFFFFF",
    border: "transparent"
  },
  available: {
    background: "#232838",
    text: "#F5EDE0",
    dot: "#D4A574",
    border: "rgba(212,165,116,0.18)"
  },
  lent: {
    background: "#232838",
    text: "#F5EDE0",
    dot: "#D4A574",
    border: "rgba(212,165,116,0.18)"
  },
  requested: {
    background: "#232838",
    text: "#F5EDE0",
    dot: "#8B6650",
    border: "rgba(212,165,116,0.18)"
  }
} as const;

export const shadows = {
  card: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 4
  },
  menu: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  }
} as const;
