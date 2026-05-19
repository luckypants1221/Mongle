import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { SleepRecord } from "@/context/SleepContext";

interface Props {
  records: SleepRecord[];
}

const DAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];

export function SleepGraph({ records }: Props) {
  const colors = useColors();
  const width = Dimensions.get("window").width - 64;
  const height = 100;

  const last7 = [...records].slice(-7);
  const maxDur = Math.max(...last7.map((r) => r.durationMinutes), 480);
  const points = last7.map((r, i) => {
    const x = (i / Math.max(last7.length - 1, 1)) * (width - 20) + 10;
    const y = height - (r.durationMinutes / maxDur) * (height - 20) - 10;
    return { x, y, record: r };
  });

  function getDayLabel(dateStr: string) {
    const d = new Date(dateStr);
    return DAYS_KR[d.getDay()];
  }

  if (last7.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>수면 데이터가 없습니다</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={{ height, width }}>
        {points.map((p, i) => {
          if (i === 0) return null;
          const prev = points[i - 1];
          const dx = p.x - prev.x;
          const dy = p.y - prev.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          return (
            <View
              key={i}
              style={{
                position: "absolute",
                left: prev.x,
                top: prev.y,
                width: length,
                height: 2,
                backgroundColor: colors.primary,
                opacity: 0.8,
                transform: [{ rotate: `${angle}deg` }, { translateY: -1 }],
                transformOrigin: "left center",
              }}
            />
          );
        })}
        {points.map((p, i) => (
          <View
            key={`dot_${i}`}
            style={{
              position: "absolute",
              left: p.x - 5,
              top: p.y - 5,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: colors.primary,
              borderWidth: 2,
              borderColor: colors.highlight,
            }}
          />
        ))}
      </View>
      <View style={styles.labels}>
        {last7.map((r, i) => (
          <Text key={i} style={[styles.label, { color: colors.mutedForeground }]}>
            {getDayLabel(r.date)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 11,
    textAlign: "center",
  },
});
