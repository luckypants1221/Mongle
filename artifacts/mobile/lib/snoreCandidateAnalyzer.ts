/** 음량 기반 소리 이벤트 탐지. 코골이/기침/말소리를 분류하지 않는다. 시간 단위는 초. */
export type LevelSample = { t: number; db: number };
export type SoundEvent = { start: number; end: number };
export type SoundAnalysis = { count: number | null; events: SoundEvent[] };
export type SnoreAnalysisStatus = "complete" | "partial" | "unavailable";
export type SnoreResult = { count: number | null; status: SnoreAnalysisStatus };

export class SoundEventCounter {
  private calibration: number[] = [];
  private firstTime: number | null = null;
  private lastTime = -1;
  private threshold: number | null = null;
  private start: number | null = null;
  private lastLoud = 0;
  private incomplete = false;
  private events: SoundEvent[] = [];

  get ready() { return this.threshold !== null; }
  get count() { return this.ready ? this.events.length : null; }
  get partial() { return this.incomplete; }

  markGap() {
    this.incomplete = true;
    this.start = null; // 관측하지 못한 구간을 연결해 세지 않는다.
  }

  private close() {
    if (this.start !== null) {
      const duration = this.lastLoud - this.start;
      if (duration >= 0.5 && duration <= 8) {
        this.events.push({ start: this.start, end: this.lastLoud });
      }
    }
    this.start = null;
  }

  add({ t, db }: LevelSample) {
    if (!Number.isFinite(t) || !Number.isFinite(db) || t < 0 || db < -160 || db > 0 || t <= this.lastTime) return;
    if (this.lastTime >= 0 && t - this.lastTime > 2) this.markGap();
    this.lastTime = t;
    if (this.firstTime === null) this.firstTime = t;
    // 시작 후 3초 동안 주변 소음을 측정한다. 이 구간은 횟수에서 제외한다.
    if (this.threshold === null) {
      this.calibration.push(db);
      if (t - this.firstTime >= 3 && this.calibration.length >= 10) {
        const sorted = [...this.calibration].sort((a, b) => a - b);
        this.threshold = Math.min(-12, Math.max(-55, sorted[Math.floor(sorted.length * 0.2)] + 12));
        this.calibration = [];
      }
      return;
    }
    const threshold = this.start === null ? this.threshold : this.threshold - 4;
    if (db >= threshold) {
      if (this.start === null) this.start = t;
      this.lastLoud = t;
    } else if (this.start !== null && t - this.lastLoud >= 0.8) {
      this.close();
    }
  }

  finish(): SoundAnalysis {
    this.close();
    return { count: this.count, events: [...this.events] };
  }
}

export function analyzeSoundEvents(samples: LevelSample[]): SoundAnalysis {
  const counter = new SoundEventCounter();
  for (const sample of [...samples].sort((a, b) => a.t - b.t)) counter.add(sample);
  return counter.finish();
}

/** 서버는 integer 필수. 미분석 상태는 별도 로컬 메타데이터로 보존한다. */
export function snoringCountForApi(count: number | null | undefined): number {
  return typeof count === "number" && Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
}

export function formatSnoreCount(count: number | null | undefined, status?: SnoreAnalysisStatus): string {
  if (count == null || status === "unavailable") return "분석 기록 없음";
  return `${count}회${status === "partial" ? " (일부 구간)" : ""}`;
}
