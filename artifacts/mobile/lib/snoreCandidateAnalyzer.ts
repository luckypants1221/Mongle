// lib/snoreCandidateAnalyzer.ts
// 음량(dB) 시계열에서 소리 이벤트 후보를 찾는 실험용 휴리스틱.
// 코골이 분류 모델이 아니므로 이 수치를 확정 코골이 횟수로 표시하면 안 됩니다.
export type LevelSample = { t: number; db: number };
export type SoundAnalysis = { count: number | null; events: { start: number; end: number }[] };

export function analyzeSoundEvents(samples: LevelSample[]): SoundAnalysis {
    const valid = samples.filter(s => Number.isFinite(s.t) && Number.isFinite(s.db) && s.db <= 0 && s.db >= -160)
        .sort((a, b) => a.t - b.t);
    if (valid.length < 40) return { count: null, events: [] };
    // 하위 20%의 음량을 배경 소음으로 추정
    const levels = valid.map(s => s.db).sort((a, b) => a - b);
    const noise = levels[Math.floor(levels.length * 0.2)];
    const threshold = Math.min(-12, Math.max(-55, noise + 12));
    const events: { start: number; end: number }[] = [];
    let start: number | null = null;
    let end = 0;
    const close = () => {
        if (start !== null && end - start >= 0.5 && end - start <= 8) events.push({ start, end });
        start = null;
    };
    for (const sample of valid) {
        if (sample.db >= threshold) {
            if (start === null) start = sample.t;
            if (sample.t - end > 1.2 && end > 0) { close(); start = sample.t; }
            end = sample.t;
        } else if (start !== null && sample.t - end > 0.75) close();
    }
    close();
    // 동일한 연속 소리를 중복 집계하지 않도록 1초 이내의 이벤트는 합친다.
    const merged: typeof events = [];
    for (const event of events) {
        const last = merged[merged.length - 1];
        if (last && event.start - last.end <= 1) last.end = event.end;
        else merged.push({ ...event });
    }
    return { count: merged.length, events: merged };
}
