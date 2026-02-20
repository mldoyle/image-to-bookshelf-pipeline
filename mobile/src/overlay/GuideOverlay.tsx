import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

type GuideBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type GuideOverlayProps = {
  width: number;
  height: number;
  isLandscape: boolean;
  detectedBox: GuideBox | null;
  detectionFrameWidth: number;
  detectionFrameHeight: number;
  detectionScore: number;
};

export function GuideOverlay({
  width,
  height,
  isLandscape,
  detectedBox,
  detectionFrameWidth,
  detectionFrameHeight,
  detectionScore
}: GuideOverlayProps) {
  if (width <= 0 || height <= 0) {
    return null;
  }

  const frameWidth = width * (isLandscape ? 0.84 : 0.72);
  const frameHeight = height * (isLandscape ? 0.62 : 0.68);
  const frameX = (width - frameWidth) / 2;
  const frameY = (height - frameHeight) / 2;
  const columnWidth = frameWidth / 3;

  const dynamicBoxVisible =
    detectedBox && detectionFrameWidth > 0 && detectionFrameHeight > 0;

  const xScale = dynamicBoxVisible ? width / detectionFrameWidth : 1;
  const yScale = dynamicBoxVisible ? height / detectionFrameHeight : 1;

  const dynamicColor = detectionScore >= 0.65 ? "#22c55e" : "#f59e0b";

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
        stroke={isLandscape ? "#22c55e" : "#f59e0b"}
        strokeWidth={3}
        fill="rgba(15,23,42,0.15)"
      />

      <Line
        x1={frameX + columnWidth}
        y1={frameY}
        x2={frameX + columnWidth}
        y2={frameY + frameHeight}
        stroke="#fbbf24"
        strokeWidth={2}
        strokeDasharray="8,8"
      />
      <Line
        x1={frameX + columnWidth * 2}
        y1={frameY}
        x2={frameX + columnWidth * 2}
        y2={frameY + frameHeight}
        stroke="#fbbf24"
        strokeWidth={2}
        strokeDasharray="8,8"
      />

      {dynamicBoxVisible && detectedBox ? (
        <Rect
          x={detectedBox.x * xScale}
          y={detectedBox.y * yScale}
          width={detectedBox.w * xScale}
          height={detectedBox.h * yScale}
          rx={12}
          ry={12}
          stroke={dynamicColor}
          strokeWidth={3}
          fill="transparent"
        />
      ) : null}

      <SvgText
        x={width / 2}
        y={Math.max(22, frameY - 12)}
        fill="#f8fafc"
        fontSize="14"
        fontWeight="700"
        textAnchor="middle"
      >
        {isLandscape ? "Align spines inside the guide" : "Rotate to capture more books"}
      </SvgText>
    </Svg>
  );
}
