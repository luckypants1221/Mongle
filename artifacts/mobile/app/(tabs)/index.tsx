import { Feather } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useSleep } from "@/context/SleepContext";
import { useColors } from "@/hooks/useColors";
import { useTabBarHeight } from "@/hooks/useTabBarHeight";
import { RemGraph } from "@/components/RemGraph";
import { EnvModal, EnvType } from "@/components/EnvModal";

const DAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];

function fmtDuration(min: number) {
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - day + i);
    return d;
  });
}

const ENV_BTNS: { key: EnvType; icon: React.ComponentProps<typeof Feather>["name"]; label: string }[] = [
  { key: "music", icon: "music", label: "음악" },
  { key: "humidity", icon: "droplet", label: "습도" },
  { key: "lighting", icon: "sun", label: "조명" },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { user } = useAuth();
  const { weeklyRecords, getRecordByDate, activeSession, startSleep, monthlyAverageDuration, monthlyAverageScore } = useSleep();

  const [envOpen, setEnvOpen] = useState<EnvType>(null);
  const [music, setMusic] = useState("none");
  const [humidity, setHumidity] = useState(55);
  const [lighting, setLighting] = useState("off");

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const weekDates = getWeekDates();
  const topPad = Platform.OS === "web" ? 56 : insets.top;
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const selectedRecord =
    getRecordByDate(selectedDate);

  const lastRecord = selectedRecord;


  const scoreColor =
    !lastRecord ? colors.mutedForeground
      : lastRecord.score >= 80 ? "#4CAF50"
        : lastRecord.score >= 60 ? "#FFE082"
          : "#EF5350";

  function handleStartSleep() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!activeSession) startSleep();
    router.push("/sleep");
  }

  function envLabel(key: EnvType) {
    if (key === "music") {
      const m: Record<string, string> = { none: "없음", nature: "자연음", rain: "빗소리", white: "백색소음" };
      return m[music] ?? music;
    }
    if (key === "humidity") return `${humidity}%`;
    if (key === "lighting") {
      const l: Record<string, string> = { off: "끄기", low: "낮음", mid: "중간", high: "높음" };
      return l[lighting] ?? lighting;
    }
    return "";
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ── 상단 헤더 그라디언트 ── */}
      <LinearGradient colors={["#252848", "#1E203C"]} style={[styles.header, { paddingTop: topPad }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Image source={require("@/assets/images/logo_nobg.png")} style={styles.headerLogo} resizeMode="contain" />
            <View>
              <Text style={styles.greetSmall}>안녕하세요,</Text>
              <Text style={styles.greetName}>{user?.name ?? "사용자"}님</Text>
            </View>
          </View>
          <View style={[styles.scoreBadge, { backgroundColor: colors.surface }]}>
            <Text style={[styles.scoreNum, { color: scoreColor }]}>{lastRecord?.score ?? "--"}</Text>
            <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>수면점수</Text>
          </View>
        </View>

        {/* 주간 달력 */}
        <View style={styles.weekRow}>
          {weekDates.map((d, i) => {
            const str = d.toISOString().split("T")[0];
            const rec = getRecordByDate(str);
            const isToday = str === todayStr;
            const isSelected = str === selectedDate;
            return (
              <Pressable
                key={i}
                style={styles.dayCol}
                onPress={() => setSelectedDate(str)}
              >
                <Text
                  style={[
                    styles.dayLabel,
                    {
                      color: isSelected
                        ? "#BBDDFF"
                        : "#7A8AA6",
                    },
                  ]}
                >
                  {DAYS_KR[d.getDay()]}
                </Text>
                <View
                  style={[
                    styles.dayCircle,
                    isSelected
                      ? { backgroundColor: "#BBDDFF" }
                      : rec
                        ? {
                          backgroundColor: "rgba(187,221,255,0.12)",
                          borderColor: "#BBDDFF50",
                          borderWidth: 1,
                        }
                        : {
                          borderColor: "#353860",
                          borderWidth: 1,
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      {
                        color:
                          isSelected
                            ? "#1E203C"
                            : rec
                              ? "#BBDDFF"
                              : "#7A8AA6"
                      }
                    ]}
                  >
                    {d.getDate()}
                  </Text>
                </View>
                {rec && (
                  <View style={[styles.scoreDot, {
                    backgroundColor: rec.score >= 80 ? "#4CAF50" : rec.score >= 60 ? "#FFE082" : "#EF5350",
                  }]} />
                )}
              </Pressable>
            );
          })}
        </View>
      </LinearGradient>

      {/* ── 바디 — flex로 남은 공간 채움 ── */}
      <View style={[styles.body, { paddingBottom: tabBarHeight + 8 }]}>

        {/* 지난 수면 요약 */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardTitleRow}>
            <Feather name="moon" size={13} color="#BBDDFF" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>지난 수면</Text>
          </View>
          {lastRecord ? (
            <View style={styles.sleepRow}>
              <View style={styles.sleepItem}>
                <Text style={[styles.sleepLbl, { color: colors.mutedForeground }]}>취침</Text>
                <Text style={[styles.sleepVal, { color: colors.text }]}>{lastRecord.startTime}</Text>
              </View>
              <Feather name="arrow-right" size={12} color={colors.muted} />
              <View style={styles.sleepItem}>
                <Text style={[styles.sleepLbl, { color: colors.mutedForeground }]}>기상</Text>
                <Text style={[styles.sleepVal, { color: colors.text }]}>{lastRecord.endTime}</Text>
              </View>
              <View style={[styles.sleepDivider, { backgroundColor: colors.border }]} />
              <View style={styles.sleepItem}>
                <Text style={[styles.sleepLbl, { color: colors.mutedForeground }]}>수면 시간</Text>
                <Text style={[styles.sleepVal, { color: "#FFE082" }]}>{fmtDuration(lastRecord.durationMinutes)}</Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>아직 수면 기록이 없습니다</Text>
          )}
        </View>

        {/* 수면 환경 — 3개 버튼 */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardTitleRow}>
            <Feather name="sliders" size={13} color="#BBDDFF" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>수면 환경</Text>
          </View>
          <View style={styles.envRow}>
            {ENV_BTNS.map(({ key, icon, label }) => (
              <Pressable
                key={key}
                style={({ pressed }) => [
                  styles.envBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setEnvOpen(key);
                }}
              >
                <View style={[styles.envIconWrap, { backgroundColor: "#BBDDFF12" }]}>
                  <Feather name={icon} size={18} color="#BBDDFF" />
                </View>
                <Text style={[styles.envBtnLabel, { color: colors.text }]}>{label}</Text>
                <Text style={[styles.envBtnValue, { color: "#BBDDFF" }]}>{envLabel(key)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 렘수면 선 그래프 */}
        <View style={[styles.card, { backgroundColor: colors.card, flex: 1 }]}>
          <View style={styles.cardTitleRow}>
            <Feather name="activity" size={13} color="#7C6AFA" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>렘수면 분석</Text>
          </View>
          {weeklyRecords.length >= 2 ? (
            <RemGraph records={weeklyRecords} compact />
          ) : (
            <View style={styles.emptyGraph}>
              <Feather name="bar-chart-2" size={24} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                수면 기록 2개 이상이면 표시됩니다
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── 수면 시작 버튼 (고정) ── */}
      <View style={[styles.startWrap, { bottom: tabBarHeight, backgroundColor: colors.background }]}>
        <Pressable
          style={({ pressed }) => [styles.startBtn, { opacity: pressed ? 0.88 : 1 }]}
          onPress={handleStartSleep}
        >
          <LinearGradient
            colors={activeSession ? ["#2E3256", "#2E3256"] : ["#FFE082", "#FFD040"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startGrad}
          >
            <Feather
              name={activeSession ? "activity" : "moon"}
              size={20}
              color={activeSession ? "#BBDDFF" : "#1E203C"}
            />
            <Text style={[styles.startText, { color: activeSession ? "#BBDDFF" : "#1E203C" }]}>
              {activeSession ? "수면 측정 중 — 탭하여 보기" : "수면 시작하기"}
            </Text>
            <Feather name="chevron-right" size={16} color={activeSession ? "#BBDDFF60" : "#1E203C60"} />
          </LinearGradient>
        </Pressable>
      </View>

      {/* ── 환경 설정 팝업 ── */}
      <EnvModal
        visible={envOpen}
        onClose={() => setEnvOpen(null)}
        env={{
          music, humidity, lighting,
          setMusic, setHumidity, setLighting,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  /* 헤더 */
  header: { paddingHorizontal: 18, paddingBottom: 14, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerLogo: { width: 40, height: 40 },
  greetSmall: { fontSize: 11, color: "#7A8AA6" },
  greetName: { fontSize: 17, fontWeight: "700", color: "#fff" },
  scoreBadge: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 1 },
  scoreNum: { fontSize: 20, fontWeight: "700" },
  scoreLabel: { fontSize: 9 },

  /* 주간 달력 */
  weekRow: { flexDirection: "row", justifyContent: "space-between" },
  dayCol: { alignItems: "center", gap: 3 },
  dayLabel: { fontSize: 10, fontWeight: "600" },
  dayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  dayNum: { fontSize: 12, fontWeight: "600" },
  scoreDot: { width: 4, height: 4, borderRadius: 2 },

  /* 바디 */
  body: { flex: 1, paddingHorizontal: 14, paddingTop: 10, gap: 10 },

  /* 공통 카드 */
  card: { borderRadius: 18, padding: 13, gap: 10 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { fontSize: 13, fontWeight: "600" },

  /* 수면 요약 */
  sleepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  sleepItem: { alignItems: "center", gap: 3 },
  sleepLbl: { fontSize: 10 },
  sleepVal: { fontSize: 15, fontWeight: "700" },
  sleepDivider: { width: 1, height: 30, marginHorizontal: 4 },

  /* 환경 버튼 */
  envRow: { flexDirection: "row", gap: 8 },
  envBtn: {
    flex: 1, borderRadius: 14, borderWidth: 1,
    alignItems: "center", paddingVertical: 10, gap: 5,
  },
  envIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  envBtnLabel: { fontSize: 11, fontWeight: "600" },
  envBtnValue: { fontSize: 10 },

  /* 그래프 */
  emptyGraph: { alignItems: "center", justifyContent: "center", flex: 1, gap: 6 },
  emptyText: { fontSize: 12, textAlign: "center" },

  /* 시작 버튼 */
  startWrap: { position: "absolute", left: 0, right: 0, paddingHorizontal: 14, paddingVertical: 8 },
  startBtn: { borderRadius: 18, overflow: "hidden" },
  startGrad: {
    paddingVertical: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  startText: { fontSize: 15, fontWeight: "800", flex: 1, textAlign: "center" },
});
