import React, { useMemo } from "react";
import { useWindowDimensions, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { SleepRecord, SleepStageSegment } from "@/lib/api";

interface Props {
  records: SleepRecord[];
  compact?: boolean;
}

type Stage = "awake" | "light" | "rem" | "deep";

const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "awake", label: "깨어있음", color: "#FFB74D" },
  { key: "light", label: "얕은 수면", color: "#64B5F6" },
  { key: "rem",   label: "렘수면",   color: "#CE93D8" },
  { key: "deep",  label: "깊은 수면", color: "#4DB6AC" },
];

const STAGE_ROW: Record<Stage, number> = {
  awake: 0,
  light: 1,
  rem:   2,
  deep:  3,
};

function fmtTime(startHour: number, startMin: number, addMin: number) {
  const total = startHour * 60 + startMin + addMin;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function stageSummary(segs: SleepStageSegment[]) {
  const counts: Record<Stage, number> = { awake: 0, light: 0, rem: 0, deep: 0 };
  segs.forEach(segment => { counts[segment.stage] += segment.durationMinutes; });
  return { awake: Math.round(counts.awake), light: Math.round(counts.light), rem: Math.round(counts.rem), deep: Math.round(counts.deep) };
}
export function RemGraph({ records, compact }: Props) {
  const colors = useColors();
  const { width: screenW } = useWindowDimensions();
  const chartW = screenW - 96;
  const ROW_H = compact ? 20 : 26;
  const ROWS = 4;
  const chartH = ROW_H * ROWS;

  const latest = [...records].filter((r) => r.durationMinutes > 0).at(-1);

  const { segments, summary, startH, startM, endLabel, xTicks } = useMemo(() => {
    if (!latest || !latest.startTime) return { segments: [], summary: null, startH: 0, startM: 0, endLabel: "", xTicks: [] };
    const dur = latest.durationMinutes;
    const segs = latest.sleepStages ?? [];
    const sum = stageSummary(segs);

    const bedH = latest.startTime
      ? parseInt(latest.startTime.split(":")[0], 10)
      : 22;
    const bedM = latest.startTime
      ? parseInt(latest.startTime.split(":")[1], 10)
      : 0;

    const end = fmtTime(bedH, bedM, dur);

    const numTicks = 5;
    const ticks = Array.from({ length: numTicks }, (_, i) => ({
      label: fmtTime(bedH, bedM, Math.round((i / (numTicks - 1)) * dur)),
      pct:   i / (numTicks - 1),
    }));

    return { segments: segs, summary: sum, startH: bedH, startM: bedM, endLabel: end, xTicks: ticks };
  }, [latest]);

  if (!latest || !segments.length) {
    return (
      <View style={[styles.empty, { height: chartH + 60 }]}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center" }}>
          서버에서 수면 단계 데이터를 제공하지 않았어요
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {/* 범례 */}
      <View style={styles.legend}>
        {STAGES.map(({ key, label, color }) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* 차트 */}
      <View style={styles.chartRow}>
        {/* Y축 라벨 */}
        <View style={{ width: 52, height: chartH }}>
          {STAGES.map(({ key, label, color }) => (
            <View
              key={key}
              style={{
                position: "absolute",
                top: STAGE_ROW[key] * ROW_H,
                height: ROW_H,
                justifyContent: "center",
                alignItems: "flex-end",
                right: 6,
                left: 0,
              }}
            >
              <Text style={{ fontSize: 9, color, fontWeight: "600" }} numberOfLines={1}>
                {label.replace(" 수면", "")}
              </Text>
            </View>
          ))}
        </View>

        {/* 그래프 영역 */}
        <View style={{ flex: 1 }}>
          {/* 가로 구분선 */}
          <View style={{ width: chartW, height: chartH, position: "relative" }}>
            {STAGES.map(({ key, color }) => (
              <View
                key={key}
                style={{
                  position: "absolute",
                  top: STAGE_ROW[key] * ROW_H,
                  left: 0,
                  right: 0,
                  height: ROW_H,
                  backgroundColor: color + "12",
                  borderTopWidth: 1,
                  borderTopColor: color + "28",
                }}
              />
            ))}

            {/* 수면 단계 블록 */}
            {segments.map((segment, i) => {
              const totalMinutes = segments.reduce((sum, item) => sum + item.durationMinutes, 0);
              const blockW = chartW * segment.durationMinutes / totalMinutes;
              const blockLeft = chartW * segments.slice(0, i).reduce((sum, item) => sum + item.durationMinutes, 0) / totalMinutes;
              const stage = segment.stage;
              const row = STAGE_ROW[stage];
              const cfg = STAGES.find((s) => s.key === stage)!;
              return (
                <View
                  key={i}
                  style={{
                    position: "absolute",
                    left: blockLeft,
                    top: row * ROW_H + 2,
                    width: Math.max(blockW - 0.5, 1),
                    height: ROW_H - 4,
                    backgroundColor: cfg.color,
                    borderRadius: 2,
                    opacity: 0.88,
                  }}
                />
              );
            })}
          </View>

          {/* X축 시간 라벨 */}
          <View style={{ width: chartW, height: 18, position: "relative", marginTop: 2 }}>
            {xTicks.map(({ label, pct }, i) => (
              <Text
                key={i}
                style={[
                  styles.xLabel,
                  {
                    color: colors.mutedForeground,
                    left: pct * chartW - 18,
                  },
                ]}
              >
                {label}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {/* 단계별 시간 요약 */}
      {summary && (
        <View style={[styles.summaryRow, { borderTopColor: colors.border }]}>
          {STAGES.filter((s) => s.key !== "awake" || (summary.awake ?? 0) > 0).map(({ key, label, color }) => (
            <View key={key} style={styles.summaryItem}>
              <View style={[styles.summaryDot, { backgroundColor: color }]} />
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                {label.replace(" 수면", "수면")}
              </Text>
              <Text style={[styles.summaryTime, { color: colors.foreground }]}>
                {summary[key as Stage]}분
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:        { gap: 8 },
  empty:       { alignItems: "center", justifyContent: "center" },
  legend:      { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 10 },
  chartRow:    { flexDirection: "row", alignItems: "flex-start" },
  xLabel:      { position: "absolute", fontSize: 9, width: 36, textAlign: "center" },
  summaryRow:  {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    flexWrap: "wrap",
    gap: 6,
  },
  summaryItem:  { alignItems: "center", gap: 3 },
  summaryDot:   { width: 8, height: 8, borderRadius: 4 },
  summaryLabel: { fontSize: 9 },
  summaryTime:  { fontSize: 12, fontWeight: "700" },
});
