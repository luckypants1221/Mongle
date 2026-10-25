import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import type { ActualSleepStage } from "./mongleHeartRate";
import type { HourlyHeartRate } from "./heartRateCore";
import { aggregateHourly } from "./heartRateCore";

export interface HealthData {
    startMs: number;
    endMs: number;
    available: boolean;
    stages: ActualSleepStage[];
    hourly: HourlyHeartRate[];
}

const EMPTY: HealthData = { startMs: 0, endMs: 0, available: false, stages: [], hourly: [] };
let healthMessage = "삼성 헬스에서 Health Connect의 심박수·수면 공유와 몽글의 읽기 권한을 확인해 주세요.";
export function getHealthConnectionMessage() { return healthMessage; }

export async function tryReadLatestWatchHealth(): Promise<HealthData | null> {
    if (!(await tryPrepareHealth())) return null;
    try {
        const mod = require("./mongleHeartRate") as typeof import("./mongleHeartRate");
        const range = await within(mod.readLatestSamsungSleep(), null, 8000);
        if (!range) { healthMessage = "최근 7일의 삼성 헬스 수면 기록이 없어요. 워치 동기화와 수면 공유 설정을 확인해 주세요."; return null; }
        return await tryReadHealth(range.startMs, range.endMs);
    } catch { return null; }
}

function supported() {
    if (Platform.OS !== "android") { healthMessage = "갤럭시 워치 연동은 Android에서 사용할 수 있어요."; return false; }
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        healthMessage = "Health Connect는 Expo Go에서 사용할 수 없어요. 몽글 Android 개발 빌드를 설치한 뒤 연결해 주세요.";
        return false;
    }
    return true;
}

async function within<T>(promise: Promise<T>, fallback: T, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([promise.catch(() => fallback), new Promise<T>(resolve => { timer = setTimeout(() => resolve(fallback), ms); })]); }
    finally { if (timer) clearTimeout(timer); }
}

/** 권한 준비. 실패해도 예외를 던지지 않음 */
export async function tryPrepareHealth(): Promise<boolean> {
    if (!supported()) return false;
    try {
        const mod = require("./mongleHeartRate");
        const r = await mod.ensureHealthConnectReady();
        if (!r.ok) healthMessage = r.message;
        return !!r.ok;
    } catch (e) {
        healthMessage = "Health Connect를 연결하지 못했어요. Android 개발 빌드 설치와 Health Connect 사용 가능 여부를 확인해 주세요.";
        console.log("Health Connect 모듈 로드/초기화 실패:", e);
        return false;
    }
}

/** 구간 수면단계 + 심박 읽기. 실패/지연 시 빈 데이터 반환 */
export async function tryReadHealth(
    startMs: number,
    endMs: number,
    timeoutMs = 8000,
): Promise<HealthData> {
    if (!supported() || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return EMPTY;
    // 수면 단계는 심박 조회 성공 여부와 독립적으로 읽는다.
    // Health Connect 동기화가 늦을 수 있으므로 빈 결과는 호출자가 다시 조회한다.
    try {
        const mod = require("./mongleHeartRate");
        const [stages, hourly] = await Promise.all([
            within<ActualSleepStage[]>(mod.readSleepStages(startMs, endMs), [], timeoutMs),
            within<HourlyHeartRate[]>(mod.readHeartRateSamples(startMs, endMs).then((samples: import("./heartRateCore").HrSample[]) => aggregateHourly(samples, 1)), [], timeoutMs),
        ]);
        healthMessage = "해당 수면 구간의 워치 데이터가 아직 없어요. 삼성 헬스를 열어 워치와 동기화한 뒤 다시 불러와 주세요.";
        return { startMs, endMs, available: stages.length > 0 || hourly.length > 0, stages, hourly };
    } catch (e) {
        console.log("수면 단계 읽기 실패:", e);
        return EMPTY;
    }
}

/** 읽어 둔 워치 심박을 서버(POST /heartrate)에 올림. 실패해도 예외를 던지지 않음 (수면 기록 저장과 무관) */
export async function tryUploadHeartRate(userId: string, data: HealthData): Promise<void> {
    if (!supported() || !data.available || data.hourly.length === 0) return;
    try {
        const mod = require("./mongleHeartRate") as typeof import("./mongleHeartRate");
        const r = await mod.uploadHourlyHeartRate(userId, data.startMs, data.endMs, data.hourly);
        console.log("[심박 업로드]", r.message);
    } catch (e) {
        console.log("[심박 업로드] 실패:", e);
    }
}
