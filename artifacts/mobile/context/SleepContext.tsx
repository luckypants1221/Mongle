import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from "react";

import { useAuth } from "@/context/AuthContext";
import { sleepinfoApi, saveSleepApi } from "@/services/authApi";
import { Alert, Platform } from "react-native";
import * as Notifications from "expo-notifications";

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
  totalRating?: number;
  tempRating?: number;
  humRating?: number;
  startISO?: string;   // ← 추가
  endISO?: string;
}

interface SleepContextType {
  records: SleepRecord[];
  activeSession: { startTime: Date; temperature: number; humidity: number } | null;
  startSleep: () => void;
  endSleep: () => Promise<SleepRecord | null>;
  updateMemo: (id: string, memo: string) => Promise<void>;
  getRecordByDate: (date: string) => SleepRecord | undefined;
  weeklyRecords: SleepRecord[];
  averageDuration: number;
  averageScore: number;
  alarmHour: number;
  alarmMin: number;
  alarmOn: boolean;
  setAlarm: (hour: number, min: number) => Promise<void>;
  setAlarmOn: (on: boolean) => Promise<void>;
  updateRating: (
    id: string,
    ratings: { total: number; temp: number; hum: number }
  ) => Promise<void>;
  alarmPresets: { h: number; m: number }[];
  addAlarmPreset: (h: number, m: number) => Promise<void>;
  editAlarmPreset: (oldH: number, oldM: number, h: number, m: number) => Promise<void>;
  removeAlarmPreset: (h: number, m: number) => Promise<void>;
}

const SleepContext = createContext<SleepContextType | null>(null);

// 서버가 시각 부분만 저장하므로, KST 시각을 담은 ISO 문자열로 변환
function toKstIso(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000).toISOString();
}
function serverTimeToHm(t?: string): string {
  if (!t) return "--:--";
  return t.slice(0, 5);   // "19:29:41" → "19:29"
}


// 기기(로컬) 기준 "YYYY-MM-DD" (toISOString은 UTC라 한국 0~9시에 하루 전 날짜가 나옴)
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const ALARM_ID_KEY = "@alarm_notification_id";

async function ensureNotificationReady(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("alarm", {
      name: "기상 알람",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 500, 300, 500],
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  return status === "granted";
}

async function rescheduleAlarm(hour: number, min: number, on: boolean) {
  try {
    const oldId = await AsyncStorage.getItem(ALARM_ID_KEY);
    if (oldId) await Notifications.cancelScheduledNotificationAsync(oldId);
    await AsyncStorage.removeItem(ALARM_ID_KEY);
    if (!on) return;
    if (!(await ensureNotificationReady())) return;

    const id = await Notifications.scheduleNotificationAsync({
      content: { title: "기상 알람", body: "일어날 시간이에요!", sound: "default" },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: min,
        channelId: "alarm",
      },
    });
    await AsyncStorage.setItem(ALARM_ID_KEY, id);
  } catch (e) {
    console.log("알람 예약 실패:", e);
  }
}

export function SleepProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const recordsKey = `@sleep_records:${userId}`;
  const [records, setRecords] = useState<SleepRecord[]>([]);
  const [activeSession, setActiveSession] = useState<SleepContextType["activeSession"]>(null);
  const [alarmHour, setAlarmHour] = useState(7);
  const [alarmMin, setAlarmMin] = useState(0);
  const [alarmOn, setAlarmOnState] = useState(true);
  const lastRecordRef = useRef<SleepRecord | null>(null);



  const DEFAULT_PRESETS = [{ h: 6, m: 0 }, { h: 7, m: 0 }, { h: 7, m: 30 }, { h: 8, m: 0 }];
  const [alarmPresets, setAlarmPresets] = useState(DEFAULT_PRESETS);

  async function savePresets(list: { h: number; m: number }[]) {
    const sorted = [...list].sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
    setAlarmPresets(sorted);
    await AsyncStorage.setItem("@alarm_presets", JSON.stringify(sorted));
  }

  async function addAlarmPreset(h: number, m: number) {
    if (alarmPresets.some((p) => p.h === h && p.m === m)) return; // 중복 방지
    await savePresets([...alarmPresets, { h, m }]);
  }

  async function editAlarmPreset(oldH: number, oldM: number, h: number, m: number) {
    const rest = alarmPresets.filter((p) => !(p.h === oldH && p.m === oldM));
    if (rest.some((p) => p.h === h && p.m === m)) return;
    await savePresets([...rest, { h, m }]);
  }

  async function removeAlarmPreset(h: number, m: number) {
    await savePresets(alarmPresets.filter((p) => !(p.h === h && p.m === m)));
  }


  useEffect(() => {
    setActiveSession(null);
    if (!userId) {
      setRecords([]);
      return;
    }
    loadRecords(userId);
    loadAlarm();
  }, [userId]);

  async function loadRecords(id: string) {
    try {
      const res = await sleepinfoApi(id);
      console.log("수면기록 응답:", JSON.stringify(res.data));
      const list = mapServerRecords(res.data);
      const rawMemos = await AsyncStorage.getItem(`@sleep_memos:${id}`);
      const memos = rawMemos ? JSON.parse(rawMemos) : {};
      const merged = list.map((r) =>
        memos[r.date] !== undefined ? { ...r, memo: memos[r.date] } : r
      );
      setRecords(merged);
      await AsyncStorage.setItem(`@sleep_records:${id}`, JSON.stringify(merged));
    } catch (e: any) {
      console.log("수면기록 조회 실패:", e.message, e.response?.status);
      console.log("상세:", JSON.stringify(e.response?.data));
      // 서버 실패 시 이 계정의 캐시만 사용
      const cached = await AsyncStorage.getItem(`@sleep_records:${id}`);
      setRecords(cached ? JSON.parse(cached) : []);
    }
  }
  function safeDate(v: any): Date | null {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  // "HH:MM:SS"(UTC) → "HH:MM"(KST)
  function serverTimeToHm(t?: string): string {
    if (!t) return "--:--";
    return t.slice(0, 5);   // "19:29:41" → "19:29"
  }

  function mapServerRecords(data: any): SleepRecord[] {
    const arr = Array.isArray(data) ? data : data?.records ?? data?.data ?? [];
    return arr
      .map((r: any, i: number) => ({
        id: String(r.id ?? r.sleep_id ?? r.created_at ?? i),
        date: r.day,
        startTime: serverTimeToHm(r.start_sleep),
        endTime: serverTimeToHm(r.end_sleep),
        durationMinutes: r.duration ?? 0,
        score: r.sleep_score ?? 0,
        temperature: r.temp_avg,
        humidity: r.hum_avg,
        memo: r.memo,
      }))
      .sort((a: SleepRecord, b: SleepRecord) =>
        a.date === b.date ? 0 : a.date < b.date ? -1 : 1
      );
  }
  async function loadAlarm() {
    try {
      const stored = await AsyncStorage.getItem("@alarm_settings");
      if (stored) {
        const a = JSON.parse(stored);
        if (typeof a.hour === "number") setAlarmHour(a.hour);
        if (typeof a.min === "number") setAlarmMin(a.min);
        if (typeof a.on === "boolean") setAlarmOnState(a.on);
        if (typeof a.hour === "number" && typeof a.min === "number") {
          await rescheduleAlarm(a.hour, a.min, typeof a.on === "boolean" ? a.on : true);
        }
      }
      const rawPresets = await AsyncStorage.getItem("@alarm_presets");
      if (rawPresets) setAlarmPresets(JSON.parse(rawPresets));
    } catch { }
  }

  async function setAlarm(hour: number, min: number) {
    setAlarmHour(hour);
    setAlarmMin(min);
    await AsyncStorage.setItem("@alarm_settings", JSON.stringify({ hour, min, on: alarmOn }));
    await rescheduleAlarm(hour, min, alarmOn);
  }

  async function setAlarmOn(on: boolean) {
    setAlarmOnState(on);
    await AsyncStorage.setItem("@alarm_settings", JSON.stringify({ hour: alarmHour, min: alarmMin, on }));
    await rescheduleAlarm(alarmHour, alarmMin, on);
  }

  function startSleep() {
    setActiveSession({
      startTime: new Date(),
      temperature: 22 + Math.floor(Math.random() * 5),
      humidity: 50 + Math.floor(Math.random() * 20),
    });
  }

  async function updateRating(
    id: string,
    ratings: { total: number; temp: number; hum: number }
  ) {
    console.log("updateRating 호출:", id, userId);
    const target =
      lastRecordRef.current?.id === id
        ? lastRecordRef.current
        : records.find((r) => r.id === id);
    console.log("target:", !!target);
    if (!target) return;

    const score = Math.round(
      (ratings.total / 5) * 100 * 0.6 +
      (ratings.temp / 5) * 100 * 0.2 +
      (ratings.hum / 5) * 100 * 0.2
    );

    const updatedRecord = {
      ...target,
      score,
      totalRating: ratings.total,
      tempRating: ratings.temp,
      humRating: ratings.hum,
    };
    const updated = records.map((r) => (r.id === id ? updatedRecord : r));
    setRecords((prev) => prev.map((r) => (r.id === id ? updatedRecord : r)));
    await AsyncStorage.setItem(recordsKey, JSON.stringify(updated));

    // 서버에 최종 점수 저장 (POST)
    const body = {
      id: Number(userId),
      sleep_score: score,
      start_sleep: toKstIso(target.startISO ?? new Date().toISOString()),
      end_sleep: toKstIso(target.endISO ?? new Date().toISOString()),
      temp_avg: target.temperature ?? 0,
      hum_avg: target.humidity ?? 0,
      audio_path: "none",
      duration: Math.max(1, Math.round(target.durationMinutes)),
      snoring_count: 0,
      memo: target.memo ?? "",
    };

    try {
      console.log("POST body:", JSON.stringify(body));
      const res = await saveSleepApi(body);
      console.log("수면기록 저장 응답:", res.status, JSON.stringify(res.data));
    } catch (e: any) {
      console.log("수면기록 저장 실패:", e.message, e.code, JSON.stringify(e.response?.data));
      Alert.alert("저장 실패", `${e.message}\n${JSON.stringify(e.response?.data ?? "")}`);
    }
  }

  async function endSleep(): Promise<SleepRecord | null> {
    if (!activeSession || !userId) return null;
    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - activeSession.startTime.getTime()) / 60000);
    const dateStr = toLocalDateStr(activeSession.startTime);
    const score = Math.min(100, Math.max(40, 70 + Math.floor(durationMinutes / 10)));
    const record: SleepRecord = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: dateStr,
      startTime: activeSession.startTime.toTimeString().slice(0, 5),
      endTime: endTime.toTimeString().slice(0, 5),
      durationMinutes: Math.max(1, durationMinutes),
      score,
      temperature: activeSession.temperature,
      humidity: activeSession.humidity,
      startISO: activeSession.startTime.toISOString(),   // ← 추가
      endISO: endTime.toISOString(),
    };
    const updated = [...records.filter((r) => r.date !== dateStr), record];
    setRecords(updated);
    setActiveSession(null);
    await AsyncStorage.setItem(recordsKey, JSON.stringify(updated));


    lastRecordRef.current = record;
    return record;
  }
  async function updateMemo(id: string, memo: string) {
    const target = records.find((r) => r.id === id);
    const updated = records.map((r) => (r.id === id ? { ...r, memo } : r));
    setRecords(updated);
    await AsyncStorage.setItem(recordsKey, JSON.stringify(updated));
    if (target) {
      const key = `@sleep_memos:${userId}`;
      const raw = await AsyncStorage.getItem(key);
      const memos = raw ? JSON.parse(raw) : {};
      memos[target.date] = memo;
      await AsyncStorage.setItem(key, JSON.stringify(memos));
    }
  }

  const getRecordByDate = useCallback(
    (date: string) => {
      for (let i = records.length - 1; i >= 0; i--) {
        if (records[i].date === date) return records[i];
      }
      return undefined;
    },
    [records]
  );

  const weeklyRecords = records.slice(-7);
  const averageDuration = records.length > 0
    ? Math.round(records.reduce((s, r) => s + r.durationMinutes, 0) / records.length) : 0;
  const averageScore = records.length > 0
    ? Math.round(records.reduce((s, r) => s + r.score, 0) / records.length) : 0;

  return (
    <SleepContext.Provider value={{
      records, activeSession, startSleep, endSleep, updateMemo,
      getRecordByDate, weeklyRecords, averageDuration, averageScore,
      alarmHour, alarmMin, alarmOn, setAlarm, setAlarmOn, updateRating,
      alarmPresets, addAlarmPreset, editAlarmPreset, removeAlarmPreset,
    }}>
      {children}
    </SleepContext.Provider>
  );
}

export function useSleep() {
  const ctx = useContext(SleepContext);
  if (!ctx) throw new Error("useSleep must be used within SleepProvider");
  return ctx;
}
