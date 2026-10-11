import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { sleepinfoApi, saveSleepApi } from "@/services/authApi";

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
  alarmPresets: { h: number; m: number }[];
  addAlarmPreset: (h: number, m: number) => Promise<void>;
  editAlarmPreset: (
    oldH: number,
    oldM: number,
    newH: number,
    newM: number
  ) => Promise<void>;
  removeAlarmPreset: (h: number, m: number) => Promise<void>;
  updateRating: (
    id: string,
    ratings: { total: number; temp: number; hum: number }
  ) => Promise<void>;
}

const SleepContext = createContext<SleepContextType | null>(null);


export function toLocalDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
  const [alarmPresets, setAlarmPresets] = useState<
    { h: number; m: number }[]
  >([
    { h: 6, m: 0 },
    { h: 7, m: 0 },
    { h: 7, m: 30 },
    { h: 8, m: 0 },
  ]);

  useEffect(() => {
    setActiveSession(null);
    if (!userId) {
      setRecords([]);
      return;
    }
    loadRecords(userId);
    loadAlarm();
    loadAlarmPresets();
  }, [userId]);

  async function loadRecords(id: string) {
    try {
      const res = await sleepinfoApi(id);
      console.log("수면기록 응답:", JSON.stringify(res.data));
      const list = mapServerRecords(res.data);
      setRecords(list);
      await AsyncStorage.setItem(`@sleep_records:${id}`, JSON.stringify(list));
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
  function utcTimeToKst(t?: string): string {
    if (!t) return "--:--";
    const [h, m] = t.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return "--:--";
    const kstH = (h + 9) % 24;
    return `${String(kstH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function mapServerRecords(data: any): SleepRecord[] {
    const arr = Array.isArray(data) ? data : data?.records ?? data?.data ?? [];
    return arr
      .map((r: any, i: number) => ({
        id: String(r.id ?? r.sleep_id ?? r.created_at ?? i),
        date: r.day,
        startTime: utcTimeToKst(r.start_sleep),
        endTime: utcTimeToKst(r.end_sleep),
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
      }
    } catch { }
  }
  async function loadAlarmPresets() {
    try {
      const stored = await AsyncStorage.getItem("@alarm_presets");

      if (stored) {
        const parsed = JSON.parse(stored);

        if (Array.isArray(parsed)) {
          setAlarmPresets(parsed);
        }
      }
    } catch (error) {
      console.log("알람 프리셋 불러오기 실패:", error);
    }
  }

  async function setAlarm(hour: number, min: number) {
    setAlarmHour(hour);
    setAlarmMin(min);
    await AsyncStorage.setItem("@alarm_settings", JSON.stringify({ hour, min, on: alarmOn }));
  }

  async function setAlarmOn(on: boolean) {
    setAlarmOnState(on);
    await AsyncStorage.setItem("@alarm_settings", JSON.stringify({ hour: alarmHour, min: alarmMin, on }));
  }
  async function addAlarmPreset(h: number, m: number) {
    const exists = alarmPresets.some((p) => p.h === h && p.m === m);
    if (exists) return;

    const updated = [...alarmPresets, { h, m }].sort(
      (a, b) => a.h * 60 + a.m - (b.h * 60 + b.m)
    );

    setAlarmPresets(updated);
    await AsyncStorage.setItem("@alarm_presets", JSON.stringify(updated));
  }

  async function editAlarmPreset(
    oldH: number,
    oldM: number,
    newH: number,
    newM: number
  ) {
    const exists = alarmPresets.some(
      (p) =>
        p.h === newH &&
        p.m === newM &&
        !(p.h === oldH && p.m === oldM)
    );

    if (exists) return;

    const updated = alarmPresets
      .map((p) =>
        p.h === oldH && p.m === oldM ? { h: newH, m: newM } : p
      )
      .sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));

    setAlarmPresets(updated);
    await AsyncStorage.setItem("@alarm_presets", JSON.stringify(updated));
  }

  async function removeAlarmPreset(h: number, m: number) {
    const updated = alarmPresets.filter(
      (p) => !(p.h === h && p.m === m)
    );

    setAlarmPresets(updated);
    await AsyncStorage.setItem("@alarm_presets", JSON.stringify(updated));
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
    const updated = records.map((r) => {
      if (r.id !== id) return r;
      // const durationScore = Math.min(100, (r.durationMinutes / 480) * 100); // 8시간 = 100점
      const score = Math.round(
        // durationScore * 0.3 +
        (ratings.total / 5) * 100 * 0.5 +
        (ratings.temp / 5) * 100 * 0.1 +
        (ratings.hum / 5) * 100 * 0.1
      );
      return {
        ...r,
        score,
        totalRating: ratings.total,
        tempRating: ratings.temp,
        humRating: ratings.hum,
      };
    });
    setRecords(updated);
    await AsyncStorage.setItem("@sleep_records", JSON.stringify(updated));
  }

  async function endSleep(): Promise<SleepRecord | null> {
    if (!activeSession || !userId) return null;
    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - activeSession.startTime.getTime()) / 60000);
    const dateStr = activeSession.startTime.toISOString().split("T")[0];
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
    };
    const updated = [...records.filter((r) => r.date !== dateStr), record];
    setRecords(updated);
    setActiveSession(null);
    await AsyncStorage.setItem(recordsKey, JSON.stringify(updated));
    try {
      const res = await saveSleepApi({
        id: Number(userId),
        sleep_score: record.score,
        start_sleep: activeSession.startTime.toISOString(),
        end_sleep: endTime.toISOString(),
        temp_avg: record.temperature ?? 0,
        hum_avg: record.humidity ?? 0,
        audio_path: "",
        duration: record.durationMinutes,
        snoring_count: 0,
        memo: record.memo ?? "",
      });
      console.log("수면기록 저장 응답:", JSON.stringify(res.data));
    } catch (e: any) {
      console.log("수면기록 저장 실패:", e.message, JSON.stringify(e.response?.data));
    }
    return record;
  }

  async function updateMemo(id: string, memo: string) {
    const updated = records.map((r) => r.id === id ? { ...r, memo } : r);
    setRecords(updated);
    await AsyncStorage.setItem("@sleep_records", JSON.stringify(updated));
  }

  const getRecordByDate = useCallback(
    (date: string) => records.find((r) => r.date === date),
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
      alarmPresets,
      addAlarmPreset,
      editAlarmPreset,
      removeAlarmPreset,
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
