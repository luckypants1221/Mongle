import { requireAccountId } from "./accountData";
import type { SleepRecord } from "./api";
import { encodeSleepMemo } from "./sleepRecordMetadata";

export function formatSleepDuration(minutes: number, compact = false): string {
  if (minutes < 1) return `${Math.round(minutes * 60)}${compact ? "s" : "초"}`;
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60), remainder = rounded % 60;
  return compact ? `${hours}h ${remainder}m` : `${hours}시간${remainder ? ` ${remainder}분` : ""}`;
}

function recordDateTime(date: string, time: string): Date {
  return new Date(time.includes("T") ? time : `${date}T${time.length === 5 ? time + ":00" : time}`);
}
export function buildSleepPayload(userId: string, record: Omit<SleepRecord, "id">) {
  const owner = requireAccountId(userId);
  if (record.userId !== owner) throw new Error("현재 계정의 수면 기록이 아닙니다.");
  const start = record.startAt ? new Date(record.startAt) : recordDateTime(record.date, record.startTime);
  const end = record.endAt ? new Date(record.endAt) : recordDateTime(record.date, record.endTime);
  if (!record.endAt && end < start) end.setDate(end.getDate() + 1);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start || !Number.isFinite(record.durationMinutes) || record.durationMinutes < 0) {
    throw new Error("수면 기록의 시작·종료 시간을 확인해주세요.");
  }
  const metric = (value: number | undefined) => {
    if (value === undefined) return 0; // Availability is explicitly stored in memo metadata.
    if (!Number.isFinite(value)) throw new Error("측정값의 형식이 올바르지 않습니다.");
    return Math.round(value);
  };
  if (record.scoreAvailable !== false && (!Number.isFinite(record.score) || record.score < 0 || record.score > 100)) throw new Error("수면 점수가 올바르지 않습니다.");
  return {
    id: Number(owner), sleep_score: record.scoreAvailable === false ? 0 : Math.round(record.score),
    start_sleep: start.toISOString(), end_sleep: end.toISOString(),
    temp_avg: metric(record.temperature), hum_avg: metric(record.humidity),
    duration: record.durationMinutes, snoring_count: metric(record.snoringCount),
    audio_path: record.audioPath ?? "",
    memo: encodeSleepMemo({ ...record, startAt: start.toISOString(), endAt: end.toISOString() }),
  };
}

export function sameSleepMeasurement(a: SleepRecord, b: SleepRecord): boolean {
  if (a.userId !== b.userId) return false;
  if (a.startAt && b.startAt && a.endAt && b.endAt) {
    return Date.parse(a.startAt) === Date.parse(b.startAt) && Date.parse(a.endAt) === Date.parse(b.endAt);
  }
  return a.date === b.date && a.startTime === b.startTime && a.endTime === b.endTime && a.durationMinutes === b.durationMinutes;
}

type RecordWriter = { create: (record: SleepRecord) => Promise<unknown>; read: () => Promise<SleepRecord[]> };
export class SleepRecordWriter {
  private attempted = false;
  private acknowledged = false;
  private running: Promise<SleepRecord> | null = null;
  constructor(readonly record: SleepRecord) {}
  save(io: RecordWriter): Promise<SleepRecord> {
    if (this.running) return this.running;
    this.running = this.write(io).finally(() => { this.running = null; });
    return this.running;
  }
  private async write(io: RecordWriter): Promise<SleepRecord> {
    const findSaved = async () => (await io.read()).find(row => sameSleepMeasurement(row, this.record));
    if (this.attempted) {
      // A timeout can occur after the server commits. Check before resubmitting.
      const existing = await findSaved();
      if (existing) return existing;
    }
    if (!this.acknowledged) {
      this.attempted = true;
      try {
        await io.create(this.record);
        this.acknowledged = true;
      } catch (error) {
        const existing = await findSaved().catch(() => undefined);
        if (existing) return existing;
        throw error;
      }
    }
    const saved = await findSaved();
    if (!saved) throw new Error("저장 응답을 받았지만 서버에서 기록을 확인하지 못했어요. 다시 시도하면 저장 여부를 확인합니다.");
    return saved;
  }
}
