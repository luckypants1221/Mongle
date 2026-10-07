import { identityId, identityRow, normalizeUser, parseAccountRecords, requireAccountId } from "./accountData";
import { apiAccountVersion, loginApi, loginProfileApi, setApiAccount, signupApi, changePasswordApi, profileApi, updateProfileApi, getSleepInfoApi, createSleepInfoApi, updateSleepInfoApi } from "../services/authApi";
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface SleepRecord {
  userId?: string;
  sleepStages?: SleepStageSegment[];
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  score: number;
  scoreAvailable?: boolean;
  temperature?: number;
  humidity?: number;
  snoringCount?: number;
  audioPath?: string;
  memo?: string;
  createdAt?: string;
}

export type SleepStageSegment = { stage: "awake" | "light" | "rem" | "deep"; durationMinutes: number };

export interface AlarmSettings {
  hour: number;
  min: number;
  on: boolean;
}

export type RegisterInput = {
  name: string;
  email: string;
  pwd: string;
};

export type ChangePasswordInput = {
  email: string;
  pwd: string;
  new_pwd: string;
};

// Compatibility facade: all callers share the same validated account API.
export const api = {
  async login(email: string, pwd: string) {
    setApiAccount(null);
    const version = apiAccountVersion();
    const response = await loginApi(email, pwd);
    if (response.data?.message !== "login success") throw new Error("로그인에 실패했습니다.");
    const identity = identityRow(response.data);
    const id = identityId(identity);
    const profile = typeof identity.email === "string" && Boolean(identity.name ?? identity.user_name) ? identity : { ...identity, ...identityRow((await loginProfileApi(id)).data) };
    const user = normalizeUser(profile, email, id);
    if (version !== apiAccountVersion()) throw new Error("다른 로그인 요청으로 이전 응답을 폐기했습니다.");
    setApiAccount(user.id);
    return user;
  },
  async register(data: RegisterInput) { await signupApi(data.name, data.email, data.pwd); },
  async changePassword(data: ChangePasswordInput) { await changePasswordApi(data.email, data.pwd, data.new_pwd); },
  logout() { setApiAccount(null); },
  async updateUser(userId: string, data: User) {
    await updateProfileApi(requireAccountId(userId), data.name, data.email);
    return normalizeUser((await profileApi(userId)).data, data.email, userId);
  },
  async getSleepRecords(userId: string) { return parseAccountRecords((await getSleepInfoApi(userId)).data, userId).records; },
  async createSleepRecord(userId: string, record: Omit<SleepRecord, "id">) {
    const id = requireAccountId(userId);
    await createSleepInfoApi(recordPayload(id, record));
    return (await this.getSleepRecords(id)).find(item => item.date === record.date) ?? null;
  },
  async updateSleepRecord(userId: string, recordId: string, data: Partial<SleepRecord>) {
    const current = (await this.getSleepRecords(userId)).find(item => item.id === recordId);
    if (!current) throw new Error("현재 계정의 기록이 없습니다.");
    await updateSleepInfoApi(recordPayload(userId, { ...current, ...data, userId: requireAccountId(userId) }));
    return (await this.getSleepRecords(userId)).find(item => item.id === recordId) ?? null;
  },
  // Alarm preferences have no server endpoint; they are local settings.
  async getAlarm(_userId: string) { return { hour: 7, min: 0, on: true }; },
  async updateAlarm(_userId: string, data: AlarmSettings) { return data; },
};
function recordPayload(userId: string, record: Omit<SleepRecord, "id">) {
  if (record.userId !== requireAccountId(userId) || record.scoreAvailable === false || record.temperature === undefined || record.humidity === undefined || record.snoringCount === undefined) throw new Error("계정 또는 실제 기록값이 없습니다.");
  const start = new Date(`${record.date}T${record.startTime}:00`);
  const end = new Date(`${record.date}T${record.endTime}:00`);
  if (end < start) end.setDate(end.getDate() + 1);
  return { id: Number(userId), sleep_score: record.score, start_sleep: start.toISOString(), end_sleep: end.toISOString(), temp_avg: Math.round(record.temperature), hum_avg: Math.round(record.humidity), duration: record.durationMinutes, snoring_count: record.snoringCount, audio_path: record.audioPath ?? "", memo: record.memo ?? "" };
}
