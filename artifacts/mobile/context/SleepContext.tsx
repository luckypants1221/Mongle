import { snoringCountForApi, type SnoreAnalysisStatus } from "../lib/snoreCandidateAnalyzer";
import type { RecordingState } from "../hooks/useSleepRecording";
import { useSleepRecording } from "../hooks/useSleepRecording";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { sleepinfoApi, saveSleepApi } from "@/services/authApi";
// Health Connect 는 safeHealth 를 통해서만 접근 (실패해도 수면 측정에는 영향 없음)
import { tryPrepareHealth, tryReadHealth } from "../lib/safeHealth";
// import type { ActualSleepStage } from "../lib/mongleHeartRate";
import { calculateSleepEnvironmentRecommendation, EnvironmentRecommendation } from "../lib/sleepEnvironmentRecommendation";

export interface SleepRecord {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  startIso?: string;       // 서버 전송용 시작 시각 (ISO, UTC)
  endIso?: string;         // 서버 전송용 종료 시각 (ISO, UTC)
  serverSaved?: boolean;   // 서버 저장 완료 여부 (중복 저장 방지)
  durationMinutes: number;
  score: number;
  temperature?: number;
  humidity?: number;
  memo?: string;
  totalRating?: number;
  tempRating?: number;
  humRating?: number;
  snoringCount?: number | null;
  snoringAnalysis?: SnoreAnalysisStatus;
}

interface SleepContextType {
  records: SleepRecord[];
  recordingState: RecordingState;
  environmentRecommendation: EnvironmentRecommendation | null;
  activeSession: { startTime: Date; temperature: number; humidity: number } | null;
  /** 가장 최근 수면의 워치 수면 단계 (없으면 빈 배열) → RemGraph 의 stages 로 전달 */
  latestStages: [];
  refreshLatestStages: () => Promise<boolean>;
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

// API가 한국 현지시각을 기대할 때 사용하는 ISO 8601(+09:00) 표현.
// Date 객체 자체의 시점은 변경하지 않는다.
function toKstIso(date: Date): string {
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return shifted.toISOString().replace("Z", "+09:00");
}

type Ratings = { total: number; temp: number; hum: number };

// 수면 점수: 수면 시간 30% + 전체 만족도 50% + 온도 만족도 10% + 습도 만족도 10%
function calcScore(durationMinutes: number, r?: Ratings): number {
  const durationScore = Math.min(100, (durationMinutes / 480) * 100); // 8시간 = 100점
  if (!r) return Math.round(durationScore); // 평점이 없으면 수면 시간 점수만
  return Math.round(
    durationScore * 0.3 +
    (r.total / 5) * 100 * 0.5 +
    (r.temp / 5) * 100 * 0.1 +
    (r.hum / 5) * 100 * 0.1
  );
}

export function SleepProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { startRecording, stopRecording, cancelRecording, recordingState } = useSleepRecording();
  const userId =
    user?.id ?? (user as any)?.user_id;
  const recordsKey = `@sleep_records:${userId}`;
  const stagesKey = `@sleep_stages:${userId}`;
  const [records, setRecords] = useState<SleepRecord[]>([]);
  const [latestStages, setLatestStages] = useState<ActualSleepStage[]>([]);
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
      setLatestStages([]);
      return;
    }
    loadRecords(userId);
    loadStages(userId);
    loadAlarm();
    loadAlarmPresets();
    return () => { void cancelRecording(); };
  }, [userId, cancelRecording]);

  // ── 서버 저장 ──────────────────────────────────────────────

  async function pushToServer(rec: SleepRecord, score: number): Promise<boolean> {
    if (!userId || !rec.startIso || !rec.endIso) return false;
    try {
      const res = await saveSleepApi({
        id: Number(userId),
        sleep_score: score,
        start_sleep: rec.startIso,
        end_sleep: rec.endIso,
        temp_avg: rec.temperature ?? 0,
        hum_avg: rec.humidity ?? 0,
        audio_path: "",
        duration: rec.durationMinutes,
        snoring_count: snoringCountForApi(rec.snoringCount),
        memo: rec.memo ?? "",
      });
      console.log("수면기록 저장 응답:", JSON.stringify(res.data));
      return true;
    } catch (e: any) {
      console.log("수면기록 저장 실패:", e.message, e.response?.status, JSON.stringify(e.response?.data));
      console.log("보낸 데이터:", e.config?.data);
      return false;
    }
  }

  // 서버에 아직 안 올라간 기록을 모두 저장하고, 갱신된 목록을 반환
  async function flushPending(list: SleepRecord[]): Promise<SleepRecord[]> {
    const result: SleepRecord[] = [];
    for (const rec of list) {
      if (rec.serverSaved === false && rec.totalRating != null) {
        const ratings: Ratings | undefined =
          rec.totalRating != null
            ? { total: rec.totalRating, temp: rec.tempRating ?? 3, hum: rec.humRating ?? 3 }
            : undefined;
        const score = calcScore(rec.durationMinutes, ratings);
        const ok = await pushToServer(rec, score);
        result.push(ok ? { ...rec, score, serverSaved: true } : rec);
      } else {
        result.push(rec);
      }
    }
    return result;
  }

  // ── 불러오기 ──────────────────────────────────────────────

  async function loadRecords(id: string) {
    // 1) 로컬 캐시 중 서버에 못 올린 기록을 먼저 저장 시도
    let pending: SleepRecord[] = [];
    let cachedMetadata: SleepRecord[] = [];
    try {
      const cachedRaw = await AsyncStorage.getItem(`@sleep_records:${id}`);
      const cached: SleepRecord[] = cachedRaw ? JSON.parse(cachedRaw) : [];
      const flushed = await flushPending(cached);
      cachedMetadata = flushed;
      pending = flushed.filter((r) => r.serverSaved === false); // 아직도 실패한 것
      if (flushed.some((r, i) => r !== cached[i])) {
        await AsyncStorage.setItem(`@sleep_records:${id}`, JSON.stringify(flushed));
      }
    } catch (e) {
      console.log("대기 기록 처리 실패:", e);
    }

    // 2) 서버 목록 불러오기 + 아직 못 올린 로컬 기록 병합
    try {
      const res = await sleepinfoApi(id);
      // loadRecords 안, sleepinfoApi 응답 직후
      const last = res.data?.[res.data.length - 1];
      console.log("[서버]", JSON.stringify(last));
      console.log("[변환]", utcTimeToKst(last?.start_sleep), utcTimeToKst(last?.end_sleep));
      const serverRecords = mapServerRecords(res.data).map((record) => {
        // 서버에는 분석 상태 필드가 없어 같은 기기의 캐시에서 복원한다.
        const matches = cachedMetadata.filter((cached) => cached.serverSaved &&
          cached.date === record.date && cached.startTime === record.startTime &&
          cached.endTime === record.endTime && cached.durationMinutes === record.durationMinutes);
        if (matches.length === 1 && matches[0].snoringAnalysis) {
          return { ...record, snoringCount: matches[0].snoringCount, snoringAnalysis: matches[0].snoringAnalysis };
        }
        return record;
      });
      const list = [...serverRecords, ...pending];
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

  // 수면 단계는 서버 응답으로 덮어써지지 않도록 별도 키에 저장/복원
  async function loadStages(id: string) {
    try {
      const raw = await AsyncStorage.getItem(`@sleep_stages:${id}`);
      setLatestStages(raw ? JSON.parse(raw) : []);
    } catch (e) {
      console.log("수면 단계 불러오기 실패:", e);
      setLatestStages([]);
    }
  }

  // "HH:MM:SS"(UTC) → "HH:MM"(KST)
  function utcTimeToKst(t?: string): string {
    if (!t) return "--:--";

    const match = t.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);

    if (match) {
      return `${match[1]}:${match[2]}`;
    }

    return "--:--";
  }

  const mapServerRecords = (data: any): SleepRecord[] => {
    const arr = Array.isArray(data) ? data : data?.records ?? data?.data ?? [];

    return arr.map((r: any, i: number) => ({
      id: String(r.record_id ?? r.id ?? i),
      date: r.day,
      startTime: utcTimeToKst(r.start_sleep),
      endTime: utcTimeToKst(r.end_sleep),
      serverSaved: true,
      durationMinutes: r.duration ?? 0,
      score: r.sleep_score ?? 0,
      temperature: r.temp_avg,
      humidity: r.hum_avg,
      memo: r.memo,

      // 추가
      snoringCount: r.snoring_count == null
        ? null
        : Number(r.snoring_count),
    }));
  };

  // ── 알람 ──────────────────────────────────────────────

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

  // ── 수면 시작 / 종료 ──────────────────────────────────────

  function startSleep() {
    if (activeSession) return;
    void startRecording();
    setActiveSession({
      startTime: new Date(),
      temperature: 22 + Math.floor(Math.random() * 5),
      humidity: 50 + Math.floor(Math.random() * 20),
    });
    // 결과를 기다리지 않음 (권한 거부/미지원이어도 수면 측정은 그대로 진행)
    tryPrepareHealth();
  }

  async function endSleep(): Promise<SleepRecord | null> {
    console.log("[endSleep] 호출됨", { hasSession: !!activeSession, userId });
    if (!activeSession || !userId) {
      console.log("[endSleep] 세션 또는 userId 없음 → 저장하지 않고 종료");
      return null;
    }
    const endTime = new Date();
    const startMs = activeSession.startTime.getTime();
    const endMs = endTime.getTime();
    const durationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));
    // 홈 화면 달력(toLocalDateStr)과 같은 기준으로 날짜 계산
    const dateStr = toLocalDateStr(activeSession.startTime);

    const snoring = await stopRecording();

    const record: SleepRecord = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: dateStr,
      snoringCount: snoring.count,
      snoringAnalysis: snoring.status,
      startTime: activeSession.startTime.toTimeString().slice(0, 5),
      endTime: endTime.toTimeString().slice(0, 5),
      startIso: toKstIso(activeSession.startTime),
      endIso: toKstIso(endTime),
      serverSaved: false,
      durationMinutes,
      score: calcScore(durationMinutes), // 평점 입력 후 최종 점수로 갱신됨
      temperature: activeSession.temperature,
      humidity: activeSession.humidity,
    };
    // endSleep 안, record 만든 직후
    console.log("[TZ]", Intl.DateTimeFormat().resolvedOptions().timeZone, new Date().getTimezoneOffset());
    console.log("[로컬]", record.startTime, record.endTime, record.startIso, record.endIso);
    // 같은 날짜의 기존 기록은 교체하되, 서버에 못 올린 기록은 유지
    const updated = [
      ...records.filter((r) => r.date !== dateStr || r.serverSaved === false),
      record,
    ];
    setRecords(updated);
    setActiveSession(null);
    await AsyncStorage.setItem(recordsKey, JSON.stringify(updated));

    // 서버 저장은 평점 입력 시(updateRating) 최종 점수로 1회 수행.
    // 평점이 입력된 미전송 기록은 다음 실행 시 재전송한다.

    // 워치 수면 단계는 따로 읽음 (기다리지 않음)
    readAndStoreStages(startMs, endMs, userId);

    return record;
  }

  async function updateRating(id: string, ratings: Ratings) {
    const target = records.find((r) => r.id === id);
    if (!target) throw new Error("수면 기록을 찾을 수 없습니다.");

    const score = calcScore(target.durationMinutes, ratings);

    // 아직 서버에 저장 안 된 기록만 저장 (중복 방지)
    let serverSaved = target.serverSaved ?? false;
    if (!serverSaved) {
      serverSaved = await pushToServer(target, score);
    }

    const updated = records.map((r) =>
      r.id === id
        ? {
          ...r,
          score,
          serverSaved,
          totalRating: ratings.total,
          tempRating: ratings.temp,
          humRating: ratings.hum,
        }
        : r
    );
    setRecords(updated);
    await AsyncStorage.setItem(recordsKey, JSON.stringify(updated));
    if (!serverSaved) throw new Error("수면 기록을 기기에 보관했습니다. 서버 저장에 실패했으니 다시 완료를 눌러주세요.");
  }

  async function refreshLatestStages(): Promise<boolean> {
    if (!userId) return false;
    const latest = [...records]
      .filter((r) => !!r.startIso && !!r.endIso)
      .sort((a, b) => Date.parse(b.endIso!) - Date.parse(a.endIso!))[0];
    if (!latest?.startIso || !latest?.endIso) return false;
    const startMs = Date.parse(latest.startIso);
    const endMs = Date.parse(latest.endIso);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false;
    const ready = await tryPrepareHealth();
    if (!ready) return false;
    const health = await tryReadHealth(startMs, endMs);
    if (!health.stages.length) return false;
    setLatestStages(health.stages);
    await AsyncStorage.setItem(`@sleep_stages:${userId}`, JSON.stringify(health.stages));
    return true;
  }

  async function readAndStoreStages(startMs: number, endMs: number, uid: string) {
    try {
      const health = await tryReadHealth(startMs, endMs);
      if (health.stages.length > 0) {
        setLatestStages(health.stages);
        await AsyncStorage.setItem(`@sleep_stages:${uid}`, JSON.stringify(health.stages));
      }
    } catch (e) {
      console.log("수면 단계 저장 실패:", e);
    }
  }

  async function updateMemo(id: string, memo: string) {
    const updated = records.map((r) => (r.id === id ? { ...r, memo } : r));
    setRecords(updated);
    await AsyncStorage.setItem(recordsKey, JSON.stringify(updated));
  }

  const getRecordByDate = useCallback(
    (date: string) => records.find((r) => r.date === date),
    [records]
  );

  const environmentRecommendation = useMemo(
    () => calculateSleepEnvironmentRecommendation(records),
    [records]
  );
  useEffect(() => {
    console.log("[추천] 전체 수면 기록:", records.length);
    console.log("[추천] 계산 결과:", environmentRecommendation);
  }, [records, environmentRecommendation]);

  const weeklyRecords = records.slice(-7);
  const averageDuration = records.length > 0
    ? Math.round(records.reduce((s, r) => s + r.durationMinutes, 0) / records.length) : 0;
  const averageScore = records.length > 0
    ? Math.round(records.reduce((s, r) => s + r.score, 0) / records.length) : 0;

  return (
    <SleepContext.Provider value={{
      records, recordingState, environmentRecommendation, activeSession, latestStages, refreshLatestStages, startSleep, endSleep, updateMemo,
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