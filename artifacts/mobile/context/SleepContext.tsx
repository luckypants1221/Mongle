import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, type SleepRecord } from "@/lib/api";

export type { SleepRecord } from "@/lib/api";

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

export function SleepProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [records, setRecords] = useState<SleepRecord[]>([]);
  const [activeSession, setActiveSession] = useState<SleepContextType["activeSession"]>(null);
  const [alarmHour, setAlarmHour] = useState(7);
  const [alarmMin, setAlarmMin] = useState(0);
  const [alarmOn, setAlarmOnState] = useState(true);

  useEffect(() => {
    if (!user) {
      setRecords([]);
      setActiveSession(null);
      setAlarmHour(7);
      setAlarmMin(0);
      setAlarmOnState(true);
      return;
    }

    loadRecords(user.id);
    loadAlarm(user.id);
  }, [user?.id]);

  async function loadRecords(userId: string) {
    try {
      const nextRecords = await api.getSleepRecords(userId);
      setRecords(nextRecords);
    } catch {}
  }

  async function loadAlarm(userId: string) {
    try {
      const alarm = await api.getAlarm(userId);
      setAlarmHour(alarm.hour);
      setAlarmMin(alarm.min);
      setAlarmOnState(alarm.on);
    } catch {}
  }

  async function setAlarm(hour: number, min: number) {
    if (!user) return;
    setAlarmHour(hour);
    setAlarmMin(min);
    await api.updateAlarm(user.id, { hour, min, on: alarmOn });
  }

  async function setAlarmOn(on: boolean) {
    if (!user) return;
    setAlarmOnState(on);
    await api.updateAlarm(user.id, { hour: alarmHour, min: alarmMin, on });
  }

  function startSleep() {
    setActiveSession({
      startTime: new Date(),
      temperature: 22 + Math.floor(Math.random() * 5),
      humidity: 50 + Math.floor(Math.random() * 20),
    });
  }

  async function endSleep(): Promise<SleepRecord | null> {
    if (!activeSession || !user) return null;
    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - activeSession.startTime.getTime()) / 60000);
    const dateStr = activeSession.startTime.toISOString().split("T")[0];
    const score = Math.min(100, Math.max(40, 70 + Math.floor(durationMinutes / 10)));
    const record = await api.createSleepRecord(user.id, {
      date: dateStr,
      startTime: activeSession.startTime.toTimeString().slice(0, 5),
      endTime: endTime.toTimeString().slice(0, 5),
      durationMinutes: Math.max(1, durationMinutes),
      score,
      temperature: activeSession.temperature,
      humidity: activeSession.humidity,
    });
    const updated = [...records.filter((r) => r.date !== dateStr), record];
    setRecords(updated);
    setActiveSession(null);
    return record;
  }

  async function updateMemo(id: string, memo: string) {
    if (!user) return;
    const updated = records.map((r) => r.id === id ? { ...r, memo } : r);
    setRecords(updated);
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
