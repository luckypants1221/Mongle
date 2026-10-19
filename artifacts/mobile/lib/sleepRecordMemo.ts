import type { SleepInfoPayload } from "../services/authApi";

export interface ServerSleepRecord extends Omit<SleepInfoPayload, "start_sleep" | "end_sleep"> {
  record_id: number;
  day: string;
  start_sleep: string;
  end_sleep: string;
}

// GET returns time-only values; PUT requires datetimes. Keep seconds and the
// server's timezone representation, including sleep that crosses midnight.
export function sleepRecordMemoPayload(record: ServerSleepRecord, memo: string): SleepInfoPayload {
  const asDateTime = (value: string) => {
    if (value.includes("T")) return value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.day) || !/^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)) {
      throw new Error("수면 기록의 날짜와 시각을 확인할 수 없습니다.");
    }
    return `${record.day}T${value}`;
  };
  const start = asDateTime(record.start_sleep);
  let end = asDateTime(record.end_sleep);
  if (!record.end_sleep.includes("T") && end < start) {
    const nextDay = new Date(`${record.day}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    end = `${nextDay.toISOString().slice(0, 10)}T${record.end_sleep}`;
  }
  return {
    id: record.id,
    sleep_score: record.sleep_score,
    start_sleep: start,
    end_sleep: end,
    temp_avg: record.temp_avg,
    hum_avg: record.hum_avg,
    audio_path: record.audio_path,
    duration: record.duration,
    snoring_count: record.snoring_count,
    memo,
  };
}
