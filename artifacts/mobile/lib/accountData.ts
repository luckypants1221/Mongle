import type { SleepRecord, SleepStageSegment, User } from "./api";
import { localDateKey, parseSleepScore } from "./snorePrediction";
import { decodeSleepMemo } from "./sleepRecordMetadata";

type Row = Record<string, unknown>;
export function accountId(value: unknown): string | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? String(id) : null;
}
export function requireAccountId(value: unknown): string {
  const id = accountId(value);
  if (!id) throw new Error("유효한 로그인 계정 ID가 필요합니다.");
  return id;
}
export function identityRow(data: unknown): Row {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("계정 응답 형식이 올바르지 않습니다.");
  const row = data as Row;
  const nested = row.user ?? row.profile;
  return nested && typeof nested === "object" && !Array.isArray(nested) ? nested as Row : row;
}
export function identityId(data: unknown): string {
  const row = identityRow(data);
  const ids = [row.user_id, row.userId, row.id].filter(v => v !== undefined && v !== null).map(requireAccountId);
  if (!ids.length || ids.some(id => id !== ids[0])) throw new Error("로그인 응답의 계정 ID를 확인할 수 없습니다.");
  return ids[0];
}
export function normalizeUser(data: unknown, email: string, expectedId?: string): User {
  const row = identityRow(data);
  const id = identityId(data);
  const name = row.name ?? row.user_name;
  const returnedEmail = row.email;
  if (expectedId && id !== requireAccountId(expectedId)) throw new Error("다른 계정의 프로필이 반환됐습니다.");
  if (typeof name !== "string" || !name.trim() || typeof returnedEmail !== "string" || returnedEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
    throw new Error("로그인한 이메일과 서버 계정 정보가 일치하지 않습니다.");
  }
  return { id, name: name.trim(), email: returnedEmail.trim() };
}
export function finiteMetric(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && !value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
function rows(data: unknown, keys: string[], allowSingle = false): Row[] {
  if (Array.isArray(data)) return data.filter(v => v && typeof v === "object" && !Array.isArray(v));
  if (data && typeof data === "object") {
    const row = data as Row;
    for (const key of keys) if (Array.isArray(row[key])) return rows(row[key], []);
    if (allowSingle && ("temp" in row || "hum" in row || "temperature" in row || "humidity" in row)) return [row];
  }
  throw new Error("서버 데이터 응답 형식이 올바르지 않습니다.");
}
export function belongsToAccount(row: Row, userId: string): boolean {
  const explicit = [row.user_id, row.userId, row.owner_id, row.ownerId].filter(v => v !== undefined && v !== null);
  // In this server's /sleepinfo and /sensor DTOs, id is the user foreign key.
  const owners = explicit.length ? explicit : row.id !== undefined ? [row.id] : [];
  return owners.every(owner => accountId(owner) === requireAccountId(userId));
}
function dateString(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : localDateKey(date);
}
function timeString(value: unknown): string {
  if (typeof value !== "string") return "";
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return value.slice(0, 5);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toTimeString().slice(0, 5);
}
export function parseSleepStages(value: unknown): SleepStageSegment[] | undefined {
  if (!Array.isArray(value) || !value.length) return undefined;
  const parsed: SleepStageSegment[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return undefined;
    const duration = finiteMetric(item.durationMinutes ?? item.duration_minutes);
    if (!["awake", "light", "rem", "deep"].includes(item.stage) || duration === undefined || duration <= 0) return undefined;
    parsed.push({ stage: item.stage, durationMinutes: duration });
  }
  return parsed;
}
export function parseAccountRecords(data: unknown, userId: string) {
  const owner = requireAccountId(userId);
  const input = rows(data, ["value", "records", "sleep_records"]);
  let rejected = 0;
  const byDate = new Map<string, SleepRecord>();
  for (const item of input) {
    if (!belongsToAccount(item, owner)) { rejected++; continue; }
    const metadata = decodeSleepMemo(item.memo);
    const start = metadata.startAt ?? item.start_sleep ?? item.startTime ?? item.start_time;
    const end = metadata.endAt ?? item.end_sleep ?? item.endTime ?? item.end_time;
    const date = dateString(metadata.startAt ?? item.day ?? item.date ?? start);
    const duration = finiteMetric(item.duration ?? item.durationMinutes ?? item.duration_minutes);
    if (!date || duration === undefined || duration < 0) { rejected++; continue; }
    const score = metadata.missing.includes("score") ? null : parseSleepScore(item.sleep_score ?? item.score);
    const count = metadata.missing.includes("snoringCount") ? undefined : finiteMetric(item.snoring_count ?? item.snoringCount);
    const startAt = typeof start === "string" && start.includes("T") && Number.isFinite(Date.parse(start)) ? start : undefined;
    const endAt = typeof end === "string" && end.includes("T") && Number.isFinite(Date.parse(end)) ? end : undefined;
    const record: SleepRecord = {
      id: String(item.sleep_id ?? item.record_id ?? `${owner}-${startAt ?? date + "T" + timeString(start)}`), userId: owner, date,
      startTime: timeString(start), endTime: timeString(end), durationMinutes: duration,
      startAt, endAt,
      score: score ?? 0, scoreAvailable: score !== null,
      temperature: metadata.missing.includes("temperature") ? undefined : finiteMetric(item.temp_avg ?? item.temperature),
      humidity: metadata.missing.includes("humidity") ? undefined : finiteMetric(item.hum_avg ?? item.humidity),
      snoringCount: count !== undefined && count >= 0 ? Math.round(count) : undefined,
      audioPath: typeof item.audio_path === "string" ? item.audio_path : "",
      memo: metadata.memo, ratings: metadata.ratings,
      createdAt: typeof (item.created_at ?? item.createdAt) === "string" ? String(item.created_at ?? item.createdAt) : undefined,
      sleepStages: parseSleepStages(item.sleep_stages ?? item.sleepStages ?? item.stages),
    };
    const previous = byDate.get(date);
    if (record.sleepStages && Math.abs(record.sleepStages.reduce((sum, segment) => sum + segment.durationMinutes, 0) - duration) > 1) record.sleepStages = undefined;
    const time = Date.parse(record.createdAt ?? record.endAt ?? "");
    const previousTime = Date.parse(previous?.createdAt ?? previous?.endAt ?? "");
    if (!previous || !Number.isFinite(previousTime) || (Number.isFinite(time) && time >= previousTime)) byDate.set(date, record);
  }
  return { records: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)), rejected };
}
export function parseAccountSensorSamples(data: unknown, userId: string, since: number, until = Date.now()) {
  const input = rows(data, ["value", "records", "sensors"], true).filter(row => belongsToAccount(row, userId));
  const candidates = input.map(row => {
    const rawTime = row.time_stamp ?? row.timestamp ?? row.created_at ?? row.createdAt;
    const timestamp = typeof rawTime === "string" ? Date.parse(rawTime) : NaN;
    return { temperature: finiteMetric(row.temp ?? row.temperature ?? row.temp_avg), humidity: finiteMetric(row.hum ?? row.humidity ?? row.hum_avg), timestamp };
  }).filter(row => Number.isFinite(row.timestamp) && row.timestamp >= since && row.timestamp <= until && (row.temperature !== undefined || row.humidity !== undefined));
  return candidates.sort((a, b) => b.timestamp - a.timestamp);
}
export function parseAccountSensor(data: unknown, userId: string, since: number, now = Date.now()) {
  return parseAccountSensorSamples(data, userId, since - 5000, now + 5000).find(row => now - row.timestamp <= 120000) ?? null;
}
export class SleepSensorSamples {
  private samples = new Map<number, ReturnType<typeof parseAccountSensorSamples>[number]>();
  add(data: unknown, userId: string, since: number, until = Date.now()) {
    for (const row of parseAccountSensorSamples(data, userId, since, until)) this.samples.set(row.timestamp, row);
  }
  averages() {
    const average = (key: "temperature" | "humidity") => {
      const values = [...this.samples.values()].map(row => row[key]).filter((value): value is number => value !== undefined);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
    };
    return { temperature: average("temperature"), humidity: average("humidity") };
  }
}

export type RequestTicket = { key: string; channel: string; sequence: number; generation: number };
export class AccountRequestGate {
  private key: string | null = null;
  private generation = 0;
  private sequences = new Map<string, number>();
  setAccount(key: string | null) { if (this.key !== key) { this.key = key; this.generation++; this.sequences.clear(); } }
  begin(channel: string, expectedKey: string | null = this.key): RequestTicket | null {
    if (!this.key || expectedKey !== this.key) return null;
    const sequence = (this.sequences.get(channel) ?? 0) + 1;
    this.sequences.set(channel, sequence);
    return { key: this.key, channel, sequence, generation: this.generation };
  }
  current(ticket: RequestTicket | null) { return Boolean(ticket && ticket.key === this.key && ticket.generation === this.generation && this.sequences.get(ticket.channel) === ticket.sequence); }
}

export class AuthenticatedAccount {
  private id: string | null = null;
  private revision = 0;
  set(id: string | null) { this.id = id === null ? null : requireAccountId(id); this.revision++; }
  version() { return this.revision; }
  begin(id: unknown) {
    const account = requireAccountId(id);
    if (this.id !== account) throw new Error("로그인한 계정과 요청 ID가 일치하지 않습니다.");
    return { id: account, revision: this.revision };
  }
  current(ticket: { id: string; revision: number }) { return this.id === ticket.id && this.revision === ticket.revision; }
}
