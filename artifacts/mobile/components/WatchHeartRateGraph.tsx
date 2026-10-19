import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import type { HealthData } from "@/lib/safeHealth";

export function WatchHeartRateGraph({ data }: { data: HealthData | null }) {
  const colors = useColors();
  const hourly = (data?.hourly ?? []).filter(h => Number.isFinite(h.heartbeat) && h.sampleCount > 0).sort((a, b) => a.hourStartMs - b.hourStartMs);
  if (!data || !hourly.length) return <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 12 }}>심박수 기록 없음 · 워치 동기화와 심박수 읽기 권한을 확인해 주세요.</Text>;
  const total = hourly.reduce((sum, h) => sum + h.sampleCount, 0);
  const average = Math.round(hourly.reduce((sum, h) => sum + h.heartbeat * h.sampleCount, 0) / total);
  const min = Math.min(...hourly.map(h => h.hrMin));
  const max = Math.max(...hourly.map(h => h.hrMax));
  const low = Math.min(...hourly.map(h => h.heartbeat)) - 5;
  const high = Math.max(...hourly.map(h => h.heartbeat)) + 5;
  const points = hourly.map(h => ({
    t: h.hourStartMs,
    x: 8 + Math.max(0, Math.min(1, (h.hourStartMs - data.startMs) / (data.endMs - data.startMs))) * 284,
    y: 85 - (h.heartbeat - low) / (high - low) * 70,
  }));
  const groups: typeof points[] = [];
  for (const point of points) {
    const last = groups[groups.length - 1];
    if (!last || point.t - last[last.length - 1].t > 3_600_000) groups.push([point]);
    else last.push(point);
  }
  const time = (ms: number) => new Date(ms).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return <View style={{ marginTop: 16, gap: 8 }}>
    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>워치 심박수 · 시간대별 평균</Text>
    <Text style={{ color: "#FF8A9A", fontSize: 12 }}>평균 {average} bpm · 최저 {min} · 최고 {max}</Text>
    <Svg width="100%" height={105} viewBox="0 0 300 100">
      <Line x1={8} x2={292} y1={85} y2={85} stroke={colors.border} />
      {groups.map((group, i) => <Polyline key={i} points={group.map(p => `${p.x},${p.y}`).join(" ")} stroke="#FF8A9A" strokeWidth={2} fill="none" />)}
      {points.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={3} fill="#FF8A9A" />)}
    </Svg>
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{time(data.startMs)}</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{time(data.endMs)}</Text>
    </View>
    <Text style={{ color: colors.mutedForeground, fontSize: 11, lineHeight: 17 }}>삼성 헬스에 동기화된 측정값 {total}개 기준 · 심박수로 수면 단계를 추정하지 않습니다.</Text>
  </View>;
}
