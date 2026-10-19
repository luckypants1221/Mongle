import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

// Backend integration supplies a percentage in the range 0–100.
// Keep null while no prediction is available; never substitute a made-up value.
export function SnoringProbabilityBadge({ probabilityPercent }: { probabilityPercent: number | null }) {
  const colors = useColors();
  const available = typeof probabilityPercent === "number" && Number.isFinite(probabilityPercent) && probabilityPercent >= 0 && probabilityPercent <= 100;
  const label = available ? `${Math.round(probabilityPercent)}%` : "--%";
  return (
    <View accessible accessibilityLabel={`코골이 확률 ${available ? label : "데이터 대기 중"}`} style={[styles.badge, { backgroundColor: colors.surface }]}>
      <Text style={[styles.value, { color: available ? colors.warning : colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>코골이 확률</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 1, minWidth: 62 },
  value: { fontSize: 20, fontWeight: "700" },
  label: { fontSize: 9 },
});
