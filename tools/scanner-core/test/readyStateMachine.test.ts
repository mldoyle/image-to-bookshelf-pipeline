import { describe, expect, it } from "vitest";
import { ReadyStateMachine } from "../src/readyStateMachine";

describe("ReadyStateMachine", () => {
  it("triggers once after score stays ready for required consecutive frames", () => {
    const machine = new ReadyStateMachine({
      readyScoreThreshold: 0.72,
      readyConsecutiveFrames: 10,
      captureCooldownMs: 1500
    });

    let triggerCount = 0;
    for (let i = 0; i < 12; i += 1) {
      const result = machine.update({
        timestampMs: i * 33,
        score: 0.9
      });
      if (result.triggered) {
        triggerCount += 1;
      }
    }

    expect(triggerCount).toBe(1);
  });

  it("resets consecutive count when score drops below threshold", () => {
    const machine = new ReadyStateMachine({
      readyScoreThreshold: 0.72,
      readyConsecutiveFrames: 3,
      captureCooldownMs: 1500
    });

    machine.update({ timestampMs: 0, score: 0.9 });
    machine.update({ timestampMs: 33, score: 0.9 });
    const dropped = machine.update({ timestampMs: 66, score: 0.5 });
    expect(dropped.consecutiveReadyFrames).toBe(0);
    expect(dropped.ready).toBe(false);
    expect(dropped.triggered).toBe(false);
  });

  it("fires only on rising edge and not every ready frame", () => {
    const machine = new ReadyStateMachine({
      readyScoreThreshold: 0.72,
      readyConsecutiveFrames: 2,
      captureCooldownMs: 1500
    });

    const f1 = machine.update({ timestampMs: 0, score: 0.9 });
    const f2 = machine.update({ timestampMs: 33, score: 0.9 });
    const f3 = machine.update({ timestampMs: 66, score: 0.9 });

    expect(f1.triggered).toBe(false);
    expect(f2.triggered).toBe(true);
    expect(f3.triggered).toBe(false);
  });

  it("honors cooldown for successive ready events", () => {
    const machine = new ReadyStateMachine({
      readyScoreThreshold: 0.72,
      readyConsecutiveFrames: 2,
      captureCooldownMs: 1500
    });

    machine.update({ timestampMs: 0, score: 0.9 });
    const firstTrigger = machine.update({ timestampMs: 33, score: 0.9 });
    expect(firstTrigger.triggered).toBe(true);

    machine.update({ timestampMs: 66, score: 0.1 });
    machine.update({ timestampMs: 99, score: 0.9 });
    const suppressed = machine.update({ timestampMs: 132, score: 0.9 });
    expect(suppressed.triggered).toBe(false);
    expect(suppressed.cooldownRemainingMs).toBeGreaterThan(0);

    machine.update({ timestampMs: 1700, score: 0.1 });
    machine.update({ timestampMs: 1733, score: 0.9 });
    const secondTrigger = machine.update({ timestampMs: 1766, score: 0.9 });
    expect(secondTrigger.triggered).toBe(true);
  });

  it("deterministic replay emits one trigger for one stable segment", () => {
    // TODO: Step 2/3 - add fixture-based replay from recorded frame streams.
    const machine = new ReadyStateMachine({
      readyScoreThreshold: 0.72,
      readyConsecutiveFrames: 4,
      captureCooldownMs: 1500
    });

    const replayScores = [
      0.4, 0.5, 0.65, 0.74, 0.78, 0.8, 0.82, 0.79, 0.77, 0.76, 0.73, 0.7, 0.69
    ];

    const triggerFrames: number[] = [];
    replayScores.forEach((score, idx) => {
      const result = machine.update({
        timestampMs: idx * 50,
        score
      });
      if (result.triggered) {
        triggerFrames.push(idx);
      }
    });

    expect(triggerFrames).toEqual([6]);
  });

  it("uses best candidate score each frame", () => {
    const machine = new ReadyStateMachine({
      readyScoreThreshold: 0.72,
      readyConsecutiveFrames: 2,
      captureCooldownMs: 1500
    });

    const frame1 = machine.updateFromCandidates(0, [
      { ready: false, score: 0.5, reasons: ["track_a_low"] },
      { ready: false, score: 0.9, reasons: [] }
    ]);
    const frame2 = machine.updateFromCandidates(33, [
      { ready: false, score: 0.6, reasons: ["track_a_low"] },
      { ready: false, score: 0.8, reasons: [] }
    ]);

    expect(frame1.triggered).toBe(false);
    expect(frame2.triggered).toBe(true);
    expect(frame2.score).toBe(0.8);
  });
});
