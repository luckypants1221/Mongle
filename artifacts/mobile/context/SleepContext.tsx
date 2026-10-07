import { Audio } from "expo-av";
import axios from "axios";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useSleepMusic } from "@/hooks/useSleepMusic";
import type { MusicState, MusicTrack } from "@/lib/sleepMusicPlayer";
import { localDateKey, type SnoreAnswers } from "@/lib/snorePrediction";
import { AccountRequestGate, parseAccountRecords, parseAccountSensor, requireAccountId, SleepSensorSamples } from "@/lib/accountData";
import type { SleepRecord, SleepRatings } from "@/lib/api";
import { buildSleepPayload, sameSleepMeasurement, SleepRecordWriter } from "@/lib/sleepRecording";
import { validSleepRatings } from "@/lib/sleepRecordMetadata";
import { createSleepInfoApi, getSensorApi, getSleepInfoApi, updateSleepInfoApi } from "@/services/authApi";
export type { SleepRecord } from "@/lib/api";

type ActiveSleepSession = {
  ownerKey: string; userId: string; measurementId: number; startTime: Date; endTime?: Date;
  temperature?: number; humidity?: number; sensorUpdatedAt?: string;
};
interface SleepContextType {
  monthlyAverageDuration: number; monthlyAverageScore: number | null;
  records: SleepRecord[]; recordsLoading: boolean; recordsError: string | null;
  activeSession: ActiveSleepSession | null;
  saveError: string | null; lastSavedRecord: SleepRecord | null;
  startSleep: () => void; endSleep: () => Promise<SleepRecord | null>;
  updateMemo: (id: string, memo: string) => Promise<void>;
  saveRatings: (ratings: SleepRatings) => Promise<void>;
  refreshRecords: () => Promise<void>;
  getRecordByDate: (date: string) => SleepRecord | undefined;
  weeklyRecords: SleepRecord[]; averageDuration: number; averageScore: number | null;
  alarmHour: number; alarmMin: number; alarmOn: boolean;
  setAlarm: (hour: number, min: number) => Promise<void>; setAlarmOn: (on: boolean) => Promise<void>;
  music: MusicState; selectMusic: (track: MusicTrack) => Promise<void>; toggleMusic: () => Promise<void>;
  setMusicVolume: (volume: number) => Promise<void>; currentDate: string;
  snoreAnswers: SnoreAnswers | null; saveSnoreAnswers: (answers: SnoreAnswers) => void;
}
const SleepContext = createContext<SleepContextType | null>(null);
const SNORE_EVENT_COOLDOWN_MS = 3500;
const SNORE_ARMING_DELAY_MS = 10000;
const SENSOR_POLL_INTERVAL_MS = 5000;
function averageScoreFor(records: SleepRecord[]): number | null {
  const available = records.filter(record => record.scoreAvailable !== false && Number.isFinite(record.score));
  return available.length ? Math.round(available.reduce((sum, record) => sum + record.score, 0) / available.length) : null;
}
function saveFailureMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 422) return "서버가 수면 기록의 형식을 처리하지 못했어요. 다시 시도해주세요.";
    if (error.response && error.response.status >= 500) return "서버에서 수면 기록을 저장하지 못했어요. 잠시 후 다시 시도해주세요.";
    return "서버 응답을 확인하지 못했어요. 연결을 확인하고 다시 시도해주세요.";
  }
  return error instanceof Error ? error.message : "수면 기록을 저장하지 못했어요. 다시 시도해주세요.";
}
export function SleepProvider({ children }: { children: React.ReactNode }) {
  const { user, sessionVersion } = useAuth();
  const ownerKey = user ? `${user.id}:${sessionVersion}` : null;
  const gate = useRef(new AccountRequestGate()).current;
  gate.setAccount(ownerKey);
  const [recordState, setRecordState] = useState<{ key: string | null; rows: SleepRecord[] }>({ key: null, rows: [] });
  const records = recordState.key === ownerKey ? recordState.rows : [];
  const [requestState, setRequestState] = useState<{ key: string | null; loading: boolean; error: string | null }>({ key: null, loading: false, error: null });
  const recordsLoading = Boolean(ownerKey && (requestState.key !== ownerKey || requestState.loading));
  const recordsError = requestState.key === ownerKey ? requestState.error : null;
  const [rawSession, setRawSession] = useState<ActiveSleepSession | null>(null);
  const activeSession = rawSession?.ownerKey === ownerKey ? rawSession : null;
  const [saveState, setSaveState] = useState<{ key: string | null; error: string | null; record: SleepRecord | null }>({ key: null, error: null, record: null });
  const saveError = saveState.key === ownerKey ? saveState.error : null;
  const lastSavedRecord = saveState.key === ownerKey ? saveState.record : null;
  const [alarmHour, setAlarmHour] = useState(7);
  const [alarmMin, setAlarmMin] = useState(0);
  const [alarmOn, setAlarmOnState] = useState(true);
  const [currentDate, setCurrentDate] = useState(() => localDateKey(new Date()));
  const [survey, setSurvey] = useState<{ key: string | null; date: string; answers: SnoreAnswers } | null>(null);
  const snoreAnswers = survey?.key === ownerKey && survey?.date === currentDate ? survey.answers : null;
  const snoreRecordingRef = useRef<Audio.Recording | null>(null);
  const snoreCountRef = useRef(0);
  const lastSnoreAtRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const recordingRunRef = useRef(0);
  const recordingAvailableRef = useRef(false);
  const measurementRef = useRef(0);
  const endingRef = useRef<number | null>(null);
  const sensorBusyRef = useRef<string | null>(null);
  const sensorSamplesRef = useRef<{ measurementId: number; samples: SleepSensorSamples } | null>(null);
  const pendingWriteRef = useRef<{ ownerKey: string; measurementId: number; writer: SleepRecordWriter } | null>(null);
  const { music, selectMusic, toggleMusic, setMusicVolume, stopMusic } = useSleepMusic(Boolean(activeSession && !activeSession.endTime), ownerKey ?? undefined);
  const musicAudibleRef = useRef(false);
  const musicLastActiveAtRef = useRef(0);
  const audible = music.playing || (music.loading && music.track !== "none");
  if (audible || musicAudibleRef.current) musicLastActiveAtRef.current = Date.now();
  musicAudibleRef.current = audible;

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(localDateKey(new Date())), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    gate.setAccount(ownerKey);
    return () => { gate.setAccount(null); void stopSnoreRecording(); };
  }, [ownerKey]);
  useEffect(() => {
    void stopSnoreRecording();
    setRawSession(null);
    pendingWriteRef.current = null;
    sensorSamplesRef.current = null;
    setSaveState({ key: ownerKey, error: null, record: null });
    setSurvey(null);
    setRecordState({ key: ownerKey, rows: [] });
    setRequestState({ key: ownerKey, loading: Boolean(ownerKey), error: null });
    setAlarmHour(7); setAlarmMin(0); setAlarmOnState(true);
    if (user && ownerKey) void loadRecords(user.id);
  }, [ownerKey]);
  useEffect(() => {
    if (!user || !activeSession || activeSession.endTime) return;
    void refreshSensorSnapshot(activeSession);
    const timer = setInterval(() => { void refreshSensorSnapshot(activeSession); }, SENSOR_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [ownerKey, activeSession?.measurementId, activeSession?.endTime]);

  function saveSnoreAnswers(answers: SnoreAnswers) {
    if (!ownerKey) return;
    const date = localDateKey(new Date());
    setCurrentDate(date);
    setSurvey({ key: ownerKey, date, answers: { ...answers } });
  }
  async function loadRecords(userId: string, propagateError = false): Promise<SleepRecord[]> {
    const ticket = gate.begin("records", ownerKey);
    if (!ticket) throw new Error("로그인 계정이 변경되었습니다.");
    setRequestState({ key: ticket.key, loading: true, error: null });
    try {
      const response = await getSleepInfoApi(requireAccountId(userId));
      if (!gate.current(ticket)) return [];
      const parsed = parseAccountRecords(response.data, userId);
      setRecordState({ key: ticket.key, rows: parsed.records });
      setRequestState({ key: ticket.key, loading: false, error: parsed.rejected ? "계정이 다르거나 형식이 잘못된 서버 기록을 제외했습니다." : null });
      return parsed.records;
    } catch {
      if (!gate.current(ticket)) return [];
      setRecordState({ key: ticket.key, rows: [] });
      setRequestState({ key: ticket.key, loading: false, error: "수면 기록을 불러오지 못했어요. 서버 연결을 확인하고 다시 시도해주세요." });
      if (propagateError) throw new Error("서버에서 저장된 기록을 확인하지 못했어요. 연결을 확인하고 다시 시도해주세요.");
      return [];
    }
  }
  async function refreshRecords() { if (user && ownerKey) await loadRecords(user.id); }
  async function refreshSensorSnapshot(session: ActiveSleepSession) {
    const pendingKey = `${session.ownerKey}:${session.measurementId}`;
    if (sensorBusyRef.current === pendingKey) return;
    const ticket = gate.begin("sensor", session.ownerKey);
    if (!ticket || ticket.key !== session.ownerKey) return;
    sensorBusyRef.current = pendingKey;
    try {
      const response = await getSensorApi(session.userId);
      if (!gate.current(ticket)) return;
      if (sensorSamplesRef.current?.measurementId === session.measurementId) {
        sensorSamplesRef.current.samples.add(response.data, session.userId, session.startTime.getTime());
      }
      const latest = parseAccountSensor(response.data, session.userId, session.startTime.getTime());
      setRawSession(current => {
        if (!current || current.ownerKey !== ticket.key || current.measurementId !== session.measurementId) return current;
        return { ...current, temperature: latest?.temperature, humidity: latest?.humidity, sensorUpdatedAt: latest ? new Date(latest.timestamp).toISOString() : undefined };
      });
    } catch {
      if (!gate.current(ticket)) return;
      setRawSession(current => current?.measurementId === session.measurementId && current.ownerKey === ticket.key ? { ...current, temperature: undefined, humidity: undefined, sensorUpdatedAt: undefined } : current);
    } finally {
      if (sensorBusyRef.current === pendingKey) sensorBusyRef.current = null;
    }
  }
  async function setAlarm(hour: number, min: number) { if (user) { setAlarmHour(hour); setAlarmMin(min); } }
  async function setAlarmOn(on: boolean) { if (user) setAlarmOnState(on); }
  function startSleep() {
    if (!user || !ownerKey || activeSession) return;
    const session: ActiveSleepSession = { ownerKey, userId: requireAccountId(user.id), measurementId: ++measurementRef.current, startTime: new Date() };
    sensorSamplesRef.current = { measurementId: session.measurementId, samples: new SleepSensorSamples() };
    pendingWriteRef.current = null;
    setSaveState({ key: ownerKey, error: null, record: null });
    gate.begin("sensor");
    snoreCountRef.current = 0; lastSnoreAtRef.current = 0; recordingAvailableRef.current = false;
    setRawSession(session);
    void startSnoreRecording();
  }
  async function startSnoreRecording() {
    if (Platform.OS === "web" || snoreRecordingRef.current) return;
    const ticket = gate.begin("recording");
    const run = ++recordingRunRef.current;
    if (!ticket) return;
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted || run !== recordingRunRef.current || !gate.current(ticket)) return;
      recordingStartedAtRef.current = Date.now();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, playThroughEarpieceAndroid: false, staysActiveInBackground: true });
      if (run !== recordingRunRef.current || !gate.current(ticket)) return;
      const { recording } = await Audio.Recording.createAsync({ ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true }, status => {
        if (run === recordingRunRef.current && gate.current(ticket)) handleRecordingStatus(status);
      }, 1000);
      if (run !== recordingRunRef.current || !gate.current(ticket)) { await recording.stopAndUnloadAsync(); return; }
      snoreRecordingRef.current = recording;
      recordingAvailableRef.current = true;
    } catch { if (run === recordingRunRef.current && gate.current(ticket)) recordingAvailableRef.current = false; }
  }
  function handleRecordingStatus(status: any) {
    if (!status?.isRecording || typeof status.metering !== "number") return;
    const now = Date.now();
    if (musicAudibleRef.current || now - musicLastActiveAtRef.current < SNORE_EVENT_COOLDOWN_MS) return;
    if (now - recordingStartedAtRef.current >= SNORE_ARMING_DELAY_MS && status.metering >= -42 && now - lastSnoreAtRef.current >= SNORE_EVENT_COOLDOWN_MS) { snoreCountRef.current++; lastSnoreAtRef.current = now; }
  }
  async function stopSnoreRecording() {
    const stoppedRun = ++recordingRunRef.current;
    const recording = snoreRecordingRef.current;
    const count = recordingAvailableRef.current ? snoreCountRef.current : undefined;
    snoreRecordingRef.current = null;
    recordingAvailableRef.current = false;
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
        if (stoppedRun === recordingRunRef.current) await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      } catch { /* Native resource cleanup does not publish another account's data. */ }
    }
    return count;
  }
  async function endSleep(): Promise<SleepRecord | null> {
    const session = activeSession;
    if (!session || !user || endingRef.current === session.measurementId) return null;
    const ticket = gate.begin("ending");
    if (!ticket) return null;
    endingRef.current = session.measurementId;
    setSaveState({ key: ticket.key, error: null, record: null });
    gate.begin("records");
    try {
      let pending = pendingWriteRef.current;
      if (!pending || pending.ownerKey !== session.ownerKey || pending.measurementId !== session.measurementId) {
        const endTime = session.endTime ?? new Date();
        setRawSession(current => current?.ownerKey === session.ownerKey && current.measurementId === session.measurementId ? { ...current, endTime } : current);
        gate.begin("sensor"); // Discard polls arriving after the measurement ended.
        await stopMusic().catch(() => undefined);
        if (!gate.current(ticket)) return null;
        const snoringCount = await stopSnoreRecording();
        if (!gate.current(ticket)) return null;
        const samples = sensorSamplesRef.current?.measurementId === session.measurementId ? sensorSamplesRef.current.samples : new SleepSensorSamples();
        try {
          const response = await getSensorApi(session.userId);
          if (!gate.current(ticket)) return null;
          samples.add(response.data, session.userId, session.startTime.getTime(), endTime.getTime());
        } catch { /* Optional sensor outages do not discard the measured sleep time. */ }
        if (!gate.current(ticket)) return null;
        const durationMinutes = Math.max(0, (endTime.getTime() - session.startTime.getTime()) / 60000);
        // Existing time-based product score, not a clinical or REM analysis.
        const score = Math.min(100, Math.max(40, 70 + Math.floor(durationMinutes / 10)));
        const record: SleepRecord = {
          id: `${session.userId}-${session.startTime.toISOString()}`, userId: session.userId,
          date: localDateKey(session.startTime), startTime: session.startTime.toTimeString().slice(0, 5), endTime: endTime.toTimeString().slice(0, 5),
          startAt: session.startTime.toISOString(), endAt: endTime.toISOString(), durationMinutes, score, scoreAvailable: true,
          ...samples.averages(), snoringCount, audioPath: "", memo: "",
        };
        pending = { ownerKey: session.ownerKey, measurementId: session.measurementId, writer: new SleepRecordWriter(record) };
        pendingWriteRef.current = pending;
      }
      const saved = await pending.writer.save({
        create: record => createSleepInfoApi(buildSleepPayload(session.userId, record)),
        read: () => loadRecords(session.userId, true),
      });
      if (!gate.current(ticket)) return null;
      setSaveState({ key: ticket.key, error: null, record: saved });
      pendingWriteRef.current = null;
      setRawSession(current => current?.ownerKey === session.ownerKey && current.measurementId === session.measurementId ? null : current);
      return saved;
    } catch (error) {
      if (gate.current(ticket)) setSaveState({ key: ticket.key, record: null, error: saveFailureMessage(error) });
      return null;
    } finally {
      if (endingRef.current === session.measurementId) endingRef.current = null;
    }
  }
  async function updateMemo(id: string, memo: string) {
    if (!user || !ownerKey) throw new Error("로그인이 필요합니다.");
    const target = records.find(record => record.id === id && record.userId === user.id);
    if (!target) throw new Error("현재 계정의 기록을 찾을 수 없습니다.");
    const ticket = gate.begin("memo");
    gate.begin("records");
    await updateSleepInfoApi(buildSleepPayload(user.id, { ...target, memo }));
    if (!gate.current(ticket)) throw new Error("로그인 계정이 변경되었습니다.");
    const saved = (await loadRecords(user.id, true)).find(row => sameSleepMeasurement(row, target));
    if (!gate.current(ticket) || !saved || saved.memo !== memo) throw new Error("서버에서 메모 저장을 확인하지 못했어요.");
    if (lastSavedRecord && sameSleepMeasurement(target, lastSavedRecord)) setSaveState({ key: ticket!.key, error: null, record: saved });
  }
  async function saveRatings(ratings: SleepRatings) {
    if (!user || !ownerKey || !lastSavedRecord || lastSavedRecord.userId !== user.id) throw new Error("평가할 수면 기록이 없습니다.");
    if (!validSleepRatings(ratings)) throw new Error("만족도를 모두 선택해주세요.");
    const ticket = gate.begin("ratings");
    const updated = { ...lastSavedRecord, ratings };
    gate.begin("records");
    await updateSleepInfoApi(buildSleepPayload(user.id, updated));
    if (!gate.current(ticket)) throw new Error("로그인 계정이 변경되었습니다.");
    const saved = (await loadRecords(user.id, true)).find(row => sameSleepMeasurement(row, updated));
    if (!gate.current(ticket) || !saved || !saved.ratings || ["total", "humidity", "temperature"].some(key => saved.ratings![key as keyof SleepRatings] !== ratings[key as keyof SleepRatings])) {
      throw new Error("서버에서 만족도 저장을 확인하지 못했어요. 다시 시도해주세요.");
    }
    setSaveState({ key: ticket!.key, error: null, record: saved });
  }
  const getRecordByDate = useCallback((date: string) => records.find(record => record.date === date), [records]);
  const oneMonthRecords = records.filter(record => {
    const age = Date.now() - new Date(`${record.date}T00:00:00`).getTime();
    return age >= 0 && age <= 30 * 86400000;
  });
  const monthlyAverageDuration = oneMonthRecords.length ? oneMonthRecords.reduce((sum, record) => sum + record.durationMinutes, 0) / oneMonthRecords.length : 0;
  const monthlyAverageScore = averageScoreFor(oneMonthRecords);
  const weeklyRecords = records.slice(-7);
  const averageDuration = records.length ? records.reduce((sum, record) => sum + record.durationMinutes, 0) / records.length : 0;
  const averageScore = averageScoreFor(records);
  return <SleepContext.Provider value={{ monthlyAverageDuration, monthlyAverageScore, records, recordsLoading, recordsError, activeSession, saveError, lastSavedRecord, startSleep, endSleep, updateMemo, saveRatings, refreshRecords, getRecordByDate, weeklyRecords, averageDuration, averageScore, alarmHour, alarmMin, alarmOn, setAlarm, setAlarmOn, music, selectMusic, toggleMusic, setMusicVolume, currentDate, snoreAnswers, saveSnoreAnswers }}>{children}</SleepContext.Provider>;
}
export function useSleep() {
  const context = useContext(SleepContext);
  if (!context) throw new Error("useSleep must be used within SleepProvider");
  return context;
}
