import Svg, { Line } from "react-native-svg";

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
  const corner = Math.min(34, frameWidth * 0.12);
  const midY = frameY + frameHeight / 2;

  return (
    <Svg
      width={width}
      height={height}
      style={{ position: "absolute", top: 0, left: 0 }}
      pointerEvents="none"
    >
      <Line x1={frameX} y1={frameY} x2={frameX + corner} y2={frameY} stroke="#D4A574" strokeWidth={1.4} />
      <Line x1={frameX} y1={frameY} x2={frameX} y2={frameY + corner} stroke="#D4A574" strokeWidth={1.4} />

      <Line
        x1={frameX + frameWidth - corner}
        y1={frameY}
        x2={frameX + frameWidth}
        y2={frameY}
        stroke="#D4A574"
        strokeWidth={1.4}
      />
      <Line
        x1={frameX + frameWidth}
        y1={frameY}
        x2={frameX + frameWidth}
        y2={frameY + corner}
        stroke="#D4A574"
        strokeWidth={1.4}
      />

      <Line
        x1={frameX}
        y1={frameY + frameHeight}
        x2={frameX + corner}
        y2={frameY + frameHeight}
        stroke="#D4A574"
        strokeWidth={1.4}
      />
      <Line
        x1={frameX}
        y1={frameY + frameHeight - corner}
        x2={frameX}
        y2={frameY + frameHeight}
        stroke="#D4A574"
        strokeWidth={1.4}
      />

      <Line
        x1={frameX + frameWidth - corner}
        y1={frameY + frameHeight}
        x2={frameX + frameWidth}
        y2={frameY + frameHeight}
        stroke="#D4A574"
        strokeWidth={1.4}
      />
      <Line
        x1={frameX + frameWidth}
        y1={frameY + frameHeight - corner}
        x2={frameX + frameWidth}
        y2={frameY + frameHeight}
        stroke="#D4A574"
        strokeWidth={1.4}
      />

      <Line
        x1={frameX}
        y1={midY}
        x2={frameX + frameWidth}
        y2={midY}
        stroke="rgba(212,165,116,0.7)"
        strokeWidth={1}
      />
    </Svg>
  );
}
