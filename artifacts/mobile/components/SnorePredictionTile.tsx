import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { useSleep } from "@/context/SleepContext";
import { estimateSnoring, isCompleteSurvey, SNORE_QUESTIONS, validSleepScore, type SnoreAnswers } from "@/lib/snorePrediction";

export function SnorePredictionTile({ previousScore, previousDate }: { previousScore?: number; previousDate: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Partial<SnoreAnswers>>({});
  const { snoreAnswers: submitted, saveSnoreAnswers } = useSleep();
  const score = validSleepScore(previousScore);
  const prediction = submitted ? estimateSnoring(submitted, score) : null;
  const draftPrediction = estimateSnoring(answers, score);
  const completed = SNORE_QUESTIONS.filter(({ key }) => typeof answers[key] === "boolean").length;

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="코골이 예측 설문 열기"
        onPress={() => { setAnswers(submitted ?? {}); setOpen(true); }}
        style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: prediction?.color ?? colors.border, opacity: pressed ? 0.75 : 1 }]}>
        <View style={styles.tileIcon}><Feather name="activity" size={18} color={prediction?.color ?? "#BBDDFF"} /></View>
        <Text style={[styles.tileLabel, { color: colors.text }]}>코골이 예측</Text>
        <Text style={[styles.tileValue, { color: prediction?.color ?? "#BBDDFF" }]}>
          {prediction ? `${prediction.percentage}% · ${prediction.level}` : "설문하기"}
        </Text>
        {prediction && <Text style={[styles.tileNote, { color: colors.mutedForeground }]}>참고용 추정</Text>}
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="설문 닫기" />
          <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.header}>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={[styles.title, { color: colors.text }]}>오늘 밤 코골이 예측</Text>
                <Text style={[styles.caption, { color: colors.mutedForeground }]}>오늘의 습관을 알려주세요 · {completed}/4</Text>
              </View>
              <Pressable style={styles.close} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="코골이 설문 닫기">
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <View style={[styles.scoreCard, { backgroundColor: colors.card }]}>
                <Feather name="moon" size={22} color="#BBDDFF" />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.question, { color: colors.text }]}>전날 수면점수 {score === null ? "없음" : `${score}점`}</Text>
                  <Text style={[styles.caption, { color: colors.mutedForeground }]}>
                    {previousDate} · {score === null ? "기록이 없어 설문만 반영해요." : "저장된 수면 기록을 자동으로 반영해요."}
                  </Text>
                </View>
              </View>
              {SNORE_QUESTIONS.map(({ key, label, detail }, index) => (
                <View key={key} style={[styles.questionCard, { backgroundColor: colors.card }]}>
                  <Text style={[styles.question, { color: colors.text }]}>{index + 1}. {label}</Text>
                  <Text style={[styles.caption, { color: colors.mutedForeground }]}>{detail}</Text>
                  <View style={styles.answerRow}>
                    {[{ value: true, label: "네" }, { value: false, label: "아니요" }].map(({ value, label: answerLabel }) => {
                      const selected = answers[key] === value;
                      return (
                        <Pressable key={answerLabel} accessibilityRole="button" accessibilityLabel={`${label} ${answerLabel}`}
                          accessibilityState={{ selected }} onPress={() => setAnswers((current) => ({ ...current, [key]: value }))}
                          style={[styles.answer, { backgroundColor: selected ? "#BBDDFF" : colors.surface, borderColor: selected ? "#BBDDFF" : colors.border }]}>
                          <Text style={[styles.answerText, { color: selected ? "#1E203C" : colors.text }]}>{answerLabel}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
              {draftPrediction && (
                <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: draftPrediction.color }]} accessibilityLiveRegion="polite">
                  <Text style={[styles.caption, { color: colors.mutedForeground }]}>참고용 예상 코골이 가능성</Text>
                  <Text style={[styles.resultNumber, { color: draftPrediction.color }]}>{draftPrediction.percentage}% <Text style={styles.resultLevel}>{draftPrediction.level}</Text></Text>
                  <Text style={[styles.caption, { color: colors.mutedForeground }]}>
                    {draftPrediction.factors.length ? `반영한 요인: ${draftPrediction.factors.join(" · ")}` : "설문에서 주요 위험 요인이 적게 나타났어요."}
                  </Text>
                </View>
              )}
              <Text style={[styles.note, { color: colors.mutedForeground }]}>
                생활습관과 수면점수를 조합한 참고용 추정이에요. 검증된 실제 발생 확률이나 의료 진단이 아니에요.
              </Text>
            </ScrollView>
            <Pressable disabled={!isCompleteSurvey(answers)} accessibilityRole="button" accessibilityState={{ disabled: !isCompleteSurvey(answers) }}
              onPress={() => { if (isCompleteSurvey(answers)) { saveSnoreAnswers(answers); setOpen(false); } }}
              style={[styles.confirm, { opacity: isCompleteSurvey(answers) ? 1 : 0.45 }]}>
              <Text style={styles.confirmText}>{isCompleteSurvey(answers) ? "예측하기" : "4개 질문에 모두 답해주세요"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, borderRadius: 14, borderWidth: 1, alignItems: "center", paddingVertical: 10, gap: 5 },
  tileIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#BBDDFF12", alignItems: "center", justifyContent: "center" },
  tileLabel: { fontSize: 11, fontWeight: "600" },
  tileValue: { fontSize: 10, fontWeight: "600" },
  tileNote: { fontSize: 9 },
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { maxHeight: "90%", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 18, fontWeight: "700" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { gap: 12, paddingBottom: 8 },
  scoreCard: { borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  questionCard: { padding: 14, borderRadius: 16, gap: 9 },
  question: { fontSize: 14, fontWeight: "600" },
  caption: { fontSize: 12, lineHeight: 18 },
  answerRow: { flexDirection: "row", gap: 10 },
  answer: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  answerText: { fontSize: 13, fontWeight: "700" },
  resultCard: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 8 },
  resultNumber: { fontSize: 32, fontWeight: "800" },
  resultLevel: { fontSize: 14, fontWeight: "600" },
  note: { fontSize: 11, lineHeight: 18 },
  confirm: { minHeight: 50, backgroundColor: "#FFE082", borderRadius: 15, alignItems: "center", justifyContent: "center" },
  confirmText: { color: "#1E203C", fontSize: 14, fontWeight: "700" },
});
