import { identityId, identityRow, normalizeUser, parseAccountRecords, requireAccountId } from "./accountData";
import { apiAccountVersion, loginApi, loginProfileApi, setApiAccount, signupApi, changePasswordApi, profileApi, updateProfileApi, getSleepInfoApi, createSleepInfoApi, updateSleepInfoApi } from "../services/authApi";
import { buildSleepPayload, sameSleepMeasurement } from "./sleepRecording";
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
  startAt?: string;
  endAt?: string;
  durationMinutes: number;
  score: number;
  scoreAvailable?: boolean;
  temperature?: number;
  humidity?: number;
  snoringCount?: number;
  audioPath?: string;
  memo?: string;
  createdAt?: string;
  ratings?: SleepRatings;
}

export type SleepRatings = { total: number; humidity: number; temperature: number };

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
    await createSleepInfoApi(buildSleepPayload(id, record));
    return (await this.getSleepRecords(id)).find(item => sameSleepMeasurement(item, { ...record, id: "pending" })) ?? null;
  },
  async updateSleepRecord(userId: string, recordId: string, data: Partial<SleepRecord>) {
    const current = (await this.getSleepRecords(userId)).find(item => item.id === recordId);
    if (!current) throw new Error("현재 계정의 기록이 없습니다.");
    const updated = { ...current, ...data, userId: requireAccountId(userId) };
    await updateSleepInfoApi(buildSleepPayload(userId, updated));
    return (await this.getSleepRecords(userId)).find(item => sameSleepMeasurement(item, updated)) ?? null;
  },
  // Alarm preferences have no server endpoint; they are local settings.
  async getAlarm(_userId: string) { return { hour: 7, min: 0, on: true }; },
  async updateAlarm(_userId: string, data: AlarmSettings) { return data; },
};
