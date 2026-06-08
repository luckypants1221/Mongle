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

interface AuthResponse {
  user?: User;
  token?: string;
  id?: string;
  user_id?: string;
  userId?: string;
  name?: string;
  email?: string;
  message?: string;
}

interface SleepRecordResponse {
  id?: string;
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
}

const localhostApiUrl = Platform.select({
  android: "http://13.125.10.228",
  default: "http://13.125.10.228",
});

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  Constants.expoConfig?.extra?.apiBaseUrl ??
  localhostApiUrl;

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

  if (!id || !user.name || !user.email) {
    throw new Error("Auth response must include user id, name and email");
  }

  return {
    id,
    name: user.name,
    email: user.email,
  };
}

function normalizeSleepRecords(data: unknown): SleepRecord[] {
  const records = Array.isArray(data)
    ? data
    : typeof data === "object" && data !== null && Array.isArray((data as { records?: unknown }).records)
      ? (data as { records: unknown[] }).records
      : typeof data === "object" && data !== null && Array.isArray((data as { sleep_records?: unknown }).sleep_records)
        ? (data as { sleep_records: unknown[] }).sleep_records
        : [];

  return records.map((item) => {
    const record = item as SleepRecordResponse;
    const startDate = record.start_sleep ? new Date(record.start_sleep) : null;
    const endDate = record.end_sleep ? new Date(record.end_sleep) : null;
    const day = record.day ?? record.date ?? startDate?.toISOString() ?? "";

    return {
      id: String(record.id ?? record.sleep_id ?? day),
      date: String(day).split("T")[0],
      startTime: record.startTime ?? (startDate ? startDate.toTimeString().slice(0, 5) : ""),
      endTime: record.endTime ?? (endDate ? endDate.toTimeString().slice(0, 5) : ""),
      durationMinutes: Math.round(Number(record.durationMinutes ?? record.duration ?? 0)),
      score: Number(record.score ?? record.sleep_score ?? 0),
      temperature: record.temperature ?? record.temp_avg,
      humidity: record.humidity ?? record.hum_avg,
      memo: record.memo,
    };
  });
}

function buildSleepRecordRequest(userId: string, record: Omit<SleepRecord, "id">) {
  const day = new Date(record.date);
  const startSleep = new Date(`${record.date}T${record.startTime}:00`);
  let endSleep = new Date(`${record.date}T${record.endTime}:00`);

  if (endSleep.getTime() < startSleep.getTime()) {
    endSleep.setDate(endSleep.getDate() + 1);
  }

  return {
    id: userId,
    day: day.toISOString(),
    sleep_score: record.score,
    start_sleep: startSleep.toISOString(),
    end_sleep: endSleep.toISOString(),
    temp_avg: Math.round(record.temperature ?? 0),
    hum_avg: Math.round(record.humidity ?? 0),
    audio_path: "",
    duration: record.durationMinutes,
    snoring_count: 0,
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
      body: JSON.stringify({ email, pwd }),
    });
    return normalizeAuthResponse(data);
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
    return normalizeAuthResponse(response);
  },

  logout() {
    authToken = null;
  },

  async updateUser(userId: string, data: User) {
    const response = await request<AuthResponse>(`/profile/${encodeURIComponent(userId)}`, {
      method: "PUT",
      body: JSON.stringify({
        user_id: userId,
        email: data.email,
        name: data.name,
      }),
    });
    return normalizeAuthResponse({
      ...data,
      ...response,
      id: response.id ?? response.user_id ?? response.userId ?? data.id,
      name: response.name ?? response.user?.name ?? data.name,
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

  async updateSleepRecord(_userId: string, _recordId: string, _data: Partial<SleepRecord>) {
    throw new Error("Sleep record update API is not available in the backend OpenAPI spec");
  },

  async getAlarm(_userId: string) {
    return { hour: 7, min: 0, on: true };
  },

  async updateAlarm(_userId: string, data: AlarmSettings) {
    return data;
  },
};
