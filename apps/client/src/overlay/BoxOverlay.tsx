import React from "react";
import Svg, { Rect, Text as SvgText } from "react-native-svg";

type OverlayBox = {
  trackId: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

type BoxOverlayProps = {
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  boxes: OverlayBox[];
  bestTrackId: number | null;
  ready: boolean;
  mostlyReady: boolean;
};

const getColor = (
  boxTrackId: number,
  bestTrackId: number | null,
  ready: boolean,
  mostlyReady: boolean
): string => {
  if (bestTrackId !== null && boxTrackId === bestTrackId) {
    if (ready) {
      return "#22c55e";
    }
    if (mostlyReady) {
      return "#84cc16";
    }
  }
  return "#f59e0b";
};

export function BoxOverlay({
  width,
  height,
  frameWidth,
  frameHeight,
  boxes,
  bestTrackId,
  ready,
  mostlyReady
}: BoxOverlayProps) {
  if (width <= 0 || height <= 0 || frameWidth <= 0 || frameHeight <= 0) {
    return null;
  }

  const scaleX = width / frameWidth;
  const scaleY = height / frameHeight;

  return (
    <Svg
      width={width}
      height={height}
      style={{ position: "absolute", top: 0, left: 0 }}
      pointerEvents="none"
    >
      {boxes.map((box) => {
        const x = box.x * scaleX;
        const y = box.y * scaleY;
        const w = box.w * scaleX;
        const h = box.h * scaleY;
        const color = getColor(box.trackId, bestTrackId, ready, mostlyReady);

        return (
          <React.Fragment key={box.trackId}>
            <Rect
              x={x}
              y={y}
              width={w}
              height={h}
              stroke={color}
              strokeWidth={3}
              fill="transparent"
              rx={6}
              ry={6}
            />
            <SvgText
              x={x + 6}
              y={Math.max(16, y - 6)}
              fill={color}
              fontSize="14"
              fontWeight="700"
            >
              {`T${box.trackId}`}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
