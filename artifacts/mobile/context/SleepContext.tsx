import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import type { SleepRecord } from "@/lib/api";
import { createSleepInfoApi, getSleepInfoApi } from "@/services/authApi";

export type { SleepRecord } from "@/lib/api";

interface SleepContextType {
  monthlyAverageDuration: number;
  monthlyAverageScore: number;
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

function getSleepRecordList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.value)) return data.value;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.sleep_records)) return data.sleep_records;
  return [];
}

function toDateString(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  return value.split("T")[0];
}

function toTimeString(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toTimeString().slice(0, 5);
  return value.includes("T") ? value.split("T")[1]?.slice(0, 5) ?? "" : value.slice(0, 5);
}

function buildDateTime(date: string, time: string) {
  if (time.includes("T")) return new Date(time);
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${normalizedTime}`);
}

function buildSleepInfoPayload(userId: string, record: SleepRecord) {
  const startSleep = buildDateTime(record.date, record.startTime);
  const endSleep = buildDateTime(record.date, record.endTime);

  if (endSleep.getTime() < startSleep.getTime()) {
    endSleep.setDate(endSleep.getDate() + 1);
  }

  return {
    id: Number(userId),
    sleep_score: record.score,
    start_sleep: startSleep.toISOString(),
    end_sleep: endSleep.toISOString(),
    temp_avg: Math.round(record.temperature ?? 0),
    hum_avg: Math.round(record.humidity ?? 0),
    audio_path: "",
    duration: record.durationMinutes,
    snoring_count: 0,
    memo: record.memo ?? "",
  };
}

function normalizeSleepRecord(item: any, userId: string, index: number): SleepRecord {
  const startSleep = item.start_sleep ?? item.startTime ?? item.start_time;
  const endSleep = item.end_sleep ?? item.endTime ?? item.end_time;
  const date = toDateString(item.day ?? item.date ?? startSleep);

  return {
    id: String(item.sleep_id ?? item.record_id ?? item.id ?? `${userId}-${date}-${index}`),
    date,
    durationMinutes: Math.round(Number(item.duration ?? item.durationMinutes ?? item.duration_minutes ?? 0)),
    score: Number(item.sleep_score ?? item.score ?? 0),
    startTime: toTimeString(startSleep),
    endTime: toTimeString(endSleep),
    temperature: item.temp_avg ?? item.temperature,
    humidity: item.hum_avg ?? item.humidity,
    memo: item.memo ?? "",
  };
}

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
  }, [user?.id]);

  async function loadRecords(userId: string) {
    try {
      const res = await getSleepInfoApi(userId);
      const converted = getSleepRecordList(res.data).map((item, index) =>
        normalizeSleepRecord(item, userId, index)
      );
      setRecords(converted);
    } catch (error) {
      console.log("Failed to load sleep records", error);
    }
  }

  async function setAlarm(hour: number, min: number) {
    setAlarmHour(hour);
    setAlarmMin(min);
  }

  async function setAlarmOn(on: boolean) {
    setAlarmOnState(on);
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

    try {
      const endTime = new Date();
      const durationMinutes = Math.round((endTime.getTime() - activeSession.startTime.getTime()) / 60000);
      const date = activeSession.startTime.toISOString().split("T")[0];
      const score = Math.min(100, Math.max(40, 70 + Math.floor(durationMinutes / 10)));
      const record: SleepRecord = {
        id: `${user.id}-${date}`,
        date,
        startTime: activeSession.startTime.toTimeString().slice(0, 5),
        endTime: endTime.toTimeString().slice(0, 5),
        durationMinutes: Math.max(1, durationMinutes),
        score,
        temperature: activeSession.temperature,
        humidity: activeSession.humidity,
        memo: "",
      };

      await createSleepInfoApi(buildSleepInfoPayload(user.id, record));
      await loadRecords(user.id);
      setActiveSession(null);
      return record;
    } catch (error) {
      console.log("Failed to create sleep record", error);
      return null;
    }
  }

  async function updateMemo(id: string, memo: string) {
    if (!user) return;

    const target = records.find((record) => record.id === id);
    if (!target) return;

    const updatedRecord = { ...target, memo };
    await createSleepInfoApi(buildSleepInfoPayload(user.id, updatedRecord));
    setRecords((current) => current.map((record) => (record.id === id ? updatedRecord : record)));
    await loadRecords(user.id);
  }

  const getRecordByDate = useCallback(
    (date: string) => records.find((record) => record.date === date),
    [records]
  );

  const oneMonthRecords = records.filter((record) => {
    const recordDate = new Date(record.date);
    const now = new Date();
    return now.getTime() - recordDate.getTime() <= 30 * 24 * 60 * 60 * 1000;
  });

  const monthlyAverageDuration =
    oneMonthRecords.length > 0
      ? Math.round(oneMonthRecords.reduce((sum, record) => sum + record.durationMinutes, 0) / oneMonthRecords.length)
      : 0;

  const monthlyAverageScore =
    oneMonthRecords.length > 0
      ? Math.round(oneMonthRecords.reduce((sum, record) => sum + record.score, 0) / oneMonthRecords.length)
      : 0;

  const weeklyRecords = records.slice(-7);

  const averageDuration =
    records.length > 0
      ? Math.round(records.reduce((sum, record) => sum + record.durationMinutes, 0) / records.length)
      : 0;

  const averageScore =
    records.length > 0
      ? Math.round(records.reduce((sum, record) => sum + record.score, 0) / records.length)
      : 0;

  return (
    <SleepContext.Provider
      value={{
        monthlyAverageDuration,
        monthlyAverageScore,
        records,
        activeSession,
        startSleep,
        endSleep,
        updateMemo,
        getRecordByDate,
        weeklyRecords,
        averageDuration,
        averageScore,
        alarmHour,
        alarmMin,
        alarmOn,
        setAlarm,
        setAlarmOn,
      }}
    >
      {children}
    </SleepContext.Provider>
  );
}

export function useSleep() {
  const ctx = useContext(SleepContext);
  if (!ctx) throw new Error("useSleep must be used within SleepProvider");
  return ctx;
}
