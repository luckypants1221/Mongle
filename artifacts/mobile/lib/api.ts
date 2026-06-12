import Constants from "expo-constants";
import { Platform } from "react-native";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface SleepRecord {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  score: number;
  temperature?: number;
  humidity?: number;
  memo?: string;
  createdAt?: string;
}

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

interface AuthResponse {
  user?: User;
  token?: string;
  id?: string;
  user_id?: string | number;
  userId?: string;
  user_name?: string;
  name?: string;
  email?: string;
  message?: string;
}

interface SleepRecordResponse {
  id?: string | number;
  sleep_id?: string | number;
  day?: string;
  date?: string;
  sleep_score?: number;
  score?: number;
  start_sleep?: string;
  startTime?: string;
  end_sleep?: string;
  endTime?: string;
  temp_avg?: number;
  temperature?: number;
  hum_avg?: number;
  humidity?: number;
  duration?: number;
  durationMinutes?: number;
  memo?: string;
  created_at?: string;
  createdAt?: string;
}

const defaultApiUrl = Platform.select({
  android: "http://13.125.10.228",
  default: "http://13.125.10.228",
});

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  Constants.expoConfig?.extra?.apiBaseUrl ??
  defaultApiUrl;

let authToken: string | null = null;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  const text = await response.text();
  if (!text) return {} as T;

  return JSON.parse(text) as T;
}

function normalizeAuthResponse(data: AuthResponse): User {
  if (data.message?.toLowerCase().includes("fail")) {
    throw new Error(data.message);
  }

  if (data.token) authToken = data.token;
  const user = (data.user ?? data) as AuthResponse;
  const id = user.id ?? user.user_id ?? user.userId;
  const name = user.name ?? user.user_name;

  if (!id || !name || !user.email) {
    throw new Error("Auth response must include user id, name and email");
  }

  return {
    id: String(id),
    name,
    email: user.email,
  };
}

function toDate(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  return value.split("T")[0];
}

function toTime(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toTimeString().slice(0, 5);
  return value.includes("T") ? value.split("T")[1]?.slice(0, 5) ?? "" : value.slice(0, 5);
}

function normalizeSleepRecords(data: unknown): SleepRecord[] {
  const records = Array.isArray(data)
    ? data
    : typeof data === "object" && data !== null && Array.isArray((data as { value?: unknown }).value)
      ? (data as { value: unknown[] }).value
      : typeof data === "object" && data !== null && Array.isArray((data as { records?: unknown }).records)
        ? (data as { records: unknown[] }).records
        : typeof data === "object" && data !== null && Array.isArray((data as { sleep_records?: unknown }).sleep_records)
          ? (data as { sleep_records: unknown[] }).sleep_records
          : [];

  const normalized = records.map((item, index) => {
    const record = item as SleepRecordResponse;
    const start = record.start_sleep ?? record.startTime;
    const end = record.end_sleep ?? record.endTime;
    const date = toDate(record.day ?? record.date ?? start);

    return {
      id: String(record.sleep_id ?? record.id ?? `${date}-${index}`),
      date,
      startTime: toTime(start),
      endTime: toTime(end),
      durationMinutes: Math.round(Number(record.durationMinutes ?? record.duration ?? 0)),
      score: Number(record.score ?? record.sleep_score ?? 0),
      temperature: record.temperature ?? record.temp_avg,
      humidity: record.humidity ?? record.hum_avg,
      memo: record.memo ?? "",
      createdAt: record.createdAt ?? record.created_at,
    };
  });

  return dedupeSleepRecords(normalized);
}

function dedupeSleepRecords(records: SleepRecord[]) {
  const byDate = new Map<string, SleepRecord>();

  records.forEach((record) => {
    byDate.set(record.date, record);
  });

  return Array.from(byDate.values());
}

function toApiDateTime(date: string, time: string) {
  if (time.includes("T")) return new Date(time).toISOString();
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${normalizedTime}`).toISOString();
}

function buildSleepRecordRequest(userId: string, record: Omit<SleepRecord, "id">) {
  return {
    id: Number(userId),
    sleep_score: record.score,
    start_sleep: toApiDateTime(record.date, record.startTime),
    end_sleep: toApiDateTime(record.date, record.endTime),
    temp_avg: Math.round(record.temperature ?? 0),
    hum_avg: Math.round(record.humidity ?? 0),
    audio_path: "",
    duration: record.durationMinutes,
    snoring_count: 0,
    memo: record.memo ?? "",
  };
}

function normalizeCreatedSleepRecord(data: unknown, fallback: SleepRecord): SleepRecord {
  const records = normalizeSleepRecords([data]);
  return records[0]?.date ? records[0] : fallback;
}

export const api = {
  async login(email: string, pwd: string) {
    const data = await request<AuthResponse>("/login", {
      method: "POST",
      body: JSON.stringify({ name: "test", email, pwd }),
    });
    return normalizeAuthResponse({ ...data, email });
  },

  async register(data: RegisterInput) {
    const response = await request<AuthResponse>("/signup", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        pwd: data.pwd,
      }),
    });
    return normalizeAuthResponse({
      ...response,
      name: response.name ?? response.user_name ?? data.name,
      email: response.email ?? data.email,
    });
  },

  async changePassword(data: ChangePasswordInput) {
    await request<unknown>("/changepw", {
      method: "POST",
      body: JSON.stringify({
        email: data.email,
        pwd: data.pwd,
        new_pwd: data.new_pwd,
      }),
    });
  },

  logout() {
    authToken = null;
  },

  async updateUser(userId: string, data: User) {
    const response = await request<AuthResponse>(`/profile/${encodeURIComponent(userId)}`, {
      method: "PUT",
      body: JSON.stringify({
        user_id: Number(userId),
        email: data.email,
        name: data.name,
      }),
    });
    return normalizeAuthResponse({
      ...data,
      ...response,
      id: String(response.id ?? response.user_id ?? response.userId ?? data.id),
      name: response.name ?? response.user?.name ?? response.user_name ?? data.name,
      email: response.email ?? response.user?.email ?? data.email,
    });
  },

  async getSleepRecords(userId: string) {
    const data = await request<unknown>(`/sleepinfo?id=${encodeURIComponent(userId)}`);
    return normalizeSleepRecords(data);
  },

  async createSleepRecord(userId: string, record: Omit<SleepRecord, "id">) {
    const fallback = {
      ...record,
      id: `${userId}-${record.date}`,
    };
    const response = await request<unknown>("/sleepinfo", {
      method: "POST",
      body: JSON.stringify(buildSleepRecordRequest(userId, record)),
    });
    return normalizeCreatedSleepRecord(response, fallback);
  },

  async updateSleepRecord(userId: string, recordId: string, data: Partial<SleepRecord>) {
    const current = {
      id: recordId,
      date: data.date ?? new Date().toISOString().split("T")[0],
      startTime: data.startTime ?? "00:00",
      endTime: data.endTime ?? "00:00",
      durationMinutes: data.durationMinutes ?? 0,
      score: data.score ?? 0,
      temperature: data.temperature,
      humidity: data.humidity,
      memo: data.memo ?? "",
    };
    return this.createSleepRecord(userId, current);
  },

  async getAlarm(_userId: string) {
    return { hour: 7, min: 0, on: true };
  },

  async updateAlarm(_userId: string, data: AlarmSettings) {
    return data;
  },
};
