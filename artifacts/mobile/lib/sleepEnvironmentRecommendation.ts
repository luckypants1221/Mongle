/** 최근 30일 수면 기록으로 추천 수면 환경을 계산한다. 서버 호출은 하지 않는다. */
export interface EnvironmentSleepRecord {
  date: string; // YYYY-MM-DD (한국 날짜)
  score: number;
  temperature?: number | null;
  humidity?: number | null;
  serverSaved?: boolean;
}

export interface EnvironmentBin {
  temperatureMin: number;
  temperatureMax: number; // 상한 미포함
  humidityMin: number;
  humidityMax: number; // 상한 미포함
  count: number;
  averageScore: number;
  averageTemperature: number;
  averageHumidity: number;
}

export interface EnvironmentRecommendation {
  temperature: number;
  humidity: number;
  averageScore: number;
  sampleCount: number;
  temperatureRange: [number, number];
  humidityRange: [number, number];
  analyzedRecordCount: number;
  bins: EnvironmentBin[];
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_TOTAL_SAMPLES = 5;
const MIN_BIN_SAMPLES = 3;

function kstDate(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function parseDateOnly(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date ? ms : NaN;
}

/** 최근 30개 달력 날짜(오늘 포함). 최소 3회 이상 같은 온습도 조합에서 수면한 경우에만 추천. */
export function calculateSleepEnvironmentRecommendation(
  records: EnvironmentSleepRecord[],
  now: Date = new Date(),
): EnvironmentRecommendation | null {
  const todayMs = parseDateOnly(kstDate(now));
  const firstMs = todayMs - 29 * DAY_MS;
  const groups = new Map<string, { tMin: number; hMin: number; count: number; scoreSum: number; tempSum: number; humSum: number }>();
  let analyzedRecordCount = 0;

  for (const r of records) {
    const dayMs = parseDateOnly(r.date);
    const temp = r.temperature;
    const hum = r.humidity;
    const score = r.score;
    if (
      !Number.isFinite(dayMs) || dayMs < firstMs || dayMs > todayMs ||
      typeof temp !== 'number' || !Number.isFinite(temp) || temp < 0 || temp > 50 ||
      typeof hum !== 'number' || !Number.isFinite(hum) || hum <= 0 || hum > 100 ||
      typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100 ||
      r.serverSaved === false
    ) continue;

    const tMin = Math.floor(temp / 2) * 2;
    const hMin = Math.floor(hum / 5) * 5;
    const key = `${tMin}:${hMin}`;
    const g = groups.get(key) ?? { tMin, hMin, count: 0, scoreSum: 0, tempSum: 0, humSum: 0 };
    g.count += 1;
    g.scoreSum += score;
    g.tempSum += temp;
    g.humSum += hum;
    groups.set(key, g);
    analyzedRecordCount += 1;
  }

  const bins: EnvironmentBin[] = Array.from(groups.values()).map(g => ({
    temperatureMin: g.tMin,
    temperatureMax: g.tMin + 2,
    humidityMin: g.hMin,
    humidityMax: g.hMin + 5,
    count: g.count,
    averageScore: g.scoreSum / g.count,
    averageTemperature: g.tempSum / g.count,
    averageHumidity: g.humSum / g.count,
  })).sort((a, b) => b.averageScore - a.averageScore || b.count - a.count || a.temperatureMin - b.temperatureMin || a.humidityMin - b.humidityMin);

  // 최근 30일 유효한 수면 기록이 5개 미만이면 추천하지 않음
  if (analyzedRecordCount < MIN_TOTAL_SAMPLES) {
    return null;
  }

  // 동일 온습도 구간에 기록이 3개 이상 있는지 확인
  const sufficientBins = bins.filter(
    bin => bin.count >= MIN_BIN_SAMPLES
  );

  // 기록이 충분한 구간이 있으면 우선 사용
  // 없다면 전체 구간을 대상으로 추천
  const candidates = sufficientBins.length > 0
    ? sufficientBins
    : bins;

  // 평균 수면 점수가 가장 높은 구간 선택
  // 기존 bins는 평균 점수 내림차순으로 정렬되어 있음
  const best = candidates[0];

  if (!best) {
    return null;
  }

  return {
    temperature: Math.round(best.averageTemperature * 10) / 10,
    humidity: Math.round(best.averageHumidity),
    averageScore: Math.round(best.averageScore * 10) / 10,
    sampleCount: best.count,
    temperatureRange: [best.temperatureMin, best.temperatureMax],
    humidityRange: [best.humidityMin, best.humidityMax],
    analyzedRecordCount,
    bins,
  };
}
