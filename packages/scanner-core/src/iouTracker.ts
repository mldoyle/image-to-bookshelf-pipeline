import type { DetectionBox, Track } from "./types";

export type IouTrackerConfig = {
  iouMatchThreshold: number;
  trackStaleMs: number;
};

export const DEFAULT_IOU_TRACKER_CONFIG: IouTrackerConfig = {
  iouMatchThreshold: 0.3,
  trackStaleMs: 400
};

export const intersectionOverUnion = (
  a: Pick<DetectionBox, "x" | "y" | "w" | "h">,
  b: Pick<DetectionBox, "x" | "y" | "w" | "h">
): number => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);

  const intersectionW = Math.max(0, x2 - x1);
  const intersectionH = Math.max(0, y2 - y1);
  const intersection = intersectionW * intersectionH;

  const areaA = Math.max(0, a.w) * Math.max(0, a.h);
  const areaB = Math.max(0, b.w) * Math.max(0, b.h);
  const union = areaA + areaB - intersection;

  if (union <= 0) {
    return 0;
  }

  return intersection / union;
};

const resolveFrameTimestamp = (
  detections: DetectionBox[],
  frameTimestampMs?: number
): number => {
  if (typeof frameTimestampMs === "number") {
    return frameTimestampMs;
  }

  if (detections.length === 0) {
    return Date.now();
  }

  return Math.max(...detections.map((detection) => detection.timestampMs));
};

export class IouTracker {
  private readonly config: IouTrackerConfig;
  private tracks: Track[] = [];
  private nextTrackId = 1;

  constructor(config: Partial<IouTrackerConfig> = {}) {
    this.config = { ...DEFAULT_IOU_TRACKER_CONFIG, ...config };
  }

  update(detections: DetectionBox[], frameTimestampMs?: number): Track[] {
    const currentTimeMs = resolveFrameTimestamp(detections, frameTimestampMs);

    this.tracks = this.tracks.filter(
      (track) => currentTimeMs - track.lastSeenMs < this.config.trackStaleMs
    );

    const matchedTrackIds = new Set<number>();

    for (const detection of detections) {
      let bestTrack: Track | null = null;
      let bestIou = -1;

      for (const track of this.tracks) {
        if (matchedTrackIds.has(track.trackId)) {
          continue;
        }

        const iou = intersectionOverUnion(track.box, detection);
        if (iou >= this.config.iouMatchThreshold && iou > bestIou) {
          bestIou = iou;
          bestTrack = track;
        }
      }

      if (bestTrack) {
        bestTrack.box = detection;
        bestTrack.lastSeenMs = currentTimeMs;
        bestTrack.stableFrames += 1;
        matchedTrackIds.add(bestTrack.trackId);
        continue;
      }

      const newTrack: Track = {
        trackId: this.nextTrackId,
        box: detection,
        stableFrames: 1,
        lastSeenMs: currentTimeMs
      };
      this.nextTrackId += 1;
      this.tracks.push(newTrack);
      matchedTrackIds.add(newTrack.trackId);
    }

    for (const track of this.tracks) {
      if (!matchedTrackIds.has(track.trackId)) {
        track.stableFrames = 0;
      }
    }

    return this.snapshot();
  }

  getTracks(): Track[] {
    return this.snapshot();
  }

  reset(): void {
    this.tracks = [];
    this.nextTrackId = 1;
  }

  private snapshot(): Track[] {
    return this.tracks
      .slice()
      .sort((a, b) => a.trackId - b.trackId)
      .map((track) => ({ ...track, box: { ...track.box } }));
  }
}
