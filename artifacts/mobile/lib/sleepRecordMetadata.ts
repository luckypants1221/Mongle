import type { SleepRecord, SleepRatings } from "./api";

const PREFIX = "@mongle/sleep:v1:";
type MissingMetric = "temperature" | "humidity" | "snoringCount" | "score";
const METRICS: MissingMetric[] = ["temperature", "humidity", "snoringCount", "score"];

export function validSleepRatings(value: unknown): value is SleepRatings {
  if (!value || typeof value !== "object") return false;
  const ratings = value as SleepRatings;
  return [ratings.total, ratings.humidity, ratings.temperature].every(v => Number.isInteger(v) && v >= 1 && v <= 5);
}
function timestamp(value: unknown): string | undefined {
  return typeof value === "string" && value.includes("T") && Number.isFinite(Date.parse(value)) ? value : undefined;
}

// The deployed API has required integer metrics and no satisfaction columns.
// Keep availability, exact timestamps and ratings alongside the user's memo.
// Wire zeros for unavailable metrics MUST only be read with this metadata.
export function encodeSleepMemo(record: Omit<SleepRecord, "id">): string {
  const missing = METRICS.filter(key => key === "score" ? record.scoreAvailable === false : record[key] === undefined);
  return PREFIX + JSON.stringify({
    text: record.memo ?? "", missing,
    startAt: record.startAt, endAt: record.endAt,
    ratings: validSleepRatings(record.ratings) ? record.ratings : undefined,
  });
}

export function decodeSleepMemo(value: unknown): {
  memo: string; missing: MissingMetric[]; startAt?: string; endAt?: string; ratings?: SleepRatings;
} {
  const memo = typeof value === "string" ? value : "";
  if (memo.startsWith(PREFIX)) {
    try {
      const data = JSON.parse(memo.slice(PREFIX.length));
      if (typeof data.text === "string" && Array.isArray(data.missing) && data.missing.every((key: MissingMetric) => METRICS.includes(key))) {
        return {
          memo: data.text, missing: data.missing,
          startAt: timestamp(data.startAt), endAt: timestamp(data.endAt),
          ratings: validSleepRatings(data.ratings) ? data.ratings : undefined,
        };
      }
    } catch { /* A plain or malformed legacy memo remains visible. */ }
  }
  return { memo, missing: [] };
}
