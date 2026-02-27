import { toByteArray } from "base64-js";
import { decode as decodeJpeg } from "jpeg-js";

export type GuideBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type GuideDetectionResult = {
  frameWidth: number;
  frameHeight: number;
  box: GuideBox | null;
  score: number;
  reason: string;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const smooth = (values: Float32Array, radius: number): Float32Array => {
  if (radius <= 0) {
    return values;
  }

  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    let sum = 0;
    let count = 0;
    const start = Math.max(0, i - radius);
    const end = Math.min(values.length - 1, i + radius);

    for (let j = start; j <= end; j += 1) {
      sum += values[j];
      count += 1;
    }

    out[i] = count > 0 ? sum / count : values[i];
  }
  return out;
};

const mean = (values: Float32Array): number => {
  if (values.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
  }
  return sum / values.length;
};

const buildLuminanceGrid = (
  rgba: Uint8Array,
  width: number,
  height: number
): { luminance: Float32Array; gridWidth: number; gridHeight: number } => {
  const targetWidth = clamp(Math.round(width / 10), 90, 180);
  const scale = targetWidth / width;
  const targetHeight = clamp(Math.round(height * scale), 90, 220);

  const luminance = new Float32Array(targetWidth * targetHeight);
  const stepX = width / targetWidth;
  const stepY = height / targetHeight;

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor(y * stepY));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor(x * stepX));
      const sourceOffset = (sourceY * width + sourceX) * 4;
      const r = rgba[sourceOffset];
      const g = rgba[sourceOffset + 1];
      const b = rgba[sourceOffset + 2];
      luminance[y * targetWidth + x] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }

  return {
    luminance,
    gridWidth: targetWidth,
    gridHeight: targetHeight
  };
};

const detectShelfBand = (
  luminance: Float32Array,
  gridWidth: number,
  gridHeight: number
): { yStart: number; yEnd: number; strength: number } | null => {
  if (gridWidth < 4 || gridHeight < 4) {
    return null;
  }

  const rowEnergy = new Float32Array(gridHeight);
  for (let y = 0; y < gridHeight; y += 1) {
    let energy = 0;
    for (let x = 0; x < gridWidth - 1; x += 1) {
      const idx = y * gridWidth + x;
      energy += Math.abs(luminance[idx + 1] - luminance[idx]);
    }
    rowEnergy[y] = energy;
  }

  const smoothed = smooth(rowEnergy, 2);
  const base = Math.max(1, mean(smoothed));
  const threshold = base * 1.12;
  const minBandHeight = Math.max(6, Math.floor(gridHeight * 0.12));

  let best: { yStart: number; yEnd: number; strength: number } | null = null;
  let segmentStart = -1;

  for (let y = 0; y <= gridHeight; y += 1) {
    const active = y < gridHeight && smoothed[y] >= threshold;
    if (active && segmentStart < 0) {
      segmentStart = y;
      continue;
    }

    if (active || segmentStart < 0) {
      continue;
    }

    const segmentEnd = y - 1;
    const segmentHeight = segmentEnd - segmentStart + 1;
    if (segmentHeight >= minBandHeight) {
      let segmentSum = 0;
      for (let i = segmentStart; i <= segmentEnd; i += 1) {
        segmentSum += smoothed[i];
      }
      const avg = segmentSum / segmentHeight;
      const strength = avg * segmentHeight;
      if (!best || strength > best.strength) {
        best = {
          yStart: segmentStart,
          yEnd: segmentEnd,
          strength
        };
      }
    }

    segmentStart = -1;
  }

  return best;
};

const detectShelfSpan = (
  luminance: Float32Array,
  gridWidth: number,
  yStart: number,
  yEnd: number
): { xStart: number; xEnd: number; strength: number } | null => {
  if (gridWidth < 4 || yEnd <= yStart) {
    return null;
  }

  const colEnergy = new Float32Array(gridWidth);
  for (let x = 0; x < gridWidth - 1; x += 1) {
    let energy = 0;
    for (let y = yStart; y <= yEnd; y += 1) {
      const idx = y * gridWidth + x;
      energy += Math.abs(luminance[idx + 1] - luminance[idx]);
    }
    colEnergy[x] = energy;
  }

  const smoothed = smooth(colEnergy, 2);
  const base = Math.max(1, mean(smoothed));
  const threshold = base * 1.05;

  let first = -1;
  let last = -1;
  let activeEnergy = 0;

  for (let x = 0; x < gridWidth; x += 1) {
    if (smoothed[x] < threshold) {
      continue;
    }

    if (first < 0) {
      first = x;
    }
    last = x;
    activeEnergy += smoothed[x];
  }

  if (first < 0 || last < 0) {
    return null;
  }

  const width = last - first + 1;
  const minWidth = Math.max(12, Math.floor(gridWidth * 0.22));
  if (width < minWidth) {
    return null;
  }

  return {
    xStart: first,
    xEnd: last,
    strength: activeEnergy
  };
};

export const estimateGuideBoxFromJpegBase64 = (
  rawBase64: string
): GuideDetectionResult | null => {
  if (!rawBase64) {
    return null;
  }

  try {
    const normalized = rawBase64.includes(",")
      ? rawBase64.slice(rawBase64.indexOf(",") + 1)
      : rawBase64;
    const bytes = toByteArray(normalized);
    const decoded = decodeJpeg(bytes, {
      useTArray: true,
      formatAsRGBA: true
    });

    const { width, height, data } = decoded;
    if (!width || !height || !data || data.length < width * height * 4) {
      return null;
    }

    const { luminance, gridWidth, gridHeight } = buildLuminanceGrid(
      data as Uint8Array,
      width,
      height
    );

    const band = detectShelfBand(luminance, gridWidth, gridHeight);
    if (!band) {
      return {
        frameWidth: width,
        frameHeight: height,
        box: null,
        score: 0,
        reason: "no_shelf_band"
      };
    }

    const span = detectShelfSpan(luminance, gridWidth, band.yStart, band.yEnd);
    if (!span) {
      return {
        frameWidth: width,
        frameHeight: height,
        box: null,
        score: 0,
        reason: "no_vertical_span"
      };
    }

    const xScale = width / gridWidth;
    const yScale = height / gridHeight;

    const rawX = span.xStart * xScale;
    const rawY = band.yStart * yScale;
    const rawW = (span.xEnd - span.xStart + 1) * xScale;
    const rawH = (band.yEnd - band.yStart + 1) * yScale;

    const paddingX = width * 0.03;
    const paddingY = height * 0.04;

    const x = clamp(rawX - paddingX, 0, width - 1);
    const y = clamp(rawY - paddingY, 0, height - 1);
    const w = clamp(rawW + paddingX * 2, 1, width - x);
    const h = clamp(rawH + paddingY * 2, 1, height - y);

    const bandStrength = clamp((band.strength / (gridHeight * 200)) * 0.7, 0, 1);
    const coverage = clamp(rawW / width, 0, 1);
    const heightRatio = clamp(rawH / height, 0, 1);
    const score = clamp(0.45 * bandStrength + 0.35 * coverage + 0.2 * heightRatio, 0, 1);

    return {
      frameWidth: width,
      frameHeight: height,
      box: { x, y, w, h },
      score,
      reason: score > 0.6 ? "strong" : "weak"
    };
  } catch {
    return null;
  }
};
