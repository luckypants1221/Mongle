import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

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
}

const SleepContext = createContext<SleepContextType | null>(null);

function genSampleRecords(): SleepRecord[] {
  const now = new Date();
  const records: SleepRecord[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (i === 0) continue;
    const dateStr = d.toISOString().split("T")[0];
    const dur = 360 + Math.floor(Math.random() * 120);
    records.push({
      id: `sample_${i}`,
      date: dateStr,
      startTime: "23:00",
      endTime: `0${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, "0")}`,
      durationMinutes: dur,
      score: 60 + Math.floor(Math.random() * 40),
      temperature: 22 + Math.floor(Math.random() * 5),
      humidity: 45 + Math.floor(Math.random() * 20),
    });
  }
  return records;
}

export function SleepProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<SleepRecord[]>([]);
  const [activeSession, setActiveSession] = useState<SleepContextType["activeSession"]>(null);
  const [alarmHour, setAlarmHour] = useState(7);
  const [alarmMin, setAlarmMin] = useState(0);
  const [alarmOn, setAlarmOnState] = useState(true);

  useEffect(() => { loadRecords(); loadAlarm(); }, []);

  async function loadRecords() {
    try {
      const stored = await AsyncStorage.getItem("@sleep_records");
      if (stored) {
        setRecords(JSON.parse(stored));
      } else {
        const sample = genSampleRecords();
        setRecords(sample);
        await AsyncStorage.setItem("@sleep_records", JSON.stringify(sample));
      }
    } catch {}
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
    } catch {}
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

  function startSleep() {
    setActiveSession({
      startTime: new Date(),
      temperature: 22 + Math.floor(Math.random() * 5),
      humidity: 50 + Math.floor(Math.random() * 20),
    });
  }

  async function endSleep(): Promise<SleepRecord | null> {
    if (!activeSession) return null;
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
    await AsyncStorage.setItem("@sleep_records", JSON.stringify(updated));
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
      alarmHour, alarmMin, alarmOn, setAlarm, setAlarmOn,
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
