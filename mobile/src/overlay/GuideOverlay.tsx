import Svg, { Rect } from "react-native-svg";

type GuideOverlayProps = {
  width: number;
  height: number;
  isLandscape: boolean;
};

export function GuideOverlay({
  width,
  height,
  isLandscape
}: GuideOverlayProps) {
  if (width <= 0 || height <= 0) {
    return null;
  }

  const frameWidth = width * (isLandscape ? 0.84 : 0.72);
  const frameHeight = height * (isLandscape ? 0.62 : 0.68);
  const frameX = (width - frameWidth) / 2;
  const frameY = (height - frameHeight) / 2;

  return (
    <Svg
      width={width}
      height={height}
      style={{ position: "absolute", top: 0, left: 0 }}
      pointerEvents="none"
    >
      <Rect
        x={frameX}
        y={frameY}
        width={frameWidth}
        height={frameHeight}
        rx={14}
        ry={14}
        stroke="#FFFFFF"
        strokeWidth={2}
        fill="transparent"
      />
    </Svg>
  );
}
