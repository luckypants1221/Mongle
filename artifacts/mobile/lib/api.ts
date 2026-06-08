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

  return response.json() as Promise<T>;
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
  if (!Array.isArray(data)) return [];

  return data.map((item) => {
    const record = item as Partial<SleepRecord> & {
      sleep_id?: string | number;
      sleep_date?: string;
      start_time?: string;
      end_time?: string;
      duration_minutes?: number;
    };

    return {
      id: String(record.id ?? record.sleep_id ?? `${record.date ?? record.sleep_date}`),
      date: String(record.date ?? record.sleep_date ?? ""),
      startTime: String(record.startTime ?? record.start_time ?? ""),
      endTime: String(record.endTime ?? record.end_time ?? ""),
      durationMinutes: Number(record.durationMinutes ?? record.duration_minutes ?? 0),
      score: Number(record.score ?? 0),
      temperature: record.temperature,
      humidity: record.humidity,
      memo: record.memo,
    };
  });
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

  updateUser(userId: string, data: Partial<User>) {
    return request<User>(`/profile?user_id=${encodeURIComponent(userId)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async getSleepRecords(userId: string) {
    const data = await request<unknown>(`/sleepinfo?id=${encodeURIComponent(userId)}`);
    return normalizeSleepRecords(data);
  },

  createSleepRecord(userId: string, record: Omit<SleepRecord, "id">) {
    return request<SleepRecord>(`/sleepinfo?id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(record),
    });
  },

  updateSleepRecord(userId: string, recordId: string, data: Partial<SleepRecord>) {
    return request<SleepRecord>(`/sleepinfo?id=${encodeURIComponent(userId)}&record_id=${encodeURIComponent(recordId)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async getAlarm(_userId: string) {
    return { hour: 7, min: 0, on: true };
  },

  async updateAlarm(_userId: string, data: AlarmSettings) {
    return data;
  },
};
