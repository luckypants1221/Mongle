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
  name?: string;
  email?: string;
}

const localhostApiUrl = Platform.select({
  android: "http://10.0.2.2:3000/api",
  default: "http://localhost:3000/api",
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
  if (data.token) authToken = data.token;
  const user = data.user ?? data;

  if (!user.id || !user.name || !user.email) {
    throw new Error("Auth response must include user id, name and email");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}
console.log("API_BASE_URL =", API_BASE_URL);
console.log("API_BASE_URL");
console.log(API_BASE_URL)

export const api = {
  async login(email: string, pwd: string) {
    const data = await request<any>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          pwd,
        }),
      }
    );

    console.log("로그인 응답");
    console.log(data);

    return normalizeAuthResponse(data);
  }
  ,
  async register(data: RegisterInput) {
    const response = await request<AuthResponse>("/auth/register", {
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
    return request<User>(`/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  getSleepRecords(userId: string) {
    return request<SleepRecord[]>(`/users/${userId}/sleep-records`);
  },

  createSleepRecord(userId: string, record: Omit<SleepRecord, "id">) {
    return request<SleepRecord>(`/users/${userId}/sleep-records`, {
      method: "POST",
      body: JSON.stringify(record),
    });
  },

  updateSleepRecord(userId: string, recordId: string, data: Partial<SleepRecord>) {
    return request<SleepRecord>(`/users/${userId}/sleep-records/${recordId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  getAlarm(userId: string) {
    return request<AlarmSettings>(`/users/${userId}/alarm`);
  },

  updateAlarm(userId: string, data: AlarmSettings) {
    return request<AlarmSettings>(`/users/${userId}/alarm`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};
