import { useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import {
  RecordingPresets, requestRecordingPermissionsAsync,
  setAudioModeAsync, useAudioRecorder,
} from "expo-audio";
import { analyzeSoundEvents, type LevelSample } from "../lib/snoreCandidateAnalyzer";

/** 음량 기반 소리 이벤트 추정이며 코골이 분류 모델은 아닙니다. */
export function useSleepRecording() {
  const recorder = useAudioRecorder({
    ...RecordingPresets.LOW_QUALITY,
    isMeteringEnabled: true,
  });
  const samples = useRef<LevelSample[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pending = useRef<Promise<void> | null>(null);
  const enabled = useRef(false);
  const previousTime = useRef(-1);
  const interrupted = useRef(false);

  function clearTimer() {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
  }

  function sample() {
    const status = recorder.getStatus();
    const t = status.durationMillis / 1000;
    if (status.isRecording && Number.isFinite(status.metering) && t > previousTime.current) {
      if (previousTime.current >= 0 && t - previousTime.current > 2) interrupted.current = true;
      samples.current.push({ t, db: status.metering! });
      previousTime.current = t;
    }
  }

  function startRecording(): Promise<void> {
    if (pending.current) return pending.current;
    const task = (async () => {
      clearTimer();
      samples.current = [];
      previousTime.current = -1;
      interrupted.current = false;
      enabled.current = false;
      if (Platform.OS === "web") return;
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("마이크 권한", "수면 측정은 진행하지만 소리 분석은 기록하지 않습니다.");
          return;
        }
        await setAudioModeAsync({
          allowsRecording: true, playsInSilentMode: true,
          shouldPlayInBackground: true, allowsBackgroundRecording: true,
        });
        await recorder.prepareToRecordAsync();
        recorder.record();
        enabled.current = true;
        timer.current = setInterval(() => {
          try { sample(); } catch { enabled.current = false; clearTimer(); }
        }, 200);
      } catch (error) {
        console.warn("녹음 시작 실패:", error);
        Alert.alert("녹음 불가", "수면 측정은 진행하지만 이번 소리 분석은 기록하지 않습니다.");
      }
    })();
    pending.current = task;
    void task.finally(() => { if (pending.current === task) pending.current = null; });
    return task;
  }

  async function stopRecording(): Promise<number | null> {
    await pending.current;
    clearTimer();
    let complete = enabled.current;
    try {
      const status = recorder.getStatus();
      // OS가 중간에 녹음을 중단했다면 전체 수면의 분석값으로 저장하지 않는다.
      if (!status.isRecording) complete = false;
      sample();
      if (status.isRecording) await recorder.stop();
    } catch (error) {
      complete = false;
      console.warn("녹음 종료 실패:", error);
    } finally {
      enabled.current = false;
      await setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false })
        .catch(() => {});
    }
    const count = complete && !interrupted.current ? analyzeSoundEvents(samples.current).count : null;
    samples.current = [];
    return count;
  }

  useEffect(() => () => {
    clearTimer();
    // recorder는 useAudioRecorder가 해제한다.
  }, []);

  return { startRecording, stopRecording };
}
