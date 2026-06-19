import { Audio } from "expo-av";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { useAuth } from "@/context/AuthContext";
import type { SleepRecord } from "@/lib/api";
import { createSleepInfoApi, getSensorApi, getSleepInfoApi } from "@/services/authApi";

export type { SleepRecord } from "@/lib/api";

type ActiveSleepSession = {
  startTime: Date;
  temperature: number;
  humidity: number;
  sensorUpdatedAt?: string;
};

interface SleepContextType {
  monthlyAverageDuration: number;
  monthlyAverageScore: number;
  records: SleepRecord[];
  activeSession: ActiveSleepSession | null;
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

const SNORE_DB_THRESHOLD = -42;
const SNORE_EVENT_COOLDOWN_MS = 3500;
const SNORE_ARMING_DELAY_MS = 10000;
const SENSOR_POLL_INTERVAL_MS = 5000;

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
    snoring_count: Math.round(record.snoringCount ?? 0),
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
    snoringCount: Number(item.snoring_count ?? item.snoringCount ?? 0),
    audioPath: item.audio_path ?? item.audioPath ?? "",
    memo: item.memo ?? "",
    createdAt: item.created_at ?? item.createdAt,
  };
}

function dedupeSleepRecords(records: SleepRecord[]) {
  const byDate = new Map<string, SleepRecord>();

  records.forEach((record) => {
    byDate.set(record.date, record);
  });

  return Array.from(byDate.values());
}

function getSensorList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.value)) return data.value;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.sensors)) return data.sensors;
  if (data && typeof data === "object") return [data];
  return [];
}

function getSensorTime(sensor: any) {
  const value = sensor?.time_stamp ?? sensor?.timestamp ?? sensor?.created_at ?? sensor?.createdAt;
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function pickLatestSensor(data: any) {
  return getSensorList(data)
    .filter((sensor) => sensor && typeof sensor === "object")
    .sort((a, b) => getSensorTime(b) - getSensorTime(a))[0];
}

function toFiniteNumber(value: any) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function SleepProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [records, setRecords] = useState<SleepRecord[]>([]);
  const [activeSession, setActiveSession] = useState<SleepContextType["activeSession"]>(null);
  const [alarmHour, setAlarmHour] = useState(7);
  const [alarmMin, setAlarmMin] = useState(0);
  const [alarmOn, setAlarmOnState] = useState(true);
  const snoreRecordingRef = useRef<Audio.Recording | null>(null);
  const snoreCountRef = useRef(0);
  const lastSnoreAtRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const recordingRequestedRef = useRef(false);

  useEffect(() => {
    return () => {
      void stopSnoreRecording();
    };
  }, []);

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

  useEffect(() => {
    if (!user?.id || !activeSession) return;

    void refreshSensorSnapshot(user.id);
    const interval = setInterval(() => {
      void refreshSensorSnapshot(user.id);
    }, SENSOR_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user?.id, activeSession?.startTime]);

  async function loadRecords(userId: string) {
    try {
      const res = await getSleepInfoApi(userId);
      const converted = getSleepRecordList(res.data).map((item, index) =>
        normalizeSleepRecord(item, userId, index)
      );
      setRecords(dedupeSleepRecords(converted));
    } catch (error) {
      console.log("Failed to load sleep records", error);
    }
  }

  async function refreshSensorSnapshot(userId: string) {
    try {
      const res = await getSensorApi(userId);
      const latest = pickLatestSensor(res.data);
      if (!latest) return;

      const temperature = toFiniteNumber(latest.temp ?? latest.temperature ?? latest.temp_avg);
      const humidity = toFiniteNumber(latest.hum ?? latest.humidity ?? latest.hum_avg);

      if (temperature === null && humidity === null) return;

      setActiveSession((current) => {
        if (!current) return current;
        return {
          ...current,
          temperature: temperature === null ? current.temperature : Math.round(temperature),
          humidity: humidity === null ? current.humidity : Math.round(humidity),
          sensorUpdatedAt: new Date().toISOString(),
        };
      });
    } catch (error) {
      console.log("Failed to load sensor snapshot", error);
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
    recordingRequestedRef.current = true;
    void startSnoreRecording();
    if (user?.id) void refreshSensorSnapshot(user.id);
  }

  async function startSnoreRecording() {
    if (Platform.OS === "web" || snoreRecordingRef.current || !recordingRequestedRef.current) return;

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) return;

      snoreCountRef.current = 0;
      lastSnoreAtRef.current = 0;
      recordingStartedAtRef.current = Date.now();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      if (!recordingRequestedRef.current) return;

      const { recording } = await Audio.Recording.createAsync(
        {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
        },
        handleRecordingStatus,
        1000
      );

      snoreRecordingRef.current = recording;
    } catch (error) {
      console.log("Failed to start snore recording", error);
    }
  }

  function handleRecordingStatus(status: any) {
    if (!status?.isRecording || typeof status.metering !== "number") return;

    const now = Date.now();
    const isArmed = now - recordingStartedAtRef.current >= SNORE_ARMING_DELAY_MS;
    const isLoudEnough = status.metering >= SNORE_DB_THRESHOLD;
    const cooledDown = now - lastSnoreAtRef.current >= SNORE_EVENT_COOLDOWN_MS;

    if (isArmed && isLoudEnough && cooledDown) {
      snoreCountRef.current += 1;
      lastSnoreAtRef.current = now;
    }
  }

  async function stopSnoreRecording() {
    const recording = snoreRecordingRef.current;
    recordingRequestedRef.current = false;
    snoreRecordingRef.current = null;

    if (!recording) {
      return {
        audioPath: "",
        snoringCount: snoreCountRef.current,
      };
    }

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      return {
        audioPath: "",
        snoringCount: snoreCountRef.current,
      };
    } catch (error) {
      console.log("Failed to stop snore recording", error);
      return {
        audioPath: "",
        snoringCount: snoreCountRef.current,
      };
    }
  }

  async function endSleep(): Promise<SleepRecord | null> {
    if (!activeSession) return null;

    const session = activeSession;

    try {
      const endTime = new Date();
      const snoreResult = await stopSnoreRecording();
      const durationMinutes = Math.round((endTime.getTime() - session.startTime.getTime()) / 60000);
      const date = session.startTime.toISOString().split("T")[0];
      const userId = user?.id ?? "local";
      const score = Math.min(100, Math.max(40, 70 + Math.floor(durationMinutes / 10)));
      const record: SleepRecord = {
        id: `${userId}-${date}`,
        date,
        startTime: session.startTime.toTimeString().slice(0, 5),
        endTime: endTime.toTimeString().slice(0, 5),
        durationMinutes: Math.max(1, durationMinutes),
        score,
        temperature: session.temperature,
        humidity: session.humidity,
        snoringCount: snoreResult.snoringCount,
        audioPath: snoreResult.audioPath,
        memo: "",
      };

      setRecords((current) => dedupeSleepRecords([...current, record]));

      if (user) {
        try {
          await createSleepInfoApi(buildSleepInfoPayload(user.id, record));
          await loadRecords(user.id);
        } catch (error) {
          console.log("Failed to sync sleep record", error);
        }
      }

      setActiveSession(null);
      return record;
    } catch (error) {
      console.log("Failed to create sleep record", error);
      return null;
    } finally {
      recordingRequestedRef.current = false;
      setActiveSession(null);
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
