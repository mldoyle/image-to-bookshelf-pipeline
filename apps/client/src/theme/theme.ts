import { colors } from "./colors";
import {
  avatarSizes,
  controlHeights,
  fontFamilies,
  lineHeights,
  radius,
  shadows,
  spacing,
  statusTokens,
  typography
} from "./tokens";

export const appTheme = {
  colors,
  spacing,
  radius,
  typography,
  lineHeights,
  fontFamilies,
  controlHeights,
  avatarSizes,
  statusTokens,
  shadows
} as const;

export type AppTheme = typeof appTheme;
