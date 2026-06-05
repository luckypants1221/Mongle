import { Feather } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSleep } from "@/context/SleepContext";
import { useColors } from "@/hooks/useColors";

function pad2(n: number) { return String(n).padStart(2, "0"); }
function formatClock(d: Date) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function formatElapsed(s: number) {
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
}

export default function SleepScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeSession, endSleep, alarmHour, alarmMin } = useSleep();

  const [elapsed, setElapsed] = useState(0);
  const [ending, setEnding] = useState(false);
  const hasSession = useRef(false);

  useEffect(() => {
    if (activeSession) hasSession.current = true;
  }, [activeSession]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (activeSession) {
        setElapsed(Math.floor((Date.now() - activeSession.startTime.getTime()) / 1000));
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [activeSession]);

  useEffect(() => {
    if (hasSession.current && !activeSession && !ending) {
      router.replace("/(tabs)");
    }
  }, [activeSession, ending]);

  async function handleEndSleep() {
    if (ending) return;
    setEnding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await endSleep();
    router.replace("/(tabs)/records");
  }

  if (!activeSession) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const startTime = formatClock(activeSession.startTime);
  // 알람 시각 기준으로 기상 예정 계산 (시작 시각 이후 가장 가까운 알람 시각)
  const wakeDate = new Date(activeSession.startTime);
  wakeDate.setHours(alarmHour, alarmMin, 0, 0);
  if (wakeDate.getTime() <= activeSession.startTime.getTime()) {
    wakeDate.setDate(wakeDate.getDate() + 1);
  }
  const wakeTime = formatClock(wakeDate);
  const totalSleepSec = Math.max(60, Math.round((wakeDate.getTime() - activeSession.startTime.getTime()) / 1000));
  const pct = Math.min(elapsed / totalSleepSec, 1);
  const hours = Math.floor(elapsed / 3600);
  const quality = hours >= 7 ? "좋음" : hours >= 5 ? "보통" : "부족";
  const qualityColor = hours >= 7 ? colors.success : hours >= 5 ? "#FFE082" : colors.destructive;
  const topPad = Platform.OS === "web" ? 67 : insets.top + 10;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  return (
    <LinearGradient colors={["#1A1C38", "#1E203C"]} style={styles.root}>
      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="chevron-down" size={24} color="#BBDDFF" />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
          <Text style={styles.headerTitle}>수면 측정 중</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 달 + 시계 */}
        <View style={styles.clockSection}>
          <View style={[styles.moonRingOuter, { borderColor: "#BBDDFF20" }]}>
            <View style={[styles.moonRingInner, { borderColor: "#BBDDFF40" }]}>
              <View style={[styles.moonCore, { backgroundColor: colors.surface }]}>
                <Feather name="moon" size={44} color="#BBDDFF" />
              </View>
            </View>
          </View>
          <Text style={styles.elapsedLabel}>경과 시간</Text>
          <Text style={styles.elapsedTime}>{formatElapsed(elapsed)}</Text>
          <View style={[styles.qualityBadge, { backgroundColor: qualityColor + "22", borderColor: qualityColor }]}>
            <View style={[styles.qualityDot, { backgroundColor: qualityColor }]} />
            <Text style={[styles.qualityText, { color: qualityColor }]}>수면 질: {quality}</Text>
          </View>
        </View>

        {/* 수면 진행 바 */}
        <View style={[styles.progressCard, { backgroundColor: colors.card }]}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>목표 수면 진행률</Text>
            <Text style={[styles.progressPct, { color: "#FFE082" }]}>{Math.round(pct * 100)}%</Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.surface }]}>
            <LinearGradient
              colors={["#BBDDFF", "#7AAAD0"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${Math.max(Math.round(pct * 100), 4)}%` }]}
            />
          </View>
        </View>

        {/* 환경 정보 2x2 */}
        <View style={styles.infoGrid}>
          {[
            { icon: "moon" as const, label: "취침", value: startTime, color: "#BBDDFF" },
            { icon: "sun" as const, label: "기상 예정", value: wakeTime, color: "#FFE082" },
            { icon: "thermometer" as const, label: "온도", value: `${activeSession.temperature}°C`, color: "#80CBC4" },
            { icon: "droplet" as const, label: "습도", value: `${activeSession.humidity}%`, color: "#64B5F6" },
          ].map(({ icon, label, value, color }) => (
            <View key={label} style={[styles.infoCard, { backgroundColor: colors.card }]}>
              <View style={[styles.infoIcon, { backgroundColor: color + "20" }]}>
                <Feather name={icon} size={16} color={color} />
              </View>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
            </View>
          ))}
        </View>

        {/* 수면 종료 버튼 */}
        <Pressable
          style={({ pressed }) => [styles.endBtn, { opacity: pressed || ending ? 0.85 : 1 }]}
          onPress={handleEndSleep}
          disabled={ending}
        >
          <LinearGradient
            colors={["#EF5350", "#C62828"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.endBtnGrad}
          >
            {ending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="stop-circle" size={22} color="#fff" />
                <Text style={styles.endBtnText}>수면 종료</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  headerTitle: { fontSize: 16, fontWeight: "600", color: "#BBDDFF" },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 14,
  },
  clockSection: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  moonRingOuter: {
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  moonRingInner: {
    width: 148, height: 148, borderRadius: 74,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
  },
  moonCore: {
    width: 112, height: 112, borderRadius: 56,
    alignItems: "center", justifyContent: "center",
  },
  elapsedLabel: { fontSize: 12, color: "#7A8AA6", marginTop: 4 },
  elapsedTime: { fontSize: 42, fontWeight: "700", color: "#fff", letterSpacing: 2 },
  qualityBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6,
  },
  qualityDot: { width: 6, height: 6, borderRadius: 3 },
  qualityText: { fontSize: 13, fontWeight: "600" },
  progressCard: { borderRadius: 16, padding: 14, gap: 10 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { fontSize: 13 },
  progressPct: { fontSize: 14, fontWeight: "700" },
  progressBar: { height: 10, borderRadius: 5, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 5 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  infoCard: {
    flex: 1, minWidth: "45%", borderRadius: 16,
    padding: 12, alignItems: "center", gap: 5,
  },
  infoIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 11 },
  infoValue: { fontSize: 16, fontWeight: "700" },
  endBtn: { borderRadius: 18, overflow: "hidden", marginTop: 4 },
  endBtnGrad: {
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  endBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
