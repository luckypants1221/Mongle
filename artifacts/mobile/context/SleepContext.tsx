import { Audio } from "expo-av";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useSleepMusic } from "@/hooks/useSleepMusic";
import type { MusicState, MusicTrack } from "@/lib/sleepMusicPlayer";
import { localDateKey, type SnoreAnswers } from "@/lib/snorePrediction";
import { AccountRequestGate, parseAccountRecords, parseAccountSensor, requireAccountId } from "@/lib/accountData";
import type { SleepRecord } from "@/lib/api";
import { createSleepInfoApi, getSensorApi, getSleepInfoApi, updateSleepInfoApi } from "@/services/authApi";
export type { SleepRecord } from "@/lib/api";

type ActiveSleepSession = {
  ownerKey: string; userId: string; measurementId: number; startTime: Date;
  temperature?: number; humidity?: number; sensorUpdatedAt?: string;
};
interface SleepContextType {
  monthlyAverageDuration: number; monthlyAverageScore: number | null;
  records: SleepRecord[]; recordsLoading: boolean; recordsError: string | null;
  activeSession: ActiveSleepSession | null;
  startSleep: () => void; endSleep: () => Promise<SleepRecord | null>;
  updateMemo: (id: string, memo: string) => Promise<void>;
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
function buildDateTime(date: string, time: string) {
  return new Date(time.includes("T") ? time : `${date}T${time.length === 5 ? time + ":00" : time}`);
}
function buildPayload(userId: string, record: SleepRecord) {
  if (record.userId !== requireAccountId(userId) || record.temperature === undefined || record.humidity === undefined || record.snoringCount === undefined || record.scoreAvailable === false) {
    throw new Error("기록의 계정 또는 실제 측정값을 확인할 수 없습니다.");
  }
  const start = buildDateTime(record.date, record.startTime);
  const end = buildDateTime(record.date, record.endTime);
  if (end < start) end.setDate(end.getDate() + 1);
  return { id: Number(requireAccountId(userId)), sleep_score: record.score, start_sleep: start.toISOString(), end_sleep: end.toISOString(), temp_avg: Math.round(record.temperature), hum_avg: Math.round(record.humidity), audio_path: record.audioPath ?? "", duration: record.durationMinutes, snoring_count: record.snoringCount ?? 0, memo: record.memo ?? "" };
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
  const { music, selectMusic, toggleMusic, setMusicVolume, stopMusic } = useSleepMusic(Boolean(activeSession), ownerKey ?? undefined);
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
    setSurvey(null);
    setRecordState({ key: ownerKey, rows: [] });
    setRequestState({ key: ownerKey, loading: Boolean(ownerKey), error: null });
    setAlarmHour(7); setAlarmMin(0); setAlarmOnState(true);
    if (user && ownerKey) void loadRecords(user.id);
  }, [ownerKey]);
  useEffect(() => {
    if (!user || !activeSession) return;
    void refreshSensorSnapshot(activeSession);
    const timer = setInterval(() => { void refreshSensorSnapshot(activeSession); }, SENSOR_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [ownerKey, activeSession?.measurementId]);

  function saveSnoreAnswers(answers: SnoreAnswers) {
    if (!ownerKey) return;
    const date = localDateKey(new Date());
    setCurrentDate(date);
    setSurvey({ key: ownerKey, date, answers: { ...answers } });
  }
  async function loadRecords(userId: string) {
    const ticket = gate.begin("records", ownerKey);
    if (!ticket) return;
    setRequestState({ key: ticket.key, loading: true, error: null });
    try {
      const response = await getSleepInfoApi(requireAccountId(userId));
      if (!gate.current(ticket)) return;
      const parsed = parseAccountRecords(response.data, userId);
      setRecordState({ key: ticket.key, rows: parsed.records });
      setRequestState({ key: ticket.key, loading: false, error: parsed.rejected ? "계정이 다르거나 형식이 잘못된 서버 기록을 제외했습니다." : null });
    } catch {
      if (!gate.current(ticket)) return;
      setRecordState({ key: ticket.key, rows: [] });
      setRequestState({ key: ticket.key, loading: false, error: "수면 기록을 불러오지 못했어요. 서버 연결을 확인하고 다시 시도해주세요." });
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
    gate.begin("records");
    try {
      const endTime = new Date();
      await stopMusic();
      if (!gate.current(ticket)) return null;
      const snoringCount = await stopSnoreRecording();
      if (!gate.current(ticket)) return null;
      if (session.temperature === undefined || session.humidity === undefined || snoringCount === undefined) {
        setRequestState({ key: ticket.key, loading: false, error: "필수 센서 또는 마이크 측정값이 없어 기록을 저장하지 않았어요. 임의의 값으로 채우지 않습니다." });
        return null;
      }
      const durationMinutes = Math.max(0, Math.round((endTime.getTime() - session.startTime.getTime()) / 60000));
      // This existing product score is calculated from this measurement's time;
      // it is not a fabricated historical record or a server analysis result.
      const score = Math.min(100, Math.max(40, 70 + Math.floor(durationMinutes / 10)));
      const record: SleepRecord = { id: `${session.userId}-${localDateKey(session.startTime)}`, userId: session.userId, date: localDateKey(session.startTime), startTime: session.startTime.toTimeString().slice(0, 5), endTime: endTime.toTimeString().slice(0, 5), durationMinutes, score, scoreAvailable: true, temperature: session.temperature, humidity: session.humidity, snoringCount, audioPath: "", memo: "" };
      await createSleepInfoApi(buildPayload(session.userId, record));
      if (!gate.current(ticket)) return null;
      // Display the account-filtered server response, not a local fallback record.
      await loadRecords(session.userId);
      return gate.current(ticket) ? record : null;
    } catch {
      if (gate.current(ticket)) setRequestState({ key: ticket.key, loading: false, error: "수면 기록을 저장하지 못했어요. 서버 연결을 확인해주세요." });
      return null;
    } finally {
      setRawSession(current => current?.ownerKey === session.ownerKey && current.measurementId === session.measurementId ? null : current);
      if (endingRef.current === session.measurementId) endingRef.current = null;
    }
  }
  async function updateMemo(id: string, memo: string) {
    if (!user || !ownerKey) throw new Error("로그인이 필요합니다.");
    const target = records.find(record => record.id === id && record.userId === user.id);
    if (!target) throw new Error("현재 계정의 기록을 찾을 수 없습니다.");
    const ticket = gate.begin("memo");
    gate.begin("records");
    await updateSleepInfoApi(buildPayload(user.id, { ...target, memo }));
    if (!gate.current(ticket)) return;
    await loadRecords(user.id);
  }
  const getRecordByDate = useCallback((date: string) => records.find(record => record.date === date), [records]);
  const oneMonthRecords = records.filter(record => {
    const age = Date.now() - new Date(`${record.date}T00:00:00`).getTime();
    return age >= 0 && age <= 30 * 86400000;
  });
  const monthlyAverageDuration = oneMonthRecords.length ? Math.round(oneMonthRecords.reduce((sum, record) => sum + record.durationMinutes, 0) / oneMonthRecords.length) : 0;
  const monthlyAverageScore = averageScoreFor(oneMonthRecords);
  const weeklyRecords = records.slice(-7);
  const averageDuration = records.length ? Math.round(records.reduce((sum, record) => sum + record.durationMinutes, 0) / records.length) : 0;
  const averageScore = averageScoreFor(records);
  return <SleepContext.Provider value={{ monthlyAverageDuration, monthlyAverageScore, records, recordsLoading, recordsError, activeSession, startSleep, endSleep, updateMemo, refreshRecords, getRecordByDate, weeklyRecords, averageDuration, averageScore, alarmHour, alarmMin, alarmOn, setAlarm, setAlarmOn, music, selectMusic, toggleMusic, setMusicVolume, currentDate, snoreAnswers, saveSnoreAnswers }}>{children}</SleepContext.Provider>;
}
export function useSleep() {
  const context = useContext(SleepContext);
  if (!context) throw new Error("useSleep must be used within SleepProvider");
  return context;
}
