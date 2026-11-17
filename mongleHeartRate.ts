/**
 * mongleHeartRate.ts — 갤럭시 워치 심박 연동 (React Native, Android 전용)
 *
 * 흐름
 *   [수면 시작] 버튼 -> startSleep()          : 시작 시각을 폰에 저장
 *   [기상]     버튼 -> finishSleepAndUpload() : 시작~지금 구간의 워치 심박을 Health Connect 에서 읽어
 *                                               한 시간 단위로 묶은 뒤 서버(POST /heartrate)로 전송
 *
 * 워치는 스스로 1분마다 심박을 재고 있고(삼성 헬스 → Health Connect 에 저장),
 * 이 모듈은 "버튼으로 정한 구간"의 기록을 읽어 오는 역할이다.
 *
 * 필요 패키지: react-native-health-connect, @react-native-async-storage/async-storage
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import type { Permission } from 'react-native-health-connect';
import {
  aggregateHourly,
  buildPayload,
  toKstIso,
  type HourlyHeartRate,
  type HrSample,
} from './heartRateCore';

// ============================ 설정 ============================
export const HR_CONFIG = {
  /** 백엔드 서버 */
  serverBase: 'http://13.125.10.228',
  path: '/heartrate',
  /** 한 시간대에 샘플이 이보다 적으면 보내지 않음 (워치 4 기준 보통 시간당 60개) */
  minSamplesPerHour: 3,
  /** 너무 짧은 수면은 무시 (실수로 버튼을 연달아 누른 경우) */
  minSleepMinutes: 10,
};

const STORAGE_KEY = 'mongle.sleepStartMs';

const PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'SleepSession' },
];

// ======================= Health Connect 준비 =======================
export type ReadyResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'update_required' | 'permission_denied' | 'init_failed'; message: string };

/** Health Connect 사용 가능 여부 확인 + 권한 요청. 수면 시작 전에 한 번 호출 */
export async function ensureHealthConnectReady(): Promise<ReadyResult> {
  const status = await getSdkStatus();
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
    return { ok: false, reason: 'unavailable', message: '이 기기는 Health Connect 를 지원하지 않습니다.' };
  }
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return {
      ok: false,
      reason: 'update_required',
      message: 'Health Connect 앱 설치(업데이트)가 필요합니다. 플레이스토어에서 설치해 주세요.',
    };
  }
  if (!(await initialize())) {
    return { ok: false, reason: 'init_failed', message: 'Health Connect 초기화에 실패했습니다.' };
  }

  if (!(await hasAllPermissions())) {
    await requestPermission(PERMISSIONS);
    if (!(await hasAllPermissions())) {
      return {
        ok: false,
        reason: 'permission_denied',
        message: '심박수·수면 읽기 권한이 필요합니다. Health Connect 설정에서 허용해 주세요.',
      };
    }
  }
  return { ok: true };
}

async function hasAllPermissions(): Promise<boolean> {
  const granted = await getGrantedPermissions();
  return PERMISSIONS.every((p) =>
    granted.some((g) => g.accessType === p.accessType && 'recordType' in g && g.recordType === p.recordType),
  );
}

export { openHealthConnectSettings };

// ========================== 수면 시작 ==========================
/** [수면 시작] 버튼: 시작 시각 저장 (앱이 꺼져도 유지됨) */
export async function startSleep(now: Date = new Date()): Promise<number> {
  const ms = now.getTime();
  await AsyncStorage.setItem(STORAGE_KEY, String(ms));
  return ms;
}

/** 진행 중인 수면의 시작 시각 (없으면 null) — 화면에 "수면 중" 표시할 때 사용 */
export async function getSleepStart(): Promise<number | null> {
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  return v ? Number(v) : null;
}

export async function cancelSleep(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// ======================= 기상 + 업로드 =======================
export interface UploadResult {
  ok: boolean;
  /** 사용자에게 보여줄 한 줄 요약 */
  message: string;
  sleepStart?: string;
  sleepEnd?: string;
  sampleCount?: number;
  hourly?: HourlyHeartRate[];
  httpStatus?: number;
}

/**
 * [기상] 버튼: 수면 시작~지금 구간의 심박을 읽어 서버로 업로드.
 * 성공하면 저장된 시작 시각을 지운다. 실패하면 남겨 두어 다시 시도할 수 있다.
 * ※ Health Connect 는 앱이 화면에 떠 있을 때만 읽을 수 있으므로 버튼 누른 직후 호출할 것.
 */
export async function finishSleepAndUpload(userId: string, now: Date = new Date()): Promise<UploadResult> {
  const startMs = await getSleepStart();
  const endMs = now.getTime();

  if (startMs == null) {
    return { ok: false, message: '수면 시작 기록이 없습니다. 먼저 [수면 시작]을 눌러 주세요.' };
  }
  if (endMs - startMs < HR_CONFIG.minSleepMinutes * 60_000) {
    return { ok: false, message: `수면 시간이 ${HR_CONFIG.minSleepMinutes}분보다 짧아 업로드하지 않았습니다.` };
  }

  const result = await uploadRange(userId, startMs, endMs);
  if (result.ok) await cancelSleep();
  return result;
}

/**
 * 버튼을 깜빡했을 때의 대안: 삼성 헬스가 기록한 최근 24시간 내 가장 긴 수면 구간으로 업로드
 */
export async function uploadLastSamsungSleep(userId: string, now: Date = new Date()): Promise<UploadResult> {
  const end = now.getTime();
  const { records } = await readRecords('SleepSession', {
    timeRangeFilter: {
      operator: 'between',
      startTime: new Date(end - 36 * 3_600_000).toISOString(),
      endTime: new Date(end).toISOString(),
    },
  });
  const recent = records
    .map((r) => ({ s: Date.parse(r.startTime), e: Date.parse(r.endTime) }))
    .filter((r) => end - r.e <= 24 * 3_600_000)
    .sort((a, b) => b.e - b.s - (a.e - a.s));
  if (recent.length === 0) {
    return { ok: false, message: '최근 24시간 안에 삼성 헬스 수면 기록이 없습니다.' };
  }
  return uploadRange(userId, recent[0].s, recent[0].e);
}

/**
 * 이미 읽어 둔 시간별 심박을 서버(POST /heartrate)로 업로드.
 * 화면용으로 집계한 값(최소 샘플 1개)에서 시간당 minSamplesPerHour 개 미만인 시간대는 빼고 보낸다.
 * 같은 사용자·같은 시간대는 서버가 덮어쓰므로 여러 번 보내도 중복되지 않는다.
 */
export async function uploadHourlyHeartRate(
  userId: string,
  startMs: number,
  endMs: number,
  hourly: HourlyHeartRate[],
): Promise<UploadResult> {
  const usable = hourly.filter((h) => h.sampleCount >= HR_CONFIG.minSamplesPerHour);
  if (usable.length === 0) {
    return { ok: false, message: '서버로 보낼 심박 시간대가 없습니다.' };
  }
  try {
    const res = await fetchWithTimeout(HR_CONFIG.serverBase + HR_CONFIG.path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(buildPayload(userId, startMs, endMs, usable)),
    });
    const ok = res.status >= 200 && res.status < 300;
    return {
      ok,
      httpStatus: res.status,
      hourly: usable,
      message: ok ? `심박 업로드 완료: ${usable.length}개 시간대` : `심박 업로드 실패: HTTP ${res.status}`,
    };
  } catch (e) {
    return { ok: false, message: `심박 업로드 서버 연결 실패: ${String(e)}` };
  }
}

/** 구간 심박 읽기 -> 집계 -> 업로드 (공통) */
async function uploadRange(userId: string, startMs: number, endMs: number): Promise<UploadResult> {
  const sleepStart = toKstIso(startMs);
  const sleepEnd = toKstIso(endMs);

  const samples = await readHeartRateSamples(startMs, endMs);
  if (samples.length === 0) {
    return {
      ok: false,
      sleepStart,
      sleepEnd,
      sampleCount: 0,
      message:
        '해당 시간에 워치 심박 기록이 없습니다. 워치 착용 여부와 삼성 헬스 → Health Connect 공유 설정을 확인하세요.',
    };
  }

  const hourly = aggregateHourly(samples, HR_CONFIG.minSamplesPerHour);
  if (hourly.length === 0) {
    return {
      ok: false,
      sleepStart,
      sleepEnd,
      sampleCount: samples.length,
      message: `심박 ${samples.length}개를 읽었지만 시간당 ${HR_CONFIG.minSamplesPerHour}개 이상인 시간대가 없습니다. 워치 심박 측정을 '계속 측정'으로 바꿔 주세요.`,
    };
  }

  const payload = buildPayload(userId, startMs, endMs, hourly);
  let httpStatus: number;
  try {
    const res = await fetchWithTimeout(HR_CONFIG.serverBase + HR_CONFIG.path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    httpStatus = res.status;
  } catch (e) {
    return {
      ok: false,
      sleepStart,
      sleepEnd,
      sampleCount: samples.length,
      hourly,
      message: `서버 연결 실패: ${String(e)}`,
    };
  }

  const ok = httpStatus >= 200 && httpStatus < 300;
  return {
    ok,
    sleepStart,
    sleepEnd,
    sampleCount: samples.length,
    hourly,
    httpStatus,
    message: ok
      ? `업로드 완료: ${hourly.length}개 시간대 (심박 ${samples.length}개)`
      : `서버 오류 HTTP ${httpStatus}`,
  };
}

/** Health Connect 에서 구간 심박 샘플 전체 읽기 (페이지 반복) */
export async function readHeartRateSamples(startMs: number, endMs: number): Promise<HrSample[]> {
  const out: HrSample[] = [];
  let pageToken: string | undefined;
  do {
    const res = await readRecords('HeartRate', {
      dataOriginFilter: ['com.sec.android.app.shealth'],
      timeRangeFilter: {
        operator: 'between',
        startTime: new Date(startMs).toISOString(),
        endTime: new Date(endMs).toISOString(),
      },
      pageToken,
    });
    for (const rec of res.records) {
      for (const s of rec.samples) {
        const t = Date.parse(s.time);
        if (t >= startMs && t < endMs) out.push({ timeMs: t, bpm: s.beatsPerMinute });
      }
    }
    pageToken = res.pageToken || undefined;
  } while (pageToken);
  return out;
}


export type ActualSleepStage = {
  startTime: string;
  endTime: string;
  stage: "awake" | "light" | "rem" | "deep";
};

/** 삼성 헬스에 동기화된 최근 수면을 앱 측정 기록 없이도 조회한다. */
export async function readLatestSamsungSleep(): Promise<{ startMs: number; endMs: number } | null> {
  const now = Date.now();
  let pageToken: string | undefined;
  let latest: { startMs: number; endMs: number } | null = null;
  do {
    const response = await readRecords("SleepSession", {
      dataOriginFilter: ['com.sec.android.app.shealth'], pageToken,
      timeRangeFilter: { operator: 'between', startTime: new Date(now - 7 * 86400000).toISOString(), endTime: new Date(now).toISOString() },
    });
    for (const record of response.records) {
      const startMs = Date.parse(record.startTime), endMs = Date.parse(record.endTime);
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs && endMs <= now && (!latest || endMs > latest.endMs)) latest = { startMs, endMs };
    }
    pageToken = response.pageToken || undefined;
  } while (pageToken);
  return latest;
}

const STAGE_MAP: Record<number, ActualSleepStage["stage"] | null> = {
  1: "awake",
  3: "awake",
  4: "light",
  5: "deep",
  6: "rem",
};

/** Health Connect에서 실제 수면 단계 조회 */
export async function readSleepStages(
  startMs: number,
  endMs: number,
): Promise<ActualSleepStage[]> {
  const result: ActualSleepStage[] = [];
  const seen = new Set<string>();
  let pageToken: string | undefined;
  do {
  const response = await readRecords("SleepSession", {
    dataOriginFilter: ['com.sec.android.app.shealth'],
    pageToken,
    timeRangeFilter: {
      operator: "between",
      startTime: new Date(startMs - 24 * 3_600_000).toISOString(),
      endTime: new Date(endMs).toISOString(),
    },
  });

  for (const record of response.records) {
    for (const stage of record.stages ?? []) {
      const mappedStage = STAGE_MAP[stage.stage];

      // 지원하지 않는 단계 코드는 그래프에서 제외
      if (!mappedStage) continue;

      // 현재 수면 구간과 겹치는 부분만 사용
      const s = Math.max(Date.parse(stage.startTime), startMs);
      const e = Math.min(Date.parse(stage.endTime), endMs);

      if (e <= s) continue;

      const key = `${s}:${e}:${mappedStage}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        startTime: new Date(s).toISOString(),
        endTime: new Date(e).toISOString(),
        stage: mappedStage,
      });
    }
  }
  pageToken = response.pageToken || undefined;
  } while (pageToken);

  return result.sort(
    (a, b) => Date.parse(a.startTime) - Date.parse(b.startTime),
  );
}


async function fetchWithTimeout(url: string, init: RequestInit, ms = 15_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
