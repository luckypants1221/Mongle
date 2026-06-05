import { Feather } from "@/components/Icon";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSleep } from "@/context/SleepContext";
import { useColors } from "@/hooks/useColors";
import { useTabBarHeight } from "@/hooks/useTabBarHeight";

const DAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function fmtDuration(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h}시간 ${m > 0 ? `${m}분` : ""}`;
}

export default function RecordsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { records, averageDuration, averageScore, getRecordByDate, updateMemo } = useSleep();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split("T")[0]);
  const [memoText, setMemoText] = useState("");
  const [editingMemo, setEditingMemo] = useState(false);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDay(viewYear, viewMonth);
  const selectedRecord = getRecordByDate(selectedDate);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  function handleSelectDate(dateStr: string) {
    setSelectedDate(dateStr);
    const rec = getRecordByDate(dateStr);
    setMemoText(rec?.memo ?? "");
    setEditingMemo(false);
  }

  async function saveMemo() {
    if (!selectedRecord) return;
    await updateMemo(selectedRecord.id, memoText);
    setEditingMemo(false);
    Alert.alert("저장", "메모가 저장되었습니다.");
  }

  function scoreColor(s: number) {
    return s >= 80 ? colors.success : s >= 60 ? "#FFE082" : colors.destructive;
  }

  const calDays: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: tabBarHeight + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 상단 요약 — 총 측정 횟수 제거 */}
        <LinearGradient colors={["#252848", "#1E203C"]} style={styles.topSection}>
          <Text style={styles.pageTitle}>수면 기록</Text>
          <Text style={styles.pageSubtitle}>나의 수면 패턴을 확인하세요</Text>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: "rgba(187,221,255,0.06)" }]}>
              <View style={[styles.statIconWrap, { backgroundColor: "#BBDDFF22" }]}>
                <Feather name="clock" size={18} color="#BBDDFF" />
              </View>
              <Text style={styles.statValue}>{fmtDuration(averageDuration)}</Text>
              <Text style={styles.statLabel}>평균 수면 시간</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: "rgba(187,221,255,0.06)" }]}>
              <View style={[styles.statIconWrap, { backgroundColor: "#FFE08222" }]}>
                <Feather name="star" size={18} color="#FFE082" />
              </View>
              <Text style={styles.statValue}>{averageScore}점</Text>
              <Text style={styles.statLabel}>평균 수면 점수</Text>
            </View>
          </View>
        </LinearGradient>

        {/* 달력 */}
        <View style={[styles.card, { backgroundColor: colors.card, marginHorizontal: 16 }]}>
          <View style={styles.calNavRow}>
            <Pressable
              onPress={() => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); }}
              style={styles.navBtn}
            >
              <Feather name="chevron-left" size={22} color={colors.text} />
            </Pressable>
            <Text style={[styles.calMonthLabel, { color: colors.text }]}>
              {viewYear}년 {viewMonth + 1}월
            </Text>
            <Pressable
              onPress={() => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); }}
              style={styles.navBtn}
            >
              <Feather name="chevron-right" size={22} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.calDayLabels}>
            {DAYS_KR.map((d) => (
              <Text key={d} style={[styles.calDayLabel, { color: colors.mutedForeground }]}>{d}</Text>
            ))}
          </View>

          <View style={styles.calGrid}>
            {calDays.map((day, i) => {
              if (!day) return <View key={`e${i}`} style={styles.calCell} />;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const rec = getRecordByDate(dateStr);
              const isSel = dateStr === selectedDate;
              const isToday = dateStr === today.toISOString().split("T")[0];
              return (
                <Pressable
                  key={dateStr}
                  style={({ pressed }) => [styles.calCell, { opacity: pressed ? 0.5 : 1 }]}
                  onPress={() => handleSelectDate(dateStr)}
                  android_ripple={{ borderless: true, color: "rgba(187,221,255,0.35)", radius: 20 }}
                >
                  <View style={[
                    styles.calDayInner,
                    isSel && { backgroundColor: "#BBDDFF" },
                    !isSel && isToday && { borderWidth: 1.5, borderColor: "#BBDDFF" },
                  ]}>
                    <Text style={[
                      styles.calDayNum,
                      { color: isSel ? "#1E203C" : isToday ? "#BBDDFF" : colors.text },
                    ]}>{day}</Text>
                  </View>
                  {rec && !isSel && (
                    <View style={[styles.calDot, { backgroundColor: scoreColor(rec.score) }]} />
                  )}
                  {rec?.memo && !isSel && (
                    <View style={[styles.memoDot, { backgroundColor: "#FFE082" }]} />
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.legend}>
            {[{ color: colors.success, label: "좋음 (80+)" }, { color: "#FFE082", label: "보통 (60+)" }, { color: colors.destructive, label: "부족 (<60)" }].map(({ color, label }) => (
              <View key={label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 선택 날짜 상세 */}
        <View style={[styles.card, { backgroundColor: colors.card, marginHorizontal: 16 }]}>
          <View style={styles.detailHeader}>
            <Feather name="calendar" size={16} color="#BBDDFF" />
            <Text style={[styles.detailDate, { color: colors.text }]}>
              {new Date(selectedDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}
            </Text>
          </View>

          {selectedRecord ? (
            <View style={styles.detailContent}>
              {/* 점수 강조 */}
              <View style={[styles.scoreHighlight, {
                backgroundColor: scoreColor(selectedRecord.score) + "15",
                borderColor: scoreColor(selectedRecord.score),
              }]}>
                <Text style={[styles.scoreHighlightNum, { color: scoreColor(selectedRecord.score) }]}>
                  {selectedRecord.score}
                </Text>
                <Text style={[styles.scoreHighlightLabel, { color: scoreColor(selectedRecord.score) }]}>수면 점수</Text>
              </View>

              <View style={styles.detailGrid}>
                {[
                  { icon: "moon" as const, label: "취침 시각", value: selectedRecord.startTime, color: "#BBDDFF" },
                  { icon: "sun" as const, label: "기상 시각", value: selectedRecord.endTime, color: "#FFE082" },
                  { icon: "clock" as const, label: "수면 시간", value: fmtDuration(selectedRecord.durationMinutes), color: "#80CBC4" },
                  { icon: "thermometer" as const, label: "온도 / 습도", value: `${selectedRecord.temperature ?? "--"}°C / ${selectedRecord.humidity ?? "--"}%`, color: colors.mutedForeground },
                ].map(({ icon, label, value, color }) => (
                  <View key={label} style={[styles.detailItem, { backgroundColor: colors.surface }]}>
                    <Feather name={icon} size={16} color={color} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailItemLabel, { color: colors.mutedForeground }]}>{label}</Text>
                      <Text style={[styles.detailItemValue, { color: colors.text }]}>{value}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* 메모 */}
              <View style={[styles.memoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.memoHeader}>
                  <Feather name="edit-3" size={14} color="#FFE082" />
                  <Text style={[styles.memoTitle, { color: colors.text }]}>수면 메모</Text>
                  <Pressable
                    onPress={() => {
                      if (editingMemo) {
                        saveMemo();
                      } else {
                        setEditingMemo(true);
                      }
                    }}
                    style={[styles.memoActionBtn, { backgroundColor: editingMemo ? "#FFE082" : colors.muted }]}
                  >
                    <Text style={[styles.memoActionText, { color: editingMemo ? "#1E203C" : colors.mutedForeground }]}>
                      {editingMemo ? "저장" : "편집"}
                    </Text>
                  </Pressable>
                </View>
                {editingMemo ? (
                  <TextInput
                    style={[styles.memoInput, { color: colors.text, borderColor: colors.border }]}
                    value={memoText}
                    onChangeText={setMemoText}
                    placeholder="오늘 수면에 대한 메모를 남겨보세요"
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    autoFocus
                  />
                ) : (
                  <Text style={[styles.memoContent, {
                    color: selectedRecord.memo ? colors.text : colors.mutedForeground,
                    fontStyle: selectedRecord.memo ? "normal" : "italic",
                  }]}>
                    {selectedRecord.memo || "메모가 없습니다. 편집 버튼을 눌러 추가하세요."}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.emptyDetail}>
              <Feather name="moon" size={36} color={colors.muted} />
              <Text style={[styles.emptyDetailText, { color: colors.mutedForeground }]}>
                이 날의 수면 기록이 없습니다
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>수면을 측정하면 기록이 남습니다</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 12 },
  topSection: { paddingHorizontal: 20, paddingBottom: 24, gap: 6 },
  pageTitle: { fontSize: 26, fontWeight: "700", color: "#BBDDFF", paddingTop: 16 },
  pageSubtitle: { fontSize: 13, color: "#7A8AA6", marginBottom: 16 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderRadius: 16, padding: 12, gap: 6, alignItems: "center" },
  statIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 15, fontWeight: "700", color: "#fff", textAlign: "center" },
  statLabel: { fontSize: 10, color: "#7A8AA6", textAlign: "center" },
  card: { borderRadius: 20, padding: 16, gap: 14 },
  calNavRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  calMonthLabel: { fontSize: 16, fontWeight: "700" },
  calDayLabels: { flexDirection: "row" },
  calDayLabel: { width: "14.28%", textAlign: "center", fontSize: 11, fontWeight: "600", paddingVertical: 4 },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  calDayInner: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  calDayNum: { fontSize: 13, fontWeight: "500" },
  calDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
  memoDot: { width: 3, height: 3, borderRadius: 1.5 },
  legend: { flexDirection: "row", justifyContent: "center", gap: 14, paddingTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendLabel: { fontSize: 11 },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailDate: { fontSize: 15, fontWeight: "600" },
  detailContent: { gap: 12 },
  scoreHighlight: { alignItems: "center", borderRadius: 16, borderWidth: 1, paddingVertical: 14, gap: 4 },
  scoreHighlightNum: { fontSize: 40, fontWeight: "700" },
  scoreHighlightLabel: { fontSize: 13, fontWeight: "600" },
  detailGrid: { gap: 8 },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 12 },
  detailItemLabel: { fontSize: 11, marginBottom: 2 },
  detailItemValue: { fontSize: 15, fontWeight: "600" },
  memoBox: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  memoHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  memoTitle: { fontSize: 14, fontWeight: "600", flex: 1 },
  memoActionBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  memoActionText: { fontSize: 12, fontWeight: "700" },
  memoInput: {
    minHeight: 80, fontSize: 14, lineHeight: 20,
    borderWidth: 1, borderRadius: 10, padding: 10, textAlignVertical: "top",
  },
  memoContent: { fontSize: 14, lineHeight: 20, minHeight: 50 },
  emptyDetail: { alignItems: "center", gap: 8, paddingVertical: 28 },
  emptyDetailText: { fontSize: 14 },
});
