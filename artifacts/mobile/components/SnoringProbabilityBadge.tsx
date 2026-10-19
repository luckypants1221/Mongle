import React from "react";
import { StyleSheet, Text, Pressable } from "react-native";
import { useColors } from "@/hooks/useColors";

// Backend integration supplies a percentage in the range 0–100.
// Keep null while no prediction is available; never substitute a made-up value.
export function SnoringProbabilityBadge({ probabilityPercent, loading = false, trainingDataMissing = false, error = false, onRetry }: { probabilityPercent: number | null; loading?: boolean; trainingDataMissing?: boolean; error?: boolean; onRetry?: () => void }) {
  const colors = useColors();
  const available = typeof probabilityPercent === "number" && Number.isFinite(probabilityPercent) && probabilityPercent >= 0 && probabilityPercent <= 100;
  const label = loading ? "조회 중" : trainingDataMissing ? "데이터 부족" : error ? "재시도" : available ? `${Math.round(probabilityPercent)}%` : "--%";
  return (
    <Pressable onPress={error ? onRetry : undefined} accessibilityRole={error ? "button" : undefined} accessible accessibilityLabel={`코골이 확률 ${loading ? "조회 중" : trainingDataMissing ? "예측 모델의 학습 데이터가 부족합니다" : error ? "조회 실패, 눌러서 재시도" : available ? label : "데이터 대기 중"}`} style={[styles.badge, { backgroundColor: colors.surface }]}>
      <Text style={[styles.value, trainingDataMissing && { fontSize: 13 }, { color: available ? colors.warning : colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>코골이 확률</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 1, minWidth: 62 },
  value: { fontSize: 20, fontWeight: "700" },
  label: { fontSize: 9 },
});
