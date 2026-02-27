import { describe, expect, it } from "vitest";

import { parseDetectionPayload } from "../src/parsing/detectorPayload";

describe("parseDetectionPayload", () => {
  it("parses xyxy arrays", () => {
    const parsed = parseDetectionPayload(
      {
        boxes: [[10, 20, 110, 220, 0.9]]
      },
      {
        frameWidth: 320,
        frameHeight: 240,
        frameTimestampMs: 123
      }
    );

    expect(parsed.payloadCandidateCount).toBe(1);
    expect(parsed.boxes).toHaveLength(1);
    expect(parsed.boxes[0]).toMatchObject({
      x: 10,
      y: 20,
      w: 100,
      h: 200,
      confidence: 0.9,
      timestampMs: 123
    });
  });

  it("parses normalized xywh objects", () => {
    const parsed = parseDetectionPayload(
      {
        detections: [{ x: 0.25, y: 0.1, w: 0.5, h: 0.6, confidence: 0.7 }]
      },
      {
        frameWidth: 200,
        frameHeight: 100,
        frameTimestampMs: 50
      }
    );

    expect(parsed.boxes).toHaveLength(1);
    expect(parsed.boxes[0]).toMatchObject({
      x: 50,
      y: 10,
      w: 100,
      h: 60,
      confidence: 0.7,
      timestampMs: 50
    });
  });

  it("drops invalid and tiny boxes", () => {
    const parsed = parseDetectionPayload(
      {
        boxes: [
          { x: 0.1, y: 0.2, w: 0.001, h: 0.001, confidence: 1 },
          { x: 10, y: 20, w: 10, h: 10, confidence: 1 }
        ]
      },
      {
        frameWidth: 200,
        frameHeight: 100,
        frameTimestampMs: 1,
        minBoxPixels: 2
      }
    );

    expect(parsed.payloadCandidateCount).toBe(2);
    expect(parsed.boxes).toHaveLength(1);
    expect(parsed.boxes[0].w).toBe(10);
  });
});
