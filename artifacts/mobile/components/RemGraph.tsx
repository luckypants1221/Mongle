import React, { useMemo } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { SleepRecord } from "@/context/SleepContext";
import type { ActualSleepStage } from "../lib/healthTypes";

interface Props {
  records: SleepRecord[];
  compact?: boolean;
  stages?: ActualSleepStage[];
}

type Stage = "awake" | "light" | "rem" | "deep";

const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "awake", label: "깨어있음", color: "#FFB74D" },
  { key: "light", label: "얕은 수면", color: "#64B5F6" },
  { key: "rem", label: "렘수면", color: "#CE93D8" },
  { key: "deep", label: "깊은 수면", color: "#4DB6AC" },
];

const STAGE_ROW: Record<Stage, number> = {
  awake: 0,
  light: 1,
  rem: 2,
  deep: 3,
};



function fmtTime(startHour: number, startMin: number, addMin: number) {
  const total = startHour * 60 + startMin + addMin;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}


export function RemGraph({ records, compact, stages }: Props) {
  const colors = useColors();
  const screenW = Dimensions.get("window").width;
  const chartW = screenW - 96;
  const ROW_H = compact ? 20 : 26;
  const ROWS = 4;
  const chartH = ROW_H * ROWS;

  const latest = [...records].filter((r) => r.durationMinutes > 0).at(-1);

  const { blocks, summary, endLabel, xTicks, hasData } = useMemo(() => {
    if (!latest) return { blocks: [], summary: null, endLabel: "", xTicks: [], hasData: false };

    const dur = latest.durationMinutes;

    const bedH = latest.startTime
      ? parseInt(latest.startTime.split(":")[0], 10)
      : 22;
    const bedM = latest.startTime
      ? parseInt(latest.startTime.split(":")[1], 10)
      : 0;

    const end = fmtTime(bedH, bedM, dur);

    const ticks = Array.from({ length: 5 }, (_, i) => ({
      label: fmtTime(bedH, bedM, Math.round((i / 4) * dur)),
      pct: i / 4,
    }));
    if (!stages || stages.length === 0) {
      return { blocks: [], summary: null, endLabel: end, xTicks: ticks, hasData: false };
    }

    const rangeStart = Date.parse(stages[0].startTime);
    const rangeEnd = Date.parse(stages[stages.length - 1].endTime);
    const totalMs = Math.max(rangeEnd - rangeStart, 1);

    // ★ 고정 5분 세그먼트 대신, 실제 구간 길이 비율로 블록 계산
    const blockList = stages.map((s) => {
      const sMs = Date.parse(s.startTime);
      const eMs = Date.parse(s.endTime);
      return {
        startPct: (sMs - rangeStart) / totalMs,
        widthPct: Math.max((eMs - sMs) / totalMs, 0.001),
        stage: s.stage,
      };
    });

    const sumMin: Record<Stage, number> = { awake: 0, light: 0, rem: 0, deep: 0 };
    stages.forEach((s) => {
      sumMin[s.stage] += (Date.parse(s.endTime) - Date.parse(s.startTime)) / 60000;
    });
    const sum = {
      awake: Math.round(sumMin.awake),
      light: Math.round(sumMin.light),
      rem: Math.round(sumMin.rem),
      deep: Math.round(sumMin.deep),
    };

    return { blocks: blockList, summary: sum, endLabel: end, xTicks: ticks, hasData: true };
  }, [latest, stages]);

  if (!latest) {
    return (
      <View style={[styles.empty, { height: chartH + 60 }]}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center" }}>
          수면 기록이 있으면 분석이 표시됩니다
        </Text>
      </View>
    );
  }
  if (!hasData) {
    return (
      <View style={[styles.empty, { height: chartH + 60 }]}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center" }}>
          워치 수면 데이터를 불러오지 못했습니다{"\n"}Health Connect 연동 상태를 확인해주세요
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
            {/* ★ 변경: 균등 분할 segments.map 대신 실제 비율 blocks.map */}
            {blocks.map((b, i) => {
              const row = STAGE_ROW[b.stage];
              const cfg = STAGES.find((s) => s.key === b.stage)!;
              return (
                <View
                  key={i}
                  style={{
                    position: "absolute",
                    left: b.startPct * chartW,
                    top: row * ROW_H + 2,
                    width: Math.max(b.widthPct * chartW - 0.5, 1),
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
  wrap: { gap: 8 },
  empty: { alignItems: "center", justifyContent: "center" },
  legend: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 10 },
  chartRow: { flexDirection: "row", alignItems: "flex-start" },
  xLabel: { position: "absolute", fontSize: 9, width: 36, textAlign: "center" },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    flexWrap: "wrap",
    gap: 6,
  },
  summaryItem: { alignItems: "center", gap: 3 },
  summaryDot: { width: 8, height: 8, borderRadius: 4 },
  summaryLabel: { fontSize: 9 },
  summaryTime: { fontSize: 12, fontWeight: "700" },
});
