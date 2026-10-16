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
    // 수면 단계는 심박 조회 성공 여부와 독립적으로 읽는다.
    // Health Connect 동기화가 늦을 수 있으므로 빈 결과는 호출자가 다시 조회한다.
    try {
        const mod = require("./mongleHeartRate");
        const stages = await Promise.race<ActualSleepStage[]>([
            mod.readSleepStages(startMs, endMs),
            new Promise<ActualSleepStage[]>((resolve) =>
                setTimeout(() => resolve([]), timeoutMs),
            ),
        ]);
        return { available: stages.length > 0, stages, hourly: [] };
    } catch (e) {
        console.log("수면 단계 읽기 실패:", e);
        return EMPTY;
    }
}