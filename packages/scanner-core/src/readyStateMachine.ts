import type { ReadyResult } from "./types";

export type ReadyStateConfig = {
  readyScoreThreshold: number;
  readyConsecutiveFrames: number;
  captureCooldownMs: number;
};

export const DEFAULT_READY_STATE_CONFIG: ReadyStateConfig = {
  readyScoreThreshold: 0.72,
  readyConsecutiveFrames: 10,
  captureCooldownMs: 1500
};

export type ReadyFrameInput = {
  timestampMs: number;
  score: number | null;
  reasons?: string[];
};

export type ReadyStateUpdate = ReadyResult & {
  triggered: boolean;
  consecutiveReadyFrames: number;
  cooldownRemainingMs: number;
};

export class ReadyStateMachine {
  private readonly config: ReadyStateConfig;
  private consecutiveReadyFrames = 0;
  private cooldownUntilMs = 0;
  private wasReadyLastFrame = false;

  constructor(config: Partial<ReadyStateConfig> = {}) {
    this.config = { ...DEFAULT_READY_STATE_CONFIG, ...config };
  }

  update(input: ReadyFrameInput): ReadyStateUpdate {
    const score = input.score ?? 0;
    const reasons = input.reasons ?? [];

    const frameIsReady = score >= this.config.readyScoreThreshold;
    if (frameIsReady) {
      this.consecutiveReadyFrames += 1;
    } else {
      this.consecutiveReadyFrames = 0;
    }

    const ready = this.consecutiveReadyFrames >= this.config.readyConsecutiveFrames;

    const inCooldown = input.timestampMs < this.cooldownUntilMs;
    const risingEdge = ready && !this.wasReadyLastFrame;
    const triggered = risingEdge && !inCooldown;

    if (triggered) {
      this.cooldownUntilMs = input.timestampMs + this.config.captureCooldownMs;
    }

    this.wasReadyLastFrame = ready;

    return {
      ready,
      score,
      reasons,
      triggered,
      consecutiveReadyFrames: this.consecutiveReadyFrames,
      cooldownRemainingMs: Math.max(0, this.cooldownUntilMs - input.timestampMs)
    };
  }

  updateFromCandidates(
    timestampMs: number,
    candidates: ReadyResult[]
  ): ReadyStateUpdate {
    if (candidates.length === 0) {
      return this.update({
        timestampMs,
        score: null,
        reasons: ["no_candidates"]
      });
    }

    const bestCandidate = candidates.reduce((best, candidate) =>
      candidate.score > best.score ? candidate : best
    );

    return this.update({
      timestampMs,
      score: bestCandidate.score,
      reasons: bestCandidate.reasons
    });
  }

  reset(): void {
    this.consecutiveReadyFrames = 0;
    this.cooldownUntilMs = 0;
    this.wasReadyLastFrame = false;
  }
}
