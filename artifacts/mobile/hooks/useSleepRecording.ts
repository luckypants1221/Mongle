import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import type { AudioRecorder } from "expo-audio";
import Constants from "expo-constants";
import { SoundEventCounter, type SnoreResult } from "../lib/snoreCandidateAnalyzer";

export type RecordingState = {
  phase: "idle" | "preparing" | "calibrating" | "recording" | "stopped" | "unavailable";
  count: number | null;
  db: number | null;
  partial: boolean;
  message: string;
};
const INITIAL: RecordingState = { phase: "idle", count: null, db: null, partial: false, message: "녹음 대기" };
const EMPTY: SnoreResult = { count: null, status: "unavailable" };

/** 수면 시작 시에만 네이티브 녹음 객체 생성. 샘플 배열을 밤새 누적하지 않는다. */
export function useSleepRecording() {
  const [recordingState, setState] = useState<RecordingState>(INITIAL);
  const recorder = useRef<AudioRecorder | null>(null);
  const counter = useRef(new SoundEventCounter());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pending = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  const generation = useRef(0);
  const lastTime = useRef(-1);
  const lastMeterAt = useRef(0);
  const failed = useRef(false);
  const lastResult = useRef<SnoreResult>(EMPTY);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
  }, []);
  const publish = useCallback((state: RecordingState) => { if (mounted.current) setState(state); }, []);

  const sample = useCallback(() => {
    const native = recorder.current;
    if (!native) return;
    try {
      const status = native.getStatus();
      if (!status.isRecording) {
        counter.current.markGap();
        clearTimer();
        publish({ phase: "unavailable", count: counter.current.count, db: null, partial: true, message: "녹음이 중단됐습니다. 감지한 구간만 저장합니다." });
        return;
      }
      const t = status.durationMillis / 1000;
      if (Number.isFinite(status.metering) && t > lastTime.current) {
        counter.current.add({ t, db: status.metering! });
        lastTime.current = t;
        lastMeterAt.current = Date.now();
      }
      const noMeter = Date.now() - lastMeterAt.current > 5000;
      if (noMeter) counter.current.markGap();
      publish({
        phase: counter.current.ready ? "recording" : "calibrating",
        count: counter.current.count,
        db: Number.isFinite(status.metering) ? status.metering! : null,
        partial: counter.current.partial,
        message: noMeter ? "음량 수집을 확인할 수 없습니다." : !counter.current.ready ? "처음 3초는 조용히 주변 소음을 측정합니다." : counter.current.partial ? "수집이 끊긴 구간이 있어 일부 구간만 분석합니다." : "소리를 감지하고 있습니다.",
      });
    } catch {
      failed.current = true;
      counter.current.markGap();
      clearTimer();
      publish({ phase: "unavailable", count: counter.current.count, db: null, partial: true, message: "음량 수집이 중단됐습니다." });
    }
  }, [clearTimer, publish]);

  const dispose = useCallback(async () => {
    clearTimer();
    const native = recorder.current;
    recorder.current = null;
    if (native) {
      try { await native.stop(); } catch { /* 이미 중단된 경우 */ }
      try { native.release(); } catch { /* 해제된 경우 */ }
      try {
        const audio = require("expo-audio") as typeof import("expo-audio");
        await audio.setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false });
      } catch { /* 오디오 모듈 오류가 수면 종료를 막지 않도록 처리 */ }
    }
  }, [clearTimer]);

  const startRecording = useCallback((): Promise<void> => {
    if (pending.current) return pending.current;
    if (recorder.current) return Promise.resolve();
    const token = ++generation.current;
    counter.current = new SoundEventCounter();
    failed.current = false;
    lastTime.current = -1;
    lastResult.current = EMPTY;
    publish({ ...INITIAL, phase: "preparing", message: "마이크 준비 중" });
    const task = (async () => {
      try {
        if (Platform.OS === "web") throw new Error("음량 분석은 Android/iOS 앱에서 사용해주세요.");
        // 모듈 로드와 객체 생성도 try 안에서 실행한다.
        const audio = require("expo-audio") as typeof import("expo-audio");
        const permission = await audio.requestRecordingPermissionsAsync();
        if (!mounted.current || token !== generation.current) return;
        if (!permission.granted) throw new Error("마이크 권한이 없어 소리 분석을 진행하지 않습니다.");
        await audio.setAudioModeAsync({
          allowsRecording: true, playsInSilentMode: true,
          shouldPlayInBackground: true,
          allowsBackgroundRecording: Constants.appOwnership !== "expo",
        });
        if (!mounted.current || token !== generation.current) return;
        const preset = audio.RecordingPresets.HIGH_QUALITY;
        // useAudioRecorder 내부와 동일하게 플랫폼별 옵션을 최상위로 펼친다.
        const options = { ...preset, ...(Platform.OS === "android" ? preset.android : preset.ios), numberOfChannels: 1, isMeteringEnabled: true };
        const native = new audio.AudioModule.AudioRecorder(options);
        recorder.current = native;
        await native.prepareToRecordAsync();
        if (!mounted.current || token !== generation.current) { await dispose(); return; }
        native.record();
        lastMeterAt.current = Date.now();
        publish({ ...INITIAL, phase: "calibrating", message: "처음 3초는 조용히 주변 소음을 측정합니다." });
        timer.current = setInterval(sample, 200);
      } catch (error) {
        await dispose();
        failed.current = true;
        if (token === generation.current) publish({ ...INITIAL, phase: "unavailable", message: error instanceof Error ? error.message : "녹음을 시작할 수 없습니다." });
      }
    })();
    pending.current = task;
    void task.then(() => { if (pending.current === task) pending.current = null; });
    return task;
  }, [dispose, publish, sample]);

  const stopRecording = useCallback(async (): Promise<SnoreResult> => {
    await pending.current;
    if (!recorder.current) return lastResult.current;
    clearTimer();
    sample();
    const analysis = counter.current.finish();
    const result: SnoreResult = {
      count: analysis.count,
      status: analysis.count === null ? "unavailable" : counter.current.partial || failed.current ? "partial" : "complete",
    };
    await dispose();
    lastResult.current = result;
    publish({ phase: "stopped", count: result.count, db: null, partial: result.status === "partial", message: result.count === null ? "분석할 음량 데이터가 부족합니다." : "분석 완료" });
    return result;
  }, [clearTimer, dispose, publish, sample]);

  const cancelRecording = useCallback(async () => {
    generation.current++;
    await pending.current;
    await dispose();
    lastResult.current = EMPTY;
    publish(INITIAL);
  }, [dispose, publish]);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", (state) => {
      if (recorder.current && state !== "active") counter.current.markGap();
    });
    return () => {
      mounted.current = false;
      generation.current++;
      subscription.remove();
      clearTimer();
      void dispose();
    };
  }, [clearTimer, dispose]);

  return { startRecording, stopRecording, cancelRecording, recordingState };
}
