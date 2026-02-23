# Letterboxd-Inspired Tokens (MVP)

This file maps Figma-exported CSS tokens to React Native theme files.

## Canonical token sources

- Colors: `/Users/mattdoyle/Projects/image-to-bookshelf/mobile/src/theme/colors.ts`
- Shared tokens: `/Users/mattdoyle/Projects/image-to-bookshelf/mobile/src/theme/tokens.ts`
- Raw Figma CSS export: `/Users/mattdoyle/Projects/image-to-bookshelf/mobile/design/figma/letterboxd-tokens.css`

## Palette

- `background`: `#0f1a1d`
- `surface`: `#152329`
- `surfaceElevated`: `#1a2f36`
- `surfaceMuted`: `#203740`
- `textPrimary`: `#f4f8f9`
- `textSecondary`: `#aec2c8`
- `textMuted`: `#7d98a0`
- `accent`: `#38d9a9`
- `accentMuted`: `#1f8a72`
- `warning`: `#f59f00`
- `danger`: `#ff6b6b`
- `border`: `#28414b`

## Scale tokens

- Spacing: `4, 8, 12, 16, 24, 32`
- Radius: `8, 12, 16, 999`
- Type sizes: `28, 20, 17, 14, 12`

## Notes

- Tokens are intentionally flattened for React Native usage.
- Missing Figma exports can be added directly into `letterboxd-tokens.css` and reflected in TS token files.
