/**
 * heartRateCore.ts — 심박 샘플 → 한 시간 단위 집계 → 서버 JSON
 *
 * React Native / Health Connect 에 의존하지 않는 순수 로직이라 Node 에서도 테스트할 수 있다.
 * (안드로이드 Kotlin 버전 HeartRateAggregator / HeartRatePayload 와 같은 결과를 낸다)
 */

export interface HrSample {
  /** 측정 시각 (epoch ms) */
  timeMs: number;
  /** 심박 (bpm) */
  bpm: number;
}

export interface HourlyHeartRate {
  /** 시간대 시작 (epoch ms, 한국시간 정각) */
  hourStartMs: number;
  /** 평균 심박 (반올림 정수) */
  heartbeat: number;
  /** 심박 표준편차 (소수 1자리) -> AI 모델 heartbeat_std 입력 */
  heartbeatStd: number;
  hrMin: number;
  hrMax: number;
  sampleCount: number;
}

export const MIN_VALID_BPM = 30;
export const MAX_VALID_BPM = 220;

const HOUR_MS = 3_600_000;
/** 한국시간 = UTC+9 (서머타임 없음) */
const KST_OFFSET_MS = 9 * HOUR_MS;

/** epoch ms -> 한국시간 정각 시작 epoch ms */
export function kstHourStart(ms: number): number {
  return Math.floor((ms + KST_OFFSET_MS) / HOUR_MS) * HOUR_MS - KST_OFFSET_MS;
}

/** epoch ms -> "2026-10-12T05:00:00+09:00" */
export function toKstIso(ms: number): string {
  const shifted = new Date(Math.floor(ms / 1000) * 1000 + KST_OFFSET_MS);
  return shifted.toISOString().slice(0, 19) + '+09:00';
}

/** 반올림: Java Math.round 와 같게 (0.5 는 올림) */
function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

/**
 * 시간대별 평균/표준편차 계산
 * - 같은 시각·같은 값 중복 제거, 30~220bpm 밖의 값 제거
 * - 샘플이 minSamples 보다 적은 시간대는 제외 (신뢰도 낮음)
 */
export function aggregateHourly(samples: HrSample[], minSamples = 3): HourlyHeartRate[] {
  const seen = new Set<string>();
  const buckets = new Map<number, number[]>();

  for (const s of samples) {
    if (!Number.isFinite(s.bpm) || s.bpm < MIN_VALID_BPM || s.bpm > MAX_VALID_BPM) continue;
    const key = `${s.timeMs}:${s.bpm}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const h = kstHourStart(s.timeMs);
    const arr = buckets.get(h);
    if (arr) arr.push(s.bpm);
    else buckets.set(h, [s.bpm]);
  }

  const out: HourlyHeartRate[] = [];
  for (const h of [...buckets.keys()].sort((a, b) => a - b)) {
    const v = buckets.get(h)!;
    const n = v.length;
    if (n < minSamples) continue;
    const mean = v.reduce((a, b) => a + b, 0) / n;
    const variance = v.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n; // 모분산
    out.push({
      hourStartMs: h,
      heartbeat: roundHalfUp(mean),
      heartbeatStd: roundHalfUp(Math.sqrt(variance) * 10) / 10,
      hrMin: Math.min(...v),
      hrMax: Math.max(...v),
      sampleCount: n,
    });
  }
  return out;
}

export interface HeartRatePayload {
  id: string;
  source: 'galaxy_watch';
  sleep_start: string;
  sleep_end: string;
  records: {
    time_stamp: string;
    heartbeat: number;
    heartbeat_std: number;
    hr_min: number;
    hr_max: number;
    sample_count: number;
  }[];
}

/** 서버 POST /heartrate 로 보낼 본문 */
export function buildPayload(
  userId: string,
  sleepStartMs: number,
  sleepEndMs: number,
  hourly: HourlyHeartRate[],
): HeartRatePayload {
  return {
    id: userId,
    source: 'galaxy_watch',
    sleep_start: toKstIso(sleepStartMs),
    sleep_end: toKstIso(sleepEndMs),
    records: hourly.map((h) => ({
      time_stamp: toKstIso(h.hourStartMs),
      heartbeat: h.heartbeat,
      heartbeat_std: h.heartbeatStd,
      hr_min: h.hrMin,
      hr_max: h.hrMax,
      sample_count: h.sampleCount,
    })),
  };
}
