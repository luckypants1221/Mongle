import type { ActualSleepStage } from "./mongleHeartRate";
import type { HourlyHeartRate } from "./heartRateCore";

export interface HealthData {
    available: boolean;
    stages: ActualSleepStage[];
    hourly: HourlyHeartRate[];
}

const EMPTY: HealthData = { available: false, stages: [], hourly: [] };

/** 권한 준비. 실패해도 예외를 던지지 않음 */
export async function tryPrepareHealth(): Promise<boolean> {
    try {
        const mod = require("./mongleHeartRate");
        const r = await mod.ensureHealthConnectReady();
        if (!r.ok) console.log("Health Connect 사용 불가:", r.message);
        return !!r.ok;
    } catch (e) {
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
    const work = (async (): Promise<HealthData> => {
        const mod = require("./mongleHeartRate");
        const core = require("./heartRateCore");
        const stages = await mod.readSleepStages(startMs, endMs);
        const samples = await mod.readHeartRateSamples(startMs, endMs);
        return { available: true, stages, hourly: core.aggregateHourly(samples, 3) };
    })();

    const timeout = new Promise<HealthData>((resolve) =>
        setTimeout(() => resolve(EMPTY), timeoutMs),
    );

    try {
        return await Promise.race([work, timeout]);
    } catch (e) {
        console.log("수면 데이터 읽기 실패:", e);
        return EMPTY;
    }
}